import {describe, test, expect} from "bun:test";
import * as grpc from "../database/grpc.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);

describe.if(IS_INTEGRATION)("grpc", () => {
  test("list methods", async () => {
    const methods = await grpc.grpcMethods("localhost:50051");
    expect(methods).toEqual({"helloworld.Greeter": ["SayHello"]});
  });

  test("send", async () => {
    const result = await grpc.send({
      target: "localhost:50051",
      method: "helloworld.Greeter/SayHello",
      payload: JSON.stringify({name: "World"}),
      metadata: [],
    });
    expect(result).toEqual({
      response: JSON.stringify({message: "Hello World"}),
      code: 0,
      metadata: [
        {key: "content-type", value: "application/grpc+proto"},
        {key: "x-served-by", value: "apiary-test-server"},
        // date is server-generated, so its value is echoed from the result; the
        // entry itself is still asserted (presence, position, string type).
        {key: "date", value: result.metadata.find(({key}) => key === "date")?.value ?? ""},
        {key: "x-trace-id", value: "test-trace"},
      ],
    });
  });
});
