package events

import (
	"time"

	"github.com/tiredbooy/pkg/metrics"
)

// MetricsObserver reports worker outcomes to Prometheus.
//
// The metrics helpers self-disable when the endpoint is off, so this is safe to
// wire unconditionally.
type MetricsObserver struct{}

var _ Observer = MetricsObserver{}

func (MetricsObserver) Consumed(consumer, eventType, result string, d time.Duration) {
	metrics.ObserveEventConsume(consumer, eventType, result, d)
}

func (MetricsObserver) Retried(consumer, eventType string) {
	metrics.IncEventRetry(consumer, eventType)
}

func (MetricsObserver) DeadLettered(consumer, eventType string) {
	metrics.IncEventDLQ(consumer, eventType)
}

func (MetricsObserver) Published(eventType, result string) {
	metrics.IncEventPublished(eventType, result)
}

func (MetricsObserver) Lag(d time.Duration) { metrics.SetEventLag(d) }

func (MetricsObserver) RelayLag(d time.Duration) { metrics.SetEventRelayLag(d) }

func (MetricsObserver) Depth(status string, n int64) {
	metrics.SetEventLedgerDepth(status, n)
}
