package database

import (
	"context"
	"encoding/json"
	"iter"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	redis "github.com/redis/go-redis/v9"
	iter2 "github.com/rprtr258/fun/iter"
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
	EmptyRequest:   RedisEmptyRequest,
	enum:           enumElem[Kind]{KindRedis, "REDIS"},
	Perform:        sendRedis,
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: true,
}

var RedisEmptyRequest = RedisRequest{
	"localhost:6379",
	`KEYS *`,
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
	defer rdb.Close() // TODO: keep connections pool

	// TODO: breaks on something like SET key "barabem barabum"
	args := slices.Collect(iter.Seq[any](iter2.Map(iter2.Seq[string](strings.FieldsSeq(req.Query)), func(arg string) any { return arg })))

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
