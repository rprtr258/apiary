package engine

import (
	"io"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.RowIter = (*rkeyRowIter)(nil)

type rkeyRowIter struct {
	rdb    Client
	keys   []string
	index  int
	cursor uint64
}

func (*rkeyRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rkeyRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if i.cursor == 0 && i.index == len(i.keys) {
			return nil, io.EOF
		}

		if i.index == len(i.keys) {
			keys, cursor, err := i.rdb.ScanType(ctx, i.cursor, "*", 0, "")
			if err != nil {
				return nil, err
			}

			i.keys = keys
			i.cursor = cursor
			i.index = 0
			continue // exhausted page: re-check for end-of-scan before indexing
		}

		key := i.keys[i.index]
		i.index++

		typ, err := i.rdb.Type(ctx, key)
		if err != nil {
			return nil, err
		}

		exp, err := i.rdb.ExpireTime(ctx, key)
		if err != nil {
			return nil, err
		}
		expAt := any(nil)
		if exp != -1 {
			expAt = time.Unix(0, 0).Add(exp)
		}

		return sql.Row{
			key,
			typ,
			expAt,
			// 0,   // TODO: fill?
			// 0,   // TODO: fill?
			// nil, // TODO: fill?
		}, nil
	}
}

var _ sql.Table = (*rkeyTable)(nil)

type rkeyTable struct {
	rdb Client
}

func (*rkeyTable) Name() string               { return "rkey" }
func (t *rkeyTable) String() string           { return t.Name() }
func (*rkeyTable) Collation() sql.CollationID { return sql.Collation_Default }

func (t *rkeyTable) Schema() sql.Schema {
	return sql.Schema{
		{
			Name:       "key",
			Type:       types.Text,
			PrimaryKey: true,
			Source:     t.Name(),
		},
		{
			Name: "type",
			Type: types.MustCreateEnumType([]string{
				"string", "list", "set", "zset", "hash",
				"stream", "vectorset",
			}, sql.Collation_Default),
			Source: t.Name(),
		},
		{
			Name:     "etime",
			Type:     types.Datetime,
			Nullable: true,
			Comment:  "expiration timestamp in unix milliseconds",
			Source:   t.Name(),
		},
		// {
		// 	Name: "len",
		// 	Type: types.Uint64,
		// 	Nullable: true,
		// 	Comment: "number of child elements",
		// },
	}
}

// TODO: partitions by types ?
func (t *rkeyTable) Partitions(*sql.Context) (sql.PartitionIter, error) {
	return &partitionIter{}, nil
}
func (t *rkeyTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	keys, cursor, err := t.rdb.ScanType(ctx, 0, "*", 0, "")
	if err != nil {
		return nil, err
	}
	return &rkeyRowIter{t.rdb, keys, 0, cursor}, nil
}
