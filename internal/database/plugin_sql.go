package database

import (
	"context"
	"database/sql"
	"reflect"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	_ "modernc.org/sqlite"
)

const KindSQL Kind = "sql"

type Database string

const (
	DBPostgres   Database = "postgres"
	DBMySQL      Database = "mysql"
	DBSQLite     Database = "sqlite"
	DBClickhouse Database = "clickhouse"
)

var AllDatabases = []enumElem[Database]{
	{DBPostgres, "POSTGRES"},
	{DBMySQL, "MYSQL"},
	{DBSQLite, "SQLITE"},
	{DBClickhouse, "CLICKHOUSE"},
}

type SQLRequest struct {
	DSN      string   `json:"dsn"`
	Database Database `json:"database"`
	Query    string   `json:"query"`
}

func (SQLRequest) Kind() Kind { return KindSQL }

type ColumnType string

var AllColumnTypes = []enumElem[ColumnType]{
	{ColumnTypeString, "STRING"},
	{ColumnTypeNumber, "NUMBER"},
	{ColumnTypeTime, "TIME"},
	{ColumnTypeBoolean, "BOOLEAN"},
}

const (
	ColumnTypeString  ColumnType = "string"
	ColumnTypeNumber  ColumnType = "number"
	ColumnTypeTime    ColumnType = "time"
	ColumnTypeBoolean ColumnType = "boolean"
)

type SQLResponse struct { // TODO: last inserted id on insert
	Columns []string     `json:"columns"`
	Types   []ColumnType `json:"types"`
	Rows    [][]any      `json:"rows"`
}

func (SQLResponse) Kind() Kind { return KindSQL }

var pluginSQL = plugin{
	EmptyRequest:   SQLEmptyRequest,
	enum:           enumElem[Kind]{KindSQL, "SQL"},
	Perform:        sendSQL,
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: (*DB).createResponse,
}

var SQLEmptyRequest = SQLRequest{
	"",         // DSN // TODO: insert last dsn used
	DBPostgres, // Database
	"",         // Query
}

func convertTypes(columns int, rows [][]any) []ColumnType {
	types := make([]ColumnType, columns) // TODO: fix get types
	if len(rows) > 0 {
		for i := range columns {
			for _, row := range rows {
				if row[i] == nil {
					continue
				}

				types[i] = func() ColumnType {
					switch row[i].(type) {
					case string:
						return ColumnTypeString
					case uint8, uint16, uint32, uint64, int8, int16, int32, int64:
						return ColumnTypeNumber
					case time.Time:
						return ColumnTypeTime
					case bool:
						return ColumnTypeBoolean
					default:
						return ColumnType(reflect.TypeOf(row[i]).String())
					}
				}()
				break
			}
		}
	}
	return types
}

func sendSQLClickhouse(ctx context.Context, dsn, query string) (SQLResponse, error) {
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "parse DSN")
	}

	db := clickhouse.OpenDB(opts)
	defer db.Close()
	db.SetMaxIdleConns(5)
	db.SetMaxOpenConns(10)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.PingContext(ctx); err != nil {
		return SQLResponse{}, errors.Wrap(err, "ping database")
	}

	// TODO: add limit
	rows, err := db.Query(query)
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "query")
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "get columns")
	}

	rowsData := [][]any{}
	for rows.Next() {
		rowDest := make([]any, len(columns))

		dest := fun.Map[any](func(_ any, i int) any {
			return &rowDest[i]
		}, rowDest...)
		if err := rows.Scan(dest...); err != nil {
			return SQLResponse{}, errors.Wrap(err, "scan row")
		}

		rowsData = append(rowsData, rowDest)
	}

	return SQLResponse{
		columns,
		convertTypes(len(columns), rowsData),
		rowsData,
	}, nil
}

func sendSQLSTD(ctx context.Context, db *sql.DB, query string) (SQLResponse, error) {
	if err := db.PingContext(ctx); err != nil {
		return SQLResponse{}, errors.Wrap(err, "ping database")
	}

	// TODO: add limit
	rows, err := db.Query(query)
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "query")
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "get columns")
	}

	rowsData := [][]any{}
	for rows.Next() {
		rowDest := make([]any, len(columns))

		dest := fun.Map[any](func(_ any, i int) any {
			return &rowDest[i]
		}, rowDest...)
		if err := rows.Scan(dest...); err != nil {
			return SQLResponse{}, errors.Wrap(err, "scan row")
		}

		rowsData = append(rowsData, rowDest)
	}

	return SQLResponse{
		columns,
		convertTypes(len(columns), rowsData),
		rowsData,
	}, nil
}

func sendSQLMysql(ctx context.Context, dsn, query string) (SQLResponse, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "connect to database")
	}
	defer db.Close()

	return sendSQLSTD(ctx, db, query)
}

func sendSQLSqlite(ctx context.Context, dsn, query string) (SQLResponse, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "connect to database")
	}
	defer db.Close()

	return sendSQLSTD(ctx, db, query)
}

func sendSQLPostgres(ctx context.Context, dsn, query string) (SQLResponse, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return SQLResponse{}, errors.Wrap(err, "connect to database")
	}
	defer db.Close()

	return sendSQLSTD(ctx, db, query)
}

func sendSQL(ctx context.Context, request EntryData) (EntryData, error) {
	req := request.(SQLRequest) // TODO: timeouts
	switch dsn, query := req.DSN, req.Query; req.Database {
	case DBPostgres:
		return sendSQLPostgres(ctx, dsn, query)
	case DBClickhouse:
		return sendSQLClickhouse(ctx, dsn, query)
	case DBSQLite:
		return sendSQLSqlite(ctx, dsn, query)
	case DBMySQL:
		return sendSQLMysql(ctx, dsn, query)
	default:
		return SQLResponse{}, errors.Errorf("unsupported database: %s", req.Database)
	}
}
