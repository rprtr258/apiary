package database

import (
	"time"

	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	json2 "github.com/rprtr258/fun/exp/json"
)

type requestv1 struct {
	ID   RequestID `json:"id"`
	Kind Kind      `json:"kind"`
	Path string    `json:"path"`
}

type responsev1 struct {
	ID         RequestID `json:"id"`
	SentAt     time.Time `json:"sent_at"`
	ReceivedAt time.Time `json:"received_at"`
}

type preresponsev1[Resp any] struct {
	SentAt     time.Time `json:"sent_at"`
	ReceivedAt time.Time `json:"received_at"`
	Data       Resp      `json:"data"`
}

type pluginv1[Req, Resp any] struct {
	Request   Req                   `json:"request"`
	Responses []preresponsev1[Resp] `json:"responses"`
}

func decoderv1plugin[Req, Resp EntryData]() json2.Decoder[map[RequestID]pluginv1[Req, Resp]] {
	return json2.Optional(string((*new(Req)).Kind()),
		json2.Map(
			func(v map[string]pluginv1[Req, Resp]) map[RequestID]pluginv1[Req, Resp] {
				res := make(map[RequestID]pluginv1[Req, Resp], len(v))
				for id, req := range v {
					res[RequestID(id)] = req
				}
				return res
			},
			json2.Dict(json2.Map2(
				func(request Req, responses []preresponsev1[Resp]) pluginv1[Req, Resp] {
					return pluginv1[Req, Resp]{request, responses}
				},
				json2.Required("request", json2.Std[Req]()),
				json2.Optional("responses", json2.Std[[]preresponsev1[Resp]](), []preresponsev1[Resp]{})),
			)),
		map[RequestID]pluginv1[Req, Resp]{},
	)
}

func mapRequestDataV1[Req, Resp EntryData](id RequestID, p map[RequestID]pluginv1[Req, Resp]) (EntryData, []Response) {
	request := p[id].Request
	responses := fun.Map[Response](func(resp preresponsev1[Resp]) Response {
		return Response{
			SentAt:     resp.SentAt,
			ReceivedAt: resp.ReceivedAt,
			Response:   resp.Data,
		}
	}, p[id].Responses...)
	return request, responses
}

func Map10[T0, T1, T2, T3, T4, T5, T6, T7, T8, T9, T any](
	combine func(T0, T1, T2, T3, T4, T5, T6, T7, T8, T9) T,
	d0 json2.Decoder[T0],
	d1 json2.Decoder[T1],
	d2 json2.Decoder[T2],
	d3 json2.Decoder[T3],
	d4 json2.Decoder[T4],
	d5 json2.Decoder[T5],
	d6 json2.Decoder[T6],
	d7 json2.Decoder[T7],
	d8 json2.Decoder[T8],
	d9 json2.Decoder[T9],
) json2.Decoder[T] {
	return func(v any, res *T) error {
		var dest0 T0
		if err := d0(v, &dest0); err != nil {
			return err
		}
		var dest1 T1
		if err := d1(v, &dest1); err != nil {
			return err
		}
		var dest2 T2
		if err := d2(v, &dest2); err != nil {
			return err
		}
		var dest3 T3
		if err := d3(v, &dest3); err != nil {
			return err
		}
		var dest4 T4
		if err := d4(v, &dest4); err != nil {
			return err
		}
		var dest5 T5
		if err := d5(v, &dest5); err != nil {
			return err
		}
		var dest6 T6
		if err := d6(v, &dest6); err != nil {
			return err
		}
		var dest7 T7
		if err := d7(v, &dest7); err != nil {
			return err
		}
		var dest8 T8
		if err := d8(v, &dest8); err != nil {
			return err
		}
		var dest9 T9
		if err := d9(v, &dest9); err != nil {
			return err
		}

		*res = combine(dest0, dest1, dest2, dest3, dest4, dest5, dest6, dest7, dest8, dest9)
		return nil
	}
}

