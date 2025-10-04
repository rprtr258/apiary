package main

import (
	"io"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	redis "github.com/redis/go-redis/v9"
)

type rsetRow struct {
	key   string
	elems []string
}

var _ sql.Partition = (*rsetPartition)(nil)

type rsetPartition struct{}

func (*rsetPartition) Key() []byte { return nil }

var _ sql.PartitionIter = (*rsetPartitionIter)(nil)

type rsetPartitionIter struct {
	end bool
}

func (*rsetPartitionIter) Close(*sql.Context) error {
	return nil
}

func (i *rsetPartitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &rsetPartition{}, nil
}

var _ sql.RowIter = (*rsetRowIter)(nil)

type rsetRowIter struct {
	rdb                 *redis.Client
	sets                []rsetRow
	indexKey, indexList int
}

func (*rsetRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rsetRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.indexKey == len(i.sets) {
		return nil, io.EOF
	}

	set := i.sets[i.indexKey]

	key := set.key
	value := set.elems[i.indexList]

	str := any(nil)
	if utf8.ValidString(value) {
		str = value
	}

	// NOTE: skipping empty sets
	i.indexList++
	for i.indexKey < len(i.sets) && i.indexList == len(i.sets[i.indexKey].elems) {
		i.indexKey++
		i.indexList = 0
	}

	return sql.Row{
		key,
		value,
		str,
	}, nil
}

var _ sql.Table = (*rsetTable)(nil)

type rsetTable struct {
	rdb *redis.Client
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
	return &rsetPartitionIter{}, nil
}
func (t *rsetTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	allKeys := []string{}
	for thecursor := uint64(0); ; {
		keys, cursor, err := t.rdb.ScanType(ctx, thecursor, "*", 0, "set").Result()
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		if cursor == 0 {
			break
		}
		thecursor = cursor
	}

	sets := make([]rsetRow, len(allKeys))
	for i, key := range allKeys {
		elems, err := t.rdb.SMembers(ctx, key).Result()
		if err != nil {
			return nil, err
		}
		sets[i] = rsetRow{key, elems}
	}

	return &rsetRowIter{t.rdb, sets, 0, 0}, nil
}
