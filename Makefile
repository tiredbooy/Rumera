# ──────────────────────────────────────────────────────────────────────────────
# Rumera monorepo — Docker orchestration shortcuts.
#
#   make            # show this help
#   make dev        # start the full dev stack with live hot-reload (watch)
#   make dev-down   # stop the dev stack
#   make prod       # build + start the optimized production stack (detached)
#   make prod-down  # stop the production stack
#
# First run? Just `make dev` — it auto-creates .env.dev from the template.
# Migrations run automatically on backend boot; no manual step needed.
# ──────────────────────────────────────────────────────────────────────────────

DC        ?= docker compose

DEV_ENV   := .env.dev
PROD_ENV  := .env.prod

DEV       := $(DC) --env-file $(DEV_ENV)  -f docker-compose.dev.yml
PROD      := $(DC) --env-file $(PROD_ENV) -f docker-compose.prod.yml

# Optional: scope logs/exec to a single service, e.g.  make dev-logs SVC=backend
SVC       ?=

.DEFAULT_GOAL := help

# ── Environment bootstrap ─────────────────────────────────────────────────────
# The compose targets depend on these files; the rules below create them from the
# committed templates on first use so nothing fails with "env file not found".

$(DEV_ENV):
	@cp .env.dev.example  $(DEV_ENV)  && echo "✅ created $(DEV_ENV) from template — review it if you like."

$(PROD_ENV):
	@cp .env.prod.example $(PROD_ENV) && echo "⚠️  created $(PROD_ENV) from template — EDIT the [REQUIRED] secrets before deploying!"

.PHONY: env
env: $(DEV_ENV) $(PROD_ENV) ## Create .env.dev and .env.prod from the templates (if missing)
	@echo "Environment files ready."

## ── Development ───────────────────────────────────────────────────────────────

.PHONY: dev
dev: $(DEV_ENV) ## Start the dev stack with Compose Watch (frontend + backend hot reload)
	$(DEV) up --build --watch

.PHONY: dev-up
dev-up: $(DEV_ENV) ## Start the dev stack in the background (no watch)
	$(DEV) up --build -d

.PHONY: dev-down
dev-down: ## Stop the dev stack
	$(DEV) down

.PHONY: dev-restart
dev-restart: ## Restart dev services (use SVC=backend to scope)
	$(DEV) restart $(SVC)

.PHONY: dev-rebuild
dev-rebuild: $(DEV_ENV) ## Force a clean rebuild of dev images and start detached
	$(DEV) up --build --force-recreate -d $(SVC)

.PHONY: dev-logs
dev-logs: ## Tail dev logs (use SVC=backend to scope)
	$(DEV) logs -f --tail=100 $(SVC)

.PHONY: dev-nuke
dev-nuke: ## Stop the dev stack AND delete its volumes (DESTRUCTIVE: wipes the DB)
	$(DEV) down -v

## ── Production ────────────────────────────────────────────────────────────────

.PHONY: prod
prod: $(PROD_ENV) ## Build + start the production stack (detached)
	$(PROD) up --build -d

.PHONY: prod-up
prod-up: $(PROD_ENV) ## Start the production stack without rebuilding
	$(PROD) up -d

.PHONY: prod-down
prod-down: ## Stop the production stack
	$(PROD) down

.PHONY: prod-restart
prod-restart: ## Restart production services (use SVC=backend to scope)
	$(PROD) restart $(SVC)

.PHONY: prod-logs
prod-logs: ## Tail production logs (use SVC=backend to scope)
	$(PROD) logs -f --tail=100 $(SVC)

.PHONY: prod-config
prod-config: $(PROD_ENV) ## Validate & render the resolved production compose config
	$(PROD) config

## ── Inspect & debug ───────────────────────────────────────────────────────────

.PHONY: ps
ps: ## Show running dev containers
	$(DEV) ps

.PHONY: config
config: $(DEV_ENV) ## Validate & render the resolved dev compose config
	$(DEV) config

.PHONY: health
health: ## Curl the gateway, backend & frontend health endpoints (dev ports)
	@echo "→ gateway  http://localhost:$${GATEWAY_PORT:-80}/healthz"        ; curl -fsS http://localhost:$${GATEWAY_PORT:-80}/healthz        && echo "  ✅" || echo "  ❌ not responding"
	@echo "→ backend  http://localhost:8080/api/v1/health" ; curl -fsS http://localhost:8080/api/v1/health && echo "  ✅" || echo "  ❌ not responding"
	@echo "→ frontend http://localhost:3000"               ; curl -fsS -o /dev/null http://localhost:3000      && echo "  ✅" || echo "  ❌ not responding"

.PHONY: backend-shell
backend-shell: ## Open a shell in the running dev backend container
	$(DEV) exec backend sh

.PHONY: frontend-shell
frontend-shell: ## Open a shell in the running dev frontend container
	$(DEV) exec frontend sh

.PHONY: db-shell
db-shell: ## Open a psql prompt on the dev main database
	$(DEV) exec postgres psql -U $${DB_USER:-postgres} -d $${DB_NAME:-rumera}

.PHONY: seed
seed: $(DEV_ENV) ## Seed realistic Persian storefront test data (idempotent — safe to re-run)
	$(DEV) exec backend go run ./cmd/seed

.PHONY: kafka-up
kafka-up: ## Start local Redpanda (Kafka API :19092, console :8085)
	docker compose -f apps/backend/deploy/kafka/docker-compose.kafka.yml up -d

.PHONY: kafka-down
kafka-down: ## Stop local Redpanda
	docker compose -f apps/backend/deploy/kafka/docker-compose.kafka.yml down

.PHONY: notification-worker
notification-worker: ## Run notification worker (MODE=all|relay|consume|log, needs KAFKA_BROKERS for non-log)
	@cd apps/backend && \
		NOTIFICATION_WORKER_MODE=$${NOTIFICATION_WORKER_MODE:-$${MODE:-all}} \
		KAFKA_BROKERS=$${KAFKA_BROKERS:-localhost:19092} \
		go run ./cmd/notification-worker

.PHONY: dev-media-reconcile
dev-media-reconcile: $(DEV_ENV) ## Audit local media orphans; pass ARGS="--apply --min-age=24h" to delete
	$(DEV) exec backend go run ./cmd/media-reconcile $(ARGS)

.PHONY: prod-media-reconcile
prod-media-reconcile: $(PROD_ENV) ## Audit production media orphans; pass ARGS="--apply --min-age=24h" to delete
	$(PROD) exec backend ./media-reconcile $(ARGS)

## ── Housekeeping ──────────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove stopped dev containers and dangling build cache
	$(DEV) down --remove-orphans
	docker image prune -f

.PHONY: help
help: ## List available targets
	@echo "Rumera — make targets:" ; echo
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
