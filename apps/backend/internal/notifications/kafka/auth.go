package kafka

import (
	"crypto/tls"
	"net"
	"time"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl"
)

// Auth carries broker connection credentials.
//
// The zero value means "plaintext, no SASL" and must stay byte-for-byte
// equivalent to having no Dialer/Transport at all: dev, CI and every test dial
// an open broker. Build the mechanism with config.Config.KafkaSASL, which is
// also what Validate exercises at boot — so a bad mechanism name or credential
// never reaches this far.
type Auth struct {
	// SASL is nil when authentication is disabled.
	SASL sasl.Mechanism
	// TLS wraps the connection using the system root CAs.
	TLS bool
}

func (a Auth) enabled() bool { return a.SASL != nil || a.TLS }

func (a Auth) tlsConfig() *tls.Config {
	if !a.TLS {
		return nil
	}
	return &tls.Config{MinVersion: tls.VersionTLS12}
}

// transport returns nil when auth is off, so Writer falls back to
// kafka-go's DefaultTransport.
func (a Auth) transport() *kafkago.Transport {
	if !a.enabled() {
		return nil
	}
	return &kafkago.Transport{
		// Mirrors kafka-go's DefaultTransport; only SASL/TLS differ.
		Dial: (&net.Dialer{Timeout: 3 * time.Second, DualStack: true}).DialContext,
		SASL: a.SASL,
		TLS:  a.tlsConfig(),
	}
}

// dialer returns nil when auth is off, so ReaderConfig falls back to
// kafka-go's DefaultDialer.
func (a Auth) dialer() *kafkago.Dialer {
	if !a.enabled() {
		return nil
	}
	return &kafkago.Dialer{
		// Mirrors kafka-go's DefaultDialer; only SASL/TLS differ.
		Timeout:       10 * time.Second,
		DualStack:     true,
		SASLMechanism: a.SASL,
		TLS:           a.tlsConfig(),
	}
}
