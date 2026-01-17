package database

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/go-openapi/loads"
	"github.com/go-openapi/spec"
	"github.com/pkg/errors"
	. "github.com/rprtr258/apiary/internal/json"
	"github.com/rprtr258/fun"
	"github.com/rs/zerolog/log"
)

type SpecSource string

const (
	// TODO: add string spec source
	SpecSourceFile SpecSource = "file"
	SpecSourceURL  SpecSource = "url"
)

type AuthType string

const (
	AuthNone   AuthType = "none"
	AuthBasic  AuthType = "basic"
	AuthBearer AuthType = "bearer"
	AuthAPIKey AuthType = "apikey"
	AuthOAuth  AuthType = "oauth"
)

type AuthConfig struct {
	Type     AuthType `json:"type"`
	Username string   `json:"username,omitempty"`
	Password string   `json:"password,omitempty"`
	Token    string   `json:"token,omitempty"`
	KeyName  string   `json:"keyName,omitempty"`
	KeyValue string   `json:"keyValue,omitempty"`
}

type EndpointInfo struct {
	Path        string                  `json:"path"`
	Method      string                  `json:"method"`
	Summary     string                  `json:"summary"`
	Parameters  []ParameterInfo         `json:"parameters"`
	RequestBody *RequestBodyInfo        `json:"requestBody,omitempty"`
	Responses   map[string]ResponseInfo `json:"responses"`
}

