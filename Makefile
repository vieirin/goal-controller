PATH  := /usr/local/bin/:node_modules/.bin/:/bin:/opt/homebrew/bin/:$(PATH)
SHELL := /bin/bash

.PHONY: all install grammar dev build test clean storm experiment run-experiment

all: install grammar build

install:
	pnpm install

grammar:
	cd packages/lib && make grammar

dev:
	pnpm run dev

build:
	pnpm run build

build-lib:
	pnpm run build:lib

build-ui:
	pnpm run build:ui

test:
	pnpm run test

clean:
	pnpm run clean

# CLI commands (for backwards compatibility)
cli: grammar build-lib
	node packages/lib/out/cli.js

run: grammar build-lib
	@if [ -z "$(FILE)" ]; then \
		echo "Error: FILE variable is required. Usage: make run FILE=examples/model.txt"; \
		exit 1; \
	fi
	@echo "Processing $(FILE)..."
	node packages/lib/out/index.js "$(FILE)"

generate: grammar build-lib
	@if [ -z "$(FILE)" ]; then \
		echo "Error: FILE variable is required. Usage: make generate FILE=examples/model.txt"; \
		exit 1; \
	fi
	@echo "Generating model from $(FILE)..."
	node packages/lib/out/index.js "$(FILE)"
	@echo "✅ Model generated successfully!"

# Experiment targets (updated paths)
storm:
	docker-compose -f experiments/docker-compose.storm.yml up -d
	docker exec -it storm-container bash

experiment:
	docker-compose -f experiments/docker-compose.storm.yml build experiment
	docker-compose -f experiments/docker-compose.storm.yml up -d experiment
	docker exec -it experiment-container bash

run-experiment:
	@echo "Running experiment..."
	@cd experiments && ./generate.sh
	@cd experiments && ./check_properties.sh --storm
	@cd experiments && ./extract_metrics.sh