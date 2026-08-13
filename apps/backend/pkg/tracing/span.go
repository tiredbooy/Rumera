package tracing

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const tracerName = "rumera/backend"

// Start begins a named span. When OTEL is disabled the global provider is a
// no-op tracer — this is free. Call the returned end function once; pass the
// operation error so status/error attributes are set.
//
//	ctx, end := tracing.Start(ctx, "orders.CreateOrder")
//	defer func() { end(err) }()
func Start(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, func(err error)) {
	ctx, span := otel.Tracer(tracerName).Start(ctx, name, trace.WithAttributes(attrs...))
	return ctx, func(err error) {
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		span.End()
	}
}

// Attr helpers keep call sites free of attribute package imports when thin.
func Int64(key string, v int64) attribute.KeyValue { return attribute.Int64(key, v) }
func String(key, v string) attribute.KeyValue      { return attribute.String(key, v) }
func Bool(key string, v bool) attribute.KeyValue   { return attribute.Bool(key, v) }
