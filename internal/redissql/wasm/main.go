// Command wasm is the js/wasm entry point for the redissql engine. It exposes
//
//	redissqlQuery(dsn, dbIndex, query) -> Promise<string>
//
// where the resolved value is a JSON string {columns: string[], rows: unknown[][]}.
// Redis operations are delegated back to the host (node) through the global
// redisCall(dsn, op, argsJson) -> Promise<string>, which the main process
// installs (see main/redissql.ts).
//
// Build: bun run build:wasm (scripts/build-wasm.ts).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"syscall/js"
	"time"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/sql"

	"github.com/rprtr258/apiary/internal/redissql"
)

// ---- bridge: goroutine blocks on a channel until the js promise settles ----

var (
	pendingMu sync.Mutex
	pending   = map[int64]chan bridgeReply{}
	nextID    atomic.Int64
)

type bridgeReply struct {
	val json.RawMessage
	err string
}

// jsCall invokes globalThis.redisCall(dsn, op, argsJson) and blocks the
// calling goroutine until the returned promise resolves or rejects.
func jsCall(dsn, op string, args ...any) (json.RawMessage, error) {
	id := nextID.Add(1)
	ch := make(chan bridgeReply, 1)
	pendingMu.Lock()
	pending[id] = ch
	pendingMu.Unlock()

	argsJSON, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("marshal %s args: %w", op, err)
	}

	promise := js.Global().Get("redisCall").Invoke(js.ValueOf(dsn), js.ValueOf(op), js.ValueOf(string(argsJSON)))
	success := js.FuncOf(func(this js.Value, pargs []js.Value) any {
		pendingMu.Lock()
		ch := pending[id]
		delete(pending, id)
		pendingMu.Unlock()
		ch <- bridgeReply{val: json.RawMessage(pargs[0].String())}
		return js.Undefined()
	})
	failure := js.FuncOf(func(this js.Value, pargs []js.Value) any {
		pendingMu.Lock()
		ch := pending[id]
		delete(pending, id)
		pendingMu.Unlock()
		ch <- bridgeReply{err: pargs[0].String()}
		return js.Undefined()
	})
	promise.Call("then", success, failure)

	reply := <-ch
	if reply.err != "" {
		return nil, fmt.Errorf("%s: %s", op, reply.err)
	}
	return reply.val, nil
}

// ---- redissql.Client over the bridge ----

type jsClient struct {
	dsn     string
	dbIndex int
}

func (c *jsClient) DBIndex() int { return c.dbIndex }

func (c *jsClient) call(op string, args ...any) (json.RawMessage, error) {
	return jsCall(c.dsn, op, args...)
}

func (c *jsClient) Keys(ctx context.Context, pattern string) ([]string, error) {
	raw, err := c.call("keys", pattern)
	if err != nil {
		return nil, err
	}
	var keys []string
	return keys, json.Unmarshal(raw, &keys)
}

func (c *jsClient) Type(ctx context.Context, key string) (string, error) {
	raw, err := c.call("type", key)
	if err != nil {
		return "", err
	}
	var typ string
	return typ, json.Unmarshal(raw, &typ)
}

func (c *jsClient) ExpireTime(ctx context.Context, key string) (time.Duration, error) {
	raw, err := c.call("expireTime", key)
	if err != nil {
		return 0, err
	}
	var seconds int64
	if err := json.Unmarshal(raw, &seconds); err != nil {
		return 0, err
	}
	// mirror go-redis DurationCmd: negative values (-1, -2) are kept as-is
	if seconds < 0 {
		return time.Duration(seconds), nil
	}
	return time.Duration(seconds) * time.Second, nil
}

func (c *jsClient) ScanType(ctx context.Context, cursor uint64, pattern string, count int64, keyType string) ([]string, uint64, error) {
	raw, err := c.call("scanType", cursor, pattern, count, keyType)
	if err != nil {
		return nil, 0, err
	}
	var reply struct {
		Keys   []string `json:"keys"`
		Cursor uint64   `json:"cursor"`
	}
	if err := json.Unmarshal(raw, &reply); err != nil {
		return nil, 0, err
	}
	return reply.Keys, reply.Cursor, nil
}

