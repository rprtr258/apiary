# Introduction

Welcome to the Apiary documentation! Apiary is a cross-platform desktop application for managing API requests, SQL queries, gRPC calls, Redis commands, JQ transformations, Markdown documents, and more.

## What is Apiary?

Apiary brings together multiple request types into a single unified interface. It's designed for developers, testers, DevOps engineers, and anyone who works with APIs and databases regularly.

### Key Concepts

- **Requests**: Individual queries that can be performed (HTTP request, SQL query, etc.)
- **Datasources**: Collections of requests imported from external sources (OpenAPI specs, database schemas, file systems)
- **Plugins**: Extensible system for adding new request types
- **Collections**: Groups of requests organized in a tree structure
- **Responses**: Results of performed requests with multiple view options

## Getting Started

1. [Installation](/guide/installation) - Download or build Apiary
2. [Usage](/guide/usage) - Basic usage and interface overview
3. [Request Types](/guide/http) - Learn about each supported request type

## Why Apiary?

- **Unified Interface**: No more switching between different tools for different protocols
- **Extensible**: Plugin system allows adding new request types
- **Cross-Platform**: Works on Linux, macOS, and Windows
- **Simple Storage**: All data stored in a single JSON file
- **Modern UI**: Dark theme, tabbed interface, sleek design

## Architecture

Apiary is built with:

- **Backend**: Go (Golang) for request execution and plugin system
- **Frontend**: Vanilla TypeScript with no frameworks
- **Desktop Framework**: Wails for native desktop integration
- **UI Components**: GoldenLayout for window management, CodeMirror for editors
- **Storage**: JSON file with versioning and migration support

## Next Steps

Proceed to [Installation](/guide/installation) to get started with Apiary.