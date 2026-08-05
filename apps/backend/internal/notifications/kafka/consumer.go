package kafka

import (
	"context"
	"fmt"
	"time"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/tiredbooy/internal/notifications"
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
func NewConsumer(brokers []string, group string, topics []string) *Consumer {
	clean := cleanBrokers(brokers)
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
		}))
	}
	return &Consumer{Readers: readers, MaxAttempts: 8}
}

// Run blocks until ctx is cancelled, consuming all readers concurrently.
func (c *Consumer) Run(ctx context.Context) error {
	errCh := make(chan error, len(c.Readers))
	for _, r := range c.Readers {
		reader := r
		go func() {
			errCh <- c.loop(ctx, reader)
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
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("kafka fetch %s: %w", r.Config().Topic, err)
		}
		done, handleErr := c.Handler.Handle(ctx, msg.Topic, msg.Value)
		if handleErr != nil && !done {
			// Retryable — do not commit; backoff briefly.
			if c.Log != nil {
				c.Log.Warn("notification handle failed",
					zap.String("topic", msg.Topic),
					zap.Error(handleErr),
				)
			}
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(2 * time.Second):
			}
			continue
		}
		if handleErr != nil && done && c.DLQ != nil {
			// Poison / permanent: copy to DLQ then commit.
			_ = c.DLQ.Publish(ctx, notifications.DLQTopic(msg.Topic), string(msg.Key), msg.Value)
		}
		if err := r.CommitMessages(ctx, msg); err != nil {
			return fmt.Errorf("kafka commit %s: %w", msg.Topic, err)
		}
	}
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
