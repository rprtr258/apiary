package redissql

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

var _ sql.Database = (*Database)(nil)

// Database exposes the tables of one redis logical db.
type Database struct {
	rdb Client
}

func (db *Database) Name() string {
	return fmt.Sprintf("db%d", db.rdb.DBIndex())
}

func (db *Database) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
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

func (db *Database) GetTableNames(*sql.Context) ([]string, error) {
	return []string{
		(*rkeyTable)(nil).Name(),
		(*rstringTable)(nil).Name(),
		(*rlistTable)(nil).Name(),
		(*rsetTable)(nil).Name(),
		(*rhashTable)(nil).Name(),
		(*rzsetTable)(nil).Name(),
	}, nil
}

var _ sql.DatabaseProvider = (*Provider)(nil)

// Provider serves exactly one database: the logical db the Client points to.
// Redis dbs always exist when addressed, so no INFO keyspace check is needed.
type Provider struct {
	rdb Client
}

func NewProvider(rdb Client) *Provider {
	return &Provider{rdb: rdb}
}

func (dp *Provider) Database(ctx *sql.Context, name string) (sql.Database, error) {
	if dp.HasDatabase(ctx, name) {
		return &Database{rdb: dp.rdb}, nil
	}
	return nil, sql.ErrDatabaseNotFound.New(name)
}

func (dp *Provider) HasDatabase(_ *sql.Context, name string) bool {
	return strings.EqualFold(name, fmt.Sprintf("db%d", dp.rdb.DBIndex()))
}

func (dp *Provider) AllDatabases(*sql.Context) []sql.Database {
	return []sql.Database{
		&Database{rdb: dp.rdb},
	}
}
