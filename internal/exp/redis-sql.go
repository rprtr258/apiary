package main

import (
	"context"
	"fmt"
	"strings"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/server"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/vitess/go/mysql"
	redis "github.com/redis/go-redis/v9"
)

var _ sql.Database = (*database)(nil)

type database struct {
	rdb *redis.Client
}

func (db *database) Name() string {
	return fmt.Sprintf("db%d", db.rdb.Options().DB)
}

func (db *database) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
	switch strings.ToLower(tblName) {
	case "rkey":
		return &rkeyTable{rdb: db.rdb}, true, nil
	case "rstring":
		return &rstringTable{rdb: db.rdb}, true, nil
	case "rlist":
		return &rlistTable{rdb: db.rdb}, true, nil
	case "rset":
		return &rsetTable{rdb: db.rdb}, true, nil
	case "rhash":
		return &rhashTable{rdb: db.rdb}, true, nil
	case "rzset":
		return &rzsetTable{rdb: db.rdb}, true, nil
	default:
		return nil, false, nil
	}
}

func (db *database) GetTableNames(*sql.Context) ([]string, error) {
	return []string{
		(*rkeyTable)(nil).Name(),
		(*rstringTable)(nil).Name(),
		(*rlistTable)(nil).Name(),
		(*rsetTable)(nil).Name(),
		(*rhashTable)(nil).Name(),
		(*rzsetTable)(nil).Name(),
	}, nil
}

var _ sql.DatabaseProvider = (*databaseProvider)(nil)

type databaseProvider struct {
	rdb *redis.Client
}

func (dp *databaseProvider) Database(ctx *sql.Context, name string) (sql.Database, error) {
	c, err := dp.rdb.InfoMap(ctx, "keyspace").Result()
	if err != nil {
		return nil, err
	}
	keyspaces := c["Keyspace"]
	if _, ok := keyspaces[name]; ok {
		return &database{rdb: dp.rdb}, nil // TODO: use number from name "db%d"
	}
	return nil, sql.ErrDatabaseNotFound.New(name)
}
func (dp *databaseProvider) HasDatabase(ctx *sql.Context, name string) bool {
	c, err := dp.rdb.InfoMap(ctx, "keyspace").Result()
	if err != nil {
		return false
	}
	keyspaces := c["Keyspace"]
	_, ok := keyspaces[name]
	return ok
}
func (dp *databaseProvider) AllDatabases(ctx *sql.Context) []sql.Database {
	// TODO: INFO keyspaces machinery
	return []sql.Database{
		&database{rdb: dp.rdb},
	}
}

func createTestDatabase() sql.DatabaseProvider {
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   0,
	})

	rdb.Conn()
	return &databaseProvider{rdb}
}

func main() {
	// ctx := context.Background()

	pro := createTestDatabase()
	engine := sqle.NewDefault(pro)

	config := server.Config{
		Protocol: "tcp",
		Address:  fmt.Sprintf("%s:%d", "localhost", 3456),
	}
	s, err := server.NewServer(
		config,
		engine,
		sql.NewContext,
		func(context.Context, *mysql.Conn, string) (sql.Session, error) {
			return sql.NewBaseSession(), nil
		},
		nil,
	)
	if err != nil {
		panic(err)
	}
	if err := s.Start(); err != nil {
		panic(err)
	}
}
