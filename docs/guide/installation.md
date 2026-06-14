# Installation

There are two ways to install Apiary: downloading pre-built binaries or building from source.

## Download Pre-built Binaries

Visit the [GitHub Releases](https://github.com/rprtr258/apiary/releases) page and download the latest binary for your platform:

| Platform | File |
|----------|------|
| Linux (amd64) | `apiary-linux-amd64` |
| macOS (Intel) | `apiary-darwin-amd64` |
| macOS (Apple Silicon) | `apiary-darwin-arm64` |
| Windows (amd64) | `apiary-windows-amd64.exe` |

### Linux/macOS

Make the binary executable:

```bash
chmod +x apiary-linux-amd64
```

Then run it:

```bash
./apiary-linux-amd64
```

### Windows

Double-click the `.exe` file or run from command line:

```cmd
apiary-windows-amd64.exe
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

The built binary will be located in `build/bin/`:

- Linux/macOS: `build/bin/apiary`
- Windows: `build/bin/apiary.exe`

### Development Mode

To run Apiary in development mode with hot reload:

```bash
bun run _start
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

To update Apiary, simply download the latest binary from the releases page and replace the old one.

## Next Steps

Now that Apiary is installed, check out the [Usage](/guide/usage) guide to learn how to use the application.