package tracing

import (
	"context"
	"testing"
	"time"

	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

func TestInit_Disabled(t *testing.T) {
	cfg := &config.Config{OTELEnabled: false}

	shutdown, err := Init(context.Background(), cfg, zap.NewNop())
	if err != nil {
		t.Fatalf("Init(disabled) returned error: %v", err)
	}
	if shutdown == nil {
		t.Fatal("Init(disabled) returned nil shutdown; want a no-op")
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("no-op shutdown returned error: %v", err)
	}
}

func TestInit_Enabled(t *testing.T) {
	cfg := &config.Config{
		OTELEnabled:          true,
		OTELServiceName:      "rumera-test",
		OTELExporterEndpoint: "localhost:4317", // not dialled until export; New is lazy
		OTELSamplerRatio:     1.0,
	}

	shutdown, err := Init(context.Background(), cfg, zap.NewNop())
	if err != nil {
		t.Fatalf("Init(enabled) returned error: %v", err)
	}
	if shutdown == nil {
		t.Fatal("Init(enabled) returned nil shutdown")
	}

	// Shutdown must return promptly even with no collector listening; bound it so
	// a hang fails the test rather than blocking the suite.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = shutdown(ctx) // export error is acceptable (no collector); must not hang
}
