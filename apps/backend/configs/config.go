package config

import (
	"fmt"
	"os"

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

	// ── Storage ───────────────────────────────────────────────────────────────
	StoragePath string `envconfig:"STORAGE_PATH" default:"./storage"`

	// ── Meilisearch ───────────────────────────────────────────────────────────
	MeiliHost   string `envconfig:"MEILI_HOST" default:"http://localhost:7700"`
	MeiliAPIKey string `envconfig:"MEILI_API_KEY"`

	// ── Crypto Payment ────────────────────────────────────────────────────────
	CryptoAPIKey     string `envconfig:"CRYPTO_API_KEY"`
	CryptoWebhookKey string `envconfig:"CRYPTO_WEBHOOK_KEY"`
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

	return &cfg, nil
}
