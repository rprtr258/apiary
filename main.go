package main

import (
	"embed"
	"flag"
	"fmt"
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
	"github.com/rprtr258/apiary/internal/version"
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

	// Only start hidden in release builds
	startHidden := version.IsRelease()

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
		StartHidden: startHidden,
	})
}

func main() {
	// Parse command line flags
	showVersion := flag.Bool("version", false, "Show version information")
	flag.Parse()

	// Setup logging
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Handle version flag
	if *showVersion {
		fmt.Printf("apiary version %s\n", version.Version)
		if version.Commit != "" {
			fmt.Printf("commit: %s\n", version.Commit)
		}
		if version.Date != "" {
			fmt.Printf("build date: %s\n", version.Date)
		}
		os.Exit(0)
	}

	log.Info().
		Str("version", version.Version).
		Str("commit", version.Commit).
		Str("date", version.Date).
		Msg("Starting apiary")

	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
