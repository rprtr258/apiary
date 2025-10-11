package app

import (
	"context"

	"github.com/spf13/afero"

	"github.com/rprtr258/apiary/internal/database"
)

type App struct {
	ctx context.Context
	DB  *database.DB
}

func New(dbFs afero.Fs) (*App, func(context.Context), func()) {
	db := database.New(dbFs)
	s := &App{DB: db}
	return s,
		func(ctx context.Context) { s.ctx = ctx },
		func() { db.Close() }
}
