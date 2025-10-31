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
