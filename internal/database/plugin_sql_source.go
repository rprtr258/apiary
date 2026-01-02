package database

import "context"

const KindSQLSource Kind = "sql-source"

type SQLSourceRequest struct {
	Database Database `json:"database"`
	DSN      string   `json:"dsn"`
}

func (SQLSourceRequest) Kind() Kind { return KindSQLSource }

var pluginSQLSource = plugin{
	EmptyRequest:   SQLSourceEmptyRequest,
	enum:           enumElem[Kind]{KindSQLSource, "SQLSource"},
	Perform:        nil, // TODO: see PerformSQLSource handler
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: (*DB).createResponseSQLSource,
}

var SQLSourceEmptyRequest = SQLSourceRequest{DBPostgres, ""}

func (db *DB) createResponseSQLSource(
	context.Context,
	RequestID,
	Response,
) error {
	return nil // no history for sql source
}
