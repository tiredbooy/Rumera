// Command event-worker runs the domain-event consumers in their own process:
// the outbox fan-out and consume loops, plus — on EVENTS_BUS=kafka — the relay
// and the supervised ingest consumer. No HTTP server, no cron, no admin seeding.
//
// Deploy it alongside API replicas running EVENTS_WORKER=external, which then
// only emit facts. EVENTS_ENABLED=false is refused rather than idled: in that
// mode the producers run the legacy in-request side effects and there is nothing
// to consume.
//
// Architecture: docs/architecture/money-and-stock-sagas.md
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

	worker, err := bootstrap.NewEventWorker()
	if err != nil {
		log.Fatalf("event-worker: %v", err)
	}
	if err := worker.Run(ctx); err != nil {
		log.Fatalf("event-worker: %v", err)
	}
}
