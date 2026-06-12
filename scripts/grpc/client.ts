import * as grpc from "@grpc/grpc-js";
import * as pb from "./helloworld.ts";
import {grpcMethods} from "./../../main/database/grpc.ts";

console.log(await grpcMethods("localhost:50051"));

// or
// grpcurl -plaintext -d '{"name":"World"}' localhost:50051 helloworld.Greeter/SayHello

const conn = new pb.helloworld.GreeterClient("localhost:50051", grpc.credentials.createInsecure());
// defer conn.close()

conn.SayHello(new pb.helloworld.HelloRequest({name: "World"}), (err, r) => {
  if (err !== null) {
    console.error(`[ERROR] ${err}`);
  } else if (r !== undefined) {
    console.log(`[INFO] Response: ${r.message}`);
  } else {
    console.log("[ERROR] No response");
  }
});
