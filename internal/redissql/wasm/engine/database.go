package engine

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

// DBName is the SQL name of the database serving the redis logical db with
// the given index.
func DBName(index int) string {
	return fmt.Sprintf("db%d", index)
}

func (db *Database) Name() string {
	return DBName(db.rdb.DBIndex())
}

// tableFactories is the single source of truth for the exposed tables. Go
// randomizes map iteration order, so nothing here fixes a listing order;
// consumers that care sort by name (the source list does).
var tableFactories = map[string]func(Client) sql.Table{
	"rkey":    func(rdb Client) sql.Table { return &rkeyTable{rdb: rdb} },
	"rstring": func(rdb Client) sql.Table { return &rstringTable{rdb: rdb} },
	"rlist":   func(rdb Client) sql.Table { return &rlistTable{rdb: rdb} },
	"rset":    func(rdb Client) sql.Table { return &rsetTable{rdb: rdb} },
	"rhash":   func(rdb Client) sql.Table { return &rhashTable{rdb: rdb} },
	"rzset":   func(rdb Client) sql.Table { return &rzsetTable{rdb: rdb} },
}

func (db *Database) GetTableInsensitive(_ *sql.Context, tblName string) (sql.Table, bool, error) {
	for name, factory := range tableFactories {
		if strings.EqualFold(name, tblName) {
			return factory(db.rdb), true, nil
		}
	}
	return nil, false, nil
}

func (*Database) GetTableNames(*sql.Context) ([]string, error) {
	names := make([]string, 0, len(tableFactories))
	for name := range tableFactories {
		names = append(names, name)
	}
	return names, nil
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
	return strings.EqualFold(name, DBName(dp.rdb.DBIndex()))
}

func (dp *Provider) AllDatabases(*sql.Context) []sql.Database {
	return []sql.Database{
		&Database{rdb: dp.rdb},
	}
}
