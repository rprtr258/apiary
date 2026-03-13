package database

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDetectType(t *testing.T) {
	tests := map[string]struct {
		input    string
		expected string
	}{
		"empty string": {
			input:    "",
			expected: "text",
		},
		"whitespace only": {
			input:    "   \n\t  ",
			expected: "text",
		},
		"valid JSON object": {
			input:    `{"name": "Alice", "age": 30}`,
			expected: "json",
		},
		"valid JSON array": {
			input:    `[1, 2, 3]`,
			expected: "json",
		},
		"valid JSON string": {
			input:    `"hello"`,
			expected: "json",
		},
		"invalid JSON": {
			input:    `{name: Alice}`,
			expected: "text",
		},
		"plain text": {
			input:    "Hello world",
			expected: "text",
		},
		"JSON with whitespace": {
			input:    "  { \"name\": \"Alice\" }  ",
			expected: "json",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			result := detectType(tc.input)
			require.Equal(t, tc.expected, result, "Type detection mismatch")
		})
	}
}

func TestDiffText(t *testing.T) {
	tests := map[string]struct {
		left          string
		right         string
		expectedDiff  string
		expectedStats string
	}{
		"identical text": {
			left:          "Hello\nWorld",
			right:         "Hello\nWorld",
			expectedDiff:  "--- Left\n+++ Right\n Hello\n World\n\n0 additions, 0 deletions",
			expectedStats: "0 additions, 0 deletions",
		},
		"single line addition": {
			left:          "Hello\nWorld",
			right:         "Hello\nWorld\n!",
			expectedDiff:  "--- Left\n+++ Right\n Hello\n World\n+!\n\n1 additions, 0 deletions",
			expectedStats: "1 additions, 0 deletions",
		},
		"single line deletion": {
			left:          "Hello\nWorld\n!",
			right:         "Hello\nWorld",
			expectedDiff:  "--- Left\n+++ Right\n Hello\n World\n-!\n\n0 additions, 1 deletions",
			expectedStats: "0 additions, 1 deletions",
		},
		"multiple changes": {
			left:          "Line1\nLine2\nLine3",
			right:         "Line1\nLine2Modified\nLine3\nLine4",
			expectedDiff:  "--- Left\n+++ Right\n Line1\n-Line2\n+Line2Modified\n Line3\n+Line4\n\n2 additions, 1 deletions",
			expectedStats: "2 additions, 1 deletions",
		},
		"empty left": {
			left:          "",
			right:         "Hello\nWorld",
			expectedDiff:  "--- Left\n+++ Right\n+Hello\n+World\n\n2 additions, 0 deletions",
			expectedStats: "2 additions, 0 deletions",
		},
		"empty right": {
			left:          "Hello\nWorld",
			right:         "",
			expectedDiff:  "--- Left\n+++ Right\n-Hello\n-World\n\n0 additions, 2 deletions",
			expectedStats: "0 additions, 2 deletions",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			diff, stats := diffText(tc.left, tc.right)
			require.Equal(t, tc.expectedDiff, diff, "Diff text mismatch")
			require.Equal(t, tc.expectedStats, stats, "Stats mismatch")
		})
	}
}

func TestDiffJSON(t *testing.T) {
	tests := map[string]struct {
		left          string
		right         string
		expectedStats string
		shouldContain []string
	}{
		"identical JSON objects": {
			left:          `{"name": "Alice", "age": 30}`,
			right:         `{"name": "Alice", "age": 30}`,
			expectedStats: "Additions: 0, Deletions: 0, Updates: 0, Unchanged: 3",
			shouldContain: []string{"age: 30", "name: \"Alice\""},
		},
		"different JSON values": {
			left:          `{"name": "Alice", "age": 30}`,
			right:         `{"name": "Bob", "age": 30}`,
			expectedStats: "Additions: 0, Deletions: 0, Updates: 1, Unchanged: 1",
			shouldContain: []string{"name:", `-"Alice"`, `+"Bob"`},
		},
		"added JSON property": {
			left:          `{"name": "Alice"}`,
			right:         `{"name": "Alice", "age": 30}`,
			expectedStats: "Additions: 1, Deletions: 0, Updates: 0, Unchanged: 1",
			shouldContain: []string{"age: +"},
		},
		"removed JSON property": {
			left:          `{"name": "Alice", "age": 30}`,
			right:         `{"name": "Alice"}`,
			expectedStats: "Additions: 0, Deletions: 1, Updates: 0, Unchanged: 1",
			shouldContain: []string{"age: -"},
		},
		"JSON arrays": {
			left:          `[1, 2, 3]`,
			right:         `[1, 2, 3, 4]`,
			expectedStats: "Additions: 1, Deletions: 0, Updates: 0, Unchanged: 3",
			shouldContain: []string{"3: +4"},
		},
		"nested JSON": {
			left:          `{"user": {"name": "Alice", "age": 30}}`,
			right:         `{"user": {"name": "Bob", "age": 25}}`,
			expectedStats: "Additions: 0, Deletions: 0, Updates: 2, Unchanged: 0",
			shouldContain: []string{"user:", "name:", "age:", `-"Alice"`, `+"Bob"`, "-30", "+25"},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			diff, stats := diffJSON(tc.left, tc.right)
			// Check stats
			require.Equal(t, tc.expectedStats, stats, "Stats mismatch")

			// Check diff contains expected markers
			for _, expected := range tc.shouldContain {
				require.Contains(t, diff, expected, "Diff should contain %s", expected)
			}
		})
	}
}

