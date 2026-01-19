package database

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/pkg/errors"

	. "github.com/rprtr258/apiary/internal/json"
)

const KindHTTP Kind = "http"

type HTTPRequest struct {
	URL     string `json:"url"`
	Method  string `json:"method"`
	Body    string `json:"body"`
	Headers []KV   `json:"headers"`
}

func (r HTTPRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(D{
		"url":     r.URL,
		"method":  r.Method,
		"body":    r.Body,
		"headers": Emptize(r.Headers),
	})
}

func (HTTPRequest) Kind() Kind { return KindHTTP }

type HTTPResponse struct {
	Code    int    `json:"code"`
	Body    string `json:"body"` // TODO: fun.Option[string]
	Headers []KV   `json:"headers"`
}

func (HTTPResponse) Kind() Kind { return KindHTTP }

func (r HTTPResponse) MarshalJSON() ([]byte, error) {
	return json.Marshal(D{
		"code":    r.Code,
		"body":    r.Body,
		"headers": Emptize(r.Headers),
	})
}

var pluginHTTP = plugin{
	EmptyRequest:   HTTPEmptyRequest,
	enum:           enumElem[Kind]{KindHTTP, "HTTP"},
	Perform:        sendHTTP,
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: true,
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
	defer response.Body.Close()

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
