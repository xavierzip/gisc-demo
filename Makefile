.PHONY: help install dev test lint build clean \
       backend-install backend-dev backend-test backend-lint \
       frontend-install frontend-dev frontend-test frontend-lint frontend-build \
       docker-up docker-down docker-build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Aggregate ───────────────────────────────────────────────

install: backend-install frontend-install ## Install all dependencies

dev: ## Start backend and frontend dev servers (requires two terminals)
	@echo "Run in separate terminals:"
	@echo "  make backend-dev"
	@echo "  make frontend-dev"

test: backend-test frontend-test ## Run all unit tests

test-e2e: ## Run E2E tests (requires docker-compose up)
	npx playwright test

test-e2e-headed: ## Run E2E tests with browser visible
	npx playwright test --headed

lint: backend-lint frontend-lint ## Run all linters

build: frontend-build ## Build frontend static files

clean: ## Remove build artifacts and caches
	rm -rf frontend/out frontend/.next frontend/node_modules/.cache
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.pytest_cache

# ─── Backend ─────────────────────────────────────────────────

backend-install: ## Install backend dependencies (creates venv)
	cd backend && python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt

backend-dev: ## Start Flask dev server on :5000
	cd backend && . venv/bin/activate && flask --app app.wsgi:app run

backend-test: ## Run backend tests
	cd backend && . venv/bin/activate && python -m pytest tests/ -v

backend-lint: ## Lint backend (requires ruff or flake8 in venv)
	cd backend && . venv/bin/activate && python -m py_compile app/__init__.py

backend-migrate: ## Run database migrations
	cd backend && . venv/bin/activate && flask --app app.wsgi:app db upgrade

backend-init-db: ## Create all database tables
	cd backend && . venv/bin/activate && flask --app app.wsgi:app init-db

docker-init-db: ## Create database tables in Docker
	docker compose exec backend flask --app app.wsgi:app init-db

# ─── Frontend ────────────────────────────────────────────────

frontend-install: ## Install frontend dependencies
	cd frontend && npm install

frontend-dev: ## Start Next.js dev server on :3000
	cd frontend && npm run dev

frontend-test: ## Run frontend tests
	cd frontend && npm test

frontend-lint: ## Lint frontend
	cd frontend && npm run lint

frontend-build: ## Build frontend static files to frontend/out/
	cd frontend && npm run build

# ─── Docker ──────────────────────────────────────────────────

docker-up: ## Start all services with Docker Compose
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

docker-build: ## Build Docker images
	docker compose build

docker-index-es: ## Index all data into Elasticsearch
	docker compose exec backend flask --app app.wsgi:app index-es

docker-create-admin: ## Create admin user in Docker (usage: make docker-create-admin EMAIL=admin@test.com PASS=admin123)
	docker compose exec backend flask --app app.wsgi:app create-admin $(EMAIL) $(PASS)

docker-setup: ## Full setup: init DB, create admin, seed events, index ES
	docker compose exec backend flask --app app.wsgi:app init-db
	docker compose exec backend flask --app app.wsgi:app create-admin admin@example.com admin123 --name "GISC Admin"
	docker compose exec backend flask --app app.wsgi:app seed-events
	docker compose exec backend flask --app app.wsgi:app index-es

docker-reset: ## Reset all data (removes .data/ and rebuilds)
	docker compose down
	rm -rf .data
	mkdir -p .data/{mysql,redis,kafka,elasticsearch,minio}
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 15
	$(MAKE) docker-setup
