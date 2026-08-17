// Package kafka provides Kafka (Redpanda) adapters for notification publish
// and consume using segmentio/kafka-go.
package kafka

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/tiredbooy/internal/notifications"
)

// Publisher implements notifications.Publisher.
//
// One Publisher is shared by the relay goroutine and the consumer's DLQ path,
// so the writer map is mutex-guarded: a concurrent map write is a runtime fatal
// that no recover can catch.
type Publisher struct {
	mu      sync.Mutex
	writers map[string]*kafkago.Writer
	brokers []string
	// transport is nil for the zero Auth, which leaves every Writer on
	// kafka-go's DefaultTransport — the unauthenticated behaviour dev and CI
	// have always had.
	transport *kafkago.Transport
}

// NewPublisher builds a multi-topic writer set. Call Close when shutting down.
func NewPublisher(brokers []string, auth Auth) *Publisher {
	clean := cleanBrokers(brokers)
	return &Publisher{
		writers:   map[string]*kafkago.Writer{},
		brokers:   clean,
		transport: auth.transport(),
	}
}

func (p *Publisher) writer(topic string) *kafkago.Writer {
	p.mu.Lock()
	defer p.mu.Unlock()
	if w, ok := p.writers[topic]; ok {
		return w
	}
	w := &kafkago.Writer{
		Addr:     kafkago.TCP(p.brokers...),
		Topic:    topic,
		Balancer: &kafkago.Hash{},
		// RequireAll, never RequireOne. Under acks=1 the leader acknowledges
		// before replication, so a failover after the ack drops the message —
		// while the fact is already marked published and is therefore never
		// re-relayed and never consumed. A customer pays and the receipt, the
		// loyalty award and the recs signal silently never happen. With RF=1
		// this still buys the leader's fsync, which is what survives a restart.
		RequiredAcks: kafkago.RequireAll,
		Async:        false,
		BatchTimeout: 10 * time.Millisecond,
		// Every topic is declared up front (deploy/kafka init-topics). Auto-creation
		// would silently manufacture a topic with broker-default partitions and
		// retention on a typo or a misroute, and facts written there are consumed by
		// nobody. Both routers already guarantee a known topic: TopicForEvent is a
		// closed switch that errors on an unknown type, and events.TopicFor falls
		// back to the pre-created rumera.domain.v1. So this can only ever fire on a
		// mistake — fail loudly instead. The relay retries and the outbox keeps the
		// fact, so a genuinely missing topic costs lag, not data.
		AllowAutoTopicCreation: false,
	}
	// Transport is a RoundTripper interface: assigning a nil *Transport through
	// it yields a non-nil interface holding a nil pointer, which defeats
	// kafka-go's `if w.Transport == nil` fallback and panics on the first write.
	// Leave the field untouched when there is no auth.
	if p.transport != nil {
		w.Transport = p.transport
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
	p.mu.Lock()
	defer p.mu.Unlock()
	var first error
	for _, w := range p.writers {
		if err := w.Close(); err != nil && first == nil {
			first = err
		}
	}
	// Writer.Close leaves a shared Transport's pooled conns open.
	if p.transport != nil {
		p.transport.CloseIdleConnections()
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
