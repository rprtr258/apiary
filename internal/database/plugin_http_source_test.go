package database

import (
	_ "embed"
	"encoding/json"
	"slices"
	"sort"
	"testing"

	"github.com/rprtr258/fun"
	"github.com/stretchr/testify/require"
)

//go:embed petstore-openapi.json
var petstoreSpec []byte

// Parse the spec from embedded file
var petstoreEndpoints []EndpointInfo = func() []EndpointInfo {
	endpoints, err := ParseSpec(string(petstoreSpec))
	require.NoError(nil, err, "should parse petstore spec without error")
	require.NotEmpty(nil, endpoints, "should parse at least one endpoint")
	return endpoints
}()

func TestParsePetstoreSpec(t *testing.T) {
	endpoints := petstoreEndpoints

	// Find the POST /store/order endpoint
	i := slices.IndexFunc(endpoints, func(e EndpointInfo) bool {
		return e.Path == "/store/order" && e.Method == "POST"
	})
	require.NotEqual(t, -1, i, "should find POST /store/order endpoint")
	orderEndpoint := endpoints[i]

	// Check endpoint properties
	require.Equal(t, "Place an order for a pet", orderEndpoint.Summary)
	require.NotNil(t, orderEndpoint.RequestBody, "should have request body")
	require.True(t, orderEndpoint.RequestBody.Required, "request body should be required")

	// Check that request body has content
	require.NotEmpty(t, orderEndpoint.RequestBody.Content, "request body should have content")

	// Check for application/json content type
	mediaType, hasContentType := orderEndpoint.RequestBody.Content["application/json"]
	require.True(t, hasContentType, "should have application/json content type")

	// Check that schema is not nil
	require.NotNil(t, mediaType.Schema, "schema should not be nil")

	// Check schema type
	schemaType, hasType := mediaType.Schema["type"].(string)
	require.True(t, hasType, "schema should have type")
	require.Equal(t, "object", schemaType, "schema type should be object")

	// Check that schema has properties
	properties, hasProperties := mediaType.Schema["properties"].(map[string]any)
	require.True(t, hasProperties, "schema should have properties")
	require.NotEmpty(t, properties, "schema properties should not be empty")

	// Check for expected properties
	expectedProps := []string{"id", "petId", "quantity", "shipDate", "status", "complete"}
	for _, prop := range expectedProps {
		require.Contains(t, properties, prop, "schema should have property %s", prop)
	}

	// Check that status has enum values
	statusProp, isMap := properties["status"].(map[string]any)
	require.True(t, isMap, "status property should be a map")
	statusEnum, hasEnum := statusProp["enum"].([]any)
	require.True(t, hasEnum, "status property should have enum")
	require.Contains(t, statusEnum, "placed", "status enum should contain 'placed'")
	require.Contains(t, statusEnum, "approved", "status enum should contain 'approved'")
	require.Contains(t, statusEnum, "delivered", "status enum should contain 'delivered'")
}

