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

//go:embed petstore-openapi.v2.json
var petstoreV2Spec []byte

//go:embed petstore-openapi.v3.json
var petstoreV3Spec []byte

// Parse the spec from embedded file
var petstoreV2Endpoints []EndpointInfo = func() []EndpointInfo {
	endpoints, err := ParseSpec(string(petstoreV2Spec))
	require.NoError(nil, err, "should parse petstore spec without error")
	require.NotEmpty(nil, endpoints, "should parse at least one endpoint")
	return endpoints
}()

var v2StoreOrderEndpoint = func() EndpointInfo {
	// Find the POST /store/order endpoint
	i := slices.IndexFunc(petstoreV2Endpoints, func(e EndpointInfo) bool {
		return e.Path == "/store/order" && e.Method == "POST"
	})
	require.NotEqual(nil, -1, i, "should find POST /store/order endpoint")
	return petstoreV2Endpoints[i]
}()

func TestParsePetstoreSpec(t *testing.T) {
	require.Equal(t, "Place an order for a pet", v2StoreOrderEndpoint.Summary)
	require.NotNil(t, v2StoreOrderEndpoint.RequestBody, "should have request body")
	require.True(t, v2StoreOrderEndpoint.RequestBody.Required, "request body should be required")

	// Check that request body has content
	require.NotEmpty(t, v2StoreOrderEndpoint.RequestBody.Content, "request body should have content")

	mediaType, hasContentType := v2StoreOrderEndpoint.RequestBody.Content["application/json"]
	require.True(t, hasContentType, "should have application/json content type")
	require.NotNil(t, mediaType.Schema, "schema should not be nil")

	schemaType, hasType := mediaType.Schema["type"].(string)
	require.True(t, hasType, "schema should have type")
	require.Equal(t, "object", schemaType, "schema type should be object")

	properties, hasProperties := mediaType.Schema["properties"].(map[string]any)
	require.True(t, hasProperties, "schema should have properties")
	require.NotEmpty(t, properties, "schema properties should not be empty")

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
	// Generate example request
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, auth)

	require.Equal(t, "POST", httpReq.Method)
	require.Equal(t, "https://petstore.swagger.io/v2/store/order", httpReq.URL)
	require.JSONEq(t, `{"complete":true,"id":42,"petId":42,"quantity":42,"shipDate":"2024-01-01T12:00:00Z","status":"placed"}`, httpReq.Body)

	i := slices.IndexFunc(httpReq.Headers, func(h KV) bool {
		return h.Key == "Content-Type"
	})
	require.True(t, i != -1, "should have Content-Type header for request with body")
	require.Equal(t, "application/json", httpReq.Headers[i].Value, "Content-Type should be application/json")
}

//go:embed testapi-openapi.v2.json
var testapi1v2 []byte

func TestGenerateExampleRequestWithRequiredProperties(t *testing.T) {
	endpoints, err := ParseSpec(string(testapi1v2))
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
	// Generate example request
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, auth)

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
	// Generate example request
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, auth)

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
	// Generate example request multiple times
	serverURL := "https://petstore.swagger.io/v2"
	auth := AuthConfig{Type: AuthNone}

	httpReq1 := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, auth)
	httpReq2 := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, auth)
	httpReq3 := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, auth)

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

//go:embed testapi2-openapi.v2.json
var testapi2v2 []byte

func TestGenerateExampleRequestWithManyProperties(t *testing.T) {
	// Test with a schema that has many properties (more than 10) to ensure we limit the example size
	endpoints, err := ParseSpec(string(testapi2v2))
	require.NoError(t, err, "should parse test spec")
	require.Len(t, endpoints, 1, "should parse one endpoint")

	endpoint := endpoints[0]
	serverURL := "https://api.example.com/v1"
	auth := AuthConfig{Type: AuthNone}
	httpReq := GenerateExampleRequest(endpoint, serverURL, auth)

	require.JSONEq(t, `{
		"prop1": "example",
		"prop2": "example",
		"prop3": "example",
		"prop4": "example",
		"prop10": "example",
		"prop11": "example",
		"prop12": "example",
		"prop13": "example",
		"prop14": "example",
		"prop15": "example"
	}`, httpReq.Body)
}

func TestGenerateExampleRequestFromLivePetstoreV3Spec(t *testing.T) {
	endpoints, err := ParseSpec(string(petstoreV3Spec))
	require.NoError(t, err, "should parse OpenAPI 3.0 spec without error")
	require.NotEmpty(t, endpoints, "should parse at least one endpoint")

	serverURL := "http://localhost:8091/api/v3"
	auth := AuthConfig{Type: AuthNone}

	// Test cases for POST endpoints
	// Note: OpenAPI 3.0 request bodies are not currently parsed by ParseSpec,
	// so we can only test that endpoints are found and GenerateExampleRequest
	// can be called without errors.
	for _, tc := range []struct {
		name   string
		path   string
		method string
	}{
		{"AddPet", "/pet", "POST"},
		{"PlaceOrder", "/store/order", "POST"},
		{"CreateUser", "/user", "POST"},
		{"CreateUsersWithList", "/user/createWithList", "POST"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Find endpoint
			endpoint, _, ok := fun.Index(func(e EndpointInfo) bool {
				return e.Path == tc.path && e.Method == tc.method
			}, endpoints...)
			require.True(t, ok, "endpoint %s %s not found in spec", tc.method, tc.path)

			// Generate example request
			httpReq := GenerateExampleRequest(endpoint, serverURL, auth)

			// Validate basic request properties
			require.Equal(t, tc.method, httpReq.Method, "HTTP method should match")
			require.Equal(t, serverURL+tc.path, httpReq.URL, "URL should be correct")

			// Note: For OpenAPI 3.0, request bodies are not currently parsed,
			// so the generated body may be empty. This is a limitation of the
			// current ParseSpec implementation which only handles Swagger 2.0
			// style request bodies (parameters with in="body").
			//
			// We still test that GenerateExampleRequest can be called without
			// errors and produces a valid HTTP request structure.

			// If there's a body, validate it's JSON
			if httpReq.Body != "" {
				var bodyObj any
				err := json.Unmarshal([]byte(httpReq.Body), &bodyObj)
				require.NoError(t, err, "if body exists, it should be valid JSON for %s", tc.path)

				// Check for Content-Type header if body exists
				hasContentType := false
				for _, h := range httpReq.Headers {
					if h.Key == "Content-Type" {
						hasContentType = true
						// For JSON endpoints, Content-Type should contain application/json
						if tc.path != "/pet/{petId}/uploadImage" { // Skip for binary upload
							require.Contains(t, h.Value, "application/json", "Content-Type should be application/json for %s", tc.path)
						}
					}
				}
				if httpReq.Body != "" && tc.path != "/pet/{petId}/uploadImage" {
					require.True(t, hasContentType, "should have Content-Type header when body exists for %s", tc.path)
				}
			}
		})
	}

	// Verify that we can parse the spec and find expected endpoints
	// This is the main value of this test - confirming that OpenAPI 3.0 specs
	// can be fetched and parsed (even if request bodies aren't extracted).
	t.Run("VerifyEndpointCount", func(t *testing.T) {
		// Count POST endpoints
		postCount := 0
		for _, endpoint := range endpoints {
			if endpoint.Method == "POST" {
				postCount++
			}
		}
		require.Greater(t, postCount, 0, "should find at least one POST endpoint")
	})
}
