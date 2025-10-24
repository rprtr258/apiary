package database

import (
	"context"
	"encoding/json"
	"time"

	"github.com/pkg/errors"
)

const KindJQ Kind = "jq"

var elemJQ = enumElem[Kind]{KindJQ, "JQ"}

type JQRequest struct {
	Query string `json:"query"`
	JSON  string `json:"json"`
}

func (JQRequest) Kind() Kind { return KindJQ }

type JQResponse struct {
	Response []string `json:"response"`
}

func (JQResponse) Kind() Kind { return KindJQ }

var JQEmptyRequest = JQRequest{
	".", // Query
	`{
  "string": "string",
  "number": 42,
  "bool": true,
  "list": [1, 2, 3],
  "null": null
}`, // JSON
}

func (db *DB) createJQ(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(JQRequest)
	_, err := db.db.ExecContext(ctx, `INSERT INTO request_jq (id, query, json) VALUES ($1, $2, $3)`, id, req.Query, req.JSON)
	return errors.Wrap(err, "insert jq request")
}

func (db *DB) updateJQ(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(JQRequest)
	_, err := db.db.ExecContext(ctx,
		`UPDATE request_jq
			SET query = $2, json = $3
			WHERE id = $1`,
		id,
		req.Query, req.JSON,
	)
	return err
}

func (db *DB) listJQRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID    string `db:"id"`
		Query string `db:"query"`
		JSON  string `db:"json"`
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_jq`); err != nil {
		return nil, errors.Wrapf(err, "query jq requests")
	}

	var resps []struct {
		ID         string          `db:"id"`
		Pos        int             `db:"pos"` // TODO: remove?
		SentAt     time.Time       `db:"sent_at"`
		ReceivedAt time.Time       `db:"received_at"`
		Response   json.RawMessage `db:"response"`
	}
	if err := db.db.SelectContext(ctx, &resps, `SELECT
	r.sent_at, r.received_at,
	rj.*
FROM response r
JOIN response_jq rj ON r.id = rj.id AND r.pos = rj.pos
ORDER BY r.id, r.pos`); err != nil {
		return nil, errors.Wrapf(err, "query jq requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		request := JQRequest{req.Query, req.JSON}
		history := make([]HistoryEntry, 0) // TODO: single slice
		for _, resp := range resps {
			if resp.ID != req.ID {
				continue
			}
			var response []string
			if err := json.Unmarshal(resp.Response, &response); err != nil {
				return nil, errors.Wrapf(err, "unmarshal jq response headers")
			}
			history = append(history, HistoryEntry{
				resp.SentAt, resp.ReceivedAt, request,
				JQResponse{response},
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

func (db *DB) createHistoryEntryJQ(
	ctx context.Context,
	id RequestID, newPos int,
	response EntryData,
) error {
	resp := response.(JQResponse)
	responsee, err := json.Marshal(resp.Response)
	if err != nil {
		return err
	}

	_, err = db.db.ExecContext(ctx,
		`INSERT INTO response_jq (id, pos, response) VALUES ($1, $2, $3)`,
		id, newPos, responsee,
	)
	return errors.Wrap(err, "insert jq response")
}