func TestGenerateExampleRequestForPetstoreOrder(t *testing.T) {
	endpoints := petstoreEndpoints

	// Find the POST /store/order endpoint
	i := slices.IndexFunc(endpoints, func(e EndpointInfo) bool {
		return e.Path == "/store/order" && e.Method == "POST"
	})
	require.NotEqual(t, -1, i, "should find POST /store/order endpoint")
	orderEndpoint := &endpoints[i]

	// Generate example request
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(*orderEndpoint, serverURL, auth)

	// Check HTTP request properties
	require.Equal(t, "POST", httpReq.Method)
	require.Equal(t, "https://petstore.swagger.io/v2/store/order", httpReq.URL)

	// Check that body is not empty and not trivial
	require.NotEmpty(t, httpReq.Body, "generated request body should not be empty")
	require.NotEqual(t, "{}", httpReq.Body, "generated request body should not be trivial empty object")
	require.NotEqual(t, `{"example": "data"}`, httpReq.Body, "generated request body should not be placeholder")

	// Parse the body to verify it's valid JSON
	var bodyObj map[string]any
	err := json.Unmarshal([]byte(httpReq.Body), &bodyObj)
	require.NoError(t, err, "generated request body should be valid JSON")

	// Check that body has some expected properties from Order schema
	// Since we only include required properties in examples, and Order has no required properties,
	// we might get an empty object. But our implementation should generate at least some properties.
	// Let's check if it has any properties at all.
	if len(bodyObj) == 0 {
		t.Log("Warning: Generated empty object for Order (no required properties in schema)")
	} else {
		// Check for expected property names if present
		expectedProps := []string{"id", "petId", "quantity", "shipDate", "status", "complete"}
		for _, prop := range expectedProps {
			if _, ok := bodyObj[prop]; ok {
				// Check type of property
				switch prop {
				case "id", "petId", "quantity":
					// Should be number
					require.IsType(t, float64(0), bodyObj[prop], "property %s should be number", prop)
				case "shipDate", "status":
					require.IsType(t, "", bodyObj[prop], "property %s should be string", prop)
				case "complete":
					require.IsType(t, false, bodyObj[prop], "property %s should be boolean", prop)
				}
			}
		}
	}

	// Check for Content-Type header
	i = slices.IndexFunc(httpReq.Headers, func(h KV) bool {
		return h.Key == "Content-Type"
	})
	require.True(t, i != -1, "should have Content-Type header for request with body")
	require.Equal(t, "application/json", httpReq.Headers[i].Value, "Content-Type should be application/json")
}

func TestGenerateExampleRequestWithRequiredProperties(t *testing.T) {
	// Test with a schema that has required properties
	specJSON := `{
		"swagger": "2.0",
		"info": {
			"title": "Test API",
			"version": "1.0.0"
		},
		"host": "api.example.com",
		"basePath": "/v1",
		"paths": {
			"/test": {
				"post": {
					"summary": "Test endpoint",
					"consumes": ["application/json"],
					"produces": ["application/json"],
					"parameters": [{
						"in": "body",
						"name": "body",
						"required": true,
						"schema": {
							"type": "object",
							"required": ["name", "email"],
							"properties": {
								"name": {"type": "string"},
								"email": {"type": "string", "format": "email"},
								"age": {"type": "integer", "minimum": 0},
								"active": {"type": "boolean"}
							}
						}
					}],
					"responses": {
						"200": {
							"description": "Success"
						}
					}
				}
			}
		}
	}`

	endpoints, err := ParseSpec(specJSON)
	require.NoError(t, err, "should parse test spec")
	require.Len(t, endpoints, 1, "should parse one endpoint")

	endpoint := endpoints[0]
	serverURL := "https://api.example.com/v1"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(endpoint, serverURL, auth)

	// Parse body
	var bodyObj map[string]any
	err = json.Unmarshal([]byte(httpReq.Body), &bodyObj)
	require.NoError(t, err, "body should be valid JSON")

	// Should have required properties
	require.Contains(t, bodyObj, "name", "should have required property 'name'")
	require.Contains(t, bodyObj, "email", "should have required property 'email'")

	// Check values
	require.Equal(t, "example", bodyObj["name"], "name should have example value")
	require.Equal(t, "user@example.com", bodyObj["email"], "email should have example email")

	// Optional properties may or may not be included
	// (our implementation only includes required properties for simplicity)
}

