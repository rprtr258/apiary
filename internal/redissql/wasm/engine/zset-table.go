package engine

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.Table = (*rzsetTable)(nil)

type rzsetTable struct {
	rdb Client
}

func (*rzsetTable) Name() string               { return "rzset" }
func (t *rzsetTable) String() string           { return t.Name() }
func (*rzsetTable) Collation() sql.CollationID { return sql.Collation_Default }

func (t *rzsetTable) Schema() sql.Schema {
	return sql.Schema{
		{
			Name:       "key",
			Type:       types.Text,
			PrimaryKey: true,
			Source:     t.Name(),
		},
		{
			Name:   "rank",
			Type:   types.Uint64,
			Source: t.Name(),
		},
		{
			Name:   "score",
			Type:   types.Float64,
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

func (t *rzsetTable) Partitions(*sql.Context) (sql.PartitionIter, error) {
	return &partitionIter{}, nil
}
func (t *rzsetTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	return rowsForType(ctx, t.rdb, "zset", func(ctx *sql.Context, key string) ([]sql.Row, error) {
		elems, err := t.rdb.ZRangeWithScores(ctx, key, 0, -1)
		if err != nil {
			return nil, err
		}
		rows := make([]sql.Row, 0, len(elems))
		for rank, elem := range elems {
			rows = append(rows, sql.Row{key, uint64(rank), elem.Score, elem.Member, maybeString(elem.Member)})
		}
		return rows, nil
	})
}