func (c *jsClient) Get(ctx context.Context, key string) (string, error) {
	return c.stringReply("get", key)
}

func (c *jsClient) LIndex(ctx context.Context, key string, index int64) (string, error) {
	return c.stringReply("lIndex", key, index)
}

// stringReply unmarshals a string reply, mapping js null to go-redis's nil error.
func (c *jsClient) stringReply(op string, args ...any) (string, error) {
	raw, err := c.call(op, args...)
	if err != nil {
		return "", err
	}
	if string(raw) == "null" {
		return "", fmt.Errorf("%s: redis: nil", op)
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", fmt.Errorf("%s: %w", op, err)
	}
	return s, nil
}

func (c *jsClient) LLen(ctx context.Context, key string) (int64, error) {
	raw, err := c.call("lLen", key)
	if err != nil {
		return 0, err
	}
	var n int64
	return n, json.Unmarshal(raw, &n)
}

func (c *jsClient) SMembers(ctx context.Context, key string) ([]string, error) {
	raw, err := c.call("sMembers", key)
	if err != nil {
		return nil, err
	}
	var members []string
	return members, json.Unmarshal(raw, &members)
}

func (c *jsClient) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	raw, err := c.call("hGetAll", key)
	if err != nil {
		return nil, err
	}
	var fields map[string]string
	return fields, json.Unmarshal(raw, &fields)
}

func (c *jsClient) ZRangeWithScores(ctx context.Context, key string, start, stop int64) ([]redissql.Z, error) {
	raw, err := c.call("zRangeWithScores", key, start, stop)
	if err != nil {
		return nil, err
	}
	var elems []redissql.Z
	return elems, json.Unmarshal(raw, &elems)
}

// ---- entry ----

type queryResult struct {
	Columns   []string            `json:"columns"`
	Typenames []string            `json:"typenames"`
	Rows      [][]json.RawMessage `json:"rows"`
}

func main() {
	js.Global().Set("redissqlQuery", js.FuncOf(redissqlQuery))

	select {} // keep the wasm runtime alive for exported callbacks
}

// redissqlQuery runs one SQL query against the redis instance at dsn.
// The host must have installed globalThis.redisCall first.
func redissqlQuery(this js.Value, args []js.Value) any {
	dsn := args[0].String()
	dbIndex := args[1].Int()
	query := args[2].String()

	handler := js.FuncOf(func(this js.Value, pargs []js.Value) any {
		resolve, reject := pargs[0], pargs[1]
		go func() {
			defer func() {
				if r := recover(); r != nil {
					reject.Invoke(js.ValueOf(fmt.Sprintf("redissql panic: %v", r)))
				}
			}()

			client := &jsClient{dsn: dsn, dbIndex: dbIndex}
			engine := sqle.NewDefault(redissql.NewProvider(client))

			session := sql.NewBaseSession()
			session.SetCurrentDatabase(fmt.Sprintf("db%d", dbIndex))
			ctx := sql.NewContext(context.Background(), sql.WithSession(session))

			schema, iter, _, err := engine.Query(ctx, query)
			if err != nil {
				reject.Invoke(js.ValueOf(err.Error()))
				return
			}

			columns := make([]string, len(schema))
			typenames := make([]string, len(schema))
			for i, col := range schema {
				columns[i] = col.Name
				typenames[i] = col.Type.String()
			}

			result := queryResult{Columns: columns, Typenames: typenames, Rows: [][]json.RawMessage{}}
			for {
				row, err := iter.Next(ctx)
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					reject.Invoke(js.ValueOf(err.Error()))
					return
				}
				cells := make([]json.RawMessage, len(row))
				for i, cell := range row {
					b, err := json.Marshal(cell)
					if err != nil {
						reject.Invoke(js.ValueOf(fmt.Sprintf("marshal cell: %v", err)))
						return
					}
					cells[i] = b
				}
				result.Rows = append(result.Rows, cells)
			}

			out, err := json.Marshal(result)
			if err != nil {
				reject.Invoke(js.ValueOf(fmt.Sprintf("marshal result: %v", err)))
				return
			}
			resolve.Invoke(js.ValueOf(string(out)))
		}()
		return js.Undefined()
	})
	return js.Global().Get("Promise").New(handler)
}
