package database

import (
	"context"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
)

type DB struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *DB {
	return &DB{
		db: db,
	}
}

func (db *DB) Close() error {
	return nil
}

func (db *DB) list(ctx context.Context, ids []RequestID) ([]Request, error) {
	var rows []struct {
		ID   RequestID
		Kind Kind
	}
	if err := db.db.SelectContext(ctx, &rows, `SELECT id, kind FROM request`); err != nil {
		return nil, errors.Wrapf(err, "query rows")
	}

	res := make([]Request, 0, len(rows))
	for kind, list := range listers {
		requests, err := list(db, ctx)
		if err != nil {
			return nil, errors.Wrapf(err, "list %s requests", kind)
		}
		res = append(res, requests...)
	}

	if ids != nil { // TODO: use filter in sql requests instead
		res = fun.Filter(func(r Request) bool {
			return fun.Contains(r.ID, ids...)
		}, res...)
	}

	return res, nil
}

func (db *DB) List(ctx context.Context) ([]Request, error) {
	return db.list(ctx, nil)
}

func (db *DB) Get(ctx context.Context, id RequestID) (Request, error) {
	resp, err := db.list(ctx, []RequestID{id})
	if err != nil {
		return Request{}, err
	}
	if len(resp) != 1 {
		return Request{}, errors.New("not found")
	}
	return resp[0], err
}

func (db *DB) Create(
	ctx context.Context,
	id RequestID,
	request EntryData,
) error {
	kind := request.Kind()
	if _, err := db.db.ExecContext(ctx, `INSERT INTO request (id, kind) VALUES ($1, $2)`, id, kind); err != nil {
		return errors.Wrap(err, "insert request")
	}

	create, ok := creates[kind]
	if !ok {
		return errors.Errorf("unknown request kind %s", kind)
	}

	return create(db, ctx, id, request)
}

func (db *DB) Delete(ctx context.Context, id RequestID) error {
	// TODO: switch on kind
	for _, table := range []string{
		"request", "response",
		"request_http", "response_http",
		"request_sql", "response_sql",
		"request_jq", "response_jq",
		"request_md",
		"request_redis", "response_redis",
		"request_grpc", "response_grpc",
	} {
		if _, err := db.db.ExecContext(ctx, `DELETE FROM `+table+` WHERE id = $1`, id); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) Rename(ctx context.Context, id, newID RequestID) error {
	// TODO: switch on kind
	for _, table := range []string{
		"request", "response",
		"request_http", "response_http",
		"request_sql", "response_sql",
		"request_jq", "response_jq",
		"request_md",
		"request_redis", "response_redis",
		"request_grpc", "response_grpc",
	} {
		if _, err := db.db.ExecContext(ctx, `UPDATE `+table+` SET id = $1 WHERE id = $2`, newID, id); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) Update(
	ctx context.Context,
	id RequestID,
	request EntryData,
) error {
	kind := request.Kind()
	update, ok := updates[kind]
	if !ok {
		return errors.Errorf("unknown request kind %s", kind)
	}

	return update(db, ctx, id, request)
}

func (db *DB) CreateHistoryEntry(
	ctx context.Context,
	id RequestID,
	entry HistoryEntry,
) error {
	var newPos int
	if err := db.db.GetContext(ctx, &newPos, `SELECT COALESCE(MAX(pos) + 1, 0) FROM response WHERE id=$1`, id); err != nil {
		return err
	}

	if _, err := db.db.ExecContext(ctx,
		`INSERT INTO response (id, pos, sent_at, received_at) VALUES ($1, $2, $3, $4)`,
		id, newPos, entry.SentAt, entry.ReceivedAt,
	); err != nil {
		return errors.Wrap(err, "insert response")
	}

	createHistoryEntry, ok := createHistoryEntrys[entry.Request.Kind()]
	if !ok {
		return errors.Errorf("unknown response kind %s", entry.Request.Kind())
	}

	return createHistoryEntry(db, ctx, id, newPos, entry.Response)
}
