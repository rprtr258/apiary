package main

import (
	"io"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	redis "github.com/redis/go-redis/v9"
)

var _ sql.Partition = (*rlistPartition)(nil)

type rlistPartition struct{}

func (*rlistPartition) Key() []byte { return nil }

var _ sql.PartitionIter = (*rlistPartitionIter)(nil)

type rlistPartitionIter struct {
	end bool
}

func (*rlistPartitionIter) Close(*sql.Context) error {
	return nil
}

func (i *rlistPartitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &rlistPartition{}, nil
}

var _ sql.RowIter = (*rlistRowIter)(nil)

type rlistRowIter struct {
	rdb       *redis.Client
	keys      []string
	lens      []int64
	indexKey  int
	indexList int64
}

func (*rlistRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rlistRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.indexKey == len(i.keys) {
		return nil, io.EOF
	}

	index := i.indexList
	key := i.keys[i.indexKey]

	value, err := i.rdb.LIndex(ctx, key, i.indexList).Result()
	if err != nil {
		return nil, err
	}

	str := any(nil)
	if utf8.ValidString(value) {
		str = value
	}

	// NOTE: skipping empty lists
	i.indexList++
	for i.indexKey < len(i.keys) && i.indexList == i.lens[i.indexKey] {
		i.indexKey++
		i.indexList = 0
	}

	return sql.Row{
		key,
		index,
		value,
		str,
	}, nil
}

var _ sql.Table = (*rlistTable)(nil)

type rlistTable struct {
	rdb *redis.Client
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
	return &rlistPartitionIter{}, nil
}
func (t *rlistTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	allKeys := []string{}
	for thecursor := uint64(0); ; {
		keys, cursor, err := t.rdb.ScanType(ctx, thecursor, "*", 0, "list").Result()
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		if cursor == 0 {
			break
		}
		thecursor = cursor
	}

	lens := make([]int64, len(allKeys))
	for i, key := range allKeys {
		len, err := t.rdb.LLen(ctx, key).Result()
		if err != nil {
			return nil, err
		}
		lens[i] = len
	}

	return &rlistRowIter{t.rdb, allKeys, lens, 0, 0}, nil
}
