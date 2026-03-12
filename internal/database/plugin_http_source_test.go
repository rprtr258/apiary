package database

import (
	_ "embed"
	"net/http"
	"slices"
	"testing"

	"github.com/rprtr258/fun"
	"github.com/stretchr/testify/require"

	. "github.com/rprtr258/apiary/internal/json"
)

var authNone = AuthConfig{Type: AuthNone}

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

	require.Contains(t, v2StoreOrderEndpoint.RequestBody.Content, "application/json")
	mediaType := v2StoreOrderEndpoint.RequestBody.Content["application/json"]
	require.NotNil(t, mediaType.Schema, "schema should not be nil")

	require.IsType(t, "", mediaType.Schema["type"])
	schemaType := mediaType.Schema["type"].(string)
	require.Equal(t, "object", schemaType, "schema type should be object")

	require.IsType(t, D{}, mediaType.Schema["properties"])
	properties := mediaType.Schema["properties"].(D)
	expectedProps := []string{"id", "petId", "quantity", "shipDate", "status", "complete"}
	for _, prop := range expectedProps {
		require.Contains(t, properties, prop, "schema should have property %s", prop)
	}

	// Check that status has enum values
	require.IsType(t, D{}, properties["status"])
	statusProp := properties["status"].(D)
	require.IsType(t, A{}, statusProp["enum"])
	statusEnum := statusProp["enum"].(A)
	require.ElementsMatch(t, statusEnum, []string{"placed", "approved", "delivered"})
}

func TestGenerateExampleRequestForPetstoreOrder(t *testing.T) {
	const serverURL = "https://petstore.swagger.io/v2"
	httpReq := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, authNone)

	require.Equal(t, "POST", httpReq.Method)
	require.Equal(t, "https://petstore.swagger.io/v2/store/order", httpReq.URL)
	require.Equal(t, `{
  "complete": true,
  "id": 42,
  "petId": 42,
  "quantity": 42,
  "shipDate": "2024-01-01T12:00:00Z",
  "status": "placed"
}`, httpReq.Body)

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
	const serverURL = "https://api.example.com/v1"
	httpReq := GenerateExampleRequest(endpoint, serverURL, authNone)

	// TODO: generate optional fields too
	require.Equal(t, `{
  "email": "user@example.com",
  "name": "example"
}`, httpReq.Body)
}

// This test checks for exact output equality to ensure we're generating consistent and correct examples
func TestGenerateExampleRequestExactOutput(t *testing.T) {
	const serverURL = "https://petstore.swagger.io/v2"
	httpReq := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, authNone)
	require.Equal(t, HTTPRequest{
		URL:    "https://petstore.swagger.io/v2/store/order",
		Method: "POST",
		Body: `{
  "complete": true,
  "id": 42,
  "petId": 42,
  "quantity": 42,
  "shipDate": "2024-01-01T12:00:00Z",
  "status": "placed"
}`,
		Headers: []KV{{"Content-Type", "application/json"}},
	}, httpReq)
}

// Test that multiple calls generate the same output (deterministic)
func TestGenerateExampleRequestConsistency(t *testing.T) {
	const serverURL = "https://petstore.swagger.io/v2"

	httpReq1 := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, authNone)
	httpReq2 := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, authNone)
	httpReq3 := GenerateExampleRequest(v2StoreOrderEndpoint, serverURL, authNone)

	require.Equal(t, httpReq1, httpReq2)
	require.Equal(t, httpReq2, httpReq3)
}

//go:embed testapi2-openapi.v2.json
var testapi2v2 []byte

// Test with a schema that has many properties (more than 10) to ensure we limit the example size
func TestGenerateExampleRequestWithManyProperties(t *testing.T) {
	endpoints, err := ParseSpec(string(testapi2v2))
	require.NoError(t, err, "should parse test spec")
	require.Len(t, endpoints, 1, "should parse one endpoint")

	endpoint := endpoints[0]
	const serverURL = "https://api.example.com/v1"
	httpReq := GenerateExampleRequest(endpoint, serverURL, authNone)

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

// Test various JSON structures to ensure they're properly formatted
func TestGenerateExampleRequestFormattedJSONStructures(t *testing.T) {
	for name, tc := range map[string]struct {
		schema   D
		expected string
	}{
		"Simple object": {
			schema: D{
				"type": "object",
				"properties": D{
					"name": D{"type": "string"},
					"age":  D{"type": "integer"},
				},
				"required": A{"name", "age"},
			},
			expected: `{
  "age": 42,
  "name": "example"
}`,
		},
		"Array schema": {
			schema: D{
				"type": "array",
				"items": D{
					"type": "object",
					"properties": D{
						"id":    D{"type": "integer"},
						"value": D{"type": "string"},
					},
				},
			},
			expected: `[
  {
    "id": 42,
    "value": "example"
  }
]`,
		},
		"Nested object": {
			schema: D{
				"type": "object",
				"properties": D{
					"user": D{
						"type": "object",
						"properties": D{
							"name": D{"type": "string"},
							"profile": D{
								"type": "object",
								"properties": D{
									"bio": D{"type": "string"},
								},
							},
						},
					},
				},
			},
			expected: `{
  "user": {
    "key": "value"
  }
}`,
		},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.expected, generateExampleFromSchema(tc.schema))
		})
	}
}

func TestGenerateExampleRequestFromLivePetstoreV3Spec(t *testing.T) {
	endpoints, err := ParseSpec(string(petstoreV3Spec))
	require.NoError(t, err, "should parse OpenAPI 3.0 spec without error")
	require.NotEmpty(t, endpoints, "should parse at least one endpoint")

	const serverURL = "http://localhost:8091/api/v3"

	// Test cases for POST endpoints
	for name, tc := range map[string]struct {
		path   string
		method string
	}{
		"AddPet":              {"/pet", http.MethodPost},
		"PlaceOrder":          {"/store/order", http.MethodPost},
		"CreateUser":          {"/user", http.MethodPost},
		"CreateUsersWithList": {"/user/createWithList", http.MethodPost},
	} {
		t.Run(name, func(t *testing.T) {
			endpoint, _, ok := fun.Index(func(e EndpointInfo) bool {
				return e.Path == tc.path && e.Method == tc.method
			}, endpoints...)
			require.True(t, ok, "endpoint %s %s not found in spec", tc.method, tc.path)

			httpReq := GenerateExampleRequest(endpoint, serverURL, authNone)

			require.Equal(t, HTTPRequest{
				Method:  tc.method,
				URL:     serverURL + tc.path,
				Body:    "", // TODO: OpenAPI 3.0 request bodies are not currently parsed by ParseSpec
				Headers: []KV{},
			}, httpReq)
		})
	}
}
