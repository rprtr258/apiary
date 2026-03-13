# Diff Requests

The Diff plugin compares two text inputs and shows the differences between them. It automatically detects whether inputs are JSON or plain text and uses appropriate diff algorithms for each type.

## Creating a Diff Request

1. Click **File → New Request** and select **DIFF**
2. The diff editor opens with three panes:
   - **Left editor**: Original content
   - **Right editor**: Modified content
   - **Diff output**: Differences between left and right

## UI Layout

The diff interface uses a three-pane split layout:

```
┌─────────────────┬─────────────────┐
│                 │                 │
│   Left Editor   │                 │
│                 │                 │
├─────────────────┤   Diff Output   │
│                 │                 │
│   Right Editor  │                 │
│                 │                 │
└─────────────────┴─────────────────┘
```

### Left and Right Editors
- Syntax highlighting for JSON and text
- Real-time updates with 500ms debounce
- Can be resized vertically and horizontally
- Support for large files

### Diff Output Pane
- Read-only view of differences
- Color-coded highlighting:
  - **Green**: Added lines/properties
  - **Red**: Removed lines/properties
  - **Yellow**: Updated lines/properties
  - **Gray**: Context/unchanged lines

## Diff Types

### Automatic Type Detection
The plugin automatically detects whether inputs are JSON or plain text:

- **JSON detection**: Valid JSON objects, arrays, or values
- **Text detection**: Any non-JSON content including invalid JSON
- **Mixed types**: If one side is JSON and the other is text, text diff is used

### JSON Diff
When both inputs are valid JSON, the plugin uses **structural diffing**:

```json
// Left
{
  "name": "Alice",
  "age": 30,
  "city": "New York"
}

// Right
{
  "name": "Bob",
  "age": 30,
  "country": "USA"
}

// Diff Output
{
  name: -"Alice" → +"Bob"
  city: -"New York"
  country: +"USA"
}
```

**JSON diff features:**
- Shows added (`+`), removed (`-`), and updated (`→`) properties
- Handles nested objects and arrays
- Preserves JSON structure in output
- Shows statistics: "Additions: 1, Deletions: 1, Updates: 1, Unchanged: 1"

### Text Diff
When either input is not JSON, the plugin uses **line-by-line diffing**:

```diff
// Left
Hello World
This is line 2
Line three
Last line

// Right
Hello World
This is modified line 2
New line added
Last line

// Diff Output
--- Left
+++ Right
 Hello World
-This is line 2
+This is modified line 2
-Line three
+New line added
 Last line

2 additions, 2 deletions
```

**Text diff features:**
- Unified diff format with `--- Left` and `+++ Right` headers
- Shows added (`+`) and removed (`-`) lines
- Context lines shown without prefix
- Statistics: "X additions, Y deletions"

## Reading Diff Output

### Color Coding
- **Green background**: Added content
- **Red background**: Removed content
- **Yellow background**: Updated content
- **No background**: Context/unchanged content

### Symbols
- `+` or `: +`: Added line or property
- `-` or `: -`: Removed line or property
- `→` or `: ~`: Updated value (JSON only)
- `*`: Children updated (nested objects/arrays)

### Statistics
- **Additions**: Number of lines/properties added
- **Deletions**: Number of lines/properties removed
- **Updates**: Number of values changed (JSON only)
- **Unchanged**: Number of unchanged elements (JSON only)

## Real-time Updates

The diff updates automatically as you type:

1. **Debouncing**: Changes are processed after 500ms of inactivity
2. **Performance**: Large files are handled efficiently
3. **Error handling**: Invalid JSON shows as text diff with error messages
4. **Progress**: No visible spinner - updates happen in background

## Examples

### Example 1: Comparing Configuration Files

**Use case**: Compare different environment configurations

```json
// Left (development.json)
{
  "database": {
    "host": "localhost",
    "port": 5432
  },
  "debug": true
}

// Right (production.json)
{
  "database": {
    "host": "db.production.com",
    "port": 5432,
    "ssl": true
  },
  "debug": false
}

// Diff shows:
// - database.host changed from "localhost" to "db.production.com"
// - database.ssl added with value true
// - debug changed from true to false
```

### Example 2: Code Review

**Use case**: Review code changes before committing

```python
# Left (original)
def calculate_total(items):
    total = 0
    for item in items:
        total += item.price
    return total

# Right (modified)
def calculate_total(items):
    if not items:
        return 0
    total = 0
    for item in items:
        total += item.price * item.quantity
    return total

# Diff shows added null check and quantity multiplication
```

### Example 3: API Response Comparison

**Use case**: Compare API responses between versions

```json
// Left (v1 response)
{
  "user": {
    "id": 123,
    "name": "Alice"
  }
}

// Right (v2 response)
{
  "data": {
    "user": {
      "id": 123,
      "name": "Alice",
      "email": "alice@example.com"
    }
  },
  "meta": {
    "version": "2.0"
  }
}

// Diff shows structural changes and added fields
```

## Limitations

1. **Large files**: Very large files may impact performance
2. **Binary data**: Only text/JSON content supported
3. **Encoding**: Assumes UTF-8 encoding
4. **Line endings**: Normalized to LF (`\n`) for comparison

## Tips and Best Practices

1. **Use for configuration**: Perfect for comparing environment configs
2. **Code reviews**: Review changes before commits
3. **API testing**: Compare API responses between versions
4. **Data validation**: Verify data transformations
5. **Documentation**: Compare documentation versions

## Keyboard Shortcuts

- **Ctrl+Enter**: Force diff update (by editing either side)
- **Resize panes**: Drag splitter bars
- **Toggle left pane**: Use the show/hide request button

## Integration with Other Plugins

- **JQ**: Use JQ to transform JSON before diffing
- **Markdown**: Compare documentation changes
- **HTTPSource**: Diff API responses from different endpoints

## Next Steps

- Learn about [JQ transformations](/guide/jq) for processing JSON before diffing
- Explore [Markdown editing](/guide/markdown) for documentation comparisons
- Check [HTTPSource](/guide/httpsource) for importing API specifications
