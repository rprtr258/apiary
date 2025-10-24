package main

import (
	"context"
	"embed"
	"io/fs"
	"os"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
	goose "github.com/pressly/goose/v3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	_ "modernc.org/sqlite"

	"github.com/rprtr258/apiary/internal/app"
	"github.com/rprtr258/apiary/internal/database"
)

//go:embed all:frontend/dist
var assets embed.FS

type export struct{}

func (export) ExportTypes(
	database.HTTPRequest, database.HTTPResponse,
	database.SQLRequest, database.SQLResponse,
	database.GRPCRequest, database.GRPCResponse,
	database.JQRequest, database.JQResponse,
	database.RedisRequest, database.RedisResponse,
	database.MDRequest, database.MDResponse,
) {
}

//go:embed internal/database/migrations/*
var migrationsFS embed.FS

func run(ctx context.Context) error {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	db, err := sqlx.Open("sqlite", "db.db")
	if err != nil {
		return err
	}
	defer db.Close()
	// NOTE: since we are using sqlite, we do not want to get (SQLITE_BUSY)
	// due to other goroutine updating same file
	db.SetMaxOpenConns(1)

	migrationsFS2, err := fs.Sub(migrationsFS, "internal/database/migrations")
	if err != nil {
		return errors.Wrap(err, "sub fs")
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, db.DB, migrationsFS2)
	if err != nil {
		return errors.Wrap(err, "new provider")
	}
	if _, err := provider.Up(ctx); err != nil {
		return errors.Wrap(err, "run migrations")
	}

	app, startup, close := app.New(db)
	defer close()

	// Create application with options
	return wails.Run(&options.App{
		Title:  "apiary",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        startup,
		Bind:             []any{app, &export{}},
		EnumBind: []any{
			database.AllKinds,
			database.AllDatabases,
			database.AllColumnTypes,
		},
		StartHidden: true,
	})
}

func main() {
	if err := run(context.Background()); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
