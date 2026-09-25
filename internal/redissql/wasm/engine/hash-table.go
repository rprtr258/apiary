package engine

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.Table = (*rhashTable)(nil)

type rhashTable struct {
	rdb Client
}

func (*rhashTable) Name() string               { return "rhash" }
func (t *rhashTable) String() string           { return t.Name() }
func (*rhashTable) Collation() sql.CollationID { return sql.Collation_Default }

func (t *rhashTable) Schema() sql.Schema {
	return sql.Schema{
		{
			Name:       "key",
			Type:       types.Text,
			PrimaryKey: true,
			Source:     t.Name(),
		},
		{
			Name:   "field",
			Type:   types.Text,
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

func (t *rhashTable) Partitions(*sql.Context) (sql.PartitionIter, error) {
	return &partitionIter{}, nil
}
func (t *rhashTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	return rowsForType(ctx, t.rdb, "hash", func(ctx *sql.Context, key string) ([]sql.Row, error) {
		elems, err := t.rdb.HGetAll(ctx, key)
		if err != nil {
			return nil, err
		}
		rows := make([]sql.Row, 0, len(elems))
		for field, value := range elems {
			rows = append(rows, sql.Row{key, field, value, maybeString(value)})
		}
		return rows, nil
	})
}
