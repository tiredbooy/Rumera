package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	// ── App ──────────────────────────────────────────────────────────────────
	Env        string `envconfig:"ENV" default:"development"`
	ServerPort string `envconfig:"SERVER_PORT" default:"8080"`

	// CORSAllowedOrigins is a comma-separated allow-list of browser origins.
	// Defaults to "*" for development; set explicit origins in production.
	CORSAllowedOrigins []string `envconfig:"CORS_ALLOWED_ORIGINS" default:"*"`

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

	// PublicSiteURL is the storefront's public origin, used to build links in
	// outbound emails (e.g. alert "view product" links).
	PublicSiteURL string `envconfig:"PUBLIC_SITE_URL" default:"http://localhost:3000"`

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

	// ── Storage ───────────────────────────────────────────────────────────────
	StoragePath string `envconfig:"STORAGE_PATH" default:"./storage"`

	// ── Meilisearch ───────────────────────────────────────────────────────────
	MeiliHost   string `envconfig:"MEILI_HOST" default:"http://localhost:7700"`
	MeiliAPIKey string `envconfig:"MEILI_API_KEY"`

	// ── Crypto Payment ────────────────────────────────────────────────────────
	CryptoAPIKey     string `envconfig:"CRYPTO_API_KEY"`
	CryptoWebhookKey string `envconfig:"CRYPTO_WEBHOOK_KEY"`

	// ── Observability ─────────────────────────────────────────────────────────
	// MetricsEnabled toggles the Prometheus /metrics endpoint and the per-request
	// metrics middleware. Default on: the endpoint is cheap and intended to be
	// scraped over an internal network only (do not expose it publicly).
	MetricsEnabled bool `envconfig:"METRICS_ENABLED" default:"true"`

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
	return nil
}
