import {describe, test, expect} from "bun:test";
import {grpcQueryFake, grpcQueryValidate} from "./grpc.ts";

describe("GRPC", () => {
  test("grpcQueryFake returns a JSON string", async () => {
    const result = await grpcQueryFake("localhost:50051", "Service/Method");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  test("grpcQueryValidate passes for valid JSON", async () => {
    await grpcQueryValidate("localhost:50051", "Service/Method", `{"name": "test"}`);
  });

  test("grpcQueryValidate throws for invalid JSON", async () => {
    expect(grpcQueryValidate("localhost:50051", "Service/Method", "not-json")).rejects.toThrow();
  });
});
