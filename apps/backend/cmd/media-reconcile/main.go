package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/database"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

func main() {
	apply := flag.Bool("apply", false, "delete confirmed orphan originals (default is dry-run)")
	minimumAge := flag.Duration("min-age", 24*time.Hour, "minimum object age eligible for deletion")
	cutoffValue := flag.String("cutoff", "", "fixed RFC3339 cutoff copied from a reviewed dry-run report")
	flag.Parse()
	if *minimumAge < 0 {
		fmt.Fprintln(os.Stderr, "--min-age cannot be negative")
		os.Exit(2)
	}
	var cutoff time.Time
	if *cutoffValue != "" {
		parsed, err := time.Parse(time.RFC3339, *cutoffValue)
		if err != nil {
			fmt.Fprintf(os.Stderr, "--cutoff must be RFC3339: %v\n", err)
			os.Exit(2)
		}
		cutoff = parsed
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "load config: %v\n", err)
		os.Exit(1)
	}
	log, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "create logger: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = log.Sync() }()

	db, err := database.NewDB(cfg, log)
	if err != nil {
		log.Fatal("connect database", zap.Error(err))
	}
	defer db.Close()
	mediaStore, err := storage.NewLocalStorage(cfg.MediaRoot)
	if err != nil {
		log.Fatal("open media storage", zap.Error(err))
	}
	mediaCache, err := storage.NewLocalStorage(cfg.MediaCacheDir)
	if err != nil {
		log.Fatal("open media cache", zap.Error(err))
	}

	lifecycle := services.NewMediaLifecycleService(
		mediaStore,
		mediaCache,
		repositories.NewMediaLifecycleRepository(db),
		log,
	)
	report, reconcileErr := lifecycle.Reconcile(ctx, services.MediaReconcileOptions{
		Apply:      *apply,
		MinimumAge: *minimumAge,
		Cutoff:     cutoff,
	})
	if err := json.NewEncoder(os.Stdout).Encode(report); err != nil {
		log.Error("encode reconciliation report", zap.Error(err))
		os.Exit(1)
	}
	if reconcileErr != nil {
		log.Error("media reconciliation failed", zap.Error(reconcileErr))
		os.Exit(1)
	}
}
