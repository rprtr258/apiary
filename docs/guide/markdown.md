# Markdown Documents

Apiary includes a Markdown editor with live preview, perfect for documentation, notes, and README files.

## Creating a Markdown Request

1. Click **File → New Request** and select **Markdown**
2. Write Markdown content in the editor
3. View live preview in the right panel

## Editor Features

### Syntax Highlighting

Markdown syntax is highlighted with different colors for headings, lists, code blocks, etc.

### Auto-completion

- **Headings**: Auto-complete `#` with space
- **Lists**: Auto-indent and continue numbering
- **Links**: Suggest link formatting
- **Images**: Suggest image syntax

### Toolbar

Formatting toolbar for common operations:
- **Bold**, *Italic*, `Code`
- Headings H1-H6
- Lists (ordered and unordered)
- Links and images
- Tables

### Multiple Cursors

Use multiple cursors for editing similar elements simultaneously.

## Preview Pane

### Live Rendering

Markdown is rendered as HTML in real-time as you type.

### Theme Support

Preview supports light and dark themes matching the editor theme.

### Scroll Sync

Editor and preview scroll positions are synchronized.

### Export Options

Export the rendered document as:
- **HTML**: Full HTML document with CSS
- **PDF**: Print to PDF
- **Markdown**: Raw markdown file

## Advanced Features

### Custom CSS

Add custom CSS to style the preview pane differently.

### Diagram Support

Render Mermaid, PlantUML, and Kroki diagrams within markdown.

### MathJax

Render mathematical equations using LaTeX syntax with MathJax.

### Table of Contents

Auto-generate table of contents from headings.

## Example: Basic Document

```markdown
# Project Documentation

## Introduction

This is a sample document created in Apiary.

## Features

- **Live Preview**: See changes as you type
- **Export Options**: Save as HTML, PDF, or Markdown
- **Syntax Highlighting**: Code blocks with language support

## Code Example

```python
def hello():
    print("Hello from Apiary!")
```

## Table

| Feature | Status |
|---------|--------|
| Live Preview | ✅ |
| Export | ✅ |
| Diagrams | ⏳ |
```

## Integration with Files

### Open Local Files

Open existing `.md` files from your filesystem.

### Save to File

Save markdown documents to your local filesystem.

### Auto-save

Documents are auto-saved to Apiary's database.

## Use Cases

### Documentation

Write API documentation, user guides, and technical specs.

### Notes

Take meeting notes, brainstorming sessions, and todo lists.

### README Files

Create README files for your projects with live preview.

### Blog Posts

Draft blog posts with proper formatting and preview.

## Next Steps

Explore other request types like [HTTP](/guide/http) and [JQ](/guide/jq).