// This test shows what actual output is generated for the petstore order and verifies it's not trivial
func TestPetstoreOrderExampleOutput(t *testing.T) {
	endpoints := petstoreEndpoints

	// Find the POST /store/order endpoint
	i := slices.IndexFunc(endpoints, func(e EndpointInfo) bool {
		return e.Path == "/store/order" && e.Method == "POST"
	})
	require.NotEqual(t, -1, i, "should find POST /store/order endpoint")
	orderEndpoint := &endpoints[i]

	// Generate example request
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(*orderEndpoint, serverURL, auth)

	// Log the actual output for debugging
	t.Logf("Generated URL: %s", httpReq.URL)
	t.Logf("Generated Body: %s", httpReq.Body)

	// Parse the body
	var bodyObj map[string]any
	err := json.Unmarshal([]byte(httpReq.Body), &bodyObj)
	require.NoError(t, err, "body should be valid JSON")

	// The body should not be empty
	require.NotEmpty(t, bodyObj, "generated body should not be empty object")

	// Count how many properties we got
	propertyCount := len(bodyObj)
	t.Logf("Generated %d properties in the example", propertyCount)

	// We should have all 6 properties from Order schema
	require.Equal(t, 6, propertyCount, "should generate all 6 properties from Order schema")

	// Check that we have some of the expected properties
	expectedProps := []string{"id", "petId", "quantity", "shipDate", "status", "complete"}
	foundProps := fun.Keys(bodyObj)
	t.Logf("Found properties: %v", foundProps)

	// At least one of the found properties should be in the expected list
	foundExpected := slices.ContainsFunc(foundProps, func(prop string) bool {
		return slices.Contains(expectedProps, prop)
	})
	require.True(t, foundExpected, "should generate at least one of the expected properties from Order schema")

	// Verify property types are correct
	for prop, value := range bodyObj {
		switch prop {
		case "id", "petId", "quantity":
			// Should be number (JSON unmarshals to float64)
			require.IsType(t, float64(0), value, "property %s should be number, got %T", prop, value)
		case "shipDate", "status":
			require.IsType(t, "", value, "property %s should be string, got %T", prop, value)
		case "complete":
			require.IsType(t, false, value, "property %s should be boolean, got %T", prop, value)
		}
	}
}

// This test checks for exact output equality to ensure we're generating consistent and correct examples
func TestGenerateExampleRequestExactOutput(t *testing.T) {
	endpoints := petstoreEndpoints

	// Find the POST /store/order endpoint
	i := slices.IndexFunc(endpoints, func(e EndpointInfo) bool {
		return e.Path == "/store/order" && e.Method == "POST"
	})
	require.NotEqual(t, -1, i, "should find POST /store/order endpoint")
	orderEndpoint := &endpoints[i]

	// Generate example request
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(*orderEndpoint, serverURL, auth)

	// Check exact HTTP request properties
	require.Equal(t, "POST", httpReq.Method)
	require.Equal(t, "https://petstore.swagger.io/v2/store/order", httpReq.URL)

	// Parse the body to verify exact structure
	var bodyObj map[string]any
	err := json.Unmarshal([]byte(httpReq.Body), &bodyObj)
	require.NoError(t, err, "body should be valid JSON")

	// Check exact properties - we should have all 6 properties from Order schema
	require.Len(t, bodyObj, 6, "should generate all 6 properties from Order schema")

	// Check exact property names (sorted alphabetically)
	// Based on the Order schema properties: complete, id, petId, quantity, shipDate, status
	expectedProps := []string{"complete", "id", "petId", "quantity", "shipDate", "status"}
	actualProps := make([]string, 0, len(bodyObj))
	for prop := range bodyObj {
		actualProps = append(actualProps, prop)
	}
	sort.Strings(actualProps)
	require.Equal(t, expectedProps, actualProps, "should generate all 6 properties from Order schema")

	// Check exact values
	require.Equal(t, true, bodyObj["complete"], "complete should be true")
	require.Equal(t, float64(42), bodyObj["id"], "id should be 42")
	require.Equal(t, float64(42), bodyObj["petId"], "petId should be 42")
	require.Equal(t, float64(42), bodyObj["quantity"], "quantity should be 42")
	require.Equal(t, "2024-01-01T12:00:00Z", bodyObj["shipDate"], "shipDate should be timestamp")
	require.Equal(t, "placed", bodyObj["status"], "status should be 'placed' (first enum value)")

	// Check headers exactly
	require.Len(t, httpReq.Headers, 1, "should have exactly one header")
	require.Equal(t, "Content-Type", httpReq.Headers[0].Key, "header key should be Content-Type")
	require.Equal(t, "application/json", httpReq.Headers[0].Value, "header value should be application/json")
}

