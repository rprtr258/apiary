package database

import (
	"context"
	_ "embed"

	"github.com/pkg/errors"
)

const KindMD Kind = "md"

var elemMD = enumElem[Kind]{KindMD, "MD"}

type MDRequest struct {
	Data string `json:"data"`
}

func (MDRequest) Kind() Kind { return KindMD }

type MDResponse struct {
	Data string `json:"data"`
}

func (MDResponse) Kind() Kind { return KindMD }

//go:embed default.md
var DefaultMarkdown string

var MDEmptyRequest = MDRequest{DefaultMarkdown}

func (db *DB) createMD(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(MDRequest)
	_, err := db.db.ExecContext(ctx, `INSERT INTO request_md (id, data) VALUES ($1, $2)`, id, req.Data)
	return errors.Wrap(err, "insert md request")
}

func (db *DB) listMDRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID string `db:"id"`
		MDRequest
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_md`); err != nil {
		return nil, errors.Wrapf(err, "query md requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		res = append(res, Request{
			ID:      RequestID(req.ID),
			Data:    req.MDRequest,
			History: nil,
		})
	}
	return res, nil
}

func (db *DB) updateMD(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(MDRequest)
	_, err := db.db.ExecContext(ctx,
		`UPDATE request_md
			SET data = $2
			WHERE id = $1`,
		id,
		req.Data,
	)
	return err
}

func (db *DB) createHistoryEntryMD(
	context.Context,
	RequestID, int,
	EntryData,
) error {
	return nil // no history for md
}
