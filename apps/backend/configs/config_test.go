package config

import (
	"testing"
	"time"
)

// validConfig returns a Config with every field Validate inspects set to a
// sane value, so each test can flip exactly one field to assert it's caught.
func validConfig() Config {
	return Config{
		OTELSamplerRatio:      1.0,
		CacheBreakerThreshold: 5,
		CacheBreakerCooldown:  10 * time.Second,
		DBRetryMaxAttempts:    3,
		DBRetryBaseBackoff:    50 * time.Millisecond,
		MediaDefaultQuality:   80,
		MediaMaxUploadMB:      15,
		MediaMaxDimension:     4000,
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
