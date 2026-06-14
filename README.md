# apiary

<img align="right" width="95" height="95"
   alt="Philosopher’s stone, logo of PostCSS"
   src="docs/public/logo.svg">

A cross-platform desktop application for managing API requests (HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource, HTTPSource) using `electron` and vanilla `TypeScript` frontend.

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
- Bun 1.3.14+

#### Build Steps
```bash
git clone https://github.com/rprtr258/apiary.git # Clone the repository
cd apiary
bun install # Install dependencies
bun run dist # Build the application
# The binary will be in release/ directory
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
renderer/        # Renderer process (frontend)
├── components/  # Shared components
└── lib/         # Shared frontend logic
main/            # Main process (backend)
├── database/    # Plugin system and JSON DB
├── api.ts       # RPC handlers implementation
└── version/     # Version management
shared/          # Shared logic
└── types/       # Shared types
scripts/         # Test scripts
```

### Development Commands
```bash
bun run _start       # Start electron app
bun run build        # Build for production
bun run lint         # Run linting
bun run typecheck    # Run type checking
bun run test         # Run tests
bun run ci           # Run linting, type checking and tests
```

## Release Process

### Creating a Release
1. **Update version**: Ensure all changes are committed
2. **Update `package.json`**: Bump `version`
2. **Create tag**: `git tag v0.1.0`
3. **Push tag**: `git push origin v0.1.0`

The GitHub Actions workflow will automatically:
- Build binaries for Linux, macOS, and Windows
- Create a GitHub Release with auto-generated notes
- Attach all platform binaries

### Testing Releases
Use the manual workflow trigger in GitHub Actions with version `0.0.0-test` to test the release process without creating an actual release.

### Version Management
- Version is stored in `package.json`
- Stored in database as `version` field for migration tracking
- Displayed in logs and via `--version` flag

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `bun run ci`
5. Submit a pull request

## License
[Add license information here]

## Acknowledgments
- Uses [GoldenLayout](https://golden-layout.com/) for window management
- [CodeMirror](https://codemirror.net/) for code editing
