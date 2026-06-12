import * as grpc from "@grpc/grpc-js";
import * as reflection from "@grpc/reflection";
import protoLoader from "@grpc/proto-loader";
import * as messages from "./helloworld_pb.js";
import {GreeterService} from "./helloworld_grpc_pb.js";

function sayHello(
  call: grpc.ServerUnaryCall<messages.HelloRequest, messages.HelloReply>,
  callback: (error: grpc.ServerErrorResponse | null, value?: unknown) => void,
): void {
  console.log(`[INFO] call request=${JSON.stringify(call.request.toObject())} method=SayHello`);
  const reply = new messages.HelloReply();
  reply.setMessage(`Hello ${call.request.getName()}`);
  callback(null, reply);
}

const _addr = "0.0.0.0:50051";

const s = new grpc.Server();
s.addService(GreeterService, {sayHello});
const packageDefinition = protoLoader.loadSync(import.meta.dirname+"/helloworld.proto", {keepCase: true, longs: String, enums: String, defaults: true, oneofs: true});
new reflection.ReflectionService(packageDefinition).addToServer(s);
s.bindAsync(_addr, grpc.ServerCredentials.createInsecure(), err => {
  if (err !== null) {
    return console.error(err);
  }
  console.log(`[INFO] Server listening on ${_addr} (with reflection)`);
});