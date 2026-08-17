package config

import (
	"strings"
	"testing"
	"time"
)

// validConfig returns a Config with every field Validate inspects set to a
// sane value, so each test can flip exactly one field to assert it's caught.
func validConfig() Config {
	return Config{
		OTELSamplerRatio:        1.0,
		CacheBreakerThreshold:   5,
		CacheBreakerCooldown:    10 * time.Second,
		DBRetryMaxAttempts:      3,
		DBRetryBaseBackoff:      50 * time.Millisecond,
		MediaDefaultQuality:     80,
		MediaMaxUploadMB:        15,
		MediaMaxDimension:       4000,
		MediaMaxSourceDimension: 12000,
		MediaMaxSourcePixels:    40_000_000,
	}
}

func TestConfig_Validate_OK(t *testing.T) {
	c := validConfig()
	if err := c.Validate(); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
}

// Empty KAFKA_SASL_MECHANISM is the dev/CI default and must stay valid —
// and must not build a mechanism.
func TestConfig_KafkaSASL_DisabledByDefault(t *testing.T) {
	c := validConfig()
	if err := c.Validate(); err != nil {
		t.Fatalf("config without SASL rejected: %v", err)
	}
	mech, err := c.KafkaSASL()
	if err != nil {
		t.Fatalf("KafkaSASL: %v", err)
	}
	if mech != nil {
		t.Errorf("KafkaSASL = %v, want nil when KAFKA_SASL_MECHANISM is empty", mech)
	}
}

func TestConfig_KafkaSASL_SCRAM(t *testing.T) {
	c := validConfig()
	c.KafkaSASLMechanism = "scram-sha-512"
	c.KafkaSASLUsername = "rumera"
	c.KafkaSASLPassword = "s3cret"
	if err := c.Validate(); err != nil {
		t.Fatalf("valid SCRAM config rejected: %v", err)
	}
	mech, err := c.KafkaSASL()
	if err != nil {
		t.Fatalf("KafkaSASL: %v", err)
	}
	if mech == nil || mech.Name() != "SCRAM-SHA-512" {
		t.Fatalf("KafkaSASL = %v, want SCRAM-SHA-512", mech)
	}
}

func TestConfig_Validate_Rejects(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Config)
	}{
		{"sampler ratio below 0", func(c *Config) { c.OTELSamplerRatio = -0.1 }},
		{"sampler ratio above 1", func(c *Config) { c.OTELSamplerRatio = 1.1 }},
		{"breaker threshold < 1", func(c *Config) { c.CacheBreakerThreshold = 0 }},
		{"breaker cooldown <= 0", func(c *Config) { c.CacheBreakerCooldown = 0 }},
		{"retry attempts < 1", func(c *Config) { c.DBRetryMaxAttempts = 0 }},
		{"retry backoff <= 0", func(c *Config) { c.DBRetryBaseBackoff = 0 }},
		{"media quality below 1", func(c *Config) { c.MediaDefaultQuality = 0 }},
		{"media quality above 100", func(c *Config) { c.MediaDefaultQuality = 101 }},
		{"media max upload < 1", func(c *Config) { c.MediaMaxUploadMB = 0 }},
		{"media max dimension < 1", func(c *Config) { c.MediaMaxDimension = 0 }},
		{"media max source dimension < 1", func(c *Config) { c.MediaMaxSourceDimension = 0 }},
		{"media max source pixels < 1", func(c *Config) { c.MediaMaxSourcePixels = 0 }},
		{"payment start URL not absolute", func(c *Config) { c.PaymentStartBaseURL = "pay.example.com/start" }},
		{"payment start URL not http(s)", func(c *Config) { c.PaymentStartBaseURL = "ftp://pay.example.com/start" }},
		// K-6: each of these would otherwise boot and dial the broker with no
		// authentication at all.
		{"unsupported SASL mechanism", func(c *Config) {
			c.KafkaSASLMechanism = "plain"
			c.KafkaSASLUsername = "u"
			c.KafkaSASLPassword = "p"
		}},
		{"SASL mechanism without username", func(c *Config) {
			c.KafkaSASLMechanism = "scram-sha-512"
			c.KafkaSASLPassword = "p"
		}},
		{"SASL mechanism without password", func(c *Config) {
			c.KafkaSASLMechanism = "scram-sha-512"
			c.KafkaSASLUsername = "u"
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := validConfig()
			tc.mutate(&c)
			if err := c.Validate(); err == nil {
				t.Fatalf("expected validation error for %q", tc.name)
			}
		})
	}
}

