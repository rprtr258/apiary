# HTTP Requests

Apiary includes a full-featured HTTP client with support for all HTTP methods, headers, bodies, and authentication.

## Creating an HTTP Request

1. Click **File → New Request** and select **HTTP**
2. Configure the request in the HTTP editor

### Method Selection

Select the HTTP method from the dropdown:
- GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS

### URL Bar

Enter the full URL including protocol, host, and path. The URL bar supports:
- Auto-completion from history
- Variable substitution
- Environment variables

### Headers

Add custom headers in the headers tab:
- Common headers are pre-filled
- Add new headers with the "+" button
- Import headers from curl commands

### Request Body

The body tab supports multiple content types:
- **None**: No body
- **Raw**: Plain text, JSON, XML, etc.
- **Form Data**: Key-value pairs for `application/x-www-form-urlencoded`
- **Multipart Form**: File uploads and form data
- **Binary**: Raw binary data from files

### Query Parameters

Add query parameters in the parameters tab. Parameters are automatically appended to the URL.

## Advanced Features

### Authentication

Supported authentication methods:
- **None**: No authentication
- **Basic**: Username and password
- **Bearer Token**: JWT or API tokens
- **OAuth 2.0**: Client credentials flow
- **API Key**: Key in header or query parameter

### Import from cURL

Paste a cURL command into the request editor, and Apiary will automatically parse it into the corresponding HTTP request configuration.

### Export as cURL

Copy the current HTTP request as a cURL command for use in scripts or sharing.

### OpenAPI Integration

Import an OpenAPI specification as an HTTPSource to automatically generate HTTP requests for all defined endpoints.

## Performing HTTP Requests

Click the **Perform** button or press `Ctrl+Enter`. The response will appear in the right panel.

## Response Handling

### Response Views

- **Body**: Raw response body with syntax highlighting
- **Preview**: Rendered HTML for web pages
- **Headers**: Response headers with filtering
- **Timing**: Request timing breakdown
- **Cookies**: Set-cookie headers parsed

### JSON Responses

JSON responses get special treatment:
- Collapsible tree view
- JQ query bar for filtering
- Copy path/value buttons
- Syntax highlighting

### Image Responses

Images are displayed inline with:
- Zoom controls
- Download button
- Dimensions information

### Binary Responses

Binary data can be viewed as:
- Hex dump
- Text preview
- File type detection

## Example: Simple GET Request

1. Create a new HTTP request
2. Select **GET** method
3. Enter `https://api.github.com/users/rprtr258`
4. Click **Perform**
5. View the JSON response in the body tab

## Example: POST with JSON Body

1. Create a new HTTP request
2. Select **POST** method
3. Enter your API endpoint
4. Switch to the **Body** tab
5. Select **Raw** and choose **JSON** from the dropdown
6. Enter your JSON payload:
```json
{
  "name": "New Item",
  "value": 42
}
```
7. Add `Content-Type: application/json` header
8. Click **Perform**

## Next Steps

- Learn about [HTTPSource](/guide/httpsource) for importing OpenAPI specs
- Explore [JQ transformations](/guide/jq) for processing JSON responses