package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
	"github.com/segmentio/kafka-go/sasl"
	"github.com/segmentio/kafka-go/sasl/scram"
)

type Config struct {
	// ── App ──────────────────────────────────────────────────────────────────
	Env        string `envconfig:"ENV" default:"development"`
	ServerPort string `envconfig:"SERVER_PORT" default:"8080"`

	// CORSAllowedOrigins is a comma-separated allow-list of browser origins.
	// Defaults to "*" for development; set explicit origins in production.
	CORSAllowedOrigins []string `envconfig:"CORS_ALLOWED_ORIGINS" default:"*"`

	// TrustedProxies is the set of proxy IPs/CIDRs to trust for client-IP
	// resolution (X-Forwarded-For). Empty leaves Gin's default (trust every hop)
	// which is fine locally. Required in production: set to the ingress/nginx
	// CIDR (compose default 172.16.0.0/12). Do not use 0.0.0.0/0 — that re-opens
	// XFF spoofing of login/OTP/global rate limits.
	TrustedProxies []string `envconfig:"TRUSTED_PROXIES"`

	// Admin bootstrap — when both are set, an admin account is created on first
	// boot if one does not already exist.
	AdminEmail    string `envconfig:"ADMIN_EMAIL"`
	AdminPassword string `envconfig:"ADMIN_PASSWORD"`

	// ── Main Database (PostgreSQL) ────────────────────────────────────────────
	DBHost     string `envconfig:"DB_HOST" required:"true"`
	DBPort     string `envconfig:"DB_PORT" default:"5432"`
	DBUser     string `envconfig:"DB_USER" required:"true"`
	DBPassword string `envconfig:"DB_PASSWORD" required:"true"`
	DBName     string `envconfig:"DB_NAME" required:"true"`
	DBSSLMode  string `envconfig:"DB_SSL_MODE" default:"disable"`

	// ── Analytics Database (TimescaleDB) ─────────────────────────────────────
	AnalyticsDBHost     string `envconfig:"ANALYTICS_DB_HOST" required:"true"`
	AnalyticsDBPort     string `envconfig:"ANALYTICS_DB_PORT" default:"5432"`
	AnalyticsDBUser     string `envconfig:"ANALYTICS_DB_USER" required:"true"`
	AnalyticsDBPassword string `envconfig:"ANALYTICS_DB_PASSWORD" required:"true"`
	AnalyticsDBName     string `envconfig:"ANALYTICS_DB_NAME" required:"true"`
	AnalyticsDBSSLMode  string `envconfig:"ANALYTICS_DB_SSL_MODE" default:"disable"`

	// ── Redis ─────────────────────────────────────────────────────────────────
	RedisAddr     string `envconfig:"REDIS_ADDR" default:"localhost:6379"`
	RedisPassword string `envconfig:"REDIS_PASSWORD" default:""`
	RedisDB       int    `envconfig:"REDIS_DB" default:"0"`

	// CacheBreakerThreshold is the number of consecutive cache failures that trips
	// the circuit breaker open, after which calls short-circuit (reads degrade to
	// a miss) for CacheBreakerCooldown before a single probe is allowed through.
	CacheBreakerThreshold int           `envconfig:"CACHE_BREAKER_THRESHOLD" default:"5"`
	CacheBreakerCooldown  time.Duration `envconfig:"CACHE_BREAKER_COOLDOWN" default:"10s"`

	// ── Database retries ──────────────────────────────────────────────────────
	// DBRetryMaxAttempts bounds total tries (the first plus retries) for an
	// operation wrapped in database.WithRetry; <2 disables retrying. Only transient
	// errors (serialization 40001, deadlock 40P01, connection resets) are retried
	// — never business errors. DBRetryBaseBackoff is the first backoff; it doubles
	// each retry.
	DBRetryMaxAttempts int           `envconfig:"DB_RETRY_MAX_ATTEMPTS" default:"3"`
	DBRetryBaseBackoff time.Duration `envconfig:"DB_RETRY_BASE_BACKOFF" default:"50ms"`

	// ── JWT ───────────────────────────────────────────────────────────────────
	JWTSecret          string `envconfig:"JWT_SECRET" required:"true"`
	JWTAccessTokenTTL  int    `envconfig:"JWT_ACCESS_TTL" default:"15"`     // minutes
	JWTRefreshTokenTTL int    `envconfig:"JWT_REFRESH_TTL" default:"10080"` // 7 days in minutes

	// ── Email ─────────────────────────────────────────────────────────────────
	SMTPHost     string `envconfig:"SMTP_HOST"`
	SMTPPort     int    `envconfig:"SMTP_PORT" default:"587"`
	SMTPUser     string `envconfig:"SMTP_USER"`
	SMTPPassword string `envconfig:"SMTP_PASSWORD"`
	SMTPFrom     string `envconfig:"SMTP_FROM"`

	// ── SMS / OTP ─────────────────────────────────────────────────────────────
	// SMSProvider selects the gateway: "kavenegar" for the real provider, or "log"
	// (default) which just logs the message — fine for dev (the OTP appears in the
	// logs) and CI. OTPTTL bounds how long a requested code stays valid.
	SMSProvider string        `envconfig:"SMS_PROVIDER" default:"log"`
	SMSAPIKey   string        `envconfig:"SMS_API_KEY"`
	SMSSender   string        `envconfig:"SMS_SENDER"`
	OTPTTL      time.Duration `envconfig:"OTP_TTL" default:"2m"`
	// SMSBaseURL is the provider REST origin. Overridable so staging can point at
	// a sandbox/mock gateway without a code change.
	SMSBaseURL string `envconfig:"SMS_BASE_URL" default:"https://api.kavenegar.com/v1"`
	// SMSTimeout bounds a single send; the gateway is off the request path but a
	// hung call still pins a worker goroutine.
	SMSTimeout time.Duration `envconfig:"SMS_TIMEOUT" default:"8s"`

	// PublicSiteURL is the storefront's public origin, used to build links in
	// outbound emails (e.g. alert "view product" links).
	PublicSiteURL string `envconfig:"PUBLIC_SITE_URL" default:"http://localhost:3000"`

	// ── Notifications / Kafka ─────────────────────────────────────────────────
	// NotificationsMode: "inline" (default) sends SMS/email from the API process;
	// "async" writes notification_outbox and relies on notification-worker + Kafka.
	NotificationsMode string `envconfig:"NOTIFICATIONS_MODE" default:"inline"`
	// KafkaBrokers is a comma-separated list (e.g. localhost:19092). Required for
	// async outbox relay and consumer worker.
	KafkaBrokers []string `envconfig:"KAFKA_BROKERS"`
	// NotificationWorkerGroup is the Kafka consumer group id.
	NotificationWorkerGroup string `envconfig:"NOTIFICATION_WORKER_GROUP" default:"rumera-notification-worker"`
	// KafkaSASLMechanism enables broker authentication: "" (default) dials
	// unauthenticated, which is what local dev and CI use. Supported values are
	// "scram-sha-256" and "scram-sha-512". PLAIN is deliberately not supported —
	// it ships the password in the clear on every handshake and nothing in this
	// deploy needs it.
	KafkaSASLMechanism string `envconfig:"KAFKA_SASL_MECHANISM"`
	KafkaSASLUsername  string `envconfig:"KAFKA_SASL_USERNAME"`
	KafkaSASLPassword  string `envconfig:"KAFKA_SASL_PASSWORD"`
	// KafkaTLSEnabled wraps broker connections in TLS (system root CAs).
	// Independent of SASL: SCRAM over a plaintext link still leaks nothing but
	// the salted proof, but every message body would be readable on the wire.
	KafkaTLSEnabled bool `envconfig:"KAFKA_TLS_ENABLED" default:"false"`

	// ── Domain events (transactional outbox) ─────────────────────────────────
	// Facts ("the order was paid") written to domain_events inside the same
	// Postgres transaction as the business write, then fanned out to idempotent
	// consumers. Distinct from notification_outbox, which carries commands
	// ("send this SMS").
	//
	// EventsEnabled gates the whole subsystem. When false, producers skip the
	// enqueue entirely and the legacy in-request side effects stay in charge —
	// the escape hatch if the bus ever misbehaves in production.
	EventsEnabled bool `envconfig:"EVENTS_ENABLED" default:"true"`
	// EventsBus selects the transport: "postgres" (default) consumes straight
	// from the outbox and needs no broker; "kafka" relays to a topic first.
	// Consumers are identical either way.
	EventsBus string `envconfig:"EVENTS_BUS" default:"postgres"`
	// EventsWorker controls where consumers run: "embedded" (in the API
	// process), "off" (a separate worker owns them), or "external" (alias for
	// off, kept for readability in deploy files).
	EventsWorker string `envconfig:"EVENTS_WORKER" default:"embedded"`
	// EventsConsumerGroup is the Kafka consumer group id (kafka bus only).
	EventsConsumerGroup string `envconfig:"EVENTS_CONSUMER_GROUP" default:"rumera-event-worker"`

	// Loop tuning. The defaults trade ~1s of added latency on side effects for a
	// trivial idle query load; lower the intervals if a consumer needs to feel
	// instant.
	EventsFanOutInterval  time.Duration `envconfig:"EVENTS_FANOUT_INTERVAL" default:"1s"`
	EventsFanOutBatch     int           `envconfig:"EVENTS_FANOUT_BATCH" default:"100"`
	EventsConsumeInterval time.Duration `envconfig:"EVENTS_CONSUME_INTERVAL" default:"1s"`
	EventsConsumeBatch    int           `envconfig:"EVENTS_CONSUME_BATCH" default:"50"`
	EventsRelayInterval   time.Duration `envconfig:"EVENTS_RELAY_INTERVAL" default:"1s"`
	EventsRelayBatch      int           `envconfig:"EVENTS_RELAY_BATCH" default:"100"`
	// EventsConcurrency is how many handlers run at once. Each holds a pool
	// connection while working, so keep it well under the pool size.
	EventsConcurrency int `envconfig:"EVENTS_CONCURRENCY" default:"4"`

	// EventsFallbackAfter is the staleness gate on the Postgres fan-out in Kafka
	// mode (K-4). A fact the broker has not delivered within this window is fanned
	// out locally instead, so a broker outage delays order.paid side effects by
	// minutes rather than stopping them. Ignored when EVENTS_BUS=postgres.
	// This is what makes the single-broker/RF=1 decision safe — do not raise it
	// above EVENTS_BACKOFF_MAX without re-reading Q1.
	EventsFallbackAfter time.Duration `envconfig:"EVENTS_FALLBACK_AFTER" default:"5m"`

	// Retry budget. A consumer that keeps failing is dead-lettered after
	// EventsMaxAttempts tries with exponential backoff between EventsBackoffBase
	// and EventsBackoffMax. Permanent failures skip the budget entirely.
	EventsMaxAttempts    int           `envconfig:"EVENTS_MAX_ATTEMPTS" default:"8"`
	EventsBackoffBase    time.Duration `envconfig:"EVENTS_BACKOFF_BASE" default:"2s"`
	EventsBackoffMax     time.Duration `envconfig:"EVENTS_BACKOFF_MAX" default:"1h"`
	EventsHandlerTimeout time.Duration `envconfig:"EVENTS_HANDLER_TIMEOUT" default:"30s"`
	// EventsMetricsInterval is how often lag and ledger depth are sampled.
	EventsMetricsInterval time.Duration `envconfig:"EVENTS_METRICS_INTERVAL" default:"15s"`

	// Retention. Nothing pruned the bus before, so both tables grew forever.
	// Only fully-settled facts are eligible; anything pending, retrying or
	// dead-lettered is kept so it stays replayable.
	EventsRetention         time.Duration `envconfig:"EVENTS_RETENTION" default:"720h"` // 30 days
	CronEventsPruneSchedule string        `envconfig:"CRON_EVENTS_PRUNE_SCHEDULE" default:"0 45 3 * * *"`

	// ── Loyalty (Cellar Club) ─────────────────────────────────────────────────
	// LoyaltyEarnDivisor: Toman of order total per 1 point earned.
	// LoyaltyRedeemValue: Toman of wallet credit per 1 point redeemed.
	// LoyaltySignupBonus: points granted once on account creation (0 = off).
	LoyaltyEarnDivisor float64 `envconfig:"LOYALTY_EARN_DIVISOR" default:"10000"`
	LoyaltyRedeemValue float64 `envconfig:"LOYALTY_REDEEM_VALUE" default:"1000"`
	LoyaltySignupBonus int     `envconfig:"LOYALTY_SIGNUP_BONUS" default:"100"`
	// LoyaltyReferralReward: points granted to BOTH referrer and referee when the
	// referee's first order is paid.
	LoyaltyReferralReward int `envconfig:"LOYALTY_REFERRAL_REWARD" default:"300"`
	// LoyaltyReviewBonus: points for a verified-purchase review (0 = off). PH-040b.
	LoyaltyReviewBonus int `envconfig:"LOYALTY_REVIEW_BONUS" default:"50"`
	// LoyaltyBirthdayBonus: points once per calendar year (0 = off). PH-040b.
	LoyaltyBirthdayBonus int `envconfig:"LOYALTY_BIRTHDAY_BONUS" default:"200"`
	// LoyaltyBirthdayTZ: IANA timezone for birthday calendar day (default Asia/Tehran).
	LoyaltyBirthdayTZ string `envconfig:"LOYALTY_BIRTHDAY_TZ" default:"Asia/Tehran"`
	// CronLoyaltyBirthdaySchedule: daily birthday award job (6-field UTC cron).
	CronLoyaltyBirthdaySchedule string `envconfig:"CRON_LOYALTY_BIRTHDAY_SCHEDULE" default:"0 15 1 * * *"`

	// ── Storage ───────────────────────────────────────────────────────────────
	StoragePath string `envconfig:"STORAGE_PATH" default:"./storage"`

	// ── Media (product images) ────────────────────────────────────────────────
	// Uploaded images are stored as originals under MediaRoot and served
	// resized/recompressed on the fly via GET /media/{key}. Rendered variants are
	// cached under MediaCacheDir. Persisted upload URLs are always canonical,
	// environment-independent /media/... paths.
	MediaRoot               string   `envconfig:"MEDIA_ROOT" default:"./storage/media"`
	MediaCacheDir           string   `envconfig:"MEDIA_CACHE_DIR" default:"./storage/media-cache"`
	MediaMaxUploadMB        int      `envconfig:"MEDIA_MAX_UPLOAD_MB" default:"15"`
	MediaAllowedFormats     []string `envconfig:"MEDIA_ALLOWED_FORMATS" default:"avif,webp,jpeg,png"`
	MediaDefaultQuality     int      `envconfig:"MEDIA_DEFAULT_QUALITY" default:"80"`
	MediaMaxDimension       int      `envconfig:"MEDIA_MAX_DIMENSION" default:"4000"`
	MediaMaxSourceDimension int      `envconfig:"MEDIA_MAX_SOURCE_DIMENSION" default:"12000"`
	MediaMaxSourcePixels    int64    `envconfig:"MEDIA_MAX_SOURCE_PIXELS" default:"40000000"`

	// ── Meilisearch (PH-030b readiness; storefront still uses Postgres ILIKE) ─
	// MeiliEnabled gates client connect + reindex cron. Default false so local
	// API boots without Meili. When true and Meili is down, boot continues with
	// a warning and the reindex job is skipped (same fail-soft pattern as Redis).
	MeiliEnabled  bool   `envconfig:"MEILI_ENABLED" default:"false"`
	MeiliHost     string `envconfig:"MEILI_HOST" default:"http://localhost:7700"`
	MeiliAPIKey   string `envconfig:"MEILI_API_KEY"`
	MeiliIndexUID string `envconfig:"MEILI_INDEX_UID" default:"products"`

	// ── Crypto Payment ────────────────────────────────────────────────────────
	CryptoAPIKey     string `envconfig:"CRYPTO_API_KEY"`
	CryptoWebhookKey string `envconfig:"CRYPTO_WEBHOOK_KEY"`

	// PaymentStartBaseURL is the gateway pay-start origin. Intents append
	// ?transaction_id=<id> (PR-005a). Required in production; empty in
	// development leaves payment_url blank (does not fake a successful pay).
	PaymentStartBaseURL string `envconfig:"PAYMENT_START_BASE_URL"`

	// ── Observability ─────────────────────────────────────────────────────────
	// MetricsEnabled toggles the Prometheus /metrics endpoint and the per-request
	// metrics middleware. Default on.
	MetricsEnabled bool `envconfig:"METRICS_ENABLED" default:"true"`
	// MetricsBearerToken, when set, requires Authorization: Bearer <token> on
	// GET /metrics. In production MetricsEnabled=true requires a non-empty token
	// so the scrape surface is never open by accident.
	MetricsBearerToken string `envconfig:"METRICS_BEARER_TOKEN"`

	// ── Tracing (OpenTelemetry) ───────────────────────────────────────────────
	// OTELEnabled gates all tracing wiring: the tracer provider, the otelgin HTTP
	// middleware and pgx query instrumentation. Default off — when false nothing
	// is installed and the global provider stays the no-op one, so there is zero
	// overhead and no export attempts.
	OTELEnabled bool `envconfig:"OTEL_ENABLED" default:"false"`
	// OTELServiceName labels every span with the emitting service.
	OTELServiceName string `envconfig:"OTEL_SERVICE_NAME" default:"rumera-backend"`
	// OTELExporterEndpoint is the OTLP/gRPC collector address (host:port, no
	// scheme). Exported insecurely (no TLS) — front it with a local collector.
	OTELExporterEndpoint string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT" default:"localhost:4317"`
	// OTELSamplerRatio is the head-sampling probability for root spans (0..1).
	// 1.0 samples everything (fine for dev); lower it in production.
	OTELSamplerRatio float64 `envconfig:"OTEL_SAMPLER_RATIO" default:"1.0"`

	// ── Background jobs (cron) ────────────────────────────────────────────────
	// Schedules are 6-field cron expressions (the runner is configured WithSeconds),
	// evaluated in UTC. Set CRON_ENABLED=false to run the API without the
	// in-process scheduler (e.g. when jobs are run by a dedicated worker).
	CronEnabled bool `envconfig:"CRON_ENABLED" default:"true"`

	// Analytics roll-ups. They aggregate "yesterday", so they run shortly after
	// midnight UTC, staggered to avoid hammering the analytics DB at once.
	CronProductStatsSchedule  string `envconfig:"CRON_PRODUCT_STATS_SCHEDULE" default:"0 15 2 * * *"`
	CronRevenueStatsSchedule  string `envconfig:"CRON_REVENUE_STATS_SCHEDULE" default:"0 30 2 * * *"`
	CronSearchSummarySchedule string `envconfig:"CRON_SEARCH_SUMMARY_SCHEDULE" default:"0 45 2 * * *"`

	// Recommendation profile refresh — rebuilds affinity profiles for recently
	// active users so /recommendations/for-you serves from a warm cache instead
	// of computing on the request path.
	CronRecsRefreshSchedule   string `envconfig:"CRON_RECS_REFRESH_SCHEDULE" default:"0 0 3 * * *"`
	CronRecsRefreshWindowDays int    `envconfig:"CRON_RECS_REFRESH_WINDOW_DAYS" default:"30"`
	CronRecsRefreshMaxUsers   int    `envconfig:"CRON_RECS_REFRESH_MAX_USERS" default:"5000"`

	// Idempotency-key housekeeping: prune stored payment/webhook responses older
	// than the retention window so idempotency_keys doesn't grow unbounded.
	CronIdempotencyCleanupSchedule string        `envconfig:"CRON_IDEMPOTENCY_CLEANUP_SCHEDULE" default:"0 30 3 * * *"`
	IdempotencyKeyRetention        time.Duration `envconfig:"IDEMPOTENCY_KEY_RETENTION" default:"720h"` // 30 days

	// Product alert checker: scans back-in-stock / price-drop subscriptions and
	// emails the ones now satisfied. Runs every 15 minutes by default.
	CronAlertCheckSchedule string `envconfig:"CRON_ALERT_CHECK_SCHEDULE" default:"0 */15 * * * *"`

	// Subscription renewal: emails customers whose cellar box is due and advances
	// the next renewal date. Runs daily at 04:00 UTC by default.
	CronSubscriptionSchedule string `envconfig:"CRON_SUBSCRIPTION_SCHEDULE" default:"0 0 4 * * *"`

	// Meili full reindex — only registered when MEILI_ENABLED and client connected.
	// Default 04:30 UTC (after subscription job). Storefront is NOT switched by this job.
	CronMeiliReindexSchedule string `envconfig:"CRON_MEILI_REINDEX_SCHEDULE" default:"0 30 4 * * *"`
}

