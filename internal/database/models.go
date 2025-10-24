package database

import (
	"context"
	"encoding/json"
	"time"
)

type KV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type enumElem[T any] struct {
	Value  T
	TSName string
}

var AllKinds = []enumElem[Kind]{
	elemHTTP,
	elemSQL,
	elemJQ,
	elemMD,
	elemRedis,
	elemGRPC,
}

var EmptyRequests = map[Kind]EntryData{
	KindHTTP:  HTTPEmptyRequest,
	KindSQL:   SQLEmptyRequest,
	KindJQ:    JQEmptyRequest,
	KindMD:    MDEmptyRequest,
	KindRedis: RedisEmptyRequest,
	KindGRPC:  GRPCEmptyRequest,
}

var creates = map[Kind]func(*DB, context.Context, RequestID, EntryData) error{
	KindHTTP:  (*DB).createHTTP,
	KindSQL:   (*DB).createSQL,
	KindJQ:    (*DB).createJQ,
	KindMD:    (*DB).createMD,
	KindRedis: (*DB).createRedis,
	KindGRPC:  (*DB).createGRPC,
}

var listers = map[Kind]func(*DB, context.Context) ([]Request, error){
	KindHTTP:  (*DB).listHTTPRequests,
	KindSQL:   (*DB).listSQLRequests,
	KindJQ:    (*DB).listJQRequests,
	KindMD:    (*DB).listMDRequests,
	KindRedis: (*DB).listRedisRequests,
	KindGRPC:  (*DB).listGRPCRequests,
}

var updates = map[Kind]func(*DB, context.Context, RequestID, EntryData) error{
	KindHTTP:  (*DB).updateHTTP,
	KindSQL:   (*DB).updateSQL,
	KindJQ:    (*DB).updateJQ,
	KindMD:    (*DB).updateMD,
	KindRedis: (*DB).updateRedis,
	KindGRPC:  (*DB).updateGRPC,
}

var createHistoryEntrys = map[Kind]func(*DB, context.Context, RequestID, int, EntryData) error{
	KindHTTP:  (*DB).createHistoryEntryHTTP,
	KindSQL:   (*DB).createHistoryEntrySQL,
	KindJQ:    (*DB).createHistoryEntryJQ,
	KindMD:    (*DB).createHistoryEntryMD,
	KindRedis: (*DB).createHistoryEntryRedis,
	KindGRPC:  (*DB).createHistoryEntryGRPC,
}

type Kind string

type EntryData interface {
	Kind() Kind
}

type HistoryEntry struct {
	SentAt     time.Time `json:"sent_at"`
	ReceivedAt time.Time `json:"received_at"`
	Request    EntryData `json:"request"` // TODO: remove?
	Response   EntryData `json:"response"`
}

type RequestID string

type Request struct {
	ID      RequestID
	Data    EntryData
	History []HistoryEntry // TODO: []HistoryEntry[HTTPRequest, HTTPResponse] | []HistoryEntry[SQLRequest, SQLResponse] aligned w/ Data field
}

func gavnischtsche(x any) (map[string]any, error) {
	b, err := json.Marshal(x)
	if err != nil {
		return nil, err
	}

	var m map[string]any
	if err = json.Unmarshal(b, &m); err != nil {
		return nil, err
	}

	return m, nil
}

func (e Request) MarshalJSON() ([]byte, error) {
	m, err := gavnischtsche(e.Data)
	if err != nil {
		return nil, err
	}

	m["id"] = e.ID
	m["kind"] = e.Data.Kind()

	return json.Marshal(m)
}
