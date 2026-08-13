// Command seed inserts realistic, on-brand Persian test data into the main
// database so the storefront (hero, categories, brands, products, recipes,
// journal) renders like a real luxury wine & spirits cellar in development.
//
// It is fully IDEMPOTENT: every entity is looked up by its natural key
// (slug / code / title) before insertion and skipped if it already exists, so
// re-running is always safe. Run it once the dev stack is up (migrations have
// applied) with:  make seed   (or)   go run ./cmd/seed
//
// Layout (same package main, split by responsibility):
//
//	main.go       — process entrypoint
//	seeder.go     — wiring + ordered orchestration
//	helpers.go    — counts, pointers, idempotency lookups, parsePrice
//	brands.go, categories.go, tags.go, products.go, recipes.go, blogs.go, hero.go
//	              — domain seeders + fixtures
package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/logger"
	"github.com/tiredbooy/pkg/database"
	"go.uber.org/zap"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("seed: config: %v", err)
	}

	zlog, err := logger.New(cfg.Env, "logs")
	if err != nil {
		// Logging is non-fatal for a one-shot tool — fall back to a no-op logger.
		zlog = zap.NewNop()
	}
	defer func() { _ = zlog.Sync() }()

	// Mirror cmd/api's pool construction, but only the MAIN database — seed never
	// touches analytics. Migrations are owned by the API boot, so we just connect.
	pool, err := database.NewDB(cfg, zlog)
	if err != nil {
		log.Fatalf("seed: connect main db: %v", err)
	}
	defer pool.Close()

	s := newSeeder(pool, zlog)
	if err := s.run(ctx); err != nil {
		log.Fatalf("seed: %v", err)
	}

	zlog.Info("seed complete",
		zap.Any("created", s.c.created),
		zap.Any("skipped", s.c.skipped),
	)
}
