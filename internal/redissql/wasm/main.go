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
	"math"
	"strconv"
	"sync"
	"syscall/js"
	"time"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/sql"

	"github.com/rprtr258/apiary/internal/redissql/wasm/engine"
)

// ---- bridge: goroutine blocks on a channel until the js promise settles ----

type bridgeReply struct {
	val json.RawMessage
	err string
}

// jsCall invokes globalThis.redisCall(dsn, op, argsJson) and blocks the
// calling goroutine until the returned promise resolves or rejects.
// jsErrorMessage converts a promise rejection reason to a readable string.
// js.Value.String() renders any JS object as "<object>", which destroys the
// message of errors thrown by the host redisCall (node-redis errors etc.),
// so extract Error.name/Error.message when present.
func jsErrorMessage(v js.Value) string {
	if v.Type() == js.TypeObject {
		name, msg := v.Get("name"), v.Get("message")
		if name.Type() == js.TypeString && msg.Type() == js.TypeString && msg.String() != "" {
			return fmt.Sprintf("%s: %s", name.String(), msg.String())
		}
	}
	return v.String()
}

func jsCall(dsn, op string, args ...any) (json.RawMessage, error) {
	argsJSON, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("marshal %s args: %w", op, err)
	}

	// Each call owns its channel and closures; a js promise settles at most
	// once, so no shared registry is needed.
	ch := make(chan bridgeReply, 1)
	promise := js.Global().Get("redisCall").Invoke(js.ValueOf(dsn), js.ValueOf(op), js.ValueOf(string(argsJSON)))
	var success, failure js.Func
	success = js.FuncOf(func(this js.Value, pargs []js.Value) any {
		ch <- bridgeReply{val: json.RawMessage(pargs[0].String())}
		success.Release()
		failure.Release()
		return js.Undefined()
	})
	failure = js.FuncOf(func(this js.Value, pargs []js.Value) any {
		ch <- bridgeReply{err: jsErrorMessage(pargs[0])}
		success.Release()
		failure.Release()
		return js.Undefined()
	})
	promise.Call("then", success, failure)

	reply := <-ch
	if reply.err != "" {
		return nil, fmt.Errorf("%s: %s", op, reply.err)
	}
	return reply.val, nil
}

// ---- engine.Client over the bridge ----

type jsClient struct {
	dsn     string
	dbIndex int
}

func (c *jsClient) DBIndex() int { return c.dbIndex }

func (c *jsClient) call(op string, args ...any) (json.RawMessage, error) {
	return jsCall(c.dsn, op, args...)
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
	var ms int64
	if err := json.Unmarshal(raw, &ms); err != nil {
		return 0, err
	}
	// mirror go-redis DurationCmd: negative values (-1) are kept as-is; the
	// host already mapped missing-key -2 onto -1
	if ms < 0 {
		return time.Duration(ms), nil
	}
	return time.Duration(ms) * time.Millisecond, nil
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

// MGet returns one entry per key; nil entries are keys that do not exist (or
// stopped being strings between SCAN and MGET) - MGET reports those as null
// instead of erroring, so json null decodes straight into a nil pointer.
func (c *jsClient) MGet(ctx context.Context, keys []string) ([]*string, error) {
	if len(keys) == 0 {
		return nil, nil // redis rejects MGET without arguments
	}
	raw, err := c.call("mGet", keys)
	if err != nil {
		return nil, err
	}
	var values []*string
	return values, json.Unmarshal(raw, &values)
}

func (c *jsClient) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	raw, err := c.call("lRange", key, start, stop)
	if err != nil {
		return nil, err
	}
	var values []string
	return values, json.Unmarshal(raw, &values)
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

func (c *jsClient) ZRangeWithScores(ctx context.Context, key string, start, stop int64) ([]engine.Z, error) {
	raw, err := c.call("zRangeWithScores", key, start, stop)
	if err != nil {
		return nil, err
	}
	var elems []struct {
		Member string `json:"member"`
		Score  any    `json:"score"`
	}
	if err := json.Unmarshal(raw, &elems); err != nil {
		return nil, err
	}
	zs := make([]engine.Z, len(elems))
	for i, e := range elems {
		score, err := parseScore(e.Member, e.Score)
		if err != nil {
			return nil, err
		}
		zs[i] = engine.Z{Member: e.Member, Score: score}
	}
	return zs, nil
}

// parseScore reads one bridge score: finite values cross as json numbers,
// ±inf as the raw redis score strings ("+inf"/"-inf"), which json cannot
// carry; strconv.ParseFloat accepts both shapes.
func parseScore(member string, score any) (float64, error) {
	switch s := score.(type) {
	case float64:
		return s, nil
	case string:
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, fmt.Errorf("zRangeWithScores: score of %q: %w", member, err)
		}
		return f, nil
	default:
		return 0, fmt.Errorf("zRangeWithScores: score of %q: unexpected %v (%T)", member, score, score)
	}
}

// ---- entry ----

type engineKey struct {
	dsn     string
	dbIndex int
}

// engines caches one SQL engine per (dsn, dbIndex). The catalog is stateless
// with respect to redis data (tables read live data through the bridge on
// every scan), and gms is designed for many sessions over one engine, so the
// engine is built once and only the session is per-query (sessions carry SET
// @vars, prepared statements and the current database, which must not leak
// between queries). Mirrors the host-side per-dsn client pool: no eviction.
var (
	enginesMu sync.Mutex
	engines   = map[engineKey]*sqle.Engine{}
)

func engineFor(dsn string, dbIndex int) *sqle.Engine {
	key := engineKey{dsn: dsn, dbIndex: dbIndex}
	enginesMu.Lock()
	defer enginesMu.Unlock()
	if db, ok := engines[key]; ok {
		return db
	}
	db := sqle.NewDefault(engine.NewProvider(&jsClient{dsn: dsn, dbIndex: dbIndex}))
	engines[key] = db
	return db
}

type queryResult struct {
	Columns   []string            `json:"columns"`
	Typenames []string            `json:"typenames"`
	Rows      [][]json.RawMessage `json:"rows"`
}

func main() {
	js.Global().Set("redissqlQuery", js.FuncOf(redissqlQuery))

	select {} // keep the wasm runtime alive for exported callbacks
}

// marshalCell encodes one row cell. Non-finite float64 cells (±inf zset
// scores) are not valid json values, so they cross as the redis score
// strings ("+inf"/"-inf") instead of failing the whole result.
func marshalCell(cell any) ([]byte, error) {
	if f, ok := cell.(float64); ok {
		if math.IsInf(f, 1) {
			return []byte(`"+inf"`), nil
		}
		if math.IsInf(f, -1) {
			return []byte(`"-inf"`), nil
		}
		if math.IsNaN(f) {
			return []byte(`"nan"`), nil
		}
	}
	return json.Marshal(cell)
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

			db := engineFor(dsn, dbIndex)

			session := sql.NewBaseSession()
			session.SetCurrentDatabase(engine.DBName(dbIndex))
			ctx := sql.NewContext(context.Background(), sql.WithSession(session))

			schema, iter, _, err := db.Query(ctx, query)
			if err != nil {
				reject.Invoke(js.ValueOf(err.Error()))
				return
			}
			defer iter.Close(ctx)

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
					b, err := marshalCell(cell)
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
	promise := js.Global().Get("Promise").New(handler)
	handler.Release() // executor ran synchronously inside Promise.New
	return promise
}
