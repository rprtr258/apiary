package database

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
)

const KindDIFF Kind = "diff"

type DIFFRequest struct {
	Left  string `json:"left"`
	Right string `json:"right"`
}

func (DIFFRequest) Kind() Kind { return KindDIFF }

type DIFFResponse struct {
	Diff      string `json:"diff"`      // Plain text diff
	Stats     string `json:"stats"`     // "3 additions, 2 deletions"
	LeftType  string `json:"leftType"`  // "json" or "text"
	RightType string `json:"rightType"` // "json" or "text"
}

func (DIFFResponse) Kind() Kind { return KindDIFF }

var pluginDIFF = plugin{
	EmptyRequest:   DIFFEmptyRequest,
	enum:           enumElem[Kind]{KindDIFF, "DIFF"},
	Perform:        sendDIFF,
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: false,
}

var DIFFEmptyRequest = DIFFRequest{
	Left:  "{\n  \"name\": \"Alice\",\n  \"age\": 30\n}",
	Right: "{\n  \"name\": \"Bob\",\n  \"age\": 30\n}",
}

func sendDIFF(_ context.Context, request EntryData) (EntryData, error) {
	req := request.(DIFFRequest)

	leftType := detectType(req.Left)
	rightType := detectType(req.Right)

	var diffOutput string
	var stats string

	if leftType == "json" && rightType == "json" {
		diffOutput, stats = diffJSON(req.Left, req.Right)
	} else {
		diffOutput, stats = diffText(req.Left, req.Right)
	}

	return DIFFResponse{
		Diff:      diffOutput,
		Stats:     stats,
		LeftType:  leftType,
		RightType: rightType,
	}, nil
}

func detectType(input string) string {
	input = strings.TrimSpace(input)
	if input == "" {
		return "text"
	}

	var js any
	if err := json.Unmarshal([]byte(input), &js); err == nil {
		return "json"
	}
	return "text"
}

func diffText(left, right string) (string, string) {
	// Handle empty strings specially - Split returns [""] for empty string
	var leftLines []string
	if left != "" {
		leftLines = strings.Split(left, "\n")
	}
	var rightLines []string
	if right != "" {
		rightLines = strings.Split(right, "\n")
	}

	matcher := difflib.NewMatcher(leftLines, rightLines)
	opcodes := matcher.GetOpCodes()

	var diffLines []string
	additions := 0
	deletions := 0

	// Generate unified diff format manually
	diffLines = append(diffLines, "--- Left")
	diffLines = append(diffLines, "+++ Right")

	// We'll generate a simple diff showing all lines with +/- for changes
	// This is simpler than trying to generate proper unified diff headers
	for _, op := range opcodes {
		tag, i1, i2, j1, j2 := op.Tag, op.I1, op.I2, op.J1, op.J2

		switch tag {
		case 'r': // replace
			for i := i1; i < i2; i++ {
				diffLines = append(diffLines, "-"+leftLines[i])
				deletions++
			}
			for j := j1; j < j2; j++ {
				diffLines = append(diffLines, "+"+rightLines[j])
				additions++
			}
		case 'd': // delete
			for i := i1; i < i2; i++ {
				diffLines = append(diffLines, "-"+leftLines[i])
				deletions++
			}
		case 'i': // insert
			for j := j1; j < j2; j++ {
				diffLines = append(diffLines, "+"+rightLines[j])
				additions++
			}
		case 'e': // equal
			for i := i1; i < i2; i++ {
				diffLines = append(diffLines, " "+leftLines[i])
			}
		}
	}

	diffText := strings.Join(diffLines, "\n")
	stats := fmt.Sprintf("%d additions, %d deletions", additions, deletions)

	// Append stats to diff output
	if diffText != "" {
		diffText = diffText + "\n\n" + stats
	} else {
		diffText = stats
	}

	return diffText, stats
}

// JSON diff types and functions
type DifferenceStatus string

const (
	StatusAdded           DifferenceStatus = "added"
	StatusRemoved         DifferenceStatus = "removed"
	StatusUpdated         DifferenceStatus = "updated"
	StatusUnchanged       DifferenceStatus = "unchanged"
	StatusChildrenUpdated DifferenceStatus = "children-updated"
)

type DifferenceType string

const (
	TypeObject DifferenceType = "object"
	TypeArray  DifferenceType = "array"
	TypeValue  DifferenceType = "value"
)