// Test that multiple calls generate the same output (deterministic)
func TestGenerateExampleRequestConsistency(t *testing.T) {
	endpoints := petstoreEndpoints

	// Find the POST /store/order endpoint
	i := slices.IndexFunc(endpoints, func(e EndpointInfo) bool {
		return e.Path == "/store/order" && e.Method == "POST"
	})
	require.NotEqual(t, -1, i, "should find POST /store/order endpoint")
	orderEndpoint := &endpoints[i]

	// Generate example request multiple times
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}

	httpReq1 := GenerateExampleRequest(*orderEndpoint, serverURL, auth)
	httpReq2 := GenerateExampleRequest(*orderEndpoint, serverURL, auth)
	httpReq3 := GenerateExampleRequest(*orderEndpoint, serverURL, auth)

	// All requests should be identical
	require.Equal(t, httpReq1.Method, httpReq2.Method, "methods should match")
	require.Equal(t, httpReq2.Method, httpReq3.Method, "methods should match")

	require.Equal(t, httpReq1.URL, httpReq2.URL, "URLs should match")
	require.Equal(t, httpReq2.URL, httpReq3.URL, "URLs should match")

	require.Equal(t, httpReq1.Body, httpReq2.Body, "bodies should match")
	require.Equal(t, httpReq2.Body, httpReq3.Body, "bodies should match")

	require.Equal(t, httpReq1.Headers, httpReq2.Headers, "headers should match")
	require.Equal(t, httpReq2.Headers, httpReq3.Headers, "headers should match")
}

func TestGenerateExampleRequestWithManyProperties(t *testing.T) {
	// Test with a schema that has many properties (more than 10)
	// to ensure we limit the example size
	specJSON := `{
		"swagger": "2.0",
		"info": {
			"title": "Test API",
			"version": "1.0.0"
		},
		"host": "api.example.com",
		"basePath": "/v1",
		"paths": {
			"/test": {
				"post": {
					"summary": "Test endpoint with many properties",
					"consumes": ["application/json"],
					"produces": ["application/json"],
					"parameters": [{
						"in": "body",
						"name": "body",
						"required": true,
						"schema": {
							"type": "object",
							"properties": {
								"prop1": {"type": "string"},
								"prop2": {"type": "string"},
								"prop3": {"type": "string"},
								"prop4": {"type": "string"},
								"prop5": {"type": "string"},
								"prop6": {"type": "string"},
								"prop7": {"type": "string"},
								"prop8": {"type": "string"},
								"prop9": {"type": "string"},
								"prop10": {"type": "string"},
								"prop11": {"type": "string"},
								"prop12": {"type": "string"},
								"prop13": {"type": "string"},
								"prop14": {"type": "string"},
								"prop15": {"type": "string"}
							}
						}
					}],
					"responses": {
						"200": {
							"description": "Success"
						}
					}
				}
			}
		}
	}`

	endpoints, err := ParseSpec(specJSON)
	require.NoError(t, err, "should parse test spec")
	require.Len(t, endpoints, 1, "should parse one endpoint")

	endpoint := endpoints[0]
	serverURL := "https://api.example.com/v1"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(endpoint, serverURL, auth)

	// Parse body
	var bodyObj map[string]any
	err = json.Unmarshal([]byte(httpReq.Body), &bodyObj)
	require.NoError(t, err, "body should be valid JSON")

	// Should have at most 10 properties (our limit for schemas with no required fields)
	require.LessOrEqual(t, len(bodyObj), 10, "should limit to 10 properties when schema has many properties")

	// Should have at least some properties
	require.Greater(t, len(bodyObj), 0, "should generate at least some properties")

	// All properties should start with "prop"
	for prop := range bodyObj {
		require.Contains(t, prop, "prop", "property %s should be one of the test properties", prop)
	}
}
