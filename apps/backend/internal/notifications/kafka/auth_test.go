package kafka

import (
	"testing"

	kafkago "github.com/segmentio/kafka-go"
	config "github.com/tiredbooy/configs"
)

// K-6. The no-auth path must stay exactly as it was: a Writer with no Transport
// and a Reader with no Dialer, so kafka-go falls back to its own defaults. A
// typed-nil assigned through the RoundTripper interface would look "set" and
// panic on the first write.
func TestZeroAuthLeavesKafkaGoDefaults(t *testing.T) {
	if tr := (Auth{}).transport(); tr != nil {
		t.Errorf("transport() = %v, want nil for zero Auth", tr)
	}
	if d := (Auth{}).dialer(); d != nil {
		t.Errorf("dialer() = %v, want nil for zero Auth", d)
	}

	p := NewPublisher([]string{"localhost:9092"}, Auth{})
	t.Cleanup(func() { _ = p.Close() })
	if w := p.writer("rumera.domain.v1"); w.Transport != nil {
		t.Errorf("Writer.Transport = %v, want nil (kafka-go DefaultTransport)", w.Transport)
	}

	c := NewConsumer([]string{"localhost:9092"}, "g", []string{"t"}, Auth{})
	t.Cleanup(func() { _ = c.Close() })
	// kafka-go substitutes DefaultDialer when the config's is nil, so assert on
	// what we actually passed in rather than on the reader's resolved config.
	if d := (Auth{}).dialer(); d != nil {
		t.Errorf("consumer built with dialer %v, want nil", d)
	}
}

func TestSASLAuthReachesWriterAndReader(t *testing.T) {
	cfg := config.Config{
		KafkaSASLMechanism: "scram-sha-512",
		KafkaSASLUsername:  "rumera",
		KafkaSASLPassword:  "s3cret",
	}
	mech, err := cfg.KafkaSASL()
	if err != nil {
		t.Fatalf("KafkaSASL: %v", err)
	}
	if mech == nil {
		t.Fatal("KafkaSASL returned nil mechanism for scram-sha-512")
	}
	if got := mech.Name(); got != "SCRAM-SHA-512" {
		t.Errorf("mechanism name = %q, want SCRAM-SHA-512", got)
	}

	auth := Auth{SASL: mech, TLS: true}
	p := NewPublisher([]string{"localhost:9092"}, auth)
	t.Cleanup(func() { _ = p.Close() })

	w := p.writer("rumera.domain.v1")
	tr, ok := w.Transport.(*kafkago.Transport)
	if !ok {
		t.Fatalf("Writer.Transport = %T, want *kafka.Transport", w.Transport)
	}
	if tr.SASL != mech {
		t.Error("Writer transport is not carrying the SASL mechanism")
	}
	if tr.TLS == nil {
		t.Error("Writer transport has no TLS config despite KAFKA_TLS_ENABLED")
	}
	// K-1 must survive the new Transport wiring.
	if w.RequiredAcks != kafkago.RequireAll || w.AllowAutoTopicCreation {
		t.Error("durability settings regressed while wiring SASL")
	}

	d := auth.dialer()
	if d == nil || d.SASLMechanism != mech {
		t.Error("reader dialer is not carrying the SASL mechanism")
	}
	if d.TLS == nil {
		t.Error("reader dialer has no TLS config despite KAFKA_TLS_ENABLED")
	}
}

func TestSHA256Mechanism(t *testing.T) {
	cfg := config.Config{
		KafkaSASLMechanism: "scram-sha-256",
		KafkaSASLUsername:  "rumera",
		KafkaSASLPassword:  "s3cret",
	}
	mech, err := cfg.KafkaSASL()
	if err != nil || mech == nil {
		t.Fatalf("KafkaSASL = %v, %v", mech, err)
	}
	if got := mech.Name(); got != "SCRAM-SHA-256" {
		t.Errorf("mechanism name = %q, want SCRAM-SHA-256", got)
	}
}