type Difference struct {
	Key      string           `json:"key"`
	Type     DifferenceType   `json:"type"`
	Children []Difference     `json:"children,omitempty"`
	Status   DifferenceStatus `json:"status"`
	OldValue any              `json:"oldValue,omitempty"`
	Value    any              `json:"value,omitempty"`
}

func getType(value any) DifferenceType {
	if value == nil {
		return TypeValue
	}

	if _, ok := value.([]any); ok {
		return TypeArray
	}

	if _, ok := value.(map[string]any); ok {
		return TypeObject
	}

	return TypeValue
}

func deepEqual(a, b any) bool {
	// Use JSON marshaling/unmarshaling for deep equality check
	// This handles nested structures properly
	aJSON, err1 := json.Marshal(a)
	bJSON, err2 := json.Marshal(b)
	if err1 != nil || err2 != nil {
		return false
	}
	return string(aJSON) == string(bJSON)
}

func getStatus(value, newValue any) DifferenceStatus {
	if value == nil && newValue != nil {
		return StatusAdded
	}

	if value != nil && newValue == nil {
		return StatusRemoved
	}

	valueType := getType(value)
	newValueType := getType(newValue)

	bothAreObjects := valueType == TypeObject && newValueType == TypeObject
	bothAreArrays := valueType == TypeArray && newValueType == TypeArray

	if deepEqual(value, newValue) {
		return StatusUnchanged
	}

	if bothAreObjects || bothAreArrays {
		return StatusChildrenUpdated
	}

	return StatusUpdated
}

func createDifference(value, newValue, key any, onlyShowDifferences bool) Difference {
	keyStr := fmt.Sprintf("%v", key)
	valueType := getType(value)

	if valueType == TypeObject {
		valueMap, _ := value.(map[string]any)
		newValueMap, _ := newValue.(map[string]any)
		if valueMap == nil {
			valueMap = make(map[string]any)
		}
		if newValueMap == nil {
			newValueMap = make(map[string]any)
		}

		return Difference{
			Key:      keyStr,
			Type:     TypeObject,
			Children: diffObjects(valueMap, newValueMap, onlyShowDifferences),
			OldValue: value,
			Value:    newValue,
			Status:   getStatus(value, newValue),
		}
	}

	if valueType == TypeArray {
		valueArr, _ := value.([]any)
		newValueArr, _ := newValue.([]any)
		if valueArr == nil {
			valueArr = []any{}
		}
		if newValueArr == nil {
			newValueArr = []any{}
		}

		return Difference{
			Key:      keyStr,
			Type:     TypeArray,
			Children: diffArrays(valueArr, newValueArr, onlyShowDifferences),
			OldValue: value,
			Value:    newValue,
			Status:   getStatus(value, newValue),
		}
	}

	return Difference{
		Key:      keyStr,
		Type:     TypeValue,
		OldValue: value,
		Value:    newValue,
		Status:   getStatus(value, newValue),
	}
}

func diffObjects(obj, newObj map[string]any, onlyShowDifferences bool) []Difference {
	// Collect all keys from both objects
	keys := make(map[string]bool)
	for k := range obj {
		keys[k] = true
	}
	for k := range newObj {
		keys[k] = true
	}

	var differences []Difference
	for k := range keys {
		value := obj[k]
		newValue := newObj[k]

		diff := createDifference(value, newValue, k, onlyShowDifferences)
		if !onlyShowDifferences || diff.Status != StatusUnchanged {
			differences = append(differences, diff)
		}
	}

	return differences
}

func diffArrays(arr, newArr []any, onlyShowDifferences bool) []Difference {
	maxLength := len(arr)
	if len(newArr) > maxLength {
		maxLength = len(newArr)
	}

	var differences []Difference
	for i := 0; i < maxLength; i++ {
		var value, newValue any
		if i < len(arr) {
			value = arr[i]
		}
		if i < len(newArr) {
			newValue = newArr[i]
		}

		diff := createDifference(value, newValue, i, onlyShowDifferences)
		if !onlyShowDifferences || diff.Status != StatusUnchanged {
			differences = append(differences, diff)
		}
	}

	return differences
}

