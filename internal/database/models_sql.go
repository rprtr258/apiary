package database

import (
	"context"
	"encoding/json"
	"time"

	"github.com/pkg/errors"
)

const KindSQL Kind = "sql"

var elemSQL = enumElem[Kind]{KindSQL, "SQL"}

type Database string

const (
	Postgres   Database = "postgres"
	MySQL      Database = "mysql"
	SQLite     Database = "sqlite"
	Clickhouse Database = "clickhouse"
)

var AllDatabases = []enumElem[Database]{
	{Postgres, "POSTGRES"},
	{MySQL, "MYSQL"},
	{SQLite, "SQLITE"},
	{Clickhouse, "CLICKHOUSE"},
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

var SQLEmptyRequest = SQLRequest{
	"",       // DSN // TODO: insert last dsn used
	Postgres, // Database
	"",       // Query
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
