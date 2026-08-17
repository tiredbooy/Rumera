package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Domain event bus metrics.
//
// They live in this package because `registry` is private — a MustRegister from
// elsewhere lands on the default registry, which Handler() never scrapes, and
// the metric silently never appears.
//
// Labels are deliberately low-cardinality: consumer name, event type, and a
// fixed result. Order ids and event ids belong on span attributes, never here.
var (
	eventsEnqueued = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "event_enqueued_total",
			Help: "Domain facts written to the outbox, by type.",
		},
		[]string{"type"},
	)

	eventsPublished = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "event_published_total",
			Help: "Domain facts relayed to the message bus, by type and result.",
		},
		[]string{"type", "result"},
	)

	eventsConsumed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "event_consumed_total",
			Help: "Consumer runs, by consumer, event type and result (ok/retry/dlq).",
		},
		[]string{"consumer", "type", "result"},
	)

	eventConsumeDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "event_consume_duration_seconds",
			Help:    "Handler execution time, by consumer.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"consumer"},
	)

	eventsRetried = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "event_retry_total",
			Help: "Consumer failures scheduled for another attempt.",
		},
		[]string{"consumer", "type"},
	)

	eventsDeadLettered = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "event_dlq_total",
			Help: "Consumptions parked for an operator. Any increase deserves an alert.",
		},
		[]string{"consumer", "type"},
	)

	// eventOutboxLagSeconds is the number to page on: how long the oldest
	// runnable consumption has been waiting. Steady growth means consumers are
	// not keeping up or the worker is down.
	eventOutboxLagSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "event_outbox_lag_seconds",
			Help: "Age of the oldest due, unprocessed consumption row.",
		},
	)

	// eventRelayLagSeconds covers the blind spot in eventOutboxLagSeconds. That
	// gauge is derived from consumption rows, and in Kafka mode consumption rows
	// only exist once the broker delivers a fact back. With the broker down none
	// are created, so it reads 0 during exactly the total-ingest failure it exists
	// to catch. This one is relay-side — the age of the oldest fact still awaiting
	// publish — so it climbs when the broker is unreachable.
	eventRelayLagSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "event_relay_lag_seconds",
			Help: "Age of the oldest fact not yet published to Kafka. Climbs when the broker is unreachable; 0 in postgres mode.",
		},
	)

	eventLedgerDepth = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "event_ledger_depth",
			Help: "Consumption rows by status (pending/retry/done/dlq).",
		},
		[]string{"status"},
	)

	// eventIngestUp is 1 while the Kafka ingest loop is running. Before K-5 a
	// fatal reader error killed ingest for the life of the process behind a single
	// ERROR log, with the healthcheck still green — nothing was alertable.
	eventIngestUp = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "event_ingest_up",
			Help: "1 when the Kafka ingest consumer is running, 0 when it has stopped. Alert on 0.",
		},
	)

	eventIngestRestarts = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "event_ingest_restarts_total",
			Help: "Times the Kafka ingest consumer was restarted after a fatal error. Sustained growth means ingest is crash-looping.",
		},
	)

	kafkaConsumerLag = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "kafka_consumer_lag",
			Help: "Kafka consumer-group lag by topic and group.",
		},
		[]string{"topic", "group"},
	)
)

func init() {
	register(
		eventsEnqueued,
		eventsPublished,
		eventsConsumed,
		eventConsumeDuration,
		eventsRetried,
		eventsDeadLettered,
		eventOutboxLagSeconds,
		eventRelayLagSeconds,
		eventLedgerDepth,
		eventIngestUp,
		eventIngestRestarts,
		kafkaConsumerLag,
	)
}

// IncEventEnqueued records one fact written to the outbox.
func IncEventEnqueued(eventType string) {
	eventsEnqueued.WithLabelValues(label(eventType)).Inc()
}

// IncEventPublished records one relay attempt.
func IncEventPublished(eventType, result string) {
	eventsPublished.WithLabelValues(label(eventType), label(result)).Inc()
}

// ObserveEventConsume records one handler run and its duration.
func ObserveEventConsume(consumer, eventType, result string, d time.Duration) {
	eventsConsumed.WithLabelValues(label(consumer), label(eventType), label(result)).Inc()
	eventConsumeDuration.WithLabelValues(label(consumer)).Observe(d.Seconds())
}

// IncEventRetry records a scheduled retry.
func IncEventRetry(consumer, eventType string) {
	eventsRetried.WithLabelValues(label(consumer), label(eventType)).Inc()
}

// IncEventDLQ records a dead-lettered consumption.
func IncEventDLQ(consumer, eventType string) {
	eventsDeadLettered.WithLabelValues(label(consumer), label(eventType)).Inc()
}

// SetEventLag publishes the outbox lag gauge.
func SetEventLag(d time.Duration) {
	eventOutboxLagSeconds.Set(d.Seconds())
}

// SetEventRelayLag publishes the age of the oldest unpublished fact. Alert on
// this alongside event_outbox_lag_seconds — a broker outage moves only this one.
func SetEventRelayLag(d time.Duration) {
	eventRelayLagSeconds.Set(d.Seconds())
}

// SetEventIngestUp records whether the Kafka ingest consumer is running.
func SetEventIngestUp(up bool) {
	v := 0.0
	if up {
		v = 1
	}
	eventIngestUp.Set(v)
}

// IncEventIngestRestart records one ingest restart after a fatal error.
func IncEventIngestRestart() {
	eventIngestRestarts.Inc()
}

// SetEventLedgerDepth publishes ledger depth for one status.
func SetEventLedgerDepth(status string, n int64) {
	eventLedgerDepth.WithLabelValues(label(status)).Set(float64(n))
}

// SetKafkaConsumerLag publishes lag for one topic/group pair.
func SetKafkaConsumerLag(topic, group string, lag int64) {
	kafkaConsumerLag.WithLabelValues(label(topic), label(group)).Set(float64(lag))
}

// label keeps an empty value from creating a blank series.
func label(s string) string {
	if s == "" {
		return "unknown"
	}
	return s
}
