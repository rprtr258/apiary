package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"

	"github.com/fullstorydev/grpcurl"
	"github.com/golang/protobuf/jsonpb"
	"github.com/golang/protobuf/proto"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/grpcreflect"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	"github.com/rprtr258/fun/exp/zun"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"

	"github.com/rprtr258/apiary/internal/database"
)

func connect(
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

func splitService(serviceName string) (pkg, short string) {
	dotI := strings.LastIndexByte(serviceName, '.')
	return serviceName[:dotI], serviceName[dotI+1:]
}

// JSONSchema represents the structure of a JSON schema
type JSONSchema struct {
	Type string `json:"type"`
	// type == "object"
	Properties map[string]JSONSchema `json:"properties,omitempty"`
	// type == "object" && "oneOf" is present
	OneOf []JSONSchema `json:"oneOf,omitempty"`
	// type == "array"
	Items *JSONSchema `json:"items,omitempty"`
}

func convertObjectToJSONSchema(msg protoreflect.MessageDescriptor) (JSONSchema, error) {
	fields := msg.Fields()
	properties := make(map[string]JSONSchema, fields.Len())
	for i := 0; i < fields.Len(); i++ {
		field := fields.Get(i)
		fieldSchema, err := convertFieldToJSONSchema(field)
		if err != nil {
			return JSONSchema{}, err
		}

		if oneof := field.ContainingOneof(); oneof != nil {
			oneofName := string(oneof.Name())
			if _, ok := properties[oneofName]; !ok {
				properties[oneofName] = JSONSchema{
					Type:  "object",
					OneOf: []JSONSchema{},
				}
			}
			m := properties[oneofName]
			m.OneOf = append(m.OneOf, JSONSchema{
				Type:       "object",
				Properties: map[string]JSONSchema{string(field.Name()): fieldSchema},
			})
			properties[oneofName] = m
		} else {
			properties[string(field.Name())] = fieldSchema
		}
	}

	return JSONSchema{
		Type:       "object",
		Properties: properties,
		Items:      nil,
	}, nil
}

func convertFieldToJSONSchema(field protoreflect.FieldDescriptor) (JSONSchema, error) {
	var fieldSchema JSONSchema
	switch field.Kind() {
	case protoreflect.BoolKind:
		fieldSchema.Type = "boolean"
	case protoreflect.Int32Kind, protoreflect.Int64Kind,
		protoreflect.Uint32Kind, protoreflect.Uint64Kind,
		protoreflect.Sint32Kind, protoreflect.Sint64Kind,
		protoreflect.Sfixed32Kind, protoreflect.Sfixed64Kind,
		protoreflect.Fixed32Kind, protoreflect.Fixed64Kind:
		fieldSchema.Type = "integer"
	case protoreflect.FloatKind,
		protoreflect.DoubleKind:
		fieldSchema.Type = "number"
	case protoreflect.StringKind:
		fieldSchema.Type = "string"
	case protoreflect.BytesKind:
		fieldSchema.Type = "string"
		// TODO: support bytes
	case protoreflect.MessageKind:
		var err error
		fieldSchema, err = convertObjectToJSONSchema(field.Message())
		if err != nil {
			return JSONSchema{}, err
		}
	case protoreflect.EnumKind:
		fieldSchema.Type = "string"
		vals := field.Enum().Values()
		for i := 0; i < vals.Len(); i++ {
			val := vals.Get(i)
			fmt.Println("ENUM", i, val.Name())
		}
	default:
		return JSONSchema{}, fmt.Errorf("unsupported field kind: %v", field.Kind())
	}

	if field.IsList() {
		return JSONSchema{
			Type:  "array",
			Items: &fieldSchema,
		}, nil
	}

	return fieldSchema, nil
}

func ConvertMessageToJSONSchema(msg protoreflect.Message) (JSONSchema, error) {
	return convertObjectToJSONSchema(msg.Descriptor())
}

func newFake(js JSONSchema) any {
	switch js.Type {
	case "object":
		m := make(map[string]any, len(js.Properties))
		for k, v := range js.Properties {
			if v.Type == "object" && v.OneOf != nil {
				idx := rand.Intn(len(v.OneOf))

				// TODO: (((GO)))VNO
				var kkk string
				var vvv JSONSchema
				for k, v := range v.OneOf[idx].Properties {
					kkk = k
					vvv = v
				}

				m[kkk] = newFake(vvv)
			} else {
				m[k] = newFake(v)
			}
		}
		return m
	case "array":
		a := []any{}
		for _, v := range js.Items.Properties {
			a = append(a, newFake(v))
		}
		return a
	case "number":
		return float64(5.2)
	case "integer":
		return int64(52)
	case "string":
		return "ABOBA"
	default:
		return nil
	}
}

type grpcServiceMethods struct {
	Service string   `json:"service"`
	Methods []string `json:"methods"`
}

func (a *App) GRPCMethods(id string) ([]grpcServiceMethods, error) {
	request, err := a.DB.Get(a.ctx, database.RequestID(id))
	if err != nil {
		return nil, errors.Wrapf(err, "get request id=%q", id)
	}
	if kind := request.Data.Kind(); kind != database.KindGRPC {
		return nil, errors.Errorf("query kind is %s, expected grpc", kind)
	}

	reflSource, cc, err := connect(a.ctx, request.Data.(database.GRPCRequest).Target)
	if err != nil {
		return nil, errors.Wrap(err, "connect")
	}
	defer cc.Close()

	services, err := grpcurl.ListServices(reflSource)
	if err != nil {
		return nil, errors.Wrap(err, "list services")
	}

	res := make([]grpcServiceMethods, 0, len(services))
	for _, service := range services {
		pkg, serviceName := splitService(service)
		methods, err := grpcurl.ListMethods(reflSource, service)
		if err != nil {
			return nil, errors.Wrapf(err, "list service %s methods", service)
		}

		prefix := pkg + "." + serviceName + "."
		zun.Map(methods, func(method string) string {
			return strings.TrimPrefix(method, prefix)
		}, methods...)
		res = append(res, grpcServiceMethods{
			service,
			methods,
		})
	}
	return res, nil
}

func (a *App) GRPCQueryFake(
	Target string,
	Method string, // NOTE: fully qualified
) (string, error) {
	reflSource, cc, err := connect(a.ctx, Target)
	if err != nil {
		return "", errors.Wrap(err, "connect")
	}
	defer cc.Close()

	dsc, err := reflSource.FindSymbol(Method)
	if err != nil {
		return "", errors.Wrap(err, "find method")
	}

	methodDesc := dsc.(*desc.MethodDescriptor)
	// fmt.Println("    IN", strings.TrimPrefix(inputType.GetFullyQualifiedName(), pkg+"."))
	// fmt.Println("    OUT", strings.TrimPrefix(methodDesc.GetOutputType().GetFullyQualifiedName(), pkg+"."))
	m := dynamicpb.NewMessage(methodDesc.GetInputType().UnwrapMessage())

	schema, err := ConvertMessageToJSONSchema(m)
	// schema["$schema"]= "http://json-schema.org/schema#"
	if err != nil {
		return "", errors.Wrap(err, "convert message to json schema")
	}

	// jsonSchema, err := json.MarshalIndent(schema, "", "  ")
	// check(err)

	b, err := json.MarshalIndent(newFake(schema), "", "  ")
	if err != nil {
		return "", errors.Wrap(err, "marshal fake")
	}
	return string(b), nil
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

func (a *App) sendGRPC(req database.GRPCRequest) (database.GRPCResponse, error) {
	reflSource, cc, err := connect(a.ctx, req.Target)
	if err != nil {
		return database.GRPCResponse{}, errors.Wrap(err, "connect")
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
		a.ctx, reflSource, cc, req.Method,
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
		return database.GRPCResponse{}, errors.Wrap(err, "invoke rpc")
	}

	kvs := make([]database.KV, 0, len(meta))
	for k, vs := range meta {
		for _, v := range vs {
			kvs = append(kvs, database.KV{
				Key:   k,
				Value: v,
			})
		}
	}

	if code := st.Code(); code != codes.OK {
		return database.GRPCResponse{
			st.Message(),
			int(code),
			kvs,
		}, nil
	}

	return database.GRPCResponse{
		body.String(),
		int(codes.OK),
		kvs,
	}, nil
}

func (a *App) GRPCQueryValidate(
	Target string,
	Method string, // NOTE: fully qualified
	Payload string,
) error {
	return errors.New("not implemented")
}
