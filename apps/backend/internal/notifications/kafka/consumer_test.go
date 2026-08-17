package kafka

import (
	"context"
	"errors"
	"testing"

	kafkago "github.com/segmentio/kafka-go"
)

type stubHandler struct {
	done bool
	err  error
}

func (s stubHandler) Handle(context.Context, string, []byte) (bool, error) {
	return s.done, s.err
}

type stubDLQ struct {
	n int
}

func (s *stubDLQ) Publish(context.Context, string, string, []byte) error {
	s.n++
	return nil
}

func TestKafkaEventTypePrefersEnvelopeType(t *testing.T) {
	if got := kafkaEventType("rumera.notification.otp.v1", []byte(`{"type":"notification.otp.v1"}`)); got != "notification.otp.v1" {
		t.Fatalf("type = %q", got)
	}
	if got := kafkaEventType("rumera.notification.email.v1", []byte(`{`)); got != "rumera.notification.email.v1" {
		t.Fatalf("fallback = %q", got)
	}
}

func TestProcessPublishesKafkaDLQ(t *testing.T) {
	dlq := &stubDLQ{}
	c := &Consumer{
		Handler:     stubHandler{done: true, err: errors.New("poison")},
		DLQ:         dlq,
		MaxAttempts: 1,
	}
	ok := c.process(context.Background(), kafkago.Message{
		Topic: "rumera.notification.otp.v1",
		Value: []byte(`{"type":"notification.otp.v1"}`),
	})
	if !ok {
		t.Fatal("expected commit after DLQ")
	}
	if dlq.n != 1 {
		t.Fatalf("DLQ publishes = %d", dlq.n)
	}
}
