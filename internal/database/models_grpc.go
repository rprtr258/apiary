package database

import (
	"context"
	"encoding/json"
	"time"

	"github.com/pkg/errors"
)

const KindGRPC Kind = "grpc"

var elemGRPC = enumElem[Kind]{KindGRPC, "GRPC"}

type GRPCRequest struct {
	Target   string `json:"target"`
	Method   string `json:"method"` // NOTE: fully qualified
	Payload  string `json:"payload"`
	Metadata []KV   `json:"metadata"`
}

func (GRPCRequest) Kind() Kind { return KindGRPC }

type GRPCResponse struct { // TODO: last inserted id on insert
	Response string `json:"response"`
	// https://grpc.io/docs/guides/status-codes/#the-full-list-of-status-codes
	Code     int  `json:"code"`
	Metadata []KV `json:"metadata"`
}

func (GRPCResponse) Kind() Kind { return KindGRPC }

var GRPCEmptyRequest = GRPCRequest{
	"",  // Target
	"",  // Method
	"",  // Payload
	nil, // Metadata
}

func (db *DB) createGRPC(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(GRPCRequest)
	metadata, err := json.Marshal(req.Metadata)
	if err != nil {
		return errors.Wrap(err, "marshal grpc request")
	}
	_, err = db.db.ExecContext(ctx, `INSERT INTO request_grpc (id, target, method, payload, metadata) VALUES ($1, $2, $3, $4, $5)`, id, req.Target, req.Method, req.Payload, metadata)
	return errors.Wrap(err, "insert grpc request")
}

func (db *DB) updateGRPC(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(GRPCRequest)
	metadata, err := json.Marshal(req.Metadata)
	if err != nil {
		return err
	}
	_, err = db.db.ExecContext(ctx,
		`UPDATE request_grpc
			SET target = $2, method = $3, payload = $4, metadata = $5
			WHERE id = $1`,
		id,
		req.Target, req.Method, req.Payload, metadata,
	)
	return err
}

func (db *DB) listGRPCRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID       string          `db:"id"`
		Target   string          `db:"target"`
		Method   string          `db:"method"`
		Payload  string          `db:"payload"`
		Metadata json.RawMessage `db:"metadata"`
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_grpc`); err != nil {
		return nil, errors.Wrapf(err, "query grpc requests")
	}

	var resps []struct {
		ID         string          `db:"id"`
		Pos        int             `db:"pos"` // TODO: remove?
		SentAt     time.Time       `db:"sent_at"`
		ReceivedAt time.Time       `db:"received_at"`
		Code       int             `db:"code"`
		Response   string          `db:"response"`
		Metadata   json.RawMessage `db:"metadata"`
	}
	if err := db.db.SelectContext(ctx, &resps, `SELECT
	r.sent_at, r.received_at,
	rg.*
FROM response r
JOIN response_grpc rg ON r.id = rg.id AND r.pos = rg.pos
ORDER BY r.id, r.pos`); err != nil {
		return nil, errors.Wrapf(err, "query grpc requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		var metadata []KV
		if err := json.Unmarshal(req.Metadata, &metadata); err != nil {
			return nil, errors.Wrapf(err, "unmarshal grpc metadata")
		}
		request := GRPCRequest{req.Target, req.Method, req.Payload, metadata}
		history := make([]HistoryEntry, 0) // TODO: single slice
		for _, resp := range resps {
			if resp.ID != req.ID {
				continue
			}
			var metadata []KV
			if err := json.Unmarshal(resp.Metadata, &metadata); err != nil {
				return nil, errors.Wrapf(err, "unmarshal grpc metadata")
			}
			history = append(history, HistoryEntry{
				resp.SentAt, resp.ReceivedAt, request,
				GRPCResponse{resp.Response, resp.Code, metadata},
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

func (db *DB) createHistoryEntryGRPC(
	ctx context.Context,
	id RequestID, newPos int,
	response EntryData,
) error {
	resp := response.(GRPCResponse)
	metadata, err := json.Marshal(resp.Metadata)
	if err != nil {
		return errors.Wrap(err, "marshal grpc metadata")
	}

	_, err = db.db.ExecContext(ctx,
		`INSERT INTO response_grpc (id, pos, code, response, metadata) VALUES ($1, $2, $3, $4, $5)`,
		id, newPos, resp.Code, resp.Response, metadata,
	)
	return errors.Wrap(err, "insert grpc response")
}
