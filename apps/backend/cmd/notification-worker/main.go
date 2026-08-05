// Command notification-worker relays the notification outbox to Kafka and/or
// consumes Kafka topics to deliver SMS/email via pkg/sms and pkg/notify.
//
//	NOTIFICATION_WORKER_MODE=all          — outbox relay + Kafka consumer (default when brokers set)
//	NOTIFICATION_WORKER_MODE=relay        — outbox → Kafka only
//	NOTIFICATION_WORKER_MODE=consume      — Kafka → providers only
//	NOTIFICATION_WORKER_MODE=log          — idle heartbeat (no brokers required)
//
// Architecture: docs/architecture/notifications-kafka.md
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"

	config "github.com/tiredbooy/configs"
	"github.com/tiredbooy/internal/logger"
	"github.com/tiredbooy/internal/notifications"
	notifkafka "github.com/tiredbooy/internal/notifications/kafka"
	notifpg "github.com/tiredbooy/internal/notifications/postgres"
	"github.com/tiredbooy/pkg/database"
	"github.com/tiredbooy/pkg/notify"
	"github.com/tiredbooy/pkg/sms"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("notification-worker: config: %v", err)
	}
	zlog, err := logger.New(cfg.Env, "logs")
	if err != nil {
		zlog = zap.NewNop()
	}
	defer func() { _ = zlog.Sync() }()

	mode := strings.ToLower(strings.TrimSpace(os.Getenv("NOTIFICATION_WORKER_MODE")))
	brokers := cfg.KafkaBrokers
	if len(brokers) == 0 {
		if raw := os.Getenv("KAFKA_BROKERS"); raw != "" {
			for _, b := range strings.Split(raw, ",") {
				b = strings.TrimSpace(b)
				if b != "" {
					brokers = append(brokers, b)
				}
			}
		}
	}
	if mode == "" {
		if len(brokers) > 0 {
			mode = "all"
		} else {
			mode = "log"
		}
	}

	mailer := notify.New(cfg, zlog)
	sender := sms.New(cfg, zlog)
	group := cfg.NotificationWorkerGroup
	if group == "" {
		group = "rumera-notification-worker"
	}

	zlog.Info("notification-worker starting",
		zap.String("mode", mode),
		zap.Strings("brokers", brokers),
		zap.String("group", group),
	)

	switch mode {
	case "log":
		runLogMode(ctx, zlog)
	case "relay", "consume", "all":
		if len(brokers) == 0 {
			log.Fatal("notification-worker: KAFKA_BROKERS required for mode " + mode)
		}
		pool, err := database.NewDB(cfg, zlog)
		if err != nil {
			log.Fatalf("notification-worker: db: %v", err)
		}
		defer pool.Close()
		store := notifpg.NewStore(pool)
		pub := notifkafka.NewPublisher(brokers)
		defer pub.Close()

		handler := &notifications.DeliveryHandler{
			Deliveries:  store,
			SMS:         sender,
			Mail:        mailer,
			MaxAttempts: 8,
		}

		g, gctx := errgroup.WithContext(ctx)

		if mode == "relay" || mode == "all" {
			relay := &notifications.Relay{Outbox: store, Publisher: pub, BatchSize: 50}
			g.Go(func() error {
				return runRelay(gctx, zlog, relay)
			})
		}
		if mode == "consume" || mode == "all" {
			consumer := notifkafka.NewConsumer(brokers, group, []string{
				notifications.TopicOTP,
				notifications.TopicEmail,
			})
			consumer.Handler = handler
			consumer.Log = zlog
			consumer.DLQ = pub
			g.Go(func() error {
				zlog.Info("kafka consumer running")
				return consumer.Run(gctx)
			})
		}

		if err := g.Wait(); err != nil && gctx.Err() == nil {
			log.Fatalf("notification-worker: %v", err)
		}
		zlog.Info("notification-worker stopped")
	default:
		log.Fatalf("notification-worker: unknown mode %q", mode)
	}
}

func runLogMode(ctx context.Context, zlog *zap.Logger) {
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	zlog.Info("log mode — set KAFKA_BROKERS and NOTIFICATION_WORKER_MODE=all for delivery")
	for {
		select {
		case <-ctx.Done():
			zlog.Info("notification-worker shutting down")
			return
		case <-t.C:
			zlog.Info("notification-worker heartbeat", zap.String("mode", "log"))
		}
	}
}

func runRelay(ctx context.Context, zlog *zap.Logger, relay *notifications.Relay) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	zlog.Info("outbox relay running")
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			n, err := relay.RunOnce(ctx)
			if err != nil {
				zlog.Warn("outbox relay error", zap.Error(err))
				continue
			}
			if n > 0 {
				zlog.Info("outbox relay published", zap.Int("count", n))
			}
		}
	}
}
