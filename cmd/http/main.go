package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const _addr = ":8080"

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /dice", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(1 * time.Second)
		dice := rand.Intn(6)
		fmt.Fprintf(w, "at %s: %d", time.Now().UTC().Format(time.RFC3339), dice+1)
	})
	mux.HandleFunc("POST /sleep", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
	})
	log.Print("running on", _addr)
	log.Fatal().Err(http.ListenAndServe(_addr, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Info().Str("method", r.Method).Str("url", r.URL.String()).Send()
		mux.ServeHTTP(w, r)
	}))).Msg("server stopped")
}
