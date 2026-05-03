package main

import (
	"flag"
	"fmt"
	"os"

	"gioui.org/app"
	"gioui.org/op"
	"gioui.org/unit"
	"github.com/go-faster/errors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	_ "modernc.org/sqlite"

	app2 "github.com/rprtr258/apiary/internal/app"
	"github.com/rprtr258/apiary/internal/version"
)

func run(w *app.Window) error {
	ap, close := app2.New("db.json")
	if err := ap.DB.Close(); err != nil { // NOTE: immediately flush db to migrate to latest version
		return errors.Wrap(err, "migrate db")
	}
	defer close()

	var ops op.Ops
	for {
		switch e := w.Event().(type) {
		case app.DestroyEvent:
			return e.Err
		case app.FrameEvent:
			// This graphics context is used for managing the rendering state.
			gtx := app.NewContext(&ops, e)
			ap.Layout(gtx)
			// Pass the drawing operations to the GPU.
			e.Frame(gtx.Ops)
		}
	}
}

func main() {
	showVersion := flag.Bool("version", false, "Show version information")
	flag.Parse()
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

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	log.Info().
		Str("version", version.Version).
		Str("commit", version.Commit).
		Str("date", version.Date).
		Msg("Starting apiary")

	go func() {
		var w app.Window
		w.Option(app.Title("apiary"), app.Size(unit.Dp(1024), unit.Dp(768)))
		if err := run(&w); err != nil {
			log.Fatal().Err(err).Msg("App stopped unexpectedly")
		}
		os.Exit(0)
	}()
	app.Main()
}
