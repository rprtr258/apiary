package engine

import (
	"io"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
)

// All tables expose a single partition spanning the whole keyspace; paging
// happens inside PartitionRows instead (SCAN with cursors, MGET per page).
var _ sql.Partition = (*partition)(nil)

type partition struct{}

func (*partition) Key() []byte { return nil }

var _ sql.PartitionIter = (*partitionIter)(nil)

type partitionIter struct {
	end bool
}

func (*partitionIter) Close(*sql.Context) error {
	return nil
}

func (i *partitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &partition{}, nil
}

var _ sql.RowIter = (*rowIter)(nil)

// rowIter iterates fully materialized rows. The group tables (rlist, rset,
// rhash, rzset) build all their rows up front, which also skips groups that
// emptied between SCAN and their fetch: an empty group produces no rows.
type rowIter struct {
	rows []sql.Row
	i    int
}

func (*rowIter) Close(*sql.Context) error {
	return nil
}

func (i *rowIter) Next(*sql.Context) (sql.Row, error) {
	if i.i >= len(i.rows) {
		return nil, io.EOF
	}
	row := i.rows[i.i]
	i.i++
	return row, nil
}

// scanAllKeys runs a full TYPE-filtered SCAN and returns every matching key.
func scanAllKeys(ctx *sql.Context, rdb Client, keyType string) ([]string, error) {
	keys := []string{}
	for cursor := uint64(0); ; {
		page, next, err := rdb.ScanType(ctx, cursor, "*", 0, keyType)
		if err != nil {
			return nil, err
		}
		keys = append(keys, page...)
		if next == 0 {
			return keys, nil
		}
		cursor = next
	}
}

// rowsForType materializes the rows of a group table (rlist, rset, rhash,
// rzset): a full TYPE-filtered SCAN, then one fetch per key. Groups that
// emptied between SCAN and their fetch produce no rows.
func rowsForType(ctx *sql.Context, rdb Client, keyType string, perKey func(ctx *sql.Context, key string) ([]sql.Row, error)) (sql.RowIter, error) {
	keys, err := scanAllKeys(ctx, rdb, keyType)
	if err != nil {
		return nil, err
	}
	rows := []sql.Row{}
	for _, key := range keys {
		keyRows, err := perKey(ctx, key)
		if err != nil {
			return nil, err
		}
		rows = append(rows, keyRows...)
	}
	return &rowIter{rows: rows}, nil
}

// maybeString returns s when it is valid UTF-8, nil otherwise; the "string"
// generated column projects raw bytes only when they are readable text.
func maybeString(s string) any {
	if utf8.ValidString(s) {
		return s
	}
	return nil
}
