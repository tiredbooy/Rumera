package kafka

import (
	"testing"

	kafkago "github.com/segmentio/kafka-go"
)

// K-1. Both settings are one-word regressions with silent, unrecoverable
// consequences — acks=1 loses an acknowledged fact on a leader failover, and
// auto-creation lands facts on a topic no consumer group subscribes to. Neither
// shows up in any functional test, so assert the writer config directly.
func TestWriterIsDurableAndDoesNotAutoCreateTopics(t *testing.T) {
	p := NewPublisher([]string{"localhost:9092"}, Auth{})
	t.Cleanup(func() { _ = p.Close() })

	w := p.writer("rumera.domain.v1")

	if w.RequiredAcks != kafkago.RequireAll {
		t.Errorf("RequiredAcks = %v, want RequireAll — acks=1 drops a published fact on failover", w.RequiredAcks)
	}
	if w.AllowAutoTopicCreation {
		t.Error("AllowAutoTopicCreation = true; topics are declared by deploy/kafka init-topics, so this can only mask a misroute")
	}
	if w.Async {
		t.Error("Async = true; the relay must observe the publish error to keep the fact unpublished")
	}
}

// The writer map is shared by the relay goroutine and the consumer DLQ path, so
// a missed cache hit would be a concurrent map write — a fatal no recover catches.
func TestWriterIsCachedPerTopic(t *testing.T) {
	p := NewPublisher([]string{"localhost:9092"}, Auth{})
	t.Cleanup(func() { _ = p.Close() })

	if p.writer("a") != p.writer("a") {
		t.Error("writer(a) returned two instances for one topic")
	}
	if p.writer("a") == p.writer("b") {
		t.Error("writer(a) and writer(b) returned the same instance")
	}
}
