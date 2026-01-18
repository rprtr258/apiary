package database

import "context"

const KindJQ Kind = "jq"

type JQRequest struct {
	Query string `json:"query"`
	JSON  string `json:"json"`
}

func (JQRequest) Kind() Kind { return KindJQ }

type JQResponse struct {
	Response []string `json:"response"`
}

func (JQResponse) Kind() Kind { return KindJQ }

var pluginJQ = plugin{
	EmptyRequest:   JQEmptyRequest,
	enum:           enumElem[Kind]{KindJQ, "JQ"},
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: (*DB).createResponseJQ,
}

func (db *DB) createResponseJQ(ctx context.Context, id RequestID, req EntryData) (EntryData, error) {
	return req, nil
}

var JQEmptyRequest = JQRequest{
	".", // Query
	`{
  "string": "string",
  "number": 42,
  "bool": true,
  "list": [1, 2, 3],
  "null": null
}`, // JSON
}
