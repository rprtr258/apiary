package main

import (
	"context"
	"net"
	"os"

	"github.com/pkg/errors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	pb "google.golang.org/grpc/examples/helloworld/helloworld" // reuse proto types only
	"google.golang.org/grpc/reflection"
)

type server struct {
	pb.UnimplementedGreeterServer
}

func (s *server) SayHello(ctx context.Context, in *pb.HelloRequest) (*pb.HelloReply, error) {
	log.Info().Any("request", in).Str("method", "SayHello").Msg("call")
	return &pb.HelloReply{
		Message: "Hello, " + in.Name,
	}, nil
}

const _addr = ":50051"

func run() error {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	lis, err := net.Listen("tcp", _addr)
	if err != nil {
		return errors.Wrap(err, "listen")
	}

	s := grpc.NewServer()
	pb.RegisterGreeterServer(s, &server{})
	reflection.Register(s)

	log.Info().Msgf("Server listening on %s", _addr)
	return s.Serve(lis)
}

func main() {
	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("App stopped unexpectedly")
	}
}
