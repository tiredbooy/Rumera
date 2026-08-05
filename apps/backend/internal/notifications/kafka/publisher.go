// Package kafka provides Kafka (Redpanda) adapters for notification publish
// and consume using segmentio/kafka-go.
package kafka

import (
	"context"
	"fmt"
	"strings"
	"time"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/tiredbooy/internal/notifications"
)

// Publisher implements notifications.Publisher.
type Publisher struct {
	writers map[string]*kafkago.Writer
	brokers []string
}

// NewPublisher builds a multi-topic writer set. Call Close when shutting down.
func NewPublisher(brokers []string) *Publisher {
	clean := cleanBrokers(brokers)
	return &Publisher{
		writers: map[string]*kafkago.Writer{},
		brokers: clean,
	}
}

func (p *Publisher) writer(topic string) *kafkago.Writer {
	if w, ok := p.writers[topic]; ok {
		return w
	}
	w := &kafkago.Writer{
		Addr:         kafkago.TCP(p.brokers...),
		Topic:        topic,
		Balancer:     &kafkago.Hash{},
		RequiredAcks: kafkago.RequireOne,
		Async:        false,
		BatchTimeout: 10 * time.Millisecond,
	}
	p.writers[topic] = w
	return w
}

func (p *Publisher) Publish(ctx context.Context, topic, key string, value []byte) error {
	if len(p.brokers) == 0 {
		return fmt.Errorf("kafka: no brokers configured")
	}
	w := p.writer(topic)
	err := w.WriteMessages(ctx, kafkago.Message{
		Key:   []byte(key),
		Value: value,
		Time:  time.Now().UTC(),
	})
	if err != nil {
		return fmt.Errorf("kafka publish %s: %w", topic, err)
	}
	return nil
}

func (p *Publisher) Close() error {
	var first error
	for _, w := range p.writers {
		if err := w.Close(); err != nil && first == nil {
			first = err
		}
	}
	return first
}

var _ notifications.Publisher = (*Publisher)(nil)

func cleanBrokers(in []string) []string {
	var out []string
	for _, b := range in {
		b = strings.TrimSpace(b)
		if b != "" {
			out = append(out, b)
		}
	}
	return out
}
