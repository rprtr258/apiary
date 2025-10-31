package database

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	nanoid "github.com/matoous/go-nanoid/v2"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	json2 "github.com/rprtr258/fun/exp/json"
)

type dbInner = map[RequestID]Request

var Decoder = json2.AndThen(
	json2.Optional("$version", json2.Int, 0),
	func(version int) json2.Decoder[dbInner] {
		switch version {
		case 0:
			return json2.Success(dbInner{})
		case 1:
			return decoderV1
		default:
			return json2.Fail[dbInner](fmt.Sprintf("unknown version: %d", version))
		}
	},
)

type D = map[string]any
type A = []any

func encod[Req, Resp EntryData](v dbInner) map[RequestID]pluginv1[Req, Resp] {
	requests := make(map[RequestID]pluginv1[Req, Resp], len(v))
	for id, req := range v {
		reqData, ok := req.Data.(Req)
		if !ok {
			continue
		}

		requests[id] = pluginv1[Req, Resp]{
			Request: reqData,
			Responses: fun.Map[preresponsev1[Resp]](func(resp Response) preresponsev1[Resp] {
				return preresponsev1[Resp]{
					SentAt:     resp.SentAt,
					ReceivedAt: resp.ReceivedAt,
					Data:       resp.Response.(Resp),
				}
			}, req.Responses...),
		}
	}
	return requests
}

func encoder(v dbInner) ([]byte, error) {
	return json.MarshalIndent(D{
		"$version": 1,
		"request": fun.MapToSlice(v, func(id RequestID, req Request) requestv1 {
			return requestv1{
				ID:   req.ID,
				Path: req.Path,
				Kind: req.Data.Kind(),
			}
		}),
		"response": func() []responsev1 {
			responses := []responsev1{}
			for id, req := range v {
				for _, resp := range req.Responses {
					responses = append(responses, responsev1{
						ID:         id,
						SentAt:     resp.SentAt,
						ReceivedAt: resp.ReceivedAt,
					})
				}
			}
			return responses
		}(),
		"http":  encod[HTTPRequest, HTTPResponse](v),
		"sql":   encod[SQLRequest, SQLResponse](v),
		"jq":    encod[JQRequest, JQResponse](v),
		"md":    encod[MDRequest, MDResponse](v),
		"redis": encod[RedisRequest, RedisResponse](v),
		"grpc":  encod[GRPCRequest, GRPCResponse](v),
		"sql-source": func() map[RequestID]SQLSourceRequest {
			requests := make(map[RequestID]SQLSourceRequest, len(v))
			for id, req := range v {
				reqData, ok := req.Data.(SQLSourceRequest)
				if !ok {
					continue
				}

				requests[id] = reqData
			}
			return requests
		}(),
	}, "", "  ")
}

type DB struct {
	filename string
	Data     dbInner
}

func New(filename string) (*DB, error) {
	b, err := os.ReadFile(filename)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, errors.Wrap(err, "read file")
		}
		b = []byte("{}")
	}

	db, err := Decoder.ParseBytes(b)
	if err != nil {
		return nil, errors.Wrap(err, "parse file")
	}

	return &DB{filename, db}, nil
}

func (db *DB) Flush() error {
	b, err := encoder(db.Data)
	if err != nil {
		return errors.Wrap(err, "encode db")
	}

	if err := os.WriteFile(db.filename, b, 0644); err != nil {
		return errors.Wrap(err, "write db")
	}

	return nil
}

func (db *DB) Close() error {
	return db.Flush()
}

func (db *DB) List(ctx context.Context, ids []RequestID) ([]Request, error) {
	if ids == nil {
		return fun.Values(db.Data), nil
	}

	res := make([]Request, 0, len(ids))
	for _, id := range ids {
		r, ok := db.Data[id]
		if !ok {
			return nil, errors.Errorf("request %s not found", id)
		}
		res = append(res, r)
	}
	return res, nil
}

func (db *DB) Create(
	ctx context.Context,
	path string,
	request EntryData,
) (RequestID, error) {
	kind := request.Kind()
	plugin, ok := Plugins[kind]
	if !ok {
		return "", errors.Errorf("unknown request kind %s", kind)
	}

	id := RequestID(nanoid.Must())

	if err := plugin.create(db, ctx, id, path, request); err != nil {
		return "", err
	}

	return id, db.Flush()
}

func (db *DB) Delete(ctx context.Context, id RequestID) error {
	delete(db.Data, id)
	return nil
}

func (db *DB) Rename(ctx context.Context, id, newID RequestID) error {
	if _, ok := db.Data[id]; !ok {
		return errors.Errorf("request %s not found", id)
	}
	if _, ok := db.Data[newID]; ok {
		return errors.Errorf("request %s already exists", newID)
	}
	db.Data[newID] = db.Data[id]
	delete(db.Data, id)
	return db.Flush()
}

func (db *DB) Update(
	ctx context.Context,
	id RequestID,
	request EntryData,
) error {
	if _, ok := db.Data[id]; !ok {
		return errors.Errorf("request %s not found", id)
	}

	kind := request.Kind()
	plugin, ok := Plugins[kind]
	if !ok {
		return errors.Errorf("unknown request kind %s", kind)
	}

	if err := plugin.update(db, ctx, id, request); err != nil {
		return err
	}

	return db.Flush()
}

func (db *DB) CreateResponse(
	ctx context.Context,
	id RequestID,
	entry Response,
) error {
	req, ok := db.Data[id]
	if !ok {
		return errors.Errorf("request %s not found", id)
	}

	kind := req.Data.Kind()
	plugin, ok := Plugins[kind]
	if !ok {
		return errors.Errorf("unknown response kind %s", kind)
	}

	if err := plugin.createResponse(db, ctx, id, entry); err != nil {
		return err
	}

	return db.Flush()
}

func (db *DB) create(
	ctx context.Context,
	id RequestID,
	path string,
	request EntryData,
) error {
	db.Data[id] = Request{
		ID:        id,
		Path:      path,
		Data:      request,
		Responses: nil,
	}
	return nil
}

func (db *DB) update(ctx context.Context, id RequestID, request EntryData) error {
	tmp := db.Data[id]
	tmp.Data = request
	db.Data[id] = tmp
	return nil
}

func (db *DB) createResponse(
	ctx context.Context,
	id RequestID,
	response Response,
) error {
	tmp := db.Data[id]
	tmp.Responses = append(db.Data[id].Responses, response)
	db.Data[id] = tmp
	return nil
}
