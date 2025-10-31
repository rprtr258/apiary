package database

import (
	"context"
	"database/sql"
	"encoding/json"
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
	EmptyRequest:       SQLEmptyRequest,
	enum:               enumElem[Kind]{KindSQL, "SQL"},
	Perform:            sendSQL,
	create:             (*DB).createSQL,
	list:               (*DB).listSQLRequests,
	update:             (*DB).updateSQL,
	createHistoryEntry: (*DB).createHistoryEntrySQL,
}

var SQLEmptyRequest = SQLRequest{
	"",         // DSN // TODO: insert last dsn used
	DBPostgres, // Database
	"",         // Query
}

func (db *DB) createSQL(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(SQLRequest)
	_, err := db.db.ExecContext(ctx, `INSERT INTO request_sql (id, dsn, database, query) VALUES ($1, $2, $3, $4)`, id, req.DSN, req.Database, req.Query)
	return errors.Wrap(err, "insert sql request")
}

func (db *DB) updateSQL(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(SQLRequest)
	_, err := db.db.ExecContext(ctx,
		`UPDATE request_sql
			SET dsn = $2, database = $3, query = $5
			WHERE id = $1`,
		id,
		req.DSN, req.Database, req.Query,
	)
	return err
}

func (db *DB) listSQLRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID       string `db:"id"`
		DSN      string `db:"dsn"`
		Database string `db:"database"`
		Query    string `db:"query"`
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_sql`); err != nil {
		return nil, errors.Wrapf(err, "query sql requests")
	}

	var resps []struct {
		ID         string          `db:"id"`
		Pos        int             `db:"pos"` // TODO: remove?
		SentAt     time.Time       `db:"sent_at"`
		ReceivedAt time.Time       `db:"received_at"`
		Columns    json.RawMessage `db:"columns"`
		Types      json.RawMessage `db:"types"`
		Rows       json.RawMessage `db:"rows"`
	}
	if err := db.db.SelectContext(ctx, &resps, `SELECT
	r.sent_at, r.received_at,
	rs.*
FROM response r
JOIN response_sql rs ON r.id = rs.id AND r.pos = rs.pos
ORDER BY r.id, r.pos`); err != nil {
		return nil, errors.Wrapf(err, "query sql requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		request := SQLRequest{req.DSN, Database(req.Database), req.Query}
		history := make([]HistoryEntry, 0) // TODO: single slice
		for _, resp := range resps {
			if resp.ID != req.ID {
				continue
			}
			var columns []string
			if err := json.Unmarshal(resp.Columns, &columns); err != nil {
				return nil, errors.Wrapf(err, "unmarshal sql response columns")
			}
			var types []ColumnType
			if err := json.Unmarshal(resp.Types, &types); err != nil {
				return nil, errors.Wrapf(err, "unmarshal sql response types")
			}
			var rows [][]any
			if err := json.Unmarshal(resp.Rows, &rows); err != nil {
				return nil, errors.Wrapf(err, "unmarshal sql response rows")
			}
			history = append(history, HistoryEntry{
				resp.SentAt, resp.ReceivedAt,
				request,
				SQLResponse{columns, types, rows},
			})
		}

		res = append(res, Request{
			ID:      RequestID(req.ID),
			Data:    request,
			History: history,
		})
	}
	return res, nil
}

func (db *DB) createHistoryEntrySQL(
	ctx context.Context,
	id RequestID, newPos int,
	response EntryData,
) error {
	resp := response.(SQLResponse)
	columns, err := json.Marshal(resp.Columns)
	if err != nil {
		return errors.Wrap(err, "marshal sql columns")
	}

	types, err := json.Marshal(resp.Types)
	if err != nil {
		return errors.Wrap(err, "marshal sql types")
	}

	rows, err := json.Marshal(resp.Rows)
	if err != nil {
		return errors.Wrap(err, "marshal sql rows")
	}

	_, err = db.db.ExecContext(ctx,
		`INSERT INTO response_sql (id, pos, columns, types, rows) VALUES ($1, $2, $3, $4, $5)`,
		id, newPos, columns, types, rows,
	)
	return errors.Wrap(err, "insert sql response")
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

	var rowsData [][]any
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

	var rowsData [][]any
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
	req := request.(SQLRequest)
	dsn, query := req.DSN, req.Query
	switch req.Database {
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
