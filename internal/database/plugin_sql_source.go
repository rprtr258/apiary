package database

import (
	"context"

	"github.com/pkg/errors"
)

const KindSQLSource Kind = "sql-source"

type SQLSourceRequest struct {
	Database Database `json:"database"`
	DSN      string   `json:"dsn"`
}

func (SQLSourceRequest) Kind() Kind { return KindSQLSource }

var pluginSQLSource = plugin{
	EmptyRequest:       SQLSourceEmptyRequest,
	enum:               enumElem[Kind]{KindSQLSource, "SQLSource"},
	create:             (*DB).createSQLSource,
	list:               (*DB).listSQLSource,
	update:             (*DB).updateSQLSource,
	createHistoryEntry: (*DB).createHistoryEntrySQLSource,
}

var SQLSourceEmptyRequest = SQLSourceRequest{DBPostgres, ""}

func (db *DB) createSQLSource(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(SQLSourceRequest)
	_, err := db.db.ExecContext(ctx, `INSERT INTO request_sql_source (id, dsn, database) VALUES ($1, $2, $3)`, id, req.DSN, req.Database)
	return errors.Wrap(err, "insert sql source")
}

func (db *DB) updateSQLSource(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(SQLSourceRequest)
	_, err := db.db.ExecContext(ctx,
		`UPDATE request_sql_source
			SET dsn = $2, database = $3
			WHERE id = $1`,
		id,
		req.DSN, req.Database,
	)
	return err
}

func (db *DB) listSQLSource(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID       string `db:"id"`
		DSN      string `db:"dsn"`
		Database string `db:"database"`
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_sql_source`); err != nil {
		return nil, errors.Wrapf(err, "query sql requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		request := SQLSourceRequest{Database(req.Database), req.DSN}

		res = append(res, Request{
			ID:      RequestID(req.ID),
			Data:    request,
			History: nil,
		})
	}
	return res, nil
}

func (db *DB) createHistoryEntrySQLSource(
	context.Context,
	RequestID, int,
	EntryData,
) error {
	return nil // no history for sql source
}
