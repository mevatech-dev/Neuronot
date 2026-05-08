.PHONY: help db-up db-down db-migrate db-rollback db-reset api-dev api-build api-test mobile-dev lint test ci

# Auto-load api/.env so DATABASE_URL, JWT_SECRET, CONSENT_KEK, etc. are
# present for every recipe (api-dev, db-migrate, …) without manual export.
ifneq (,$(wildcard api/.env))
include api/.env
export
endif

help:
	@echo "Neuronot — make targets:"
	@echo "  db-up         Start postgres (docker-compose)"
	@echo "  db-down       Stop postgres"
	@echo "  db-migrate    Run all pending migrations"
	@echo "  db-rollback   Roll back last migration"
	@echo "  db-reset      Drop volume + restart + migrate"
	@echo "  api-dev       Run Go API locally (hot reload via go run)"
	@echo "  api-build     Build API binary"
	@echo "  api-test      Run Go tests"
	@echo "  mobile-dev    Start Expo dev server"
	@echo "  lint          Lint API + mobile"
	@echo "  test          Test API + mobile"
	@echo "  ci            Lint + test (used by CI)"

db-up:
	docker compose -f infra/docker-compose.yml up -d postgres

db-down:
	docker compose -f infra/docker-compose.yml down

db-migrate:
	cd api && goose -dir migrations postgres "$$DATABASE_URL" up

db-rollback:
	cd api && goose -dir migrations postgres "$$DATABASE_URL" down

db-reset:
	docker compose -f infra/docker-compose.yml down -v
	docker compose -f infra/docker-compose.yml up -d postgres
	sleep 3
	$(MAKE) db-migrate

api-dev:
	cd api && go run ./cmd/api

api-build:
	cd api && go build -o bin/api ./cmd/api

api-test:
	cd api && go test ./...

mobile-dev:
	cd mobile && bun start

lint:
	cd api && golangci-lint run ./... || true
	cd mobile && bun run lint || true

test:
	$(MAKE) api-test
	cd mobile && bun run test || true

ci: lint test
