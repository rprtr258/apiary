package app

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"github.com/redis/go-redis/v9"

	"github.com/rprtr258/apiary/internal/database"
)

func sendRedis(ctx context.Context, request database.RedisRequest) (database.RedisResponse, error) {
	uri, err := url.Parse(request.DSN)
	if err != nil {
		return database.RedisResponse{}, errors.Wrapf(err, "parse dsn %q", request.DSN)
	}

	db := 0
	if len(uri.Path) > 1 && uri.Path[1:] != "" { // NOTE: handle both "" and "/"
		if db, err = strconv.Atoi(uri.Path[1:]); err != nil {
			return database.RedisResponse{}, errors.Wrapf(err, "parse db %q", request.DSN)
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
	for arg := range strings.FieldsSeq(request.Query) {
		args = append(args, arg)
	}

	val, err := rdb.Do(ctx, args...).Result()
	if err != nil {
		return database.RedisResponse{}, errors.Wrapf(err, "process query %q", request.Query)
	}

	b, err := json.Marshal(val)
	if err != nil {
		return database.RedisResponse{}, errors.Wrapf(err, "marshal result %v", val)
	}

	return database.RedisResponse{
		Response: string(b),
	}, nil
}
