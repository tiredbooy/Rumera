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

// validProdConfig extends validConfig with the fields the production-only guards
// inspect, so each guard test can flip exactly one of them.
func validProdConfig() Config {
	c := validConfig()
	c.Env = "production"
	c.JWTSecret = strings.Repeat("x", 32)
	c.CORSAllowedOrigins = []string{"https://rumera.example"}
	c.CryptoWebhookKey = "whk_live_secret_value"
	c.SMSProvider = "kavenegar"
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
		{"log SMS provider", func(c *Config) { c.SMSProvider = "log" }},
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
	// All four would fail the production guards; in development they're allowed.
	c.JWTSecret = "dev"
	c.CORSAllowedOrigins = []string{"*"}
	c.CryptoWebhookKey = ""
	c.SMSProvider = "log"
	if err := c.Validate(); err != nil {
		t.Fatalf("development config should skip production guards: %v", err)
	}
}
