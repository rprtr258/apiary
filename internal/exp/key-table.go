package main

import (
	"io"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	redis "github.com/redis/go-redis/v9"
)

var _ sql.Partition = (*rkeyPartition)(nil)

type rkeyPartition struct{}

func (*rkeyPartition) Key() []byte { return nil }

var _ sql.PartitionIter = (*rkeyPartitionIter)(nil)

type rkeyPartitionIter struct {
	end bool
}

func (*rkeyPartitionIter) Close(*sql.Context) error {
	return nil
}

func (i *rkeyPartitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &rkeyPartition{}, nil
}

var _ sql.RowIter = (*rkeyRowIter)(nil)

type rkeyRowIter struct {
	rdb   *redis.Client
	keys  []string
	index int
}

func (*rkeyRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rkeyRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.index == len(i.keys) {
		return nil, io.EOF
	}
	key := i.keys[i.index]
	i.index++

	typ, err := i.rdb.Type(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	expUnix, err := i.rdb.ExpireTime(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	exp := any(nil)
	if expUnix != -1 {
		exp = time.Unix(0, 0).Add(expUnix)
	}

	return sql.Row{
		key,
		typ,
		exp,
		// 0,   // TODO: fill?
		// 0,   // TODO: fill?
		// nil, // TODO: fill?
	}, nil
}

var _ sql.Table = (*rkeyTable)(nil)

type rkeyTable struct {
	rdb *redis.Client
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
	return &rkeyPartitionIter{}, nil
}
func (t *rkeyTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	keys, err := t.rdb.Keys(ctx, "*").Result()
	if err != nil {
		return nil, err
	}
	return &rkeyRowIter{t.rdb, keys, 0}, nil
}
