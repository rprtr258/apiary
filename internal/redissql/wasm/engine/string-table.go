package engine

import (
	"io"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.RowIter = (*rstringRowIter)(nil)

// rstringRowIter streams one SCAN+MGET page at a time; nil MGET entries are
// keys that were deleted between the SCAN page and the MGET.
type rstringRowIter struct {
	rdb     Client
	keys    []string  // keys of the current page
	values  []*string // values of the current page, aligned with keys
	cursor  uint64    // next scan cursor; 0 when the scan is exhausted
	index   int
	started bool // false until the first page is fetched
}

func (*rstringRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rstringRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if !i.started || i.index == len(i.keys) {
			if i.started && i.cursor == 0 {
				return nil, io.EOF
			}
			keys, cursor, err := i.rdb.ScanType(ctx, i.cursor, "*", 0, "string")
			if err != nil {
				return nil, err
			}
			values, err := i.rdb.MGet(ctx, keys)
			if err != nil {
				return nil, err
			}
			i.keys, i.values, i.cursor, i.index, i.started = keys, values, cursor, 0, true
			continue // exhausted page: re-check for end-of-scan before indexing
		}

		key := i.keys[i.index]
		value := i.values[i.index]
		i.index++
		if value == nil {
			continue // key deleted between SCAN and MGET
		}
		return sql.Row{
			key,
			*value,
			maybeString(*value),
		}, nil
	}
}

var _ sql.Table = (*rstringTable)(nil)

type rstringTable struct {
	rdb Client
}

func (*rstringTable) Name() string               { return "rstring" }
func (t *rstringTable) String() string           { return t.Name() }
func (*rstringTable) Collation() sql.CollationID { return sql.Collation_Default }

func (t *rstringTable) Schema() sql.Schema {
	return sql.Schema{
		{
			Name:       "key",
			Type:       types.Text,
			PrimaryKey: true,
			Source:     t.Name(),
		},
		{
			Name:   "value",
			Type:   types.Blob,
			Source: t.Name(),
		},
		{
			Name:      "string",
			Type:      types.Text,
			Nullable:  true,
			Generated: sql.NewUnresolvedColumnDefaultValue("value"),
			Source:    t.Name(),
		},
	}
}

func (t *rstringTable) Partitions(*sql.Context) (sql.PartitionIter, error) {
	return &partitionIter{}, nil
}
func (t *rstringTable) PartitionRows(*sql.Context, sql.Partition) (sql.RowIter, error) {
	return &rstringRowIter{rdb: t.rdb}, nil
}
