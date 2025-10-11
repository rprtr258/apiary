package main

import (
	"embed"
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/afero"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

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
	database.MarkdownRequest, database.MarkdownResponse,
) {
}

func run() error {
	fs := afero.NewBasePathFs(afero.NewOsFs(), "dist")
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	app, startup, close := app.New(fs)
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
		Windows: &windows.Options{
			WebviewDisableRendererCodeIntegrity: true,
		},
	})
}

func main() {
	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
