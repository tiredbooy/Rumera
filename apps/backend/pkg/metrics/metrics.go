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

	recommendationInteractions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "recommendation_interactions_total",
			Help: "Recommendation interaction signals recorded, by interaction_type.",
		},
		[]string{"interaction_type"},
	)

	// Idempotency platform (PH-011b) — local scrape via GET /metrics.
	idempotencyClaims = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "idempotency_claim_total",
			Help: "Idempotency store claim attempts by result (won, lost, error).",
		},
		[]string{"result"},
	)
	idempotencyReplays = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "idempotency_replay_total",
			Help: "Completed idempotency keys that returned a stored HTTP response without re-running the handler.",
		},
	)
	idempotencyConflicts = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "idempotency_conflict_total",
			Help: "Idempotency 409 responses by reason (body, inflight).",
		},
		[]string{"reason"},
	)
	idempotencyCompleteErrors = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "idempotency_complete_error_total",
			Help: "Failures persisting a successful (2xx) response for an idempotency key.",
		},
	)
	idempotencyMissingKey = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "idempotency_missing_key_total",
			Help: "Requests on idempotency-wrapped routes that omitted Idempotency-Key (and auto-key was disallowed).",
		},
		[]string{"route"},
	)

	// Money / stock saga metrics (PH-013b) — low-cardinality labels only.
	ordersCreated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "orders_created_total",
			Help: "Order placement attempts by result (ok, error).",
		},
		[]string{"result"},
	)
	orderCreateDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "orders_create_duration_seconds",
			Help:    "CreateOrder wall time in seconds (includes stock reserve TX).",
			Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
	)
	paymentsSettled = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payments_settled_total",
			Help: "Payment settlement outcomes by result (confirmed, failed, error).",
		},
		[]string{"result"},
	)
	paymentConfirmDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "payments_confirm_duration_seconds",
			Help:    "Payment Confirm wall time (paid order + stock deduct TX).",
			Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
	)
	inventoryOps = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inventory_ops_total",
			Help: "Inventory lifecycle ops by op (reserve, deduct, release) and result (ok, error).",
		},
		[]string{"op", "result"},
	)
	walletOps = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "wallet_ops_total",
			Help: "Wallet ledger ops by direction (credit, debit) and result (ok, error).",
		},
		[]string{"direction", "result"},
	)

	// Loyalty programme (PH-040e) — low-cardinality reason labels only.
	loyaltyAwards = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "loyalty_award_total",
			Help: "Loyalty point awards by reason and result (ok, replay, skip, error).",
		},
		[]string{"reason", "result"},
	)
	loyaltyRedeems = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "loyalty_redeem_total",
			Help: "Loyalty redeem attempts by result (ok, replay, insufficient, error).",
		},
		[]string{"result"},
	)
)

func init() {
	register(
		httpRequests,
		httpDuration,
		cacheRequests,
		dbRetries,
		cacheCircuitState,
		recommendationInteractions,
		idempotencyClaims,
		idempotencyReplays,
		idempotencyConflicts,
		idempotencyCompleteErrors,
		idempotencyMissingKey,
		ordersCreated,
		orderCreateDuration,
		paymentsSettled,
		paymentConfirmDuration,
		inventoryOps,
		walletOps,
		loyaltyAwards,
		loyaltyRedeems,
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

// IncRecommendationInteraction records one successfully stored recommendation
// signal. interactionType should match models.InteractionType string values.
func IncRecommendationInteraction(interactionType string) {
	if interactionType == "" {
		interactionType = "unknown"
	}
	recommendationInteractions.WithLabelValues(interactionType).Inc()
}

// Idempotency claim result labels for IncIdempotencyClaim.
const (
	IdempotencyClaimWon   = "won"
	IdempotencyClaimLost  = "lost"
	IdempotencyClaimError = "error"
)

// Idempotency conflict reason labels for IncIdempotencyConflict.
const (
	IdempotencyConflictBody     = "body"
	IdempotencyConflictInflight = "inflight"
)

// IncIdempotencyClaim records one claim attempt (won / lost / error).
func IncIdempotencyClaim(result string) {
	if result == "" {
		result = "unknown"
	}
	idempotencyClaims.WithLabelValues(result).Inc()
}

// IncIdempotencyReplay records returning a stored successful response.
func IncIdempotencyReplay() {
	idempotencyReplays.Inc()
}

// IncIdempotencyConflict records a 409 (body mismatch or in-flight).
func IncIdempotencyConflict(reason string) {
	if reason == "" {
		reason = "unknown"
	}
	idempotencyConflicts.WithLabelValues(reason).Inc()
}

// IncIdempotencyCompleteError records failure to persist a 2xx response body.
func IncIdempotencyCompleteError() {
	idempotencyCompleteErrors.Inc()
}

// IncIdempotencyMissingKey records a request that skipped the platform because
// the client key was absent and auto-key was disabled (adoption signal).
func IncIdempotencyMissingKey(route string) {
	if route == "" {
		route = "unmatched"
	}
	idempotencyMissingKey.WithLabelValues(route).Inc()
}

// Business / saga result labels (PH-013b).
const (
	ResultOK        = "ok"
	ResultError     = "error"
	ResultConfirmed = "confirmed"
	ResultFailed    = "failed"

	InventoryOpReserve = "reserve"
	InventoryOpDeduct  = "deduct"
	InventoryOpRelease = "release"

	WalletCredit = "credit"
	WalletDebit  = "debit"

	// Loyalty result labels (PH-040e).
	ResultReplay       = "replay"       // idempotent no-op (already recorded)
	ResultSkip         = "skip"         // disabled/zero/ineligible
	ResultInsufficient = "insufficient" // redeem overdraw
)

// IncOrderCreate records one place-order attempt (ok or error).
func IncOrderCreate(result string) {
	if result == "" {
		result = ResultError
	}
	ordersCreated.WithLabelValues(result).Inc()
}

// ObserveOrderCreate records CreateOrder latency.
func ObserveOrderCreate(d time.Duration) {
	orderCreateDuration.Observe(d.Seconds())
}

// IncPaymentSettle records confirm/fail settlement (confirmed, failed, error).
func IncPaymentSettle(result string) {
	if result == "" {
		result = ResultError
	}
	paymentsSettled.WithLabelValues(result).Inc()
}

// ObservePaymentConfirm records Confirm latency.
func ObservePaymentConfirm(d time.Duration) {
	paymentConfirmDuration.Observe(d.Seconds())
}

// IncInventoryOp records reserve/deduct/release (ok or error).
func IncInventoryOp(op, result string) {
	if op == "" {
		op = "unknown"
	}
	if result == "" {
		result = ResultError
	}
	inventoryOps.WithLabelValues(op, result).Inc()
}

// IncWalletOp records credit/debit ledger ops (ok or error).
func IncWalletOp(direction, result string) {
	if direction == "" {
		direction = "unknown"
	}
	if result == "" {
		result = ResultError
	}
	walletOps.WithLabelValues(direction, result).Inc()
}

// IncLoyaltyAward records one award attempt (ok, replay, skip, error).
// reason should match loyalty ledger reasons (order_paid, review, …).
func IncLoyaltyAward(reason, result string) {
	if reason == "" {
		reason = "unknown"
	}
	if result == "" {
		result = ResultError
	}
	loyaltyAwards.WithLabelValues(reason, result).Inc()
}

// IncLoyaltyRedeem records one redeem attempt (ok, replay, insufficient, error).
func IncLoyaltyRedeem(result string) {
	if result == "" {
		result = ResultError
	}
	loyaltyRedeems.WithLabelValues(result).Inc()
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
