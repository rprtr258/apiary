package main

import (
	"io"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	redis "github.com/redis/go-redis/v9"
)

var _ sql.Partition = (*rhashPartition)(nil)

type rhashPartition struct{}

func (*rhashPartition) Key() []byte { return nil }

var _ sql.PartitionIter = (*rhashPartitionIter)(nil)

type rhashPartitionIter struct {
	end bool
}

func (*rhashPartitionIter) Close(*sql.Context) error {
	return nil
}

func (i *rhashPartitionIter) Next(*sql.Context) (sql.Partition, error) {
	if i.end {
		return nil, io.EOF
	}
	i.end = true
	return &rhashPartition{}, nil
}

var _ sql.RowIter = (*rhashRowIter)(nil)

type rhashRow struct {
	key   string
	elems [][2]string
}

type rhashRowIter struct {
	rdb                 *redis.Client
	rows                []rhashRow
	indexKey, indexHash int
}

func (*rhashRowIter) Close(*sql.Context) error {
	return nil
}

func (i *rhashRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.indexKey == len(i.rows) {
		return nil, io.EOF
	}

	set := i.rows[i.indexKey]

	key := set.key
	row := set.elems[i.indexHash]
	field := row[0]
	value := row[1]

	str := any(nil)
	if utf8.ValidString(value) {
		str = value
	}

	// NOTE: skipping empty sets
	i.indexHash++
	for i.indexKey < len(i.rows) && i.indexHash == len(i.rows[i.indexKey].elems) {
		i.indexKey++
		i.indexHash = 0
	}

	return sql.Row{
		key,
		field,
		value,
		str,
	}, nil
}

var _ sql.Table = (*rhashTable)(nil)

type rhashTable struct {
	rdb *redis.Client
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
	return &rhashPartitionIter{}, nil
}
func (t *rhashTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	allKeys := []string{}
	for thecursor := uint64(0); ; {
		keys, cursor, err := t.rdb.ScanType(ctx, thecursor, "*", 0, "hash").Result()
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		if cursor == 0 {
			break
		}
		thecursor = cursor
	}

	rows := []rhashRow{}
	for _, key := range allKeys {
		elems, err := t.rdb.HGetAll(ctx, key).Result()
		if err != nil {
			return nil, err
		}

		kvs := make([][2]string, 0, len(elems))
		for key, val := range elems {
			kvs = append(kvs, [2]string{key, val})
		}

		rows = append(rows, rhashRow{key, kvs})
	}

	return &rhashRowIter{t.rdb, rows, 0, 0}, nil
}
