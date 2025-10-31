package app

import (
	"context"

	"github.com/rprtr258/apiary/internal/database"
	"github.com/rs/zerolog/log"
)

type App struct {
	ctx context.Context
	DB  *database.DB
}

func New(filename string) (*App, func(context.Context), func()) {
	db, err := database.New(filename)
	if err != nil {
		log.Panic().Err(err).Msg("failed to create database")
	}

	s := &App{DB: db}
	return s,
		func(ctx context.Context) { s.ctx = ctx },
		func() { db.Close() }
}
