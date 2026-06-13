package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/tiredbooy/internal/bootstrap"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	app, err := bootstrap.New()
	if err != nil {
		log.Fatalf("Failed to initlize app: %v", err)
	}

	if err := app.Start(ctx); err != nil {
		log.Fatalf("app exited with error: %v", err)
	}
}