func TestSendDIFF(t *testing.T) {
	tests := map[string]struct {
		request      DIFFRequest
		expectedType string // "text" or "json" for both sides
	}{
		"text diff": {
			request: DIFFRequest{
				Left:  "Hello\nWorld",
				Right: "Hello\nWorld\n!",
			},
			expectedType: "text",
		},
		"JSON diff": {
			request: DIFFRequest{
				Left:  `{"name": "Alice", "age": 30}`,
				Right: `{"name": "Bob", "age": 30}`,
			},
			expectedType: "json",
		},
		"mixed types": {
			request: DIFFRequest{
				Left:  `{"name": "Alice", "age": 30}`,
				Right: "Plain text",
			},
			expectedType: "text", // Right is text, so text diff
		},
		"empty request": {
			request: DIFFRequest{
				Left:  "",
				Right: "",
			},
			expectedType: "text",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			response, err := sendDIFF(t.Context(), tc.request)
			require.NoError(t, err)
			require.IsType(t, DIFFResponse{}, response)

			resp := response.(DIFFResponse)

			switch tc.expectedType {
			case "text":
				// Text diffs should have headers
				require.Contains(t, resp.Diff, "--- Left")
				require.Contains(t, resp.Diff, "+++ Right")
			case "json":
				// JSON diffs should have structural format
				require.Equal(t, "json", resp.LeftType)
				require.Equal(t, "json", resp.RightType)
			}

			// Stats should be present (in resp.Stats field, not necessarily in diff)

			if tc.expectedType == "json" {
				require.Equal(t, "json", resp.LeftType)
				require.Equal(t, "json", resp.RightType)
			} else {
				// At least one side should be text
				require.True(t, resp.LeftType == "text" || resp.RightType == "text")
			}
		})
	}
}

func TestStatsCalculation(t *testing.T) {
	tests := map[string]struct {
		diff     string
		expected string
	}{
		"no changes": {
			diff:     "--- Left\n+++ Right\n Hello\n World\n",
			expected: "0 additions, 0 deletions",
		},
		"one addition": {
			diff:     "--- Left\n+++ Right\n Hello\n World\n+New line\n",
			expected: "1 additions, 0 deletions",
		},
		"one deletion": {
			diff:     "--- Left\n+++ Right\n Hello\n World\n-Old line\n",
			expected: "0 additions, 1 deletions",
		},
		"multiple changes": {
			diff:     "--- Left\n+++ Right\n Line1\n-Line2\n+Line2Modified\n Line3\n+Line4\n",
			expected: "2 additions, 1 deletions",
		},
		"header lines ignored": {
			diff:     "--- Left\n+++ Right\n@@ -1,2 +1,3 @@\n Hello\n World\n+!\n",
			expected: "1 additions, 0 deletions",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			result := calculateStatsFromDiff(tc.diff)
			require.Equal(t, tc.expected, result, "Stats calculation mismatch")
		})
	}
}

func TestPluginIntegration(t *testing.T) {
	// Test that plugin is registered correctly
	plugin, ok := Plugins[KindDIFF]
	require.True(t, ok, "DIFF plugin should be registered")
	require.Equal(t, KindDIFF, plugin.enum.Value)
	require.NotNil(t, plugin.Perform)
	require.Equal(t, false, plugin.createResponse, "DIFF should not create responses")
}