// ── DSN helpers ───────────────────────────────────────────────────────────────

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func (c *Config) AnalyticsDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
		c.AnalyticsDBHost, c.AnalyticsDBPort, c.AnalyticsDBUser,
		c.AnalyticsDBPassword, c.AnalyticsDBName, c.AnalyticsDBSSLMode,
	)
}

// ── Environment helpers ───────────────────────────────────────────────────────

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

// ── Loader ────────────────────────────────────────────────────────────────────

func Load() (*Config, error) {
	// Only load .env file when running locally (outside Docker).
	// In Docker, env_file in docker-compose handles this.
	if _, err := os.Stat(".env"); err == nil {
		godotenv.Load(".env")
	}

	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return &cfg, nil
}

// Validate fails fast on configuration values that are nonsensical rather than
// letting them surface as confusing runtime behaviour (a sampler that never
// samples, a breaker that can't trip, a retry loop that never retries). It is
// called by Load after the environment is parsed.
func (c *Config) Validate() error {
	if c.OTELSamplerRatio < 0 || c.OTELSamplerRatio > 1 {
		return fmt.Errorf("OTEL_SAMPLER_RATIO must be in [0,1], got %v", c.OTELSamplerRatio)
	}
	if c.CacheBreakerThreshold < 1 {
		return fmt.Errorf("CACHE_BREAKER_THRESHOLD must be >= 1, got %d", c.CacheBreakerThreshold)
	}
	if c.CacheBreakerCooldown <= 0 {
		return fmt.Errorf("CACHE_BREAKER_COOLDOWN must be > 0, got %s", c.CacheBreakerCooldown)
	}
	if c.DBRetryMaxAttempts < 1 {
		return fmt.Errorf("DB_RETRY_MAX_ATTEMPTS must be >= 1, got %d", c.DBRetryMaxAttempts)
	}
	if c.DBRetryBaseBackoff <= 0 {
		return fmt.Errorf("DB_RETRY_BASE_BACKOFF must be > 0, got %s", c.DBRetryBaseBackoff)
	}
	if c.MediaDefaultQuality < 1 || c.MediaDefaultQuality > 100 {
		return fmt.Errorf("MEDIA_DEFAULT_QUALITY must be in [1,100], got %d", c.MediaDefaultQuality)
	}
	if c.MediaMaxUploadMB < 1 {
		return fmt.Errorf("MEDIA_MAX_UPLOAD_MB must be >= 1, got %d", c.MediaMaxUploadMB)
	}
	if c.MediaMaxDimension < 1 {
		return fmt.Errorf("MEDIA_MAX_DIMENSION must be >= 1, got %d", c.MediaMaxDimension)
	}
	if c.MediaMaxSourceDimension < 1 {
		return fmt.Errorf("MEDIA_MAX_SOURCE_DIMENSION must be >= 1, got %d", c.MediaMaxSourceDimension)
	}
	if c.MediaMaxSourcePixels < 1 {
		return fmt.Errorf("MEDIA_MAX_SOURCE_PIXELS must be >= 1, got %d", c.MediaMaxSourcePixels)
	}
	// Events. A zero value means "not set" — a hand-built Config (tests, other
	// entrypoints) never goes through envconfig, so normalise rather than reject
	// and only fail on values that were explicitly wrong.
	if c.EventsBus == "" {
		c.EventsBus = "postgres"
	}
	if c.EventsWorker == "" {
		c.EventsWorker = "embedded"
	}
	switch c.EventsBus {
	case "postgres", "kafka":
	default:
		return fmt.Errorf("EVENTS_BUS must be \"postgres\" or \"kafka\", got %q", c.EventsBus)
	}
	switch c.EventsWorker {
	case "embedded", "off", "external":
	default:
		return fmt.Errorf("EVENTS_WORKER must be \"embedded\", \"off\" or \"external\", got %q", c.EventsWorker)
	}
	// "off" means nothing anywhere consumes the facts — while the producers have
	// already stood the legacy in-request side effects down. Receipts, loyalty and
	// recommendation signals would stop entirely, silently. Fail loudly instead.
	// "external" is fine: cmd/event-worker runs the loops in its own process.
	if c.EventsEnabled && c.EventsWorker == "off" {
		return fmt.Errorf(
			"EVENTS_WORKER=\"off\" with EVENTS_ENABLED=true would leave order.paid facts with no consumer " +
				"— set EVENTS_WORKER=embedded (consumers in the API process) or external (run cmd/event-worker " +
				"alongside it), or EVENTS_ENABLED=false to keep the legacy in-request side effects")
	}
	// Kafka mode with no brokers would boot fine and then silently never relay:
	// facts would pile up in the outbox with nothing consuming them.
	if c.EventsEnabled && c.EventsBus == "kafka" && len(nonEmpty(c.KafkaBrokers)) == 0 {
		return fmt.Errorf("EVENTS_BUS=kafka requires KAFKA_BROKERS (or set EVENTS_BUS=postgres)")
	}
	// A typo'd mechanism, or credentials that never got mounted, must not fall
	// through to "dial the broker unauthenticated" — that is a production broker
	// silently open to anyone who can reach the port. Fail at boot instead.
	if strings.TrimSpace(c.KafkaSASLMechanism) != "" &&
		(strings.TrimSpace(c.KafkaSASLUsername) == "" || c.KafkaSASLPassword == "") {
		return fmt.Errorf("KAFKA_SASL_MECHANISM=%q requires KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD",
			c.KafkaSASLMechanism)
	}
	// Builds the mechanism for real, so an unsupported name or a credential
	// SASLprep rejects is a boot failure rather than a first-publish failure.
	if _, err := c.KafkaSASL(); err != nil {
		return err
	}
	if c.EventsMaxAttempts < 0 {
		return fmt.Errorf("EVENTS_MAX_ATTEMPTS must be >= 1, got %d", c.EventsMaxAttempts)
	}
	if c.EventsConcurrency < 0 {
		return fmt.Errorf("EVENTS_CONCURRENCY must be >= 1, got %d", c.EventsConcurrency)
	}
	if c.EventsBackoffBase < 0 {
		return fmt.Errorf("EVENTS_BACKOFF_BASE must be > 0, got %s", c.EventsBackoffBase)
	}
	if c.EventsBackoffMax > 0 && c.EventsBackoffBase > 0 && c.EventsBackoffMax < c.EventsBackoffBase {
		return fmt.Errorf("EVENTS_BACKOFF_MAX (%s) must be >= EVENTS_BACKOFF_BASE (%s)", c.EventsBackoffMax, c.EventsBackoffBase)
	}
	if c.EventsRetention < 0 {
		return fmt.Errorf("EVENTS_RETENTION must be > 0, got %s", c.EventsRetention)
	}

	if raw := strings.TrimSpace(c.PaymentStartBaseURL); raw != "" {
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return fmt.Errorf("PAYMENT_START_BASE_URL must be an absolute http(s) URL, got %q", raw)
		}
	}

	// Production-only guards against fail-open / insecure defaults that are fine
	// for local dev but dangerous if they ship. Each would otherwise surface as a
	// silent security hole rather than a loud boot failure.
	if c.IsProduction() {
		if len(c.JWTSecret) < 32 {
			return fmt.Errorf("JWT_SECRET must be at least 32 characters in production, got %d", len(c.JWTSecret))
		}
		for _, o := range c.CORSAllowedOrigins {
			if o == "*" {
				return fmt.Errorf("CORS_ALLOWED_ORIGINS must not be \"*\" in production — set explicit origins")
			}
		}
		if c.CryptoWebhookKey == "" {
			return fmt.Errorf("CRYPTO_WEBHOOK_KEY is required in production (payment webhooks fail closed without it, so orders never confirm)")
		}
		if strings.TrimSpace(c.PaymentStartBaseURL) == "" {
			return fmt.Errorf("PAYMENT_START_BASE_URL is required in production (wallet/gift/checkout intents have no gateway start URL without it)")
		}
		if c.SMSProvider == "log" {
			return fmt.Errorf("SMS_PROVIDER must be a real gateway in production, not \"log\" (which writes OTP codes to the logs)")
		}
		if c.MetricsEnabled && strings.TrimSpace(c.MetricsBearerToken) == "" {
			return fmt.Errorf("METRICS_BEARER_TOKEN is required in production when METRICS_ENABLED=true (or set METRICS_ENABLED=false)")
		}
		if !hasTrustedProxy(c.TrustedProxies) {
			return fmt.Errorf("TRUSTED_PROXIES is required in production (comma-separated IPs/CIDRs of the ingress; empty leaves Gin trusting every hop so X-Forwarded-For can spoof login/OTP rate limits)")
		}
	}
	return nil
}

