package main

import (
	"context"
	"os"
	"time"

	"github.com/pkg/errors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	pb "google.golang.org/grpc/examples/helloworld/helloworld"
)

func run(ctx context.Context) error {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return errors.Wrap(err, "connect")
	}
	defer conn.Close()

	c := pb.NewGreeterClient(conn)

	r, err := c.SayHello(ctx, &pb.HelloRequest{Name: "World"})
	if err != nil {
		return errors.Wrap(err, "greet")
	}

	log.Info().Msgf("Response: %s", r.Message)
	return nil
}

// or
// grpcurl -plaintext -d '{"name":"World"}' localhost:50051 helloworld.Greeter/SayHello
func main() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := run(ctx); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
