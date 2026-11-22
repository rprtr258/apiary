package engine

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/sql"
)

// fakeClient serves canned replies; unlisted methods panic via the nil
// embedded interface, which is fine for these tests.
type fakeClient struct {
	Client
	keys    []string
	pages   [][]string // when set, served as consecutive SCAN pages (cursor points at the next page, 0 terminates)
	strings map[string]string
	hashes  map[string]map[string]string
	sets    map[string][]string
	lists   map[string][]string
	zsets   map[string][]Z
	types   map[string]string // per-key TYPE replies, default "string"
	lens    map[string]uint64
}

func (c *fakeClient) DBIndex() int { return 0 }

func (c *fakeClient) ScanType(_ context.Context, cursor uint64, _ string, _ int64, _ string) ([]string, uint64, error) {
	if len(c.pages) > 0 {
		idx := int(cursor)
		if idx >= len(c.pages) {
			return nil, 0, fmt.Errorf("unexpected scan cursor %d", cursor)
		}
		next := uint64(0)
		if idx+1 < len(c.pages) {
			next = uint64(idx + 1)
		}
		return c.pages[idx], next, nil
	}
	return c.keys, 0, nil
}

func (c *fakeClient) Type(_ context.Context, key string) (string, error) {
	if typ, ok := c.types[key]; ok {
		return typ, nil
	}
	return "string", nil
}

func (c *fakeClient) KeyLen(_ context.Context, key, _ string) (uint64, error) {
	return c.lens[key], nil
}

func (c *fakeClient) ExpireTime(_ context.Context, _ string) (time.Duration, error) { return -1, nil }

func (c *fakeClient) MGet(_ context.Context, keys []string) ([]*string, error) {
	values := make([]*string, len(keys))
	for i, key := range keys {
		if value, ok := c.strings[key]; ok {
			values[i] = &value
		}
	}
	return values, nil
}

func (c *fakeClient) HGetAll(_ context.Context, key string) (map[string]string, error) {
	return c.hashes[key], nil
}

func (c *fakeClient) SMembers(_ context.Context, key string) ([]string, error) {
	return c.sets[key], nil
}

func (c *fakeClient) LRange(_ context.Context, key string, _, _ int64) ([]string, error) {
	return c.lists[key], nil
}

func (c *fakeClient) ZRangeWithScores(_ context.Context, key string, _, _ int64) ([]Z, error) {
	return c.zsets[key], nil
}

func TestPartitionRowsSkipsDeletedKeys(t *testing.T) {
	ctx := sql.NewContext(t.Context())
	c := &fakeClient{
		keys:    []string{"gone", "live"},
		strings: map[string]string{"live": "v"},
		hashes:  map[string]map[string]string{"live": {"f": "v"}},
		sets:    map[string][]string{"live": {"m"}},
		lists:   map[string][]string{"live": {"a", "b"}},
		zsets:   map[string][]Z{"live": {{Score: 1, Member: "m"}}},
	}

	// wants: every table yields only "live" rows; rlist yields its 2 live elements
	wants := map[string]int{"rstring": 1, "rhash": 1, "rset": 1, "rlist": 2, "rzset": 1}
	for _, table := range []sql.Table{&rstringTable{c}, &rhashTable{c}, &rsetTable{c}, &rlistTable{c}, &rzsetTable{c}} {
		iter, err := table.PartitionRows(ctx, nil)
		if err != nil {
			t.Fatalf("%s: %v", table.Name(), err)
		}
		rows := 0
		for {
			if _, err := iter.Next(ctx); err != nil {
				if err == io.EOF {
					break
				}
				t.Fatalf("%s: %v", table.Name(), err)
			}
			rows++
		}
		if rows != wants[table.Name()] {
			t.Fatalf("%s: got %d rows, want %d", table.Name(), rows, wants[table.Name()])
		}
	}
}