type ParameterInfo struct {
	Name        string `json:"name"`
	In          string `json:"in"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
	Schema      D      `json:"schema"`
	Example     any    `json:"example,omitempty"`
}

type RequestBodyInfo struct {
	Description string                   `json:"description"`
	Required    bool                     `json:"required"`
	Content     map[string]MediaTypeInfo `json:"content"`
}

type MediaTypeInfo struct {
	Schema  D   `json:"schema"`
	Example any `json:"example,omitempty"`
}

type ResponseInfo struct {
	Description string                   `json:"description"`
	Content     map[string]MediaTypeInfo `json:"content,omitempty"`
}

const KindHTTPSource Kind = "http-source"

type HTTPSourceRequest struct {
	ServerURL  string     `json:"serverUrl"`
	SpecSource SpecSource `json:"specSource"`
	SpecData   string     `json:"specData"`
	Auth       AuthConfig `json:"auth"`
}

func (HTTPSourceRequest) Kind() Kind { return KindHTTPSource }

var pluginHTTPSource = plugin{
	EmptyRequest:   HTTPSourceEmptyRequest,
	enum:           enumElem[Kind]{KindHTTPSource, "HTTPSource"},
	Perform:        nil, // TODO: see PerformVirtualEndpointHTTPSource handler
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: false,
}

var HTTPSourceEmptyRequest = HTTPSourceRequest{"", SpecSourceFile, "", AuthConfig{Type: AuthNone}}

type HTTPSourceResponse struct{}

func (HTTPSourceResponse) Kind() Kind { return KindHTTPSource }

func FetchSpec(ctx context.Context, source SpecSource, data string) (string, error) {
	switch source {
	case SpecSourceFile:
		return data, nil // assume data is the content
	case SpecSourceURL:
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(data)
		if err != nil {
			return "", errors.Wrap(err, "fetch spec from URL")
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", errors.Wrap(err, "read spec response")
		}
		if resp.StatusCode != http.StatusOK {
			return "", errors.Errorf("unexpected status code: %d, body: %q", resp.StatusCode, body)
		}
		return string(body), nil
	default:
		return "", errors.New("unknown spec source")
	}
}

func ParseSpec(specJSON string) ([]EndpointInfo, error) {
	// Load and expand the spec to resolve references
	doc, err := loads.Analyzed([]byte(specJSON), "")
	if err != nil {
		return nil, errors.Wrap(err, "load spec")
	}

	// Expand references
	if err := spec.ExpandSpec(doc.Spec(), &spec.ExpandOptions{}); err != nil {
		return nil, errors.Wrap(err, "expand spec references")
	}

	swag := doc.Spec()
	endpoints := []EndpointInfo{}

	// Collect and sort paths for stable ordering
	paths := fun.Keys(swag.Paths.Paths)
	sort.Strings(paths)

	for _, pathStr := range paths {
		pathItem := swag.Paths.Paths[pathStr]
		// Define method order for stable iteration
		methodOperations := []struct {
			method    string
			operation *spec.Operation
		}{
			{"get", pathItem.Get},
			{"head", pathItem.Head},
			{"post", pathItem.Post},
			{"put", pathItem.Put},
			{"patch", pathItem.Patch},
			{"delete", pathItem.Delete},
			{"options", pathItem.Options},
		}
		for _, mo := range methodOperations {
			if mo.operation == nil {
				continue
			}

			endpoint := EndpointInfo{
				Path:        pathStr,
				Method:      strings.ToUpper(mo.method),
				Summary:     mo.operation.Summary,
				Parameters:  []ParameterInfo{},
				RequestBody: nil,
				Responses:   map[string]ResponseInfo{},
			}

			// Parameters
			for _, param := range mo.operation.Parameters {
				paramInfo := ParameterInfo{
					Name:        param.Name,
					In:          param.In,
					Description: param.Description,
					Required:    param.Required,
				}
				if param.Schema != nil {
					// Convert schema to map
					schemaMap := schemaToMap(param.Schema)
					paramInfo.Schema = schemaMap
				}
				if param.Example != nil {
					paramInfo.Example = param.Example
				}
				endpoint.Parameters = append(endpoint.Parameters, paramInfo)
			}

			// Request body (Swagger 2.0: parameters with in="body")
			for _, param := range mo.operation.Parameters {
				if param.In == "body" {
					reqBody := &RequestBodyInfo{
						Description: param.Description,
						Required:    param.Required,
						Content:     make(map[string]MediaTypeInfo),
					}
					// For Swagger 2.0, body parameter has a schema
					if param.Schema != nil {
						// Convert schema to map
						schemaMap := schemaToMap(param.Schema)
						// Add example if present
						var example any
						if param.Example != nil {
							example = param.Example
						}
						// Use first consume type or default to application/json
						contentType := "application/json"
						if len(mo.operation.Consumes) > 0 {
							contentType = mo.operation.Consumes[0]
						}
						reqBody.Content[contentType] = MediaTypeInfo{
							Schema:  schemaMap,
							Example: example,
						}
					}
					endpoint.RequestBody = reqBody
					break // Swagger 2.0 only allows one body parameter
				}
			}

			// Responses
			for code, resp := range mo.operation.Responses.StatusCodeResponses {
				respInfo := ResponseInfo{
					Description: resp.Description,
					Content:     make(map[string]MediaTypeInfo),
				}
				// Parse response schema if present
				if resp.Schema != nil {
					// Convert schema to map
					schemaMap := schemaToMap(resp.Schema)
					// Use first produce type or default to application/json
					contentType := "application/json"
					if len(mo.operation.Produces) > 0 {
						contentType = mo.operation.Produces[0]
					}
					respInfo.Content[contentType] = MediaTypeInfo{
						Schema: schemaMap,
					}
				}
				endpoint.Responses[fmt.Sprintf("%d", code)] = respInfo
			}

			endpoints = append(endpoints, endpoint)
		}
	}

	return endpoints, nil
}

// schemaToMap converts a spec.Schema to a map for JSON serialization
func schemaToMap(schema *spec.Schema) D {
	if schema == nil {
		return nil
	}

	// Marshal to JSON and unmarshal to map to get full structure
	jsonBytes, err := json.Marshal(schema)
	if err != nil {
		log.Warn().Err(err).Msg("failed to marshal schema, using default")
		return D{"type": "object"}
	}

	var result D
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		log.Warn().Err(err).Msg("failed to unmarshal schema, using default")
		return D{"type": "object"}
	}

	return result
}

func GenerateExampleRequest(endpoint EndpointInfo, serverURL string, auth AuthConfig) HTTPRequest {
	urlStr := serverURL + endpoint.Path

	// Replace path params with examples
	for _, param := range endpoint.Parameters {
		if param.In == "path" {
			example := param.Example
			if example == nil {
				// placeholder
				switch param.Schema["type"] {
				case "string":
					example = "string"
				case "integer":
					example = 1
				default:
					example = "placeholder"
				}
			}
			urlStr = strings.ReplaceAll(urlStr, "{"+param.Name+"}", fmt.Sprintf("%v", example))
		}
	}

	authHeaders := []KV{}
	switch auth.Type {
	case AuthBasic:
		if auth.Username != "" || auth.Password != "" {
			// Basic auth: base64 encode username:password
			authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(auth.Username+":"+auth.Password))
			authHeaders = append(authHeaders, KV{Key: "Authorization", Value: authHeader})
		}
	case AuthBearer:
		authHeaders = append(authHeaders, KV{Key: "Authorization", Value: "Bearer " + auth.Token})
	case AuthAPIKey:
		authHeaders = append(authHeaders, KV{Key: auth.KeyName, Value: auth.KeyValue})
	}

	queryParameters := []KV{}
	for _, param := range endpoint.Parameters {
		example := param.Example
		if example == nil && param.Schema != nil {
			// Generate example from schema
			example = generateParameterExampleFromSchema(param.Schema)
		}
		if example == nil {
			example = "placeholder"
		}
		kv := KV{Key: param.Name, Value: fmt.Sprintf("%v", example)}
		switch param.In {
		case "query":
			queryParameters = append(queryParameters, kv)
		case "header":
			authHeaders = append(authHeaders, kv)
		}
	}

	// Build query string
	if len(queryParameters) > 0 {
		uv := url.Values{}
		for _, q := range queryParameters {
			uv.Add(q.Key, q.Value)
		}
		urlStr += "?" + uv.Encode()
	}

	body := ""
	if endpoint.RequestBody != nil && len(endpoint.RequestBody.Content) > 0 {
		// Use first content type
		for contentType, mediaType := range endpoint.RequestBody.Content {
			if mediaType.Example != nil {
				// Try to marshal example to JSON
				if jsonBytes, err := json.Marshal(mediaType.Example); err == nil {
					body = string(jsonBytes)
				} else {
					body = fmt.Sprintf("%v", mediaType.Example)
				}
			} else if mediaType.Schema != nil {
				// Generate example from schema
				body = generateExampleFromSchema(mediaType.Schema)
			}
			// Add Content-Type header
			if body != "" {
				authHeaders = append(authHeaders, KV{Key: "Content-Type", Value: contentType})
			}
			break // Use first content type
		}
	}

	return HTTPRequest{
		URL:     urlStr,
		Method:  endpoint.Method,
		Body:    body,
		Headers: authHeaders,
	}
}

// generateExampleFromSchema generates a JSON example from a schema map
func generateExampleFromSchema(schema D) string {
	if schema == nil {
		return "{}"
	}

	// Get schema type
	schemaType, _ := schema["type"].(string)

	switch schemaType {
	case "object":
		return generateObjectExample(schema)
	case "array":
		return generateArrayExample(schema)
	case "string":
		// Check for format or enum
		if enum, ok := schema["enum"].(A); ok && len(enum) > 0 {
			return fmt.Sprintf(`"%v"`, enum[0])
		}
		if format, ok := schema["format"].(string); ok {
			switch format {
			case "date-time":
				return `"2024-01-01T12:00:00Z"`
			case "date":
				return `"2024-01-01"`
			case "email":
				return `"user@example.com"`
			case "uuid":
				return `"123e4567-e89b-12d3-a456-426614174000"`
			default:
				return `"example"`
			}
		}
		return `"example"`
	case "integer", "number":
		if format, ok := schema["format"].(string); ok {
			switch format {
			case "int32", "int64":
				return "42"
			case "float", "double":
				return "3.14"
			}
		}
		return "42"
	case "boolean":
		return "true"
	case "null":
		return "null"
	default:
		// Check for $ref or allOf/anyOf/oneOf
		if ref, ok := schema["$ref"].(string); ok && ref != "" {
			// For refs, just return empty object
			return "{}"
		}
		// Default to empty object
		return "{}"
	}
}

// generateObjectExample generates an example for object type
func generateObjectExample(schema D) string {
	properties, _ := schema["properties"].(D)
	required, _ := schema["required"].(A)

	if len(properties) == 0 {
		return "{}"
	}

	// Get sorted property names for deterministic output
	propNames := fun.Keys(properties)
	sort.Strings(propNames)

	example := make(D)
	for _, propName := range propNames {
		propSchema := properties[propName]
		propMap, ok := propSchema.(D)
		if !ok {
			continue
		}

		// Check if property is required
		isRequired := false
		for _, req := range required {
			if reqStr, ok := req.(string); ok && reqStr == propName {
				isRequired = true
				break
			}
		}

		// Include required properties, and if none are required, include first few properties
		if isRequired || len(required) == 0 {
			propType, _ := propMap["type"].(string)
			switch propType {
			case "string":
				// Check for enum or format
				if enum, ok := propMap["enum"].(A); ok && len(enum) > 0 {
					example[propName] = enum[0]
				} else if format, ok := propMap["format"].(string); ok {
					switch format {
					case "date-time":
						example[propName] = "2024-01-01T12:00:00Z"
					case "date":
						example[propName] = "2024-01-01"
					case "email":
						example[propName] = "user@example.com"
					case "uuid":
						example[propName] = "123e4567-e89b-12d3-a456-426614174000"
					default:
						example[propName] = "example"
					}
				} else {
					example[propName] = "example"
				}
			case "integer", "number":
				if format, ok := propMap["format"].(string); ok {
					switch format {
					case "int32", "int64":
						example[propName] = 42
					case "float", "double":
						example[propName] = 3.14
					default:
						example[propName] = 42
					}
				} else {
					example[propName] = 42
				}
			case "boolean":
				example[propName] = true
			case "array":
				example[propName] = A{"item1", "item2"}
			case "object":
				example[propName] = D{"key": "value"}
			default:
				example[propName] = nil
			}

			// Include all properties when none are required, but limit to 10 to avoid huge examples
			if len(required) == 0 && len(example) >= 10 {
				break
			}
		}
	}

	if len(example) == 0 {
		return "{}"
	}

	jsonBytes, err := json.Marshal(example)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

// generateArrayExample generates an example for array type
func generateArrayExample(schema D) string {
	items, ok := schema["items"].(D)
	if !ok {
		return "[]"
	}

	// Generate one example item
	itemExample := generateExampleFromSchema(items)
	// Parse the item example to create an array
	var itemObj any
	if err := json.Unmarshal([]byte(itemExample), &itemObj); err != nil {
		return "[]"
	}

	arrayExample := A{itemObj}
	jsonBytes, err := json.Marshal(arrayExample)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

// generateParameterExampleFromSchema generates a simple example value from a schema map for parameters
func generateParameterExampleFromSchema(schema D) any {
	if schema == nil {
		return "example"
	}

	schemaType, _ := schema["type"].(string)

	switch schemaType {
	case "string":
		// Check for format or enum
		if enum, ok := schema["enum"].(A); ok && len(enum) > 0 {
			return enum[0]
		}
		if format, ok := schema["format"].(string); ok {
			switch format {
			case "date-time":
				return "2024-01-01T12:00:00Z"
			case "date":
				return "2024-01-01"
			case "email":
				return "user@example.com"
			case "uuid":
				return "123e4567-e89b-12d3-a456-426614174000"
			}
		}
		return "example"
	case "integer", "number":
		if format, ok := schema["format"].(string); ok {
			switch format {
			case "int32", "int64":
				return 42
			case "float", "double":
				return 3.14
			}
		}
		return 42
	case "boolean":
		return true
	case "array":
		return "item1,item2" // CSV format for query parameters
	default:
		return "example"
	}
}
