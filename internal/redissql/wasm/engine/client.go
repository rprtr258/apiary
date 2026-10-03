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
	// ExpireTime returns the key TTL as a seconds-precision duration, -1 if the
	// key has no expire or does not exist (the host maps PTTL's missing-key -2
	// onto -1 so callers cannot fabricate a pre-epoch expiry).
	ExpireTime(ctx context.Context, key string) (time.Duration, error)
	ScanType(ctx context.Context, cursor uint64, pattern string, count int64, keyType string) (keys []string, cursorOut uint64, err error)
	Get(ctx context.Context, key string) (string, error)
	LLen(ctx context.Context, key string) (int64, error)
	LIndex(ctx context.Context, key string, index int64) (string, error)
	SMembers(ctx context.Context, key string) ([]string, error)
	HGetAll(ctx context.Context, key string) (map[string]string, error)
	ZRangeWithScores(ctx context.Context, key string, start, stop int64) ([]Z, error)
}

// Z is a sorted set member with its score.
type Z struct {
	Score  float64
	Member string
}
