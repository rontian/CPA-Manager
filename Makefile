.PHONY: help install dev build test type-check lint format sync-config sync-config-dry

PYTHON ?= python3

help:
	@echo "CPA-Manager development commands"
	@echo "  make install          Install npm dependencies"
	@echo "  make dev              Run the Vite dev server"
	@echo "  make build            Type-check and build"
	@echo "  make test             Run tests"
	@echo "  make type-check       Run TypeScript type-check"
	@echo "  make lint             Run ESLint"
	@echo "  make format           Format source files"
	@echo "  make sync-config      Add missing keys to .env"
	@echo "  make sync-config-dry  Preview config sync without writing"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

type-check:
	npm run type-check

lint:
	npm run lint

format:
	npm run format

sync-config:
	$(PYTHON) ./scripts/sync-config.py --skip-yaml

sync-config-dry:
	$(PYTHON) ./scripts/sync-config.py --skip-yaml --dry-run
