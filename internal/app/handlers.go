package app

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/fullstorydev/grpcurl"
	"github.com/jhump/protoreflect/desc"
	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	"github.com/rprtr258/fun/exp/zun"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"

	"github.com/rprtr258/apiary/internal/database"
	. "github.com/rprtr258/apiary/internal/json"
)

type requestPreview struct {
	Kind    database.Kind
	SubKind string
}

type Tree struct {
	IDs  map[string]string // id -> basename
	Dirs map[string]Tree
}

type ListResponse struct {
	Tree     Tree
	Requests map[string]requestPreview
}

func add(t Tree, parts []string, id database.RequestID, basename string) Tree {
	if len(parts) == 1 {
		t.IDs[string(id)] = basename
		return t
	}

	part := parts[0]
	if _, ok := t.Dirs[part]; !ok {
		t.Dirs[part] = Tree{map[string]string{}, map[string]Tree{}}
	}
	t.Dirs[part] = add(t.Dirs[part], parts[1:], id, basename)
	return t
}

func (a *App) List() (ListResponse, error) {
	requests, err := a.DB.List(a.ctx, nil)
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

	tree := Tree{map[string]string{}, map[string]Tree{}}
	for _, req := range requests {
		parts := strings.Split(req.Path, "/")
		tree = add(tree, parts, req.ID, path.Base(req.Path))
	}

	return ListResponse{
		Tree:     tree,
		Requests: previews,
	}, nil
}

type GetResponse struct {
	Request database.Request
	History []D
}

func (a *App) get(id database.RequestID) (database.Request, error) {
	resp, err := a.DB.List(a.ctx, []database.RequestID{id})
	if err != nil {
		return database.Request{}, err
	}
	if len(resp) != 1 {
		return database.Request{}, errors.New("not found")
	}
	return resp[0], err
}

func (a *App) Get(id string) (GetResponse, error) {
	request, err := a.get(database.RequestID(id))
	if err != nil {
		return GetResponse{}, errors.Wrapf(err, "get request id=%q", id)
	}

	history := fun.Map[D](func(h database.Response) D {
		return D{
			"sent_at":     h.SentAt.Format(time.RFC3339),
			"received_at": h.ReceivedAt.Format(time.RFC3339),
			"response":    h.Response,
		}
	}, request.Responses...)
	slices.SortFunc(history, func(i, j D) int {
		return strings.Compare(i["sent_at"].(string), j["sent_at"].(string))
	})

	return GetResponse{request, history}, nil
}

type ResponseNewRequest struct {
	ID database.RequestID `json:"id"`
}

func (a *App) Create(
	path string,
	kind database.Kind,
) (ResponseNewRequest, error) {
	plugin, ok := database.Plugins[kind]
	if !ok {
		return ResponseNewRequest{}, errors.Errorf("unknown request kind %q", kind)
	}

	id, err := a.DB.Create(a.ctx, path, plugin.EmptyRequest)
	if err != nil {
		return ResponseNewRequest{}, errors.Wrap(err, "error while creating request")
	}

	return ResponseNewRequest{
		ID: id,
	}, nil
}

func (a *App) Duplicate(id string) (ResponseNewRequest, error) {
	request, err := a.get(database.RequestID(id))
	if err != nil {
		return ResponseNewRequest{}, errors.Wrapf(err, "get original request id=%q", id)
	}

	newID, err := a.DB.Create(a.ctx, request.Path, request.Data)
	return ResponseNewRequest{newID}, err
}

