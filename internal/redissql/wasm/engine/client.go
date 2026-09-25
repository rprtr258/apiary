// Package engine exposes redis data as SQL tables consumable by
// go-mysql-server (rkey, rstring, rlist, rset, rhash, rzset). Redis access
// goes through the Client interface so the package compiles both natively
// (go-redis) and for js/wasm (bridge to node-redis, see the parent package).
package engine

import (
	"context"
	"time"
)

// Client is the subset of redis operations the SQL engine needs.
type Client interface {
	// DBIndex is the redis logical db number, used for the SQL database name "db%d".
	DBIndex() int
	Type(ctx context.Context, key string) (string, error)
	// ExpireTime reports the key's remaining time to live in milliseconds
	// (PTTL), or -1 when there is none (no expiry or missing key).
	ExpireTime(ctx context.Context, key string) (time.Duration, error)
	ScanType(ctx context.Context, cursor uint64, pattern string, count int64, keyType string) (keys []string, cursorOut uint64, err error)
	MGet(ctx context.Context, keys []string) ([]*string, error)
	LRange(ctx context.Context, key string, start, stop int64) ([]string, error)
	SMembers(ctx context.Context, key string) ([]string, error)
	HGetAll(ctx context.Context, key string) (map[string]string, error)
	ZRangeWithScores(ctx context.Context, key string, start, stop int64) ([]Z, error)
}

// Z is a sorted set member with its score.
type Z struct {
	Score  float64
	Member string
}
