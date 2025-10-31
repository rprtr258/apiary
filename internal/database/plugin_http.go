package database

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/pkg/errors"
)

const KindHTTP Kind = "http"

type HTTPRequest struct {
	URL     string `json:"url"`
	Method  string `json:"method"`
	Body    string `json:"body"`
	Headers []KV   `json:"headers"`
}

func (HTTPRequest) Kind() Kind { return KindHTTP }

type HTTPResponse struct {
	Code    int    `json:"code"`
	Body    string `json:"body"` // TODO: fun.Option[string]
	Headers []KV   `json:"headers"`
}

func (HTTPResponse) Kind() Kind { return KindHTTP }

var pluginHTTP = plugin{
	EmptyRequest:       HTTPEmptyRequest,
	enum:               enumElem[Kind]{KindHTTP, "HTTP"},
	Perform:            sendHTTP,
	create:             (*DB).createHTTP,
	list:               (*DB).listHTTPRequests,
	update:             (*DB).updateHTTP,
	createHistoryEntry: (*DB).createHistoryEntryHTTP,
}

var HTTPEmptyRequest = HTTPRequest{
	"",             // URL // TODO: insert last url used
	http.MethodGet, // Method
	"",             // Body
	nil,            // Headers
}

func fromKV(kvs []KV) http.Header {
	headers := make(http.Header, len(kvs))
	for _, kv := range kvs {
		headers.Add(kv.Key, kv.Value)
	}
	return headers
}

func toKV(headers http.Header) []KV {
	kvs := make([]KV, 0, len(headers))
	for k, vs := range headers {
		kvs = append(kvs, KV{
			Key:   k,
			Value: vs[0],
		})
	}
	slices.SortFunc(kvs, func(a, b KV) int {
		return strings.Compare(a.Key, b.Key)
	})
	return kvs
}

func sendHTTP(ctx context.Context, requestt EntryData) (EntryData, error) {
	req := requestt.(HTTPRequest)
	request, err := http.NewRequestWithContext(
		ctx,
		req.Method,
		req.URL,
		strings.NewReader(req.Body),
	)
	if err != nil {
		return HTTPResponse{}, errors.Wrap(err, "create request")
	}
	request.Header = fromKV(req.Headers)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return HTTPResponse{}, errors.Wrap(err, "perform request")
	}

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(response.Body); err != nil {
		return HTTPResponse{}, err
	}

	return HTTPResponse{
		response.StatusCode,
		buf.String(),
		toKV(response.Header),
	}, nil
}

func (db *DB) createHTTP(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(HTTPRequest)
	headers, err := json.Marshal(req.Headers)
	if err != nil {
		return errors.Wrap(err, "marshal http request")
	}
	_, err = db.db.ExecContext(ctx, `INSERT INTO request_http (id, url, method, body, headers) VALUES ($1, $2, $3, $4, $5)`, id, req.URL, req.Method, req.Body, headers)
	return errors.Wrap(err, "insert http request")
}

func (db *DB) listHTTPRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID      string          `db:"id"`
		URL     string          `db:"url"`
		Method  string          `db:"method"`
		Body    string          `db:"body"`
		Headers json.RawMessage `db:"headers"`
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_http`); err != nil {
		return nil, errors.Wrapf(err, "query http requests")
	}

	var resps []struct {
		ID         string           `db:"id"`
		Pos        int              `db:"pos"` // TODO: remove?
		SentAt     time.Time        `db:"sent_at"`
		ReceivedAt time.Time        `db:"received_at"`
		Code       int              `db:"code"`
		Body       sql.Null[string] `db:"body"`
		Headers    json.RawMessage  `db:"headers"`
	}
	if err := db.db.SelectContext(ctx, &resps, `SELECT
	r.sent_at, r.received_at,
	rh.*
FROM response r
JOIN response_http rh ON r.id = rh.id AND r.pos = rh.pos
ORDER BY r.id, r.pos`); err != nil {
		return nil, errors.Wrapf(err, "query http requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		var headers []KV
		if err := json.Unmarshal(req.Headers, &headers); err != nil {
			return nil, errors.Wrapf(err, "unmarshal http response headers")
		}
		request := HTTPRequest{req.URL, req.Method, req.Body, headers}
		history := make([]HistoryEntry, 0) // TODO: single slice
		for _, resp := range resps {
			if resp.ID != req.ID {
				continue
			}
			var headers []KV
			if err := json.Unmarshal(resp.Headers, &headers); err != nil {
				return nil, errors.Wrapf(err, "unmarshal http response headers")
			}
			history = append(history, HistoryEntry{
				resp.SentAt, resp.ReceivedAt, request,
				HTTPResponse{resp.Code, resp.Body.V, headers},
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

func (db *DB) updateHTTP(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(HTTPRequest)
	headers, err := json.Marshal(req.Headers)
	if err != nil {
		return err
	}
	_, err = db.db.ExecContext(ctx,
		`UPDATE request_http
			SET url = $2, method = $3, body = $4, headers = $5
			WHERE id = $1`,
		id,
		req.URL, req.Method, req.Body, headers,
	)
	return err
}

func (db *DB) createHistoryEntryHTTP(
	ctx context.Context,
	id RequestID, newPos int,
	response EntryData,
) error {
	resp := response.(HTTPResponse)
	headers, err := json.Marshal(resp.Headers)
	if err != nil {
		return errors.Wrap(err, "marshal http headers")
	}

	_, err = db.db.ExecContext(ctx,
		`INSERT INTO response_http (id, pos, code, headers, body) VALUES ($1, $2, $3, $4, $5)`,
		id, newPos, resp.Code, headers, resp.Body,
	)
	return errors.Wrap(err, "insert http response")
}
