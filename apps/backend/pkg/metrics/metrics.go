// Package metrics holds the application's Prometheus instrumentation. It owns a
// private registry (so the exposed series are exactly what we register — no
// surprise globals) and exposes small, typed helpers the rest of the codebase
// calls without importing Prometheus directly.
//
// Counters/histograms are registered once in init(); runtime gauges that read
// live state at scrape time (DB pool stats, analytics queue depth) are wired in
// at start-up via the Register* functions, which are no-ops-safe to call once.
//
// Scrape it at GET /metrics (see Handler). Keep that endpoint on an internal
// network — it is not authenticated.
package metrics

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Cache outcome label values for IncCache.
const (
	CacheHit   = "hit"
	CacheMiss  = "miss"
	CacheError = "error"
)

var registry = prometheus.NewRegistry()

var (
	httpRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests, by method, matched route and status code.",
		},
		[]string{"method", "route", "status"},
	)

	httpDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds, by matched route.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"route"},
	)

	cacheRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_requests_total",
			Help: "Read-through cache outcomes (hit, miss, error).",
		},
		[]string{"result"},
	)

	dbRetries = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "db_retries_total",
			Help: "Database operations retried after a transient (serialization/connection) error.",
		},
	)

	cacheCircuitState = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "cache_circuit_state",
			Help: "Cache circuit breaker state: 0=closed, 1=half-open, 2=open.",
		},
	)
)

func init() {
	register(
		httpRequests,
		httpDuration,
		cacheRequests,
		dbRetries,
		cacheCircuitState,
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
}

// register adds collectors to the private registry, tolerating duplicate
// registration so the package is safe to initialise more than once (e.g. tests).
func register(cs ...prometheus.Collector) {
	for _, c := range cs {
		if err := registry.Register(c); err != nil {
			var already prometheus.AlreadyRegisteredError
			if !errors.As(err, &already) {
				panic(err)
			}
		}
	}
}

// Handler returns the HTTP handler that serves the registered metrics in the
// Prometheus text exposition format. Mount it at /metrics.
func Handler() http.Handler {
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{})
}

// ObserveHTTP records one finished request: it increments the request counter
// (keyed by method/route/status) and observes its latency on the route histogram.
func ObserveHTTP(method, route string, status int, d time.Duration) {
	statusStr := strconv.Itoa(status)
	httpRequests.WithLabelValues(method, route, statusStr).Inc()
	httpDuration.WithLabelValues(route).Observe(d.Seconds())
}

// IncCache records one read-through cache outcome. Use the Cache* constants.
func IncCache(result string) {
	cacheRequests.WithLabelValues(result).Inc()
}

// IncDBRetry records one retried database operation (called per retry attempt).
func IncDBRetry() {
	dbRetries.Inc()
}

// Cache circuit-breaker state values for SetCacheCircuitState.
const (
	CircuitClosed   = 0
	CircuitHalfOpen = 1
	CircuitOpen     = 2
)

// SetCacheCircuitState publishes the current cache circuit-breaker state. Use the
// Circuit* constants.
func SetCacheCircuitState(state float64) {
	cacheCircuitState.Set(state)
}

// RegisterDBPool exposes a pgx connection pool's live statistics as gauges,
// distinguished by the given pool name (e.g. "main", "analytics"). The values are
// read from pool.Stat() at each scrape, so they always reflect the current state.
func RegisterDBPool(name string, pool *pgxpool.Pool) {
	labels := prometheus.Labels{"pool": name}
	register(
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "db_pool_total_conns", Help: "Total connections currently in the pool (acquired + idle).",
			ConstLabels: labels,
		}, func() float64 { return float64(pool.Stat().TotalConns()) }),
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "db_pool_acquired_conns", Help: "Connections currently checked out of the pool.",
			ConstLabels: labels,
		}, func() float64 { return float64(pool.Stat().AcquiredConns()) }),
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "db_pool_idle_conns", Help: "Idle connections available in the pool.",
			ConstLabels: labels,
		}, func() float64 { return float64(pool.Stat().IdleConns()) }),
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "db_pool_max_conns", Help: "Maximum connections the pool is configured to hold.",
			ConstLabels: labels,
		}, func() float64 { return float64(pool.Stat().MaxConns()) }),
	)
}

// RegisterQueueDepth exposes the depth (buffered, not-yet-flushed events) and
// capacity of an async queue as gauges under the given queue name. depth is read
// at scrape time; capacity is fixed. A depth trending toward capacity means the
// queue is back-pressured and about to drop events.
func RegisterQueueDepth(name string, depth func() int, capacity int) {
	labels := prometheus.Labels{"queue": name}
	register(
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "analytics_queue_depth", Help: "Buffered events awaiting flush.",
			ConstLabels: labels,
		}, func() float64 { return float64(depth()) }),
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "analytics_queue_capacity", Help: "Maximum events the buffer can hold before dropping.",
			ConstLabels: labels,
		}, func() float64 { return float64(capacity) }),
	)
}