func (a *App) Read(requestID string) (database.Request, error) {
	request, err := a.get(database.RequestID(requestID))
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
		return errors.Wrap(err, "marshal request")
	}

	parseRequestt, ok := map[database.Kind]func([]byte) (database.EntryData, error){
		database.KindHTTP:      parse[database.HTTPRequest],
		database.KindSQL:       parse[database.SQLRequest],
		database.KindGRPC:      parse[database.GRPCRequest],
		database.KindJQ:        parse[database.JQRequest],
		database.KindRedis:     parse[database.RedisRequest],
		database.KindMD:        parse[database.MDRequest],
		database.KindSQLSource: parse[database.SQLSourceRequest],
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

// Perform create a handler that performs call and save result to history
func (a *App) Perform(requestID string) (D, error) {
	request, err := a.get(database.RequestID(requestID))
	if err != nil {
		return nil, errors.Wrapf(err, "get request id=%q", requestID)
	}

	sentAt := time.Now()

	var response database.EntryData
	switch request := request.Data.(type) {
	case database.JQRequest:
		response, err = sendJQ(a.ctx, request)
		if err != nil {
			return nil, errors.Wrapf(err, "send jq request id=%q", requestID)
		}
	default:
		plugin, ok := database.Plugins[request.Kind()]
		if !ok {
			return nil, errors.Errorf("unsupported request type %T", request)
		}

		response, err = plugin.Perform(a.ctx, request)
		if err != nil {
			return nil, errors.Wrapf(err, "send %v request id=%q", request.Kind(), requestID)
		}
	}

	receivedAt := time.Now()
	if err := a.DB.CreateResponse(
		a.ctx, database.RequestID(requestID),
		database.Response{sentAt, receivedAt, response},
	); err != nil {
		return nil, errors.Wrap(err, "insert into database")
	}

	return D{
		"RequestId":   requestID,
		"sent_at":     sentAt.Format(time.RFC3339),
		"received_at": receivedAt.Format(time.RFC3339),
		"request":     request,
		"response":    response,
	}, nil
}

func (a *App) PerformSQLSource(requestID, query string) (D, error) {
	request, err := a.get(database.RequestID(requestID))
	if err != nil {
		return nil, errors.Wrapf(err, "get request id=%q", requestID)
	}
	if request.Data.Kind() != database.KindSQLSource {
		return nil, errors.Errorf("request %s is not SQLSource", requestID)
	}
	req := request.Data.(database.SQLSourceRequest)

	sentAt := time.Now()

	plugin, ok := database.Plugins[database.KindSQL]
	if !ok {
		return nil, errors.Errorf("unsupported request type %T", request)
	}

	response, err := plugin.Perform(a.ctx, database.SQLRequest{
		DSN:      req.DSN,
		Database: req.Database,
		Query:    query,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "send request id=%q", requestID)
	}

	receivedAt := time.Now()

	return D{
		"RequestId":   requestID,
		"sent_at":     sentAt.Format(time.RFC3339),
		"received_at": receivedAt.Format(time.RFC3339),
		"request":     request,
		"response":    response,
	}, nil
}

type grpcServiceMethods struct {
	Service string   `json:"service"`
	Methods []string `json:"methods"`
}

func splitService(serviceName string) (pkg, short string) {
	dotI := strings.LastIndexByte(serviceName, '.')
	return serviceName[:dotI], serviceName[dotI+1:]
}

func (a *App) GRPCMethods(id string) ([]grpcServiceMethods, error) {
	request, err := a.get(database.RequestID(id))
	if err != nil {
		return nil, errors.Wrapf(err, "get request id=%q", id)
	}
	if kind := request.Data.Kind(); kind != database.KindGRPC {
		return nil, errors.Errorf("query kind is %s, expected grpc", kind)
	}

	reflSource, cc, err := database.Connect(a.ctx, request.Data.(database.GRPCRequest).Target)
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

func ConvertMessageToJSONSchema(msg protoreflect.Message) (JSONSchema, error) {
	return convertObjectToJSONSchema(msg.Descriptor())
}

func (a *App) GRPCQueryFake(
	Target string,
	Method string, // NOTE: fully qualified
) (string, error) {
	reflSource, cc, err := database.Connect(a.ctx, Target)
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

func (a *App) GRPCQueryValidate(
	Target string,
	Method string, // NOTE: fully qualified
	Payload string,
) error {
	return errors.New("not implemented")
}
