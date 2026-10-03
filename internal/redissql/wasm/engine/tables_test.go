package engine

import (
	"context"
	"io"
	"testing"

	"github.com/dolthub/go-mysql-server/sql"
)

// fakeClient serves canned replies; unlisted methods panic via the nil
// embedded interface, which is fine for these tests.
type fakeClient struct {
	Client
	keys   []string
	hashes map[string]map[string]string
	sets   map[string][]string
	lists  map[string]int64
}

func (c *fakeClient) DBIndex() int { return 0 }

func (c *fakeClient) ScanType(context.Context, uint64, string, int64, string) ([]string, uint64, error) {
	return c.keys, 0, nil
}

func (c *fakeClient) HGetAll(_ context.Context, key string) (map[string]string, error) {
	return c.hashes[key], nil
}

func (c *fakeClient) SMembers(_ context.Context, key string) ([]string, error) {
	return c.sets[key], nil
}

func (c *fakeClient) LLen(_ context.Context, key string) (int64, error) {
	return c.lists[key], nil
}

func (c *fakeClient) LIndex(_ context.Context, key string, index int64) (string, error) {
	len, ok := c.lists[key]
	// a key deleted between SCAN and LINDEX makes the bridge fail like a nil reply
	if !ok || index >= len {
		return "", context.Canceled
	}
	return "v", nil
}

func TestPartitionRowsSkipsDeletedKeys(t *testing.T) {
	ctx := sql.NewContext(context.Background())
	c := &fakeClient{
		keys:   []string{"gone", "live"},
		hashes: map[string]map[string]string{"live": {"f": "v"}},
		sets:   map[string][]string{"live": {"m"}},
		lists:  map[string]int64{"live": 2},
	}

	// wants: rhash/rset yield only "live" rows, rlist yields the 2 live elements
	wants := map[string]int{"rhash": 1, "rset": 1, "rlist": 2}
	for _, table := range []sql.Table{&rhashTable{c}, &rsetTable{c}, &rlistTable{c}} {
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