// A TYPE-filtered scan terminates with an empty page whose cursor is 0 when
// the tail keys all have a different type; row iterators must not index that
// page (regression: panic index out of range [0] with length 0).
func TestRowIterEndsOnEmptyScanPage(t *testing.T) {
	ctx := sql.NewContext(t.Context())
	c := &fakeClient{
		pages:   [][]string{{"a"}, {}},
		strings: map[string]string{"a": "v"},
	}

	for _, table := range []sql.Table{&rkeyTable{c}, &rstringTable{c}} {
		iter, err := table.PartitionRows(ctx, nil)
		if err != nil {
			t.Fatalf("%s: %v", table.Name(), err)
		}
		rows := 0
		for {
			if _, err := iter.Next(ctx); err != nil {
				if err == io.EOF {
					break
				}
				t.Fatalf("%s: %v", table.Name(), err)
			}
			rows++
		}
		if rows != 1 {
			t.Fatalf("%s: got %d rows, want 1", table.Name(), rows)
		}
	}
}

// len is filled per type through the Client (cardinality commands on the
// host side) and stays null for types without one.
func TestRkeyLenColumn(t *testing.T) {
	ctx := sql.NewContext(t.Context())
	c := &fakeClient{
		keys: []string{"str", "lst", "strm", "vs", "json"},
		types: map[string]string{
			"str":  "string",
			"lst":  "list",
			"strm": "stream",
			"vs":   "vectorset",
			"json": "ReJSON-RL",
		},
		lens: map[string]uint64{"str": 3, "lst": 2, "strm": 9, "vs": 4},
	}
	want := map[string]any{
		"str":  uint64(3),
		"lst":  uint64(2),
		"strm": uint64(9),
		"vs":   uint64(4),
		"json": nil,
	}

	iter, err := (&rkeyTable{c}).PartitionRows(ctx, nil)
	if err != nil {
		t.Fatalf("partition rows: %v", err)
	}
	for {
		row, err := iter.Next(ctx)
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("next: %v", err)
		}
		key, ok := row[0].(string)
		if !ok {
			t.Fatalf("unexpected key cell %v (%T)", row[0], row[0])
		}
		wantLen, ok := want[key]
		if !ok {
			t.Fatalf("unexpected key %q", key)
		}
		if row[3] != wantLen {
			t.Fatalf("len(%q) = %v (%T), want %v", key, row[3], row[3], wantLen)
		}
		delete(want, key)
	}
	if len(want) > 0 {
		t.Fatalf("missing rows for keys %v", want)
	}
}

// EXPLAIN ANALYZE is handled natively by go-mysql-server (the mysql shim); the
// explain driver in main/database/sql.redis.ts relies on that, so the engine
// needs no redis-specific EXPLAIN code.
func TestExplainAnalyzeThroughEngine(t *testing.T) {
	c := &fakeClient{
		strings: map[string]string{"a": "v"},
	}

	db := sqle.NewDefault(NewProvider(c))
	session := sql.NewBaseSession()
	session.SetCurrentDatabase(DBName(c.DBIndex()))
	ctx := sql.NewContext(t.Context(), sql.WithSession(session))
	_, iter, _, err := db.Query(ctx, "EXPLAIN ANALYZE SELECT `key` FROM rstring")
	if err != nil {
		t.Fatalf("explain: %v", err)
	}
	defer func() {
		if err := iter.Close(ctx); err != nil {
			t.Fatalf("close: %v", err)
		}
	}()

	var lines []string
	for {
		row, err := iter.Next(ctx)
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("iterate: %v", err)
		}
		cells := make([]string, len(row))
		for i, cell := range row {
			cells[i] = fmt.Sprint(cell)
		}
		lines = append(lines, strings.Join(cells, " "))
	}
	if len(lines) == 0 {
		t.Fatal("explain returned no rows")
	}
	if plan := strings.Join(lines, "\n"); !strings.Contains(plan, "Project") {
		t.Fatalf("unexpected plan:\n%s", plan)
	}
}
