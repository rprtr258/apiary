package app

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/rprtr258/fun"

	"github.com/rprtr258/apiary/internal/database"
)

type requestPreview struct {
	Kind    database.Kind
	SubKind string
}

type Tree struct {
	IDs  []string
	Dirs map[string]Tree
}

type ListResponse struct {
	Tree     Tree
	Requests map[string]requestPreview
}

func add(t Tree, parts []string, id string) Tree {
	if len(parts) == 1 {
		t.IDs = append(t.IDs, id)
		return t
	}

	part := parts[0]
	if _, ok := t.Dirs[part]; !ok {
		t.Dirs[part] = Tree{[]string{}, map[string]Tree{}}
	}
	t.Dirs[part] = add(t.Dirs[part], parts[1:], id)
	return t
}

func (a *App) List() (ListResponse, error) {
	requests, err := a.DB.List(a.ctx)
	if err != nil {
		return ListResponse{}, errors.Wrap(err, "list requests")
	}

	previews := make(map[string]requestPreview, len(requests))
	for _, request := range requests {
		previews[string(request.ID)] = requestPreview{
			Kind: request.Data.Kind(),
			SubKind: func() string {
				switch v := request.Data.(type) {
				case database.HTTPRequest:
					return v.Method
				case database.SQLRequest:
					return string(v.Database)
				default:
					return ""
				}
			}(),
		}
	}

	tree := Tree{[]string{}, map[string]Tree{}}
	for _, req := range requests {
		parts := strings.Split(string(req.ID), "/")
		tree = add(tree, parts, string(req.ID))
	}

	return ListResponse{
		Tree:     tree,
		Requests: previews,
	}, nil
}

type historyEntry = map[string]any

type GetResponse struct {
	Request database.Request
	History []historyEntry
}

func (a *App) Get(id string) (GetResponse, error) {
	request, err := a.DB.Get(a.ctx, database.RequestID(id))
	if err != nil {
		return GetResponse{}, errors.Wrapf(err, "get request id=%q", id)
	}

	history := fun.Map[historyEntry](func(h database.HistoryEntry) historyEntry {
		return historyEntry{
			"sent_at":     h.SentAt.Format(time.RFC3339),
			"received_at": h.ReceivedAt.Format(time.RFC3339),
			"request":     h.Request,
			"response":    h.Response,
		}
	}, request.History...)
	slices.SortFunc(history, func(i, j historyEntry) int {
		return strings.Compare(i["sent_at"].(string), j["sent_at"].(string))
	})

	return GetResponse{request, history}, nil
}

type ResponseNewRequest struct {
	ID database.RequestID `json:"id"`
}

func (a *App) Create(
	id string,
	kind database.Kind,
) (ResponseNewRequest, error) {
	req, ok := database.EmptyRequests[kind]
	if !ok {
		return ResponseNewRequest{}, errors.Errorf("unknown request kind %q", kind)
	}

	err := a.DB.Create(a.ctx, database.RequestID(id), req)
	if err != nil {
		return ResponseNewRequest{}, errors.Wrap(err, "error while creating request")
	}

	return ResponseNewRequest{
		ID: database.RequestID(id), // TODO: remove
	}, nil
}

func (a *App) Duplicate(id string) error {
	request, err := a.DB.Get(a.ctx, database.RequestID(id))
	if err != nil {
		return errors.Wrapf(err, "get original request id=%q", id)
	}

	n := 1
	for {
		newID := database.RequestID(fmt.Sprintf("%s (%d)", id, n))
		if _, err := a.DB.Get(a.ctx, newID); errors.Is(err, sql.ErrNoRows) {
			break
		}
	}

	newID := database.RequestID(fmt.Sprintf("%s (%d)", id, n))
	return a.DB.Create(a.ctx, newID, request.Data)
}

func (a *App) Read(requestID string) (database.Request, error) {
	request, err := a.DB.Get(a.ctx, database.RequestID(requestID))
	if err != nil {
		return database.Request{}, errors.Wrapf(err, "get request id=%q", requestID)
	}

	return request, nil
}

func (a *App) Rename(requestID, newRequestID string) error {
	if err := a.DB.Rename(a.ctx, database.RequestID(requestID), database.RequestID(newRequestID)); err != nil {
		return errors.Wrap(err, "rename request")
	}

	return nil
}

