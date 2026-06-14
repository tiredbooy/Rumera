# ──────────────────────────────────────────────────────────────────────────────
# Rumera monorepo — Docker orchestration shortcuts.
#
#   make dev          # start the full dev stack with live hot-reload (watch)
#   make dev-down     # stop the dev stack
#   make prod         # build + start the optimized production stack
#   make prod-down    # stop the production stack
#
# Run `make help` to list everything.
# ──────────────────────────────────────────────────────────────────────────────

DC       ?= docker compose

# Environment files (explicitly set to avoid default .env)
DEV_ENV  := --env-file .env.dev        # 👈 changed from .env.dev
PROD_ENV := --env-file .env.prod   # optional, create later

DEV      := $(DC) $(DEV_ENV) -f docker-compose.dev.yml
PROD     := $(DC) $(PROD_ENV) -f docker-compose.prod.yml

.DEFAULT_GOAL := help

## ── Development ───────────────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start the dev stack with Compose Watch (frontend + backend hot reload)
	$(DEV) up --build --watch

.PHONY: dev-up
dev-up: ## Start the dev stack in the background (no watch)
	$(DEV) up --build -d

.PHONY: dev-down
dev-down: ## Stop the dev stack
	$(DEV) down

.PHONY: dev-logs
dev-logs: ## Tail dev logs (use SVC=backend to scope)
	$(DEV) logs -f $(SVC)

.PHONY: dev-nuke
dev-nuke: ## Stop the dev stack and delete its volumes (DESTRUCTIVE)
	$(DEV) down -v

## ── Production ────────────────────────────────────────────────────────────────

.PHONY: prod
prod: ## Build + start the production stack (detached)
	$(PROD) up --build -d

.PHONY: prod-down
prod-down: ## Stop the production stack
	$(PROD) down

.PHONY: prod-logs
prod-logs: ## Tail production logs (use SVC=backend to scope)
	$(PROD) logs -f $(SVC)

.PHONY: prod-config
prod-config: ## Validate & render the resolved production compose config
	$(PROD) config

## ── Utilities ─────────────────────────────────────────────────────────────────

.PHONY: ps
ps: ## Show running dev containers
	$(DEV) ps

.PHONY: config
config: ## Validate & render the resolved dev compose config
	$(DEV) config

.PHONY: help
help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'