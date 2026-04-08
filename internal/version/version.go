package version

import (
	"runtime/debug"
	"strings"
)

var (
	// Version is set via ldflags during build
	Version = "dev"
	// Commit is the git commit hash
	Commit = ""
	// Date is the build timestamp
	Date = ""
)

func init() {
	// Fallback to module version if ldflags not set
	if Version == "dev" {
		if info, ok := debug.ReadBuildInfo(); ok {
			Version = info.Main.Version
		}
	}
}

// Clean returns version without 'v' prefix
func Clean() string {
	return strings.TrimPrefix(Version, "v")
}

// IsRelease returns true if this is a release build
// Release builds have proper semantic versions set via ldflags (e.g., v0.1.0)
// Development builds have versions like "(devel)" or pseudo-versions
func IsRelease() bool {
	// Check for development markers
	if Version == "(devel)" || Version == "dev" {
		return false
	}

	// Check if it looks like a semantic version (X.Y.Z)
	// This matches 0.1.0, 1.0.0, 0.1.0-beta.1, etc.
	if len(Version) >= 5 {
		// Check if second character is a digit
		if Version[0] >= '0' && Version[0] <= '9' {
			// Check for Go module pseudo-versions (v0.0.0-20250131123346-cfc53af023ac)
			// These are development builds
			if strings.HasPrefix(Version, "0.0.0-") {
				// Check if it has a timestamp pattern (14 digits after first dash)
				// Format: 0.0.0-YYYYMMDDHHMMSS-commitHash
				if parts := strings.SplitN(Version, "-", 3); len(parts) >= 2 {
					// Check if second part is 14 digits (timestamp)
					if len(parts[1]) == 14 {
						allDigits := true
						for _, ch := range parts[1] {
							if ch < '0' || ch > '9' {
								allDigits = false
								break
							}
						}
						if allDigits {
							// Has timestamp - pseudo-version
							return false
						}
					}
				}
			}
			// Looks like a proper semantic version
			return true
		}
	}

	return false
}