// K-9: cmd/event-worker exists now, so "external" is a supported deployment
// (API emits, worker consumes). Only "off" still leaves the facts unconsumed.
func TestConfig_Validate_EventsWorker(t *testing.T) {
	cases := []struct {
		worker  string
		enabled bool
		wantErr bool
	}{
		{"embedded", true, false},
		{"external", true, false},
		{"off", true, true},
		// EVENTS_ENABLED=false: nothing is emitted, so any worker value is fine.
		{"embedded", false, false},
		{"external", false, false},
		{"off", false, false},
		{"nonsense", true, true},
	}
	for _, tc := range cases {
		t.Run(tc.worker, func(t *testing.T) {
			c := validConfig()
			c.EventsWorker = tc.worker
			c.EventsEnabled = tc.enabled
			err := c.Validate()
			if tc.wantErr && err == nil {
				t.Fatalf("EVENTS_WORKER=%q EVENTS_ENABLED=%v: expected error", tc.worker, tc.enabled)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("EVENTS_WORKER=%q EVENTS_ENABLED=%v: %v", tc.worker, tc.enabled, err)
			}
		})
	}
}

// Only the API process embeds the consumers; the standalone worker opts in
// through bootstrap, not through this flag.
func TestConfig_EventsWorkerEmbedded(t *testing.T) {
	cases := []struct {
		worker  string
		enabled bool
		want    bool
	}{
		{"embedded", true, true},
		{"external", true, false},
		{"embedded", false, false},
	}
	for _, tc := range cases {
		c := validConfig()
		c.EventsWorker = tc.worker
		c.EventsEnabled = tc.enabled
		if got := c.EventsWorkerEmbedded(); got != tc.want {
			t.Errorf("EventsWorkerEmbedded(%q, enabled=%v) = %v, want %v",
				tc.worker, tc.enabled, got, tc.want)
		}
	}
}

// validProdConfig extends validConfig with the fields the production-only guards
// inspect, so each guard test can flip exactly one of them.
func validProdConfig() Config {
	c := validConfig()
	c.Env = "production"
	c.JWTSecret = strings.Repeat("x", 32)
	c.CORSAllowedOrigins = []string{"https://rumera.example"}
	c.CryptoWebhookKey = "whk_live_secret_value"
	c.SMSProvider = "kavenegar"
	c.MetricsEnabled = true
	c.MetricsBearerToken = "metrics-scrape-secret"
	c.PaymentStartBaseURL = "https://pay.example.com/start"
	c.TrustedProxies = []string{"172.16.0.0/12"}
	return c
}

func TestConfig_Validate_ProductionOK(t *testing.T) {
	c := validProdConfig()
	if err := c.Validate(); err != nil {
		t.Fatalf("valid production config rejected: %v", err)
	}
}

func TestConfig_Validate_ProductionGuards(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Config)
	}{
		{"short JWT secret", func(c *Config) { c.JWTSecret = "too-short" }},
		{"wildcard CORS", func(c *Config) { c.CORSAllowedOrigins = []string{"https://ok.example", "*"} }},
		{"empty webhook key", func(c *Config) { c.CryptoWebhookKey = "" }},
		{"empty payment start URL", func(c *Config) { c.PaymentStartBaseURL = "" }},
		{"log SMS provider", func(c *Config) { c.SMSProvider = "log" }},
		{"metrics enabled without token", func(c *Config) { c.MetricsBearerToken = "" }},
		{"empty trusted proxies", func(c *Config) { c.TrustedProxies = nil }},
		{"blank trusted proxies", func(c *Config) { c.TrustedProxies = []string{"", "  "} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := validProdConfig()
			tc.mutate(&c)
			if err := c.Validate(); err == nil {
				t.Fatalf("expected production validation error for %q", tc.name)
			}
		})
	}
}

func TestConfig_Validate_DevelopmentSkipsProductionGuards(t *testing.T) {
	c := validProdConfig()
	c.Env = "development"
	// These would fail the production guards; in development they're allowed.
	c.JWTSecret = "dev"
	c.CORSAllowedOrigins = []string{"*"}
	c.CryptoWebhookKey = ""
	c.SMSProvider = "log"
	c.PaymentStartBaseURL = ""
	c.TrustedProxies = nil
	if err := c.Validate(); err != nil {
		t.Fatalf("development config should skip production guards: %v", err)
	}
}

func TestConfig_Validate_ProductionRequiresTrustedProxies(t *testing.T) {
	empty := validProdConfig()
	empty.TrustedProxies = nil
	if err := empty.Validate(); err == nil {
		t.Fatal("production config with empty TRUSTED_PROXIES must fail")
	}

	cidr := validProdConfig()
	cidr.TrustedProxies = []string{"172.16.0.0/12"}
	if err := cidr.Validate(); err != nil {
		t.Fatalf("production config with CIDR must pass: %v", err)
	}
}
