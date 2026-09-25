package engine

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.Table = (*rsetTable)(nil)

type rsetTable struct {
	rdb Client
}

func (*rsetTable) Name() string               { return "rset" }
func (t *rsetTable) String() string           { return t.Name() }
func (*rsetTable) Collation() sql.CollationID { return sql.Collation_Default }

func (t *rsetTable) Schema() sql.Schema {
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

func (t *rsetTable) Partitions(*sql.Context) (sql.PartitionIter, error) {
	return &partitionIter{}, nil
}
func (t *rsetTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	return rowsForType(ctx, t.rdb, "set", func(ctx *sql.Context, key string) ([]sql.Row, error) {
		elems, err := t.rdb.SMembers(ctx, key)
		if err != nil {
			return nil, err
		}
		rows := make([]sql.Row, 0, len(elems))
		for _, value := range elems {
			rows = append(rows, sql.Row{key, value, maybeString(value)})
		}
		return rows, nil
	})
}
