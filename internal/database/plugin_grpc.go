package database

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/fullstorydev/grpcurl"
	"github.com/golang/protobuf/jsonpb"
	"github.com/golang/protobuf/proto"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/grpcreflect"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	. "github.com/rprtr258/apiary/internal/json"
)

const KindGRPC Kind = "grpc"

type GRPCRequest struct {
	Target   string `json:"target"`
	Method   string `json:"method"` // NOTE: fully qualified
	Payload  string `json:"payload"`
	Metadata []KV   `json:"metadata"`
}

func (GRPCRequest) Kind() Kind { return KindGRPC }

func (r GRPCRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(D{
		"target":   r.Target,
		"method":   r.Method,
		"payload":  r.Payload,
		"metadata": Emptize(r.Metadata),
	})
}

type GRPCResponse struct { // TODO: last inserted id on insert
	Response string `json:"response"`
	// https://grpc.io/docs/guides/status-codes/#the-full-list-of-status-codes
	Code     int  `json:"code"`
	Metadata []KV `json:"metadata"`
}

func (r GRPCResponse) MarshalJSON() ([]byte, error) {
	return json.Marshal(D{
		"response": r.Response,
		"code":     r.Code,
		"metadata": Emptize(r.Metadata),
	})
}

func (GRPCResponse) Kind() Kind { return KindGRPC }

var pluginGRPC = plugin{
	EmptyRequest:   GRPCEmptyRequest,
	enum:           enumElem[Kind]{KindGRPC, "GRPC"},
	Perform:        sendGRPC,
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: true,
}

var GRPCEmptyRequest = GRPCRequest{
	"",  // Target
	"",  // Method
	"",  // Payload
	nil, // Metadata
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
				if err := (&jsonpb.Marshaler{}).Marshal(&body, m); err != nil {
					log.Error().Err(err).Any("response", m).Msg("marshal response")
				}
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
