// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var scripts_grpc_helloworld_pb = require('../../scripts/grpc/helloworld_pb.js');

function serialize_helloworld_HelloReply(arg) {
  if (!(arg instanceof scripts_grpc_helloworld_pb.HelloReply)) {
    throw new Error('Expected argument of type helloworld.HelloReply');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloReply(buffer_arg) {
  return scripts_grpc_helloworld_pb.HelloReply.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloRequest(arg) {
  if (!(arg instanceof scripts_grpc_helloworld_pb.HelloRequest)) {
    throw new Error('Expected argument of type helloworld.HelloRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloRequest(buffer_arg) {
  return scripts_grpc_helloworld_pb.HelloRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


// The greeting service definition.
var GreeterService = exports.GreeterService = {
  // Sends a greeting
sayHello: {
    path: '/helloworld.Greeter/SayHello',
    requestStream: false,
    responseStream: false,
    requestType: scripts_grpc_helloworld_pb.HelloRequest,
    responseType: scripts_grpc_helloworld_pb.HelloReply,
    requestSerialize: serialize_helloworld_HelloRequest,
    requestDeserialize: deserialize_helloworld_HelloRequest,
    responseSerialize: serialize_helloworld_HelloReply,
    responseDeserialize: deserialize_helloworld_HelloReply,
  },
};

exports.GreeterClient = grpc.makeGenericClientConstructor(GreeterService, 'Greeter');
