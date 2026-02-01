# HTTPSource

HTTPSource allows you to import OpenAPI specifications as collections of pre-configured HTTP requests.

## Creating an HTTPSource

1. Click **File → New Datasource** and select **HTTPSource**
2. Provide OpenAPI spec (URL or file)
3. Import the API definition

## OpenAPI Sources

### From URL

Enter the URL of an OpenAPI specification (JSON or YAML).

### From File

Upload an OpenAPI file from your local filesystem.

### From Text

Paste OpenAPI spec directly into the editor.

## Import Process

Apiary will:
1. Parse the OpenAPI specification
2. Extract all API endpoints
3. Create a collection in the sidebar
4. Generate request templates for each endpoint

## Browsing API

### Tree View

The HTTPSource appears as an expandable tree:
- **Servers**: Available server URLs
- **Paths**: API endpoints grouped by path
- **Operations**: HTTP methods (GET, POST, etc.)
- **Tags**: Endpoints grouped by tags

### Endpoint Details

Click an endpoint to open a pre-configured HTTP request:
- **URL**: Already set with path parameters
- **Method**: Already set
- **Parameters**: Path, query, and header parameters from spec
- **Request Body**: Schema-based body editor
- **Examples**: Example requests from spec

## Using Generated Requests

### Path Parameters

Path parameters (like `/users/{id}`) are presented as fillable fields.

### Query Parameters

Query parameters are listed with descriptions and example values.

### Request Body

For endpoints with request bodies, Apiary provides a schema-aware editor:
- **JSON Schema**: Auto-complete based on schema
- **Form Editor**: Generate form from schema
- **Examples**: Pre-filled example values

### Authentication

API authentication methods from the spec are pre-configured.

## Example: Importing a PetStore API

1. Create an HTTPSource with URL `https://petstore.swagger.io/v2/swagger.json`
2. Expand the "pet" section in the sidebar
3. Click "POST /pet" to open the add pet endpoint
4. Fill in the request body with pet data
5. Click **Perform** to execute

## Advanced Features

### Multiple Servers

If the spec defines multiple servers, switch between them from the dropdown.

### Schema Validation

Request bodies are validated against the OpenAPI schema before sending.

### Response Validation

Response bodies can be validated against the response schema.

### Example Generation

Generate example requests from schema with realistic data.

## Use Cases

### API Testing

Test all endpoints of an API with pre-configured requests.

### Documentation

Explore API documentation interactively.

### Client Development

Generate API client code from the spec.

### API Monitoring

Set up monitoring requests for API health checks.

## Integration with Other Features

### Environment Variables

Use environment variables in server URLs and parameters.

### Collections

Organize imported endpoints into custom collections.

### Sharing

Share imported HTTPSource configurations with team members.

## Next Steps

Learn about other datasource types like [SQLSource](/guide/sqlsource).
