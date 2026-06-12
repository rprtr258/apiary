SHELL := /usr/bin/env bash

.DEFAULT_GOAL := dev

.PHONY: db_drop
db_drop:
  @echo "Dropping database..."
  rm -f dist/*

.PHONY: build
build:
  bun run build

.PHONY: dev
dev:
  bun run dev

.PHONY: dist
dist:
  bun run dist

.PHONY: dist-linux
dist-linux:
  bun run dist:linux

.PHONY: dist-mac
dist-mac:
  bun run dist:mac

.PHONY: dist-win
dist-win:
  bun run dist:win