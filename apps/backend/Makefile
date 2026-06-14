# ─── Load .env file ───────────────────────────────────────────────
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# ─── DSNs ─────────────────────────────────────────────────────────
DB_DSN=host=$(DB_HOST) user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) sslmode=$(DB_SSL_MODE)
ANALYTICS_DSN=host=$(ANALYTICS_DB_HOST) user=$(ANALYTICS_DB_USER) password=$(ANALYTICS_DB_PASSWORD) dbname=$(ANALYTICS_DB_NAME) sslmode=$(ANALYTICS_DB_SSL_MODE) port=$(ANALYTICS_DB_PORT)

# ─── Main DB Migrations ───────────────────────────────────────────
.PHONY: migrate-up
migrate-up:
	goose -dir migrations/main postgres "$(DB_DSN)" up

.PHONY: migrate-down
migrate-down:
	goose -dir migrations/main postgres "$(DB_DSN)" down

.PHONY: migrate-status
migrate-status:
	goose -dir migrations/main postgres "$(DB_DSN)" status

.PHONY: migrate-reset
migrate-reset:
	goose -dir migrations/main postgres "$(DB_DSN)" reset

.PHONY: migrate-create
migrate-create:
	goose -dir migrations/main create $(name) sql
# usage: make migrate-create name=create_users

# ─── Analytics DB Migrations ──────────────────────────────────────
.PHONY: analytics-up
analytics-up:
	goose -dir migrations/analytics postgres "$(ANALYTICS_DSN)" up

.PHONY: analytics-down
analytics-down:
	goose -dir migrations/analytics postgres "$(ANALYTICS_DSN)" down

.PHONY: analytics-status
analytics-status:
	goose -dir migrations/analytics postgres "$(ANALYTICS_DSN)" status

.PHONY: analytics-reset
analytics-reset:
	goose -dir migrations/analytics postgres "$(ANALYTICS_DSN)" reset

.PHONY: analytics-create
analytics-create:
	goose -dir migrations/analytics create $(name) sql
# usage: make analytics-create name=create_events

# ─── Run both at once ─────────────────────────────────────────────
.PHONY: migrate-all-up
migrate-all-up: migrate-up analytics-up
	@echo "✅ All migrations applied"

.PHONY: migrate-all-down
migrate-all-down: migrate-down analytics-down
	@echo "✅ All migrations rolled back"

# ─── App ──────────────────────────────────────────────────────────
.PHONY: run
run:
	go run ./cmd/server/main.go

.PHONY: build
build:
	go build -o bin/server ./cmd/server/main.go

.PHONY: test
test:
	go test ./... -v

.PHONY: tidy
tidy:
	go mod tidy

# ─── Quality gate ─────────────────────────────────────────────────
.PHONY: lint
lint:
	golangci-lint run

.PHONY: test-unit
test-unit:
	go test ./...

# Integration suite (tag-gated). Needs Docker for testcontainers.
.PHONY: test-integration
test-integration:
	go test -tags=integration -count=1 ./tests/integration/...

.PHONY: cover
cover:
	go test ./... -coverprofile=coverage.out -covermode=atomic
	go tool cover -func=coverage.out | tail -1

# ─── Docker ───────────────────────────────────────────────────────
.PHONY: docker-up
docker-up:
	docker compose up -d

.PHONY: docker-down
docker-down:
	docker compose down

.PHONY: docker-logs
docker-logs:
	docker compose logs -f