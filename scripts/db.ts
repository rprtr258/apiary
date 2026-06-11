package main

import (
	"fmt"
	"os"

	"github.com/pkg/errors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rprtr258/apiary/internal/database"
)

func run(args []string) error {
	filename := "db.json"
	if len(args) > 1 {
		filename = os.Args[1]
	}

	f, err := os.ReadFile(filename)
	if err != nil {
		return errors.Wrap(err, "read file")
	}

	res, err := database.Decoder.ParseBytes(f)
	if err != nil {
		return errors.Wrap(err, "parse file")
	}

	fmt.Println(res)

	return nil
}

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	if err := run(os.Args); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
