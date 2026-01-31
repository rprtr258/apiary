# apiary

A cross-platform desktop application for managing API requests (HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource, HTTPSource) using Go backend and vanilla TypeScript frontend via Wails.

## Features

- **Multiple Request Types**: HTTP, SQL, gRPC, Redis, JQ, Markdown
- **Source Plugins**: SQLSource, HTTPSource (OpenAPI)
- **Cross-platform**: Linux, macOS, Windows
- **Plugin Architecture**: Extensible request/response system
- **JSON Database**: Simple file-based storage

## Installation

### Download Pre-built Binaries

Download the latest release from [GitHub Releases](https://github.com/rprtr258/apiary/releases):

- **Linux**: `apiary-linux-amd64`
- **macOS (Intel)**: `apiary-darwin-amd64`
- **macOS (Apple Silicon)**: `apiary-darwin-arm64`
- **Windows**: `apiary-windows-amd64.exe`

Make the binary executable (Linux/macOS):

```bash
chmod +x apiary-linux-amd64
```

### Building from Source

#### Prerequisites
- Go 1.25+
- Bun 1.2.5+
- Wails CLI v2.11.0+

#### Build Steps
```bash
# Clone the repository
git clone https://github.com/rprtr258/apiary.git
cd apiary

# Install dependencies
cd frontend && bun install && cd ..

# Build the application
wails build

# The binary will be in build/bin/apiary (or apiary.exe on Windows)
```

## Usage

```bash
# Start the application
./apiary

# Show version information
./apiary --version

# Example output:
# apiary version v0.1.0
# commit: abc123def456
# build date: 2025-01-31T16:00:00Z
```

The application will create a `db.json` file in the current directory to store your requests and responses.

## Development

### Project Structure
```text
apiary/
├── frontend/          # TypeScript frontend
│   ├── src/          # Source code
│   └── dist/         # Built assets
├── internal/         # Go backend
│   ├── app/         # Application core
│   ├── database/    # Plugin system and JSON DB
│   └── version/     # Version management
├── cmd/             # Test executables
└── build/           # Build outputs
```

### Development Commands
```bash
# Frontend development
cd frontend
bun run dev          # Start development server
bun run build        # Build for production
bun run ci           # Run linting and type checking
bun run test         # Run tests

# Backend development
go test ./internal/...  # Run Go tests
wails build            # Build application
wails dev              # Development mode
```

## Release Process

### Creating a Release

1. **Update version**: Ensure all changes are committed
2. **Create tag**: `git tag v0.1.0`
3. **Push tag**: `git push origin v0.1.0`

The GitHub Actions workflow will automatically:
- Build binaries for Linux, macOS, and Windows
- Inject version information via `ldflags`
- Create a GitHub Release with auto-generated notes
- Attach all platform binaries

### Testing Releases
Use the manual workflow trigger in GitHub Actions with version `0.0.0-test` to test the release process without creating an actual release.

### Version Management
- Version is stored in `internal/version/version.go`
- Injected at build time via `ldflags`
- Stored in database as `app_version` field for migration tracking
- Displayed in logs and via `--version` flag

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `bun run ci` and `go test ./internal/...`
5. Submit a pull request

## License

[Add license information here]

## Acknowledgments

- Built with [Wails](https://wails.io/)
- Uses [GoldenLayout](https://golden-layout.com/) for window management
- [CodeMirror](https://codemirror.net/) for code editing
- [Zerolog](https://github.com/rs/zerolog) for logging
