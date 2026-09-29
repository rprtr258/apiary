# Installation

There are three ways to install Apiary: Homebrew, downloading pre-built binaries, or building from source.

## Homebrew (Linux)

```bash
brew install rprtr258/tap/apiary
```

## Download Pre-built Binaries

Grab the latest binary from [GitHub Releases](https://github.com/rprtr258/apiary/releases):

| Platform | File |
|----------|------|
| Linux (x64) | `apiary-linux-x86_64.AppImage` |
| macOS (Intel) | `apiary-darwin-x64.dmg` |
| macOS (Apple Silicon) | `apiary-darwin-arm64.dmg` |
| Windows (x64) | `apiary-win-x64.exe` |

### Linux/macOS

Make the binary executable:

```bash
chmod +x apiary-linux-x86_64.AppImage
```

Then run it:

```bash
./apiary-linux-x86_64.AppImage
```

### Windows

Double-click the `.exe` file or run from command line:

```cmd
apiary-win-x64.exe
```

## Building from Source

### Prerequisites
- **Bun 1.3.14+**: [Install Bun](https://bun.sh/)

### Build Steps
```bash
# Clone the repository:
git clone https://github.com/rprtr258/apiary.git
cd apiary

# Install dependencies:
bun install

# Build the application:
bun run dist
```

The built binary will be located in `release/`.

### Development Servers (optional)

Docker Compose spins up test services for local development:

```bash
docker compose up -d     # MySQL, PostgreSQL, Redis, gRPC, PetStore API
```

### Development Mode

To run Apiary in development mode with hot reload:

```bash
bun run dev
```

## First Run

When you first run Apiary, it will create a `db.json` file in your current directory to store all requests, responses, and settings.

### Command Line Options

- `--version`: Display version information
- `--help`: Show help message

Example:

```bash
./apiary --version
# Output: apiary version vX.Y.Z
# commit: abc123def456
# build date: YYYY-MM-DDTHH:MM:SSZ
```

## Updating

To update Apiary, simply download the latest binary from the releases page and replace the old one. If you installed via Homebrew, run:

```bash
brew upgrade apiary
```

## Next Steps

Now that Apiary is installed, check out the [Usage](/guide/usage) guide to learn how to use the application.
