package engine

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.Table = (*rlistTable)(nil)

type rlistTable struct {
	rdb Client
}

func (*rlistTable) Name() string               { return "rlist" }
func (t *rlistTable) String() string           { return t.Name() }
func (*rlistTable) Collation() sql.CollationID { return sql.Collation_Default }

func (t *rlistTable) Schema() sql.Schema {
	return sql.Schema{
		{
			Name:       "key",
			Type:       types.Text,
			PrimaryKey: true,
			Source:     t.Name(),
		},
		{
			Name:   "index",
			Type:   types.Uint64,
			Source: t.Name(),
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

func (t *rlistTable) Partitions(*sql.Context) (sql.PartitionIter, error) {
	return &partitionIter{}, nil
}
func (t *rlistTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	// one LRANGE per list fetches all elements in a single round trip
	return rowsForType(ctx, t.rdb, "list", func(ctx *sql.Context, key string) ([]sql.Row, error) {
		values, err := t.rdb.LRange(ctx, key, 0, -1)
		if err != nil {
			return nil, err
		}
		rows := make([]sql.Row, 0, len(values))
		for idx, value := range values {
			rows = append(rows, sql.Row{key, uint64(idx), value, maybeString(value)})
		}
		return rows, nil
	})
}
