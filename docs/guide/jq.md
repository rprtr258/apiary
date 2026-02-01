# JQ Transformations

Apiary includes a powerful JQ processor for filtering, transforming, and manipulating JSON data.

## Creating a JQ Request

1. Click **File → New Request** and select **JQ**
2. Provide JSON input (or select from another request's output)
3. Write JQ query
4. View transformed output

## Input Sources

### Direct Input

Paste or type JSON directly into the input editor.

### From Request Response

Select output from another request as input for JQ transformation.

### From File

Load JSON from a local file.

## JQ Editor

### Query Syntax

Write JQ queries using the full JQ language syntax:

- **Basic filter**: `.` (identity)
- **Field access**: `.field`, `.field.subfield`
- **Array iteration**: `.[]`, `.[0]`, `.[:5]`
- **Object construction**: `{key: value}`
- **Functions**: `length`, `keys`, `map`, `select`, etc.

### Auto-completion

Apiary provides JQ function and syntax suggestions.

### Multiple Queries

Separate multiple queries with newlines; each produces independent output.

## Performing Transformations

Click **Perform** to execute the JQ query. The transformed output appears in the right panel.

## Output Display

### Formatted JSON

Output is pretty-printed with syntax highlighting and collapsible sections.

### Raw Output

Toggle between formatted and raw output views.

### Multiple Results

If the query produces multiple results, they are displayed as separate items.

## Example: Basic Filtering

Input JSON:
```json
{
  "users": [
    {"id": 1, "name": "Alice", "active": true},
    {"id": 2, "name": "Bob", "active": false},
    {"id": 3, "name": "Charlie", "active": true}
  ]
}
```

JQ query:
```jq
.users[] | select(.active == true) | {id, name}
```

Output:
```json
{"id": 1, "name": "Alice"}
{"id": 3, "name": "Charlie"}
```

## Example: Data Transformation

```jq
# Group users by active status
.users | group_by(.active) | map({status: (if .[0].active then "active" else "inactive" end), count: length, users: map(.name)})
```

## Advanced Features

### Variable Binding

Use `as` for variable binding in complex queries.

### Modules

Import JQ modules for extended functionality.

### Streaming

Process large JSON inputs with streaming mode.

### Error Handling

JQ errors are displayed with line numbers and helpful messages.

## Integration with Other Requests

JQ can be used as a post-processing step for any JSON response:

1. Perform an HTTP request that returns JSON
2. Click the JQ button in the response toolbar
3. Write JQ query to filter the response
4. View filtered results inline

## Performance Tips

- Use streaming mode for large inputs
- Apply filters early in the pipeline
- Use `--compact-output` for machine-readable output

## Next Steps

Learn about other request types like [HTTP](/guide/http) and [SQL](/guide/sql).
