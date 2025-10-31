package database

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/redis/go-redis/v9"
)

const KindRedis Kind = "redis"

type RedisRequest struct {
	DSN   string `json:"dsn"`
	Query string `json:"query"`
}

func (RedisRequest) Kind() Kind { return KindRedis }

type RedisResponse struct {
	Response string `json:"response"`
}

func (RedisResponse) Kind() Kind { return KindRedis }

var pluginRedis = plugin{
	EmptyRequest:       RedisEmptyRequest,
	enum:               enumElem[Kind]{KindRedis, "REDIS"},
	Perform:            sendRedis,
	create:             (*DB).createRedis,
	list:               (*DB).listRedisRequests,
	update:             (*DB).updateRedis,
	createHistoryEntry: (*DB).createHistoryEntryRedis,
}

var RedisEmptyRequest = RedisRequest{
	"localhost:6379",
	`KEYS`,
}

func (db *DB) createRedis(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(RedisRequest)
	_, err := db.db.ExecContext(ctx, `INSERT INTO request_redis (id, dsn, query) VALUES ($1, $2)`, id, req.DSN, req.Query)
	return errors.Wrap(err, "insert redis request")
}

func (db *DB) updateRedis(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(RedisRequest)
	_, err := db.db.ExecContext(ctx,
		`UPDATE request_redsi
			SET dsn = $2, query = $3
			WHERE id = $1`,
		id,
		req.DSN, req.Query,
	)
	return err
}

func (db *DB) listRedisRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID    string `db:"id"`
		DSN   string `db:"dsn"`
		Query string `db:"query"`
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_redis`); err != nil {
		return nil, errors.Wrapf(err, "query redis requests")
	}

	var resps []struct {
		ID         string    `db:"id"`
		Pos        int       `db:"pos"` // TODO: remove?
		SentAt     time.Time `db:"sent_at"`
		ReceivedAt time.Time `db:"received_at"`
		Response   string    `db:"response"`
	}
	if err := db.db.SelectContext(ctx, &resps, `SELECT
	r.sent_at, r.received_at,
	rr.*
FROM response r
JOIN response_redis rr ON r.id = rr.id AND r.pos = rr.pos
ORDER BY r.id, r.pos`); err != nil {
		return nil, errors.Wrapf(err, "query redis requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		request := RedisRequest{req.DSN, req.Query}
		history := make([]HistoryEntry, 0) // TODO: single slice
		for _, resp := range resps {
			if resp.ID != req.ID {
				continue
			}
			history = append(history, HistoryEntry{
				resp.SentAt, resp.ReceivedAt, request,
				RedisResponse{resp.Response},
			})
		}

		res = append(res, Request{
			ID:      RequestID(req.ID),
			Data:    request,
			History: history,
		})
	}
	return res, nil
}

func (db *DB) createHistoryEntryRedis(
	ctx context.Context,
	id RequestID, newPos int,
	response EntryData,
) error {
	resp := response.(RedisResponse)
	_, err := db.db.ExecContext(ctx,
		`INSERT INTO response_redis (id, pos, response) VALUES ($1, $2, $3)`,
		id, newPos, resp.Response,
	)
	return errors.Wrap(err, "insert redis response")
}

func sendRedis(ctx context.Context, request EntryData) (EntryData, error) {
	req := request.(RedisRequest)
	uri, err := url.Parse(req.DSN)
	if err != nil {
		return RedisResponse{}, errors.Wrapf(err, "parse dsn %q", req.DSN)
	}

	db := 0
	if len(uri.Path) > 1 && uri.Path[1:] != "" { // NOTE: handle both "" and "/"
		if db, err = strconv.Atoi(uri.Path[1:]); err != nil {
			return RedisResponse{}, errors.Wrapf(err, "parse db %q", req.DSN)
		}
	}

	password, _ := uri.User.Password()
	rdb := redis.NewClient(&redis.Options{
		Addr:     uri.Host,
		Username: uri.User.Username(),
		Password: password,
		DB:       db,
	})

	// TODO: breaks on something like SET key "barabem barabum"
	args := []any{}
	for arg := range strings.FieldsSeq(req.Query) {
		args = append(args, arg)
	}

	val, err := rdb.Do(ctx, args...).Result()
	if err != nil {
		return RedisResponse{}, errors.Wrapf(err, "process query %q", req.Query)
	}

	b, err := json.Marshal(val)
	if err != nil {
		return RedisResponse{}, errors.Wrapf(err, "marshal result %v", val)
	}

	return RedisResponse{
		Response: string(b),
	}, nil
}