func diffJSON(left, right string) (string, string) {
	var leftJSON, rightJSON any
	json.Unmarshal([]byte(left), &leftJSON)
	json.Unmarshal([]byte(right), &rightJSON)

	// Use the structural diff algorithm
	diff := createDifference(leftJSON, rightJSON, "", false)

	// Convert diff to formatted output
	diffOutput := formatDiff(diff, 0)
	stats := calculateStatsFromStructuralDiff(diff)

	return diffOutput, stats
}

func formatDiff(diff Difference, indentLevel int) string {
	indent := strings.Repeat("  ", indentLevel)

	// Format based on type and status
	var sb strings.Builder
	switch diff.Type {
	case TypeObject:
		fmt.Fprintf(&sb, "%s%s{\n", indent, formatKeyAndStatus(diff.Key, diff.Status))
		for _, child := range diff.Children {
			sb.WriteString(formatDiff(child, indentLevel+1))
			sb.WriteString("\n")
		}
		fmt.Fprintf(&sb, "%s}", indent)
	case TypeArray:
		fmt.Fprintf(&sb, "%s%s[\n", indent, formatKeyAndStatus(diff.Key, diff.Status))
		for _, child := range diff.Children {
			sb.WriteString(formatDiff(child, indentLevel+1))
			sb.WriteString("\n")
		}
		fmt.Fprintf(&sb, "%s]", indent)
	case TypeValue:
		oldVal := formatValue(diff.OldValue)
		newVal := formatValue(diff.Value)

		switch diff.Status {
		case StatusAdded:
			fmt.Fprintf(&sb, "%s%s: +%s", indent, diff.Key, newVal)
		case StatusRemoved:
			fmt.Fprintf(&sb, "%s%s: -%s", indent, diff.Key, oldVal)
		case StatusUpdated:
			fmt.Fprintf(&sb, "%s%s: -%s → +%s", indent, diff.Key, oldVal, newVal)
		case StatusUnchanged:
			fmt.Fprintf(&sb, "%s%s: %s", indent, diff.Key, newVal)
		case StatusChildrenUpdated:
			fmt.Fprintf(&sb, "%s%s: (children updated)", indent, diff.Key)
		}
	}
	return sb.String()
}

func formatKeyAndStatus(key string, status DifferenceStatus) string {
	if key == "" {
		return ""
	}

	switch status {
	case StatusAdded:
		return fmt.Sprintf("%s: + ", key)
	case StatusRemoved:
		return fmt.Sprintf("%s: - ", key)
	case StatusUpdated:
		return fmt.Sprintf("%s: ~ ", key)
	case StatusChildrenUpdated:
		return fmt.Sprintf("%s: * ", key)
	default:
		return key
	}
}

func formatValue(value any) string {
	if value == nil {
		return "null"
	}

	switch v := value.(type) {
	case string:
		return fmt.Sprintf("%q", v)
	case bool:
		return fmt.Sprintf("%v", v)
	case float64:
		// Check if it's an integer
		if v == float64(int64(v)) {
			return fmt.Sprintf("%.0f", v)
		}
		return fmt.Sprintf("%g", v)
	default:
		// For other types, use JSON marshaling
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	}
}

type stats struct {
	additions, deletions, updates, unchanged int
}

func calculateStatsFromStructuralDiff(diff Difference) string {
	var stats stats
	calculateStatsRecursive(diff, &stats)
	return fmt.Sprintf("Additions: %d, Deletions: %d, Updates: %d, Unchanged: %d",
		stats.additions, stats.deletions, stats.updates, stats.unchanged)
}

func calculateStatsRecursive(diff Difference, stats *stats) {
	switch diff.Status {
	case StatusAdded:
		stats.additions++
	case StatusRemoved:
		stats.deletions++
	case StatusUpdated:
		stats.updates++
	case StatusUnchanged:
		stats.unchanged++
	case StatusChildrenUpdated:
		for _, child := range diff.Children {
			calculateStatsRecursive(child, stats)
		}
		return
	}

	for _, child := range diff.Children {
		calculateStatsRecursive(child, stats)
	}
}

func calculateStatsFromDiff(diff string) string {
	additions := 0
	deletions := 0
	for line := range strings.SplitSeq(diff, "\n") {
		if strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++") {
			additions++
		} else if strings.HasPrefix(line, "-") && !strings.HasPrefix(line, "---") {
			deletions++
		}
	}

	return fmt.Sprintf("%d additions, %d deletions", additions, deletions)
}
