package main

import (
	"io"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	redis "github.com/redis/go-redis/v9"
)

var _ sql.Partition = (*rzsetPartition)(nil)

type rzsetPartition struct{}

func (*rzsetPartition) Key() []byte { return nil }

var _ sql.PartitionIter = (*rzsetPartitionIter)(nil)

type rzsetPartitionIter struct {
	end bool
}

func (*rzsetPartitionIter) Close(*sql.Context) error {
	return nil
}

func (i *rzsetPartitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &rzsetPartition{}, nil
}

var _ sql.RowIter = (*rzsetRowIter)(nil)

type rzsetRow struct {
	key   string
	elems []redis.Z
}

type rzsetRowIter struct {
	rdb       *redis.Client
	rows      []rzsetRow
	indexKey  int
	indexRank int
}

func (*rzsetRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rzsetRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.indexKey == len(i.rows) {
		return nil, io.EOF
	}

	rank := i.indexRank
	set := i.rows[i.indexKey]

	key := set.key
	row := set.elems[i.indexRank]
	value := row.Member.(string)
	score := row.Score

	str := any(nil)
	if utf8.ValidString(value) {
		str = value
	}

	// NOTE: skipping empty sets
	i.indexRank++
	for i.indexKey < len(i.rows) && i.indexRank == len(i.rows[i.indexKey].elems) {
		i.indexKey++
		i.indexRank = 0
	}

	return sql.Row{
		key,
		rank,
		score,
		value,
		str,
	}, nil
}

var _ sql.Table = (*rzsetTable)(nil)

type rzsetTable struct {
	rdb *redis.Client
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
	return &rzsetPartitionIter{}, nil
}
func (t *rzsetTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	allKeys := []string{}
	for thecursor := uint64(0); ; {
		keys, cursor, err := t.rdb.ScanType(ctx, thecursor, "*", 0, "zset").Result()
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		if cursor == 0 {
			break
		}
		thecursor = cursor
	}

	rows := []rzsetRow{}
	for _, key := range allKeys {
		elems, err := t.rdb.ZRangeWithScores(ctx, key, 0, -1).Result()
		if err != nil {
			return nil, err
		}
		rows = append(rows, rzsetRow{key, elems})
	}

	return &rzsetRowIter{t.rdb, rows, 0, 0}, nil
}
