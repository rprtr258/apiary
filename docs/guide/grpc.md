# gRPC Calls

Apiary provides full gRPC support with reflection and proto file loading.

## Creating a gRPC Request

1. Click **File → New Request** and select **gRPC**
2. Configure the server connection
3. Select service and method
4. Define request message

## Server Connection

### Server Address

Enter the gRPC server address in format `host:port` (e.g., `localhost:50051`).

### Security

- **Insecure**: Plaintext connection
- **TLS**: Secure connection with certificates
- **mTLS**: Mutual TLS authentication

### Reflection

If the server supports reflection, Apiary can automatically discover all available services and methods.

### Proto Files

Alternatively, load `.proto` files to define services without reflection.

## Service Selection

After connecting, select:
- **Service**: The gRPC service (e.g., `greeter.Greeter`)
- **Method**: The method within the service (e.g., `SayHello`)

## Request Message

Enter the request message as JSON. Apiary will convert JSON to protobuf.

Example for a simple message:
```json
{
  "name": "World"
}
```

## Metadata

Add gRPC metadata as key-value pairs for headers like authentication tokens.

## Performing Calls

Click **Perform** to send the gRPC request. The response will appear in the right panel.

## Response Handling

### Response Message

The response message is displayed as JSON for easy reading.

### Metadata

Response metadata (headers) are shown in a separate tab.

### Status

gRPC status code and message are displayed in the status bar.

## Streaming Calls

Apiary supports all gRPC call types:
- **Unary**: Single request, single response
- **Server Streaming**: Single request, stream of responses
- **Client Streaming**: Stream of requests, single response
- **Bidirectional Streaming**: Stream of requests and responses

## Example: Unary Call

1. Connect to `localhost:50051`
2. Enable reflection
3. Select `greeter.Greeter/SayHello`
4. Enter request JSON: `{"name": "Apiary"}`
5. Click **Perform**

## Advanced Features

### Import Proto Files

Drag and drop `.proto` files into Apiary to load service definitions.

### Save Requests

Save frequently used gRPC calls for quick access.

### History

View past calls and responses in the history panel.

## Next Steps

Explore other request types like [HTTP](/guide/http) and [SQL](/guide/sql).
