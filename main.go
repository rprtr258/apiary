package main

import (
	"embed"
	"os"

	"github.com/pkg/errors"
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
	database.SQLSourceRequest,
	database.HTTPSourceRequest,
	database.EndpointInfo,
) {
}

func run() error {
	app, startup, close := app.New("db.json")
	if err := app.DB.Close(); err != nil { // NOTE: immediately flush db to migrate to latest version
		return errors.Wrap(err, "migrate db")
	}
	defer close()

	return wails.Run(&options.App{
		Title:  "apiary",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: options.NewRGB(27, 38, 54),
		OnStartup:        startup,
		Bind:             []any{app, &export{}},
		EnumBind: []any{
			database.KindEnums,
			database.AllDatabases,
			database.AllColumnTypes,
		},
		StartHidden: true,
	})
}

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
