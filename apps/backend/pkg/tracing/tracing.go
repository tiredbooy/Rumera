// Package tracing wires OpenTelemetry distributed tracing for the backend.
//
// It is opt-in (config OTEL_ENABLED, default false). When disabled, Init does
// nothing and returns a no-op shutdown, so the global tracer provider stays the
// default no-op one — instrumentation elsewhere (otelgin, otelpgx) then produces
// zero spans and never tries to export. This keeps tracing free until switched on.
//
// When enabled it installs an OTLP/gRPC exporter, a batching tracer provider with
// a parent-based ratio sampler, and the W3C trace-context + baggage propagators,
// then returns the provider's Shutdown so the caller can flush spans on teardown.
package tracing

import (
	"context"
	"fmt"

	config "github.com/tiredbooy/configs"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.uber.org/zap"
)

// ShutdownFunc flushes and stops the tracer provider. It is always safe to call
// (a no-op when tracing is disabled) and should be invoked during shutdown.
type ShutdownFunc func(context.Context) error

// noop is the shutdown returned when tracing is disabled.
func noop(context.Context) error { return nil }

// Init configures the global OpenTelemetry tracer provider from cfg and returns a
// shutdown function. When OTEL_ENABLED is false it is a no-op. Call this BEFORE
// constructing anything that captures the global provider (e.g. the otelpgx
// tracer), so those see the real provider rather than the no-op default.
func Init(ctx context.Context, cfg *config.Config, log *zap.Logger) (ShutdownFunc, error) {
	if !cfg.OTELEnabled {
		log.Info("tracing disabled (OTEL_ENABLED=false)")
		return noop, nil
	}

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(cfg.OTELExporterEndpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("otlp exporter: %w", err)
	}

	// Schemaless resource avoids pinning a semconv version; service.name is the
	// one attribute every backend needs to be identifiable in the trace UI.
	res := resource.NewSchemaless(
		attribute.String("service.name", cfg.OTELServiceName),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		// ParentBased keeps a trace intact across services: child spans honour the
		// incoming sampling decision; only roots are sampled by the ratio.
		sdktrace.WithSampler(sdktrace.ParentBased(
			sdktrace.TraceIDRatioBased(cfg.OTELSamplerRatio),
		)),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	log.Info("tracing enabled",
		zap.String("endpoint", cfg.OTELExporterEndpoint),
		zap.String("service", cfg.OTELServiceName),
		zap.Float64("sampler_ratio", cfg.OTELSamplerRatio),
	)

	return tp.Shutdown, nil
}
