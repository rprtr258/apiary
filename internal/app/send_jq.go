package app

import (
	"context"
	"encoding/json"
	"io"
	"strings"

	"github.com/itchyny/gojq"
	"github.com/pkg/errors"

	"github.com/rprtr258/apiary/internal/database"
)

func jq(ctx context.Context, input any, query string) ([]string, error) {
	result, err := func() ([]string, error) {
		query, err := gojq.Parse(query)
		if err != nil {
			return nil, errors.Wrap(err, "parse query")
		}

		var result []string
		iter := query.RunWithContext(ctx, input)
		for {
			v, ok := iter.Next()
			if !ok {
				break
			}
			if err, ok := v.(error); ok {
				if err, ok := err.(*gojq.HaltError); ok && err.Value() == nil {
					break
				}
				return nil, errors.Wrap(err, "run query")
			}
			var sb strings.Builder
			e := json.NewEncoder(&sb)
			e.SetIndent("", "  ")
			if err := e.Encode(v); err != nil {
				return nil, errors.Wrap(err, "encode result")
			}
			result = append(result, strings.TrimSpace(sb.String()))
		}
		return result, nil
	}()
	if err != nil {
		return nil, err
	}

	return result, nil
}

func sendJQ(ctx context.Context, request database.JQRequest) (database.JQResponse, error) {
	d := json.NewDecoder(strings.NewReader(request.JSON))

	resps := []string{}
	for {
		var jsonv any
		if err := d.Decode(&jsonv); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return database.JQResponse{}, err
		}

		resp, err := jq(ctx, jsonv, request.Query)
		if err != nil {
			return database.JQResponse{}, err
		}
		resps = append(resps, resp...)
	}
	return database.JQResponse{
		Response: resps,
	}, nil
}

// HandlerSend create a handler that performs call and save result to history
func (a *App) JQ(json, query string) ([]string, error) {
	resp, err := sendJQ(a.ctx, database.JQRequest{query, json})
	return resp.Response, err
}
