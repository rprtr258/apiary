package app

import (
	"context"

	"github.com/jmoiron/sqlx"

	"github.com/rprtr258/apiary/internal/database"
)

type App struct {
	ctx context.Context
	DB  *database.DB
}

func New(sqldb *sqlx.DB) (*App, func(context.Context), func()) {
	db := database.New(sqldb)
	s := &App{DB: db}
	return s,
		func(ctx context.Context) { s.ctx = ctx },
		func() { db.Close() }
}