func parse[T database.EntryData](b []byte) (database.EntryData, error) {
	var res T
	if err := json.Unmarshal(b, &res); err != nil {
		return res, errors.Wrapf(err, "unmarshal %T request", res)
	}
	return res, nil
}

func (a *App) Update(
	requestID string,
	kind database.Kind,
	request map[string]any,
) error {
	b, err := json.Marshal(request)
	if err != nil {
		return errors.Wrap(err, "huita request")
	}

	parseRequestt, ok := map[database.Kind]func([]byte) (database.EntryData, error){
		database.KindHTTP:  parse[database.HTTPRequest],
		database.KindSQL:   parse[database.SQLRequest],
		database.KindGRPC:  parse[database.GRPCRequest],
		database.KindJQ:    parse[database.JQRequest],
		database.KindRedis: parse[database.RedisRequest],
		database.KindMD:    parse[database.MDRequest],
	}[kind]
	if !ok {
		return errors.Errorf("unknown request kind %q", kind)
	}

	requestt, err := parseRequestt(b)
	if err != nil {
		return errors.Wrap(err, "unmarshal request")
	}

	if err := a.DB.Update(
		a.ctx,
		database.RequestID(requestID),
		requestt,
	); err != nil {
		return errors.Wrap(err, "update request")
	}

	return nil
}

func (a *App) Delete(requestID string) error {
	if err := a.DB.Delete(a.ctx, database.RequestID(requestID)); err != nil {
		return errors.Wrap(err, "delete request")
	}

	return nil
}

func fromKV(kvs []database.KV) http.Header {
	headers := make(http.Header, len(kvs))
	for _, kv := range kvs {
		headers.Add(kv.Key, kv.Value)
	}
	return headers
}

func toKV(headers http.Header) []database.KV {
	kvs := make([]database.KV, 0, len(headers))
	for k, vs := range headers {
		kvs = append(kvs, database.KV{
			Key:   k,
			Value: vs[0],
		})
	}
	slices.SortFunc(kvs, func(a, b database.KV) int {
		return strings.Compare(a.Key, b.Key)
	})
	return kvs
}

// Perform create a handler that performs call and save result to history
func (a *App) Perform(requestID string) (historyEntry, error) {
	request, err := a.DB.Get(a.ctx, database.RequestID(requestID))
	if err != nil {
		return nil, errors.Wrapf(err, "get request id=%q", requestID)
	}

	sentAt := time.Now()

	var response database.EntryData
	switch request := request.Data.(type) {
	case database.HTTPRequest:
		response, err = a.sendHTTP(request)
		if err != nil {
			return nil, errors.Wrapf(err, "send http request id=%q", requestID)
		}
	case database.SQLRequest:
		response, err = a.sendSQL(request)
		if err != nil {
			return nil, errors.Wrapf(err, "send sql request id=%q", requestID)
		}
	case database.GRPCRequest:
		response, err = a.sendGRPC(request)
		if err != nil {
			return nil, errors.Wrapf(err, "send grpc request id=%q", requestID)
		}
	case database.JQRequest:
		response, err = sendJQ(a.ctx, request)
		if err != nil {
			return nil, errors.Wrapf(err, "send jq request id=%q", requestID)
		}
	case database.RedisRequest:
		response, err = sendRedis(a.ctx, request)
		if err != nil {
			return nil, errors.Wrapf(err, "send redis request id=%q", requestID)
		}
	case database.MDRequest:
		response, err = sendMarkdown(request)
		if err != nil {
			return nil, errors.Wrapf(err, "send redis request id=%q", requestID)
		}
	default:
		return nil, errors.Errorf("unsupported request type %T", request)
	}

	receivedAt := time.Now()
	if err := a.DB.CreateHistoryEntry(
		a.ctx, database.RequestID(requestID),
		database.HistoryEntry{sentAt, receivedAt, request.Data, response},
	); err != nil {
		return nil, errors.Wrap(err, "insert into database")
	}

	return historyEntry{
		"RequestId":   requestID,
		"sent_at":     sentAt.Format(time.RFC3339),
		"received_at": receivedAt.Format(time.RFC3339),
		"request":     request,
		"response":    response,
	}, nil
}
