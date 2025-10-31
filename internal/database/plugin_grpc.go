package database

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/fullstorydev/grpcurl"
	"github.com/golang/protobuf/jsonpb"
	"github.com/golang/protobuf/proto"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/grpcreflect"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const KindGRPC Kind = "grpc"

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

var pluginGRPC = plugin{
	EmptyRequest:       GRPCEmptyRequest,
	enum:               enumElem[Kind]{KindGRPC, "GRPC"},
	Perform:            sendGRPC,
	create:             (*DB).createGRPC,
	list:               (*DB).listGRPCRequests,
	update:             (*DB).updateGRPC,
	createHistoryEntry: (*DB).createHistoryEntryGRPC,
}

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

func Connect(
	ctx context.Context,
	target string,
) (grpcurl.DescriptorSource, *grpc.ClientConn, error) {
	cc, err := grpcurl.BlockingDial(ctx, "tcp", target, nil)
	if err != nil {
		return nil, nil, errors.Wrap(err, "dial")
	}

	refClient := grpcreflect.NewClientAuto(ctx, cc)
	refClient.AllowMissingFileDescriptors()
	return grpcurl.DescriptorSourceFromServer(ctx, refClient), cc, nil
}

type invocationHandler struct {
	onResolveMethod   func(*desc.MethodDescriptor)
	onSendHeaders     func(metadata.MD)
	onReceiveHeaders  func(metadata.MD)
	onReceiveResponse func(proto.Message)
	onReceiveTrailers func(*status.Status, metadata.MD)
}

var _ grpcurl.InvocationEventHandler = (*invocationHandler)(nil)

func (h *invocationHandler) OnResolveMethod(md *desc.MethodDescriptor) {
	if h.onResolveMethod != nil {
		h.onResolveMethod(md)
	}
}

func (h *invocationHandler) OnSendHeaders(md metadata.MD) {
	if h.onSendHeaders != nil {
		h.onSendHeaders(md)
	}
}

func (h *invocationHandler) OnReceiveHeaders(md metadata.MD) {
	if h.onReceiveHeaders != nil {
		h.onReceiveHeaders(md)
	}
}

func (h *invocationHandler) OnReceiveResponse(resp proto.Message) {
	if h.onReceiveResponse != nil {
		h.onReceiveResponse(resp)
	}
}

func (h *invocationHandler) OnReceiveTrailers(stat *status.Status, md metadata.MD) {
	if h.onReceiveTrailers != nil {
		h.onReceiveTrailers(stat, md)
	}
}

func sendGRPC(ctx context.Context, request EntryData) (EntryData, error) {
	req := request.(GRPCRequest)
	reflSource, cc, err := Connect(ctx, req.Target)
	if err != nil {
		return GRPCResponse{}, errors.Wrap(err, "connect")
	}
	defer cc.Close()

	// TODO: долбоебское апи заставляет меня передавать долбоебские строки вместо metadata.MD сразу
	headers := make([]string, 0, len(req.Metadata))
	for _, kv := range req.Metadata {
		headers = append(headers, fmt.Sprintf("%s: %s", kv.Key, kv.Value))
	}

	var body bytes.Buffer
	var st status.Status
	meta := metadata.MD{}
	r := bytes.NewReader([]byte(req.Payload))
	if err := grpcurl.InvokeRPC(
		ctx, reflSource, cc, req.Method,
		headers,
		&invocationHandler{
			onReceiveResponse: func(m proto.Message) {
				_ = (&jsonpb.Marshaler{}).Marshal(&body, m)
			},
			onReceiveHeaders: func(md metadata.MD) {
				for k, vs := range md {
					meta[k] = append(meta[k], vs...)
				}
			},
			onReceiveTrailers: func(stat *status.Status, md metadata.MD) {
				st = fun.Deref(stat)
				for k, vs := range md {
					meta[k] = append(meta[k], vs...)
				}
			},
		},
		grpcurl.NewJSONRequestParserWithUnmarshaler(r, jsonpb.Unmarshaler{}).Next,
	); err != nil {
		return GRPCResponse{}, errors.Wrap(err, "invoke rpc")
	}

	kvs := make([]KV, 0, len(meta))
	for k, vs := range meta {
		for _, v := range vs {
			kvs = append(kvs, KV{
				Key:   k,
				Value: v,
			})
		}
	}

	if code := st.Code(); code != codes.OK {
		return GRPCResponse{
			st.Message(),
			int(code),
			kvs,
		}, nil
	}

	return GRPCResponse{
		body.String(),
		int(codes.OK),
		kvs,
	}, nil
}
