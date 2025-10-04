package main

import (
	"io"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	redis "github.com/redis/go-redis/v9"
)

var _ sql.Partition = (*rstringPartition)(nil)

type rstringPartition struct{}

func (*rstringPartition) Key() []byte { return nil }

var _ sql.PartitionIter = (*rstringPartitionIter)(nil)

type rstringPartitionIter struct {
	end bool
}

func (*rstringPartitionIter) Close(*sql.Context) error {
	return nil
}

func (i *rstringPartitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &rstringPartition{}, nil
}

var _ sql.RowIter = (*rstringRowIter)(nil)

type rstringRowIter struct {
	rdb    *redis.Client
	keys   []string
	index  int
	cursor uint64
}

func (*rstringRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rstringRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.cursor == 0 && i.index == len(i.keys) {
		return nil, io.EOF
	}

	if i.index == len(i.keys) {
		keys, cursor, err := i.rdb.ScanType(ctx, i.cursor, "*", 0, "string").Result()
		if err != nil {
			return nil, err
		}

		i.keys = keys
		i.cursor = cursor
		i.index = 0
	}

	key := i.keys[i.index]
	i.index++

	value, err := i.rdb.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	str := any(nil)
	if utf8.ValidString(value) {
		str = value
	}

	return sql.Row{
		key,
		value,
		str,
	}, nil
}

var _ sql.Table = (*rstringTable)(nil)

type rstringTable struct {
	rdb *redis.Client
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
	return &rstringPartitionIter{}, nil
}
func (t *rstringTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	keys, cursor, err := t.rdb.ScanType(ctx, 0, "*", 0, "string").Result()
	if err != nil {
		return nil, err
	}
	return &rstringRowIter{t.rdb, keys, 0, cursor}, nil
}
