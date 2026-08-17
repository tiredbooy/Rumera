package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/tiredbooy/internal/notifications"
	"github.com/tiredbooy/pkg/metrics"
	"go.uber.org/zap"
)

// MessageHandler processes one Kafka payload. done=true means commit offset.
type MessageHandler interface {
	Handle(ctx context.Context, topic string, raw []byte) (done bool, err error)
}

// Consumer reads topics in a consumer group and hands messages to the handler.
type Consumer struct {
	Readers []*kafkago.Reader
	Handler MessageHandler
	Log     *zap.Logger
	// MaxAttempts before producing to DLQ (uses envelope attempt if present).
	MaxAttempts int
	// DLQ publishes permanent failures (optional).
	DLQ notifications.Publisher
}

// NewConsumer creates one reader per topic.
func NewConsumer(brokers []string, group string, topics []string, auth Auth) *Consumer {
	clean := cleanBrokers(brokers)
	// nil for the zero Auth, which is what ReaderConfig already defaults to
	// (DefaultDialer) — the unauthenticated path is untouched.
	dialer := auth.dialer()
	var readers []*kafkago.Reader
	for _, topic := range topics {
		readers = append(readers, kafkago.NewReader(kafkago.ReaderConfig{
			Brokers:        clean,
			GroupID:        group,
			Topic:          topic,
			MinBytes:       1,
			MaxBytes:       10e6,
			CommitInterval: time.Second,
			StartOffset:    kafkago.FirstOffset,
			Dialer:         dialer,
		}))
	}
	return &Consumer{Readers: readers, MaxAttempts: 8}
}

// Run blocks until ctx is cancelled, consuming all readers concurrently.
//
// A fatal error on ANY reader tears down the rest. Without that, one dead reader
// leaves its topic silently unconsumed while the others keep the process looking
// healthy, and Run itself would block until every sibling returned — so the error
// could not reach the caller that is supposed to act on it. Returning promptly is
// what lets the supervisor restart ingest (K-5).
func (c *Consumer) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	go c.reportLag(runCtx)
	errCh := make(chan error, len(c.Readers))
	for _, r := range c.Readers {
		reader := r
		go func() {
			err := c.loop(runCtx, reader)
			if err != nil {
				// Stop the siblings so Run returns now rather than after the last
				// healthy reader happens to notice a shutdown.
				cancel()
			}
			errCh <- err
		}()
	}
	var first error
	for range c.Readers {
		if err := <-errCh; err != nil && first == nil && ctx.Err() == nil {
			first = err
		}
	}
	return first
}

func (c *Consumer) loop(ctx context.Context, r *kafkago.Reader) error {
	defer r.Close()
	for {
		msg, err := r.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil || errors.Is(err, io.EOF) {
				return nil
			}
			return fmt.Errorf("kafka fetch %s: %w", r.Config().Topic, err)
		}
		if !c.process(ctx, msg) {
			if ctx.Err() != nil {
				// Shutting down: leave the offset uncommitted so the message is
				// redelivered to whoever takes this partition next.
				return nil
			}
			// The message could not be settled — the DLQ produce failed while we
			// are still live. Returning an error (rather than nil) is the point:
			// it propagates out of Run so the supervisor restarts the process and
			// Kafka redelivers from the last committed offset. Returning nil here
			// would silently kill this reader for the life of the process while
			// the rest of the worker kept looking healthy.
			return fmt.Errorf("kafka %s: cannot settle offset %d, dead-letter unavailable",
				msg.Topic, msg.Offset)
		}
		if err := r.CommitMessages(ctx, msg); err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("kafka commit %s: %w", msg.Topic, err)
		}
	}
}

// process runs the handler against one message, retrying THAT message in place
// until it succeeds, is permanently rejected, or the attempt budget runs out.
//
// Retrying in place is the whole point. FetchMessage has already advanced the
// reader position (kafka-go reader.go: `r.offset = m.message.Offset + 1`), so
// simply not committing does NOT redeliver — the next fetch returns the *next*
// message and the failed one is skipped silently, with no consumer lag to alert
// on. Because kafka-go commits a single highest offset per partition, the next
// success would also commit past the skipped message permanently.
//
// Returns true when the offset should be committed.
func (c *Consumer) process(ctx context.Context, msg kafkago.Message) bool {
	maxAttempts := c.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 8
	}
	for attempt := 1; ; attempt++ {
		done, handleErr := c.Handler.Handle(ctx, msg.Topic, msg.Value)
		if handleErr == nil {
			return true
		}
		// The side effect happened; only the bookkeeping failed. Commit so it is
		// not re-sent, but never copy it to the DLQ — for an OTP that payload is
		// the plaintext code, and a bulk replay would text it a second time.
		if errors.Is(handleErr, notifications.ErrDeliveredUnconfirmed) {
			if c.Log != nil {
				c.Log.Error("notification delivered but unconfirmed; committing without dead-letter",
					zap.String("topic", msg.Topic),
					zap.Int64("offset", msg.Offset),
					zap.Error(handleErr),
				)
			}
			return true
		}
		permanent := done
		// An infrastructure failure is not a bad message. Never let it exhaust
		// into a dead-letter — keep retrying until the dependency returns or the
		// process is shut down.
		exhausted := attempt >= maxAttempts && !errors.Is(handleErr, notifications.ErrRetryIndefinitely)
		if permanent || exhausted {
			if c.Log != nil {
				c.Log.Error("notification message dead-lettered",
					zap.String("topic", msg.Topic),
					zap.Int64("offset", msg.Offset),
					zap.Int("attempts", attempt),
					zap.Bool("permanent", permanent),
					zap.Error(handleErr),
				)
			}
			if c.DLQ != nil {
				if err := c.DLQ.Publish(ctx, notifications.DLQTopic(msg.Topic), string(msg.Key), msg.Value); err != nil {
					// Committing now would lose the message entirely, so keep the
					// offset and let redelivery try the DLQ again.
					if c.Log != nil {
						c.Log.Error("notification DLQ publish failed, not committing",
							zap.String("topic", msg.Topic),
							zap.Error(err),
						)
					}
					return false
				}
			}
			metrics.IncEventDLQ("notification", kafkaEventType(msg.Topic, msg.Value))
			return true
		}

		if c.Log != nil {
			c.Log.Warn("notification handle failed, retrying",
				zap.String("topic", msg.Topic),
				zap.Int64("offset", msg.Offset),
				zap.Int("attempt", attempt),
				zap.Error(handleErr),
			)
		}
		backoff := time.Duration(attempt) * 2 * time.Second
		if backoff > 30*time.Second {
			backoff = 30 * time.Second
		}
		select {
		case <-ctx.Done():
			return false
		case <-time.After(backoff):
		}
	}
}

func (c *Consumer) reportLag(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	c.sampleLag()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.sampleLag()
		}
	}
}

func (c *Consumer) sampleLag() {
	for _, r := range c.Readers {
		stats := r.Stats()
		metrics.SetKafkaConsumerLag(stats.Topic, r.Config().GroupID, stats.Lag)
	}
}

func kafkaEventType(topic string, raw []byte) string {
	var envelope struct {
		Type string `json:"type"`
	}
	if json.Unmarshal(raw, &envelope) == nil && envelope.Type != "" {
		return envelope.Type
	}
	return topic
}

func (c *Consumer) Close() error {
	var first error
	for _, r := range c.Readers {
		if err := r.Close(); err != nil && first == nil {
			first = err
		}
	}
	return first
}
