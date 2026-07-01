SHELL := /bin/bash

.PHONY: help install dev dev-web dev-usage build test type-check lint format sync-config sync-config-dry tools build-sync-config

ROOT_DIR := $(CURDIR)
USAGE_CONFIG ?= $(ROOT_DIR)/config.json
USAGE_DATA_DIR ?= $(ROOT_DIR)/data
USAGE_DB_PATH ?= $(USAGE_DATA_DIR)/usage.sqlite
USAGE_HTTP_ADDR ?= 0.0.0.0:18317

help:
	@echo "CPA-Manager development commands"
	@echo "  make install          Install npm dependencies"
	@echo "  make dev              Run Vite and usage-service together"
	@echo "  make dev-web          Run only the Vite dev server"
	@echo "  make dev-usage        Run only the usage-service"
	@echo "  make build            Type-check and build"
	@echo "  make test             Run tests"
	@echo "  make type-check       Run TypeScript type-check"
	@echo "  make lint             Run ESLint"
	@echo "  make format           Format source files"
	@echo "  make sync-config      Add missing keys to .env"
	@echo "  make sync-config-dry  Preview config sync without writing"
	@echo "  make tools            Build production helper binaries"
	@echo "  make build-sync-config Build only sync-config helper binaries"

install:
	npm install

dev:
	@echo "Starting CPA-Manager web UI and usage-service. Press Ctrl+C to stop both."
	@$(MAKE) --no-print-directory dev-web & \
	web_pid=$$!; \
	$(MAKE) --no-print-directory dev-usage & \
	usage_pid=$$!; \
	trap 'kill $$web_pid $$usage_pid 2>/dev/null || true' INT TERM EXIT; \
	while kill -0 $$web_pid 2>/dev/null && kill -0 $$usage_pid 2>/dev/null; do sleep 1; done; \
	status=0; \
	if ! kill -0 $$web_pid 2>/dev/null; then wait $$web_pid || status=$$?; fi; \
	if ! kill -0 $$usage_pid 2>/dev/null; then wait $$usage_pid || status=$$?; fi; \
	kill $$web_pid $$usage_pid 2>/dev/null || true; \
	wait $$web_pid $$usage_pid 2>/dev/null || true; \
	exit $$status

dev-web:
	npm run dev

dev-usage:
	@mkdir -p "$(USAGE_DATA_DIR)"
	cd usage-service && \
		CPA_MANAGER_CONFIG="$(USAGE_CONFIG)" \
		USAGE_DATA_DIR="$(USAGE_DATA_DIR)" \
		USAGE_DB_PATH="$(USAGE_DB_PATH)" \
		HTTP_ADDR="$(USAGE_HTTP_ADDR)" \
		go run ./cmd/cpa-manager

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
	cd tools/sync-config && go run . --skip-yaml --env ../../.env --env-example ../../.env.example

sync-config-dry:
	cd tools/sync-config && go run . --skip-yaml --env ../../.env --env-example ../../.env.example --dry-run

tools: build-sync-config

build-sync-config:
	cd tools/sync-config && \
		CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o ../sync-config-linux-amd64 . && \
		CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags='-s -w' -o ../sync-config-linux-arm64 . && \
		CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o ../sync-config-darwin-amd64 . && \
		CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags='-s -w' -o ../sync-config-darwin-arm64 . && \
		CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o ../sync-config-windows-amd64.exe . && \
		CGO_ENABLED=0 GOOS=windows GOARCH=arm64 go build -trimpath -ldflags='-s -w' -o ../sync-config-windows-arm64.exe .
