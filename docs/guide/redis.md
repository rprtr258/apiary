# Redis Commands

Apiary includes a Redis client for executing commands and inspecting data.

## Creating a Redis Request

1. Click **File → New Request** and select **Redis**
2. Configure the Redis connection
3. Enter Redis commands

## Redis Connection

### Server Address

Enter Redis server address in format `host:port` (default port is 6379).

### Authentication

- **None**: No authentication
- **Password**: Redis AUTH password
- **Username/Password**: Redis 6+ ACL authentication

### Database Selection

Select Redis database index (0-15 by default).

## Command Execution

### Command Editor

Enter Redis commands in the editor. Each line is a separate command, or use Redis command syntax:

```
SET key value
GET key
```

### Command History

Previously executed commands are available via up/down arrows.

### Auto-completion

Apiary suggests Redis commands and key names based on connection.

## Performing Commands

Click **Perform** to execute commands. Results appear in the right panel.

## Response Handling

### Simple Strings

Plain string responses are displayed as-is.

### Bulk Strings

Large string responses are shown with line numbers and syntax highlighting.

### Integers

Numeric responses are formatted with thousands separators.

### Arrays

Array responses are displayed as expandable lists.

### Nested Structures

Complex nested responses are shown as interactive trees.

## Example: Basic Operations

1. Connect to `localhost:6379`
2. Enter commands:
```
SET mykey "Hello Redis"
GET mykey
INCR counter
```
3. Click **Perform**

## Advanced Features

### Key Pattern Matching

Use the key browser to explore keys by pattern (`*`, `?`, `[]`).

### Pub/Sub

Subscribe to Redis channels and receive real-time messages.

### Lua Scripts

Execute Lua scripts with `EVAL` and `EVALSHA`.

### Pipeline Mode

Execute multiple commands in a pipeline for better performance.

## Monitoring

Monitor Redis server metrics:
- **Info**: Server information
- **Slow Log**: Slow commands
- **Memory Usage**: Key memory usage

## Next Steps

Learn about other request types like [HTTP](/guide/http) and [gRPC](/guide/grpc).
