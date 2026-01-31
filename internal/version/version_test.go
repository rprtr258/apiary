package version

import (
	"testing"
)

func TestIsRelease_Semver(t *testing.T) {
	tests := []struct {
		name     string
		version  string
		expected bool
	}{
		// Proper semantic versions
		{"v0.1.0", "v0.1.0", true},
		{"v1.0.0", "v1.0.0", true},
		{"v2.3.4", "v2.3.4", true},
		{"v0.1.0-beta.1", "v0.1.0-beta.1", true},
		{"v1.0.0-rc.2", "v1.0.0-rc.2", true},
		{"v0.1.0-alpha", "v0.1.0-alpha", true},

		// Development markers
		{"(devel)", "(devel)", false},
		{"dev", "dev", false},

		// Go pseudo-versions
		{"pseudo-version with timestamp", "v0.0.0-20250131123346-cfc53af023ac", false},
		{"pseudo-version short", "v0.0.0-20250131123346", false},                             // Valid 14-digit timestamp
		{"pseudo-version with non-digit timestamp", "v0.0.0-20250131abc-cfc53af023ac", true}, // Not a valid pseudo-version

		// Edge cases
		{"missing v prefix", "0.1.0", false},
		{"empty string", "", false},
		{"just v", "v", false},
		{"v followed by letter", "va.1.0", false},
		{"v followed by dot", "v.1.0", false},
		{"malformed version", "v1", false},                                                         // v followed by digit but length < 3
		{"malformed version 2", "v1.", true},                                                       // v followed by digit
		{"malformed version 3", "v1.0", true},                                                      // v followed by digit
		{"malformed version 4", "v1.0.", true},                                                     // v followed by digit
		{"pseudo-version with wrong prefix", "v1.0.0-20250131123346-cfc53af023ac", true},           // Not v0.0.0 prefix
		{"pseudo-version timestamp too short", "v0.0.0-20250131-cfc53af023ac", true},               // Not 14 digits
		{"pseudo-version timestamp too long", "v0.0.0-202501311233461-cfc53af023ac", true},         // Not 14 digits
		{"pseudo-version with non-digit in timestamp", "v0.0.0-2025013112334a-cfc53af023ac", true}, // Non-digit in timestamp
	}

	// Save original version
	originalVersion := Version

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Temporarily set version
			Version = tt.version

			// Test IsRelease
			result := IsRelease()
			if result != tt.expected {
				t.Errorf("IsRelease() for version %q = %v, expected %v", tt.version, result, tt.expected)
			}

			// Restore version
			Version = originalVersion
		})
	}
}

func TestIsRelease_PseudoVersionDetection(t *testing.T) {
	tests := []struct {
		name     string
		version  string
		expected bool
	}{
		// Valid pseudo-versions (should return false)
		{"standard pseudo-version", "v0.0.0-20250131123346-cfc53af023ac", false},
		{"pseudo-version with different commit", "v0.0.0-20241225153020-abc123def456", false},

		// Invalid pseudo-versions (should return true - they're not proper releases but not pseudo-versions either)
		{"wrong prefix", "v1.0.0-20250131123346-cfc53af023ac", true},
		{"no timestamp", "v0.0.0-cfc53af023ac", true},
		{"timestamp too short", "v0.0.0-20250131-cfc53af023ac", true},
		{"timestamp too long", "v0.0.0-202501311233461-cfc53af023ac", true},
		{"non-digit in timestamp", "v0.0.0-2025013112334a-cfc53af023ac", true},
		{"multiple dashes but no timestamp", "v0.0.0--cfc53af023ac", true},
	}

	originalVersion := Version

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			Version = tt.version
			result := IsRelease()
			if result != tt.expected {
				t.Errorf("IsRelease() for pseudo-version %q = %v, expected %v", tt.version, result, tt.expected)
			}
			Version = originalVersion
		})
	}
}

func TestIsRelease_DevMarkers(t *testing.T) {
	tests := []struct {
		name     string
		version  string
		expected bool
	}{
		{"(devel)", "(devel)", false},
		{"dev", "dev", false},
		{"development", "development", false},    // Not a recognized dev marker
		{"devel without parens", "devel", false}, // Not a recognized dev marker
	}

	originalVersion := Version

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			Version = tt.version
			result := IsRelease()
			if result != tt.expected {
				t.Errorf("IsRelease() for dev marker %q = %v, expected %v", tt.version, result, tt.expected)
			}
			Version = originalVersion
		})
	}
}

func TestIsRelease_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		version  string
		expected bool
	}{
		// Edge cases for version parsing
		{"empty", "", false},
		{"single char", "v", false},
		{"vX", "vX", false},
		{"v1", "v1", false},      // v followed by digit but length < 3
		{"v1.", "v1.", true},     // v followed by digit
		{"v1.0", "v1.0", true},   // v followed by digit
		{"v1.0.", "v1.0.", true}, // v followed by digit
		{"v1.0.0", "v1.0.0", true},
		{"v1.0.0-", "v1.0.0-", true}, // Valid semver with empty prerelease
		{"v1.0.0-beta", "v1.0.0-beta", true},
		{"v1.0.0-beta.1", "v1.0.0-beta.1", true},
		{"v1.0.0+build", "v1.0.0+build", true},
		{"v1.0.0-beta.1+build", "v1.0.0-beta.1+build", true},

		// Non-digit after v
		{"va.0.0", "va.0.0", false},
		{"v1.a.0", "v1.a.0", true}, // v followed by digit
		{"v1.0.a", "v1.0.a", true}, // v followed by digit

		// Special characters
		{"v1.0.0_", "v1.0.0_", true}, // v followed by digit
		{"v1.0.0!", "v1.0.0!", true}, // v followed by digit
	}

	originalVersion := Version

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			Version = tt.version
			result := IsRelease()
			if result != tt.expected {
				t.Errorf("IsRelease() for edge case %q = %v, expected %v", tt.version, result, tt.expected)
			}
			Version = originalVersion
		})
	}
}

func TestClean(t *testing.T) {
	tests := []struct {
		name     string
		version  string
		expected string
	}{
		{"with v prefix", "v1.0.0", "1.0.0"},
		{"without v prefix", "1.0.0", "1.0.0"},
		{"empty", "", ""},
		{"just v", "v", ""},
		{"v with prerelease", "v1.0.0-beta.1", "1.0.0-beta.1"},
		{"pseudo-version", "v0.0.0-20250131123346-cfc53af023ac", "0.0.0-20250131123346-cfc53af023ac"},
		{"dev marker", "(devel)", "(devel)"},
	}

	originalVersion := Version

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			Version = tt.version
			result := Clean()
			if result != tt.expected {
				t.Errorf("Clean() for %q = %q, expected %q", tt.version, result, tt.expected)
			}
			Version = originalVersion
		})
	}
}
