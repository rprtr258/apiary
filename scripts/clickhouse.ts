package main

import (
	"context"
	"crypto/tls"
	"database/sql"
	"fmt"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/go-sql-driver/mysql"
	"github.com/kr/pretty"
	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
)

func run() error {
	opts, err := clickhouse.ParseDSN("clickhouse://play@play.clickhouse.com:9440/default?secure&skip_verify")
	if err != nil {
		return errors.Wrap(err, "parse DSN")
	}
	pretty.Println(opts)

	opts2 := &clickhouse.Options{
		Addr: []string{"play.clickhouse.com:9440"},
		Auth: clickhouse.Auth{
			Database: "default",
			Username: "play",
			Password: "",
		},
		TLS: &tls.Config{
			InsecureSkipVerify: true,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 60,
		},
		DialTimeout: time.Second * 30,
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
		BlockBufferSize:      10,
		MaxCompressionBuffer: 10240,
	}
	_ = opts2
	db := clickhouse.OpenDB(opts)
	db.SetMaxIdleConns(5)
	db.SetMaxOpenConns(10)
	db.SetConnMaxLifetime(time.Hour)
	defer db.Close()

	db, err = sql.Open("mysql", "root:my-secret-pw@tcp(127.0.0.1:3306)/")
	if err != nil {
		return errors.Wrap(err, "connect to database")
	}
	defer db.Close()

	if err := db.PingContext(context.Background()); err != nil {
		return errors.Wrap(err, "ping database")
	}

	rows, err := db.Query("SELECT 2+2")
	if err != nil {
		return errors.Wrap(err, "query")
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return errors.Wrap(err, "get columns")
	}

	var rowsData [][]any
	for rows.Next() {
		rowDest := make([]any, len(columns))

		rowPtrs := make([]any, len(columns))
		for i := range rowPtrs {
			rowPtrs[i] = &rowDest[i]
		}

		if err := rows.Scan(rowPtrs...); err != nil {
			return errors.Wrap(err, "scan row")
		}

		rowsData = append(rowsData, rowDest)
	}

	fmt.Println(rowsData)
	return nil
}

func main() {
	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