var decoderV1 = Map10(
	func(
		requests []requestv1,
		response []responsev1,
		http map[RequestID]pluginv1[HTTPRequest, HTTPResponse],
		sql map[RequestID]pluginv1[SQLRequest, SQLResponse],
		jq map[RequestID]pluginv1[JQRequest, JQResponse],
		md map[RequestID]pluginv1[MDRequest, MDResponse],
		redis map[RequestID]pluginv1[RedisRequest, RedisResponse],
		grpc map[RequestID]pluginv1[GRPCRequest, GRPCResponse],
		sqlsource map[RequestID]SQLSourceRequest,
		httpsource map[RequestID]HTTPSourceRequest,
	) dbInner {
		data := make(map[RequestID]Request, len(requests))
		for _, reqv1 := range requests {
			var reqe EntryData
			var responses []Response
			switch reqv1.Kind {
			case KindHTTP:
				reqe, responses = mapRequestDataV1(reqv1.ID, http)
			case KindSQL:
				reqe, responses = mapRequestDataV1(reqv1.ID, sql)
			case KindJQ:
				reqe, responses = mapRequestDataV1(reqv1.ID, jq)
			case KindMD:
				reqe, responses = mapRequestDataV1(reqv1.ID, md)
			case KindRedis:
				reqe, responses = mapRequestDataV1(reqv1.ID, redis)
			case KindGRPC:
				reqe, responses = mapRequestDataV1(reqv1.ID, grpc)
			case KindSQLSource:
				reqe, responses = sqlsource[reqv1.ID], nil
			case KindHTTPSource:
				reqe, responses = httpsource[reqv1.ID], nil
			default:
				panic("unknown kind " + string(reqv1.Kind))
			}

			data[reqv1.ID] = Request{
				ID:        reqv1.ID,
				Path:      reqv1.Path,
				Data:      reqe,
				Responses: responses,
			}
		}

		return data
	},
	json2.Optional("request", json2.List(json2.Map3(
		func(id RequestID, kind Kind, path string) requestv1 {
			return requestv1{id, kind, path}
		},
		json2.Map(
			func(id string) RequestID {
				return RequestID(id)
			},
			json2.Field("id", json2.String),
		),
		json2.Validate(
			func(kind Kind) error {
				if _, ok := Plugins[kind]; !ok {
					return errors.Errorf("unknown kind %q", kind)
				}
				return nil
			},
			json2.Map(
				func(kind string) Kind {
					return Kind(kind)
				},
				json2.Field("kind", json2.String),
			),
		),
		json2.Required("path", json2.String),
	)), []requestv1{}),
	json2.Optional("response", json2.List(json2.Map3(
		func(id RequestID, sentAt, receivedAt time.Time) responsev1 {
			return responsev1{id, sentAt, receivedAt}
		},
		json2.Map(
			func(id string) RequestID {
				return RequestID(id)
			},
			json2.Field("id", json2.String),
		),
		json2.Field("sent_at", json2.Time),
		json2.Field("received_at", json2.Time),
	)), []responsev1{}),
	decoderv1plugin[HTTPRequest, HTTPResponse](),
	decoderv1plugin[SQLRequest, SQLResponse](),
	decoderv1plugin[JQRequest, JQResponse](),
	decoderv1plugin[MDRequest, MDResponse](),
	decoderv1plugin[RedisRequest, RedisResponse](),
	decoderv1plugin[GRPCRequest, GRPCResponse](),
	json2.Optional(string(KindSQLSource),
		json2.Map(
			func(v map[string]SQLSourceRequest) map[RequestID]SQLSourceRequest {
				res := make(map[RequestID]SQLSourceRequest, len(v))
				for id, req := range v {
					res[RequestID(id)] = req
				}
				return res
			},
			json2.Dict(json2.Std[SQLSourceRequest]())),
		map[RequestID]SQLSourceRequest{},
	),
	json2.Optional(string(KindHTTPSource),
		json2.Map(
			func(v map[string]HTTPSourceRequest) map[RequestID]HTTPSourceRequest {
				res := make(map[RequestID]HTTPSourceRequest, len(v))
				for id, req := range v {
					res[RequestID(id)] = req
				}
				return res
			},
			json2.Dict(json2.Std[HTTPSourceRequest]())),
		map[RequestID]HTTPSourceRequest{},
	),
)
