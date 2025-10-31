package database

import (
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

type EntryData interface {
	Kind() Kind
}

type Response struct {
	SentAt     time.Time `json:"sent_at"`
	ReceivedAt time.Time `json:"received_at"`
	Response   EntryData `json:"response"`
}

type RequestID string

type Request struct {
	ID        RequestID
	Path      string
	Data      EntryData
	Responses []Response // TODO: []HistoryEntry[HTTPRequest, HTTPResponse] | []HistoryEntry[SQLRequest, SQLResponse] aligned w/ Data field
}

// NOTE: still used by frontend
func (e Request) MarshalJSON() ([]byte, error) {
	b, err := json.Marshal(e.Data)
	if err != nil {
		return nil, err
	}

	var m map[string]any
	if err = json.Unmarshal(b, &m); err != nil {
		return nil, err
	}

	m["id"] = e.ID
	m["kind"] = e.Data.Kind()
	m["path"] = e.Path

	return json.Marshal(m)
}