// hasTrustedProxy reports whether at least one non-blank proxy/CIDR is set.
func hasTrustedProxy(proxies []string) bool {
	return len(nonEmpty(proxies)) > 0
}

// nonEmpty drops blank entries left by trailing commas in a list env var.
func nonEmpty(in []string) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		if strings.TrimSpace(s) != "" {
			out = append(out, strings.TrimSpace(s))
		}
	}
	return out
}

// EventsWorkerEmbedded reports whether the API process should run the event
// consumers itself.
func (c *Config) EventsWorkerEmbedded() bool {
	return c.EventsEnabled && c.EventsWorker == "embedded"
}

// KafkaBrokerList is the cleaned broker list.
func (c *Config) KafkaBrokerList() []string { return nonEmpty(c.KafkaBrokers) }

// KafkaSASL builds the broker authentication mechanism, or nil when
// KAFKA_SASL_MECHANISM is empty (the unauthenticated local/dev path).
// Validate calls this too, so by the time anything dials, the error is spent.
func (c *Config) KafkaSASL() (sasl.Mechanism, error) {
	switch mech := strings.ToLower(strings.TrimSpace(c.KafkaSASLMechanism)); mech {
	case "":
		return nil, nil
	case "scram-sha-256":
		return scram.Mechanism(scram.SHA256, c.KafkaSASLUsername, c.KafkaSASLPassword)
	case "scram-sha-512":
		return scram.Mechanism(scram.SHA512, c.KafkaSASLUsername, c.KafkaSASLPassword)
	default:
		return nil, fmt.Errorf(
			`KAFKA_SASL_MECHANISM must be empty, "scram-sha-256" or "scram-sha-512", got %q`, mech)
	}
}
