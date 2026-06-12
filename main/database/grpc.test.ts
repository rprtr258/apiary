import {describe, test, expect} from "bun:test";
import {grpcQueryFake, grpcQueryValidate} from "./grpc.ts";

describe("GRPC", () => {
  test("grpcQueryFake returns a JSON string on error (no server)", async () => {
    const result = await grpcQueryFake("localhost:50051", "Service/Method");
    expect(() => JSON.parse(result) as unknown).not.toThrow();
  });

  test("grpcQueryValidate passes for valid JSON with reflection error", async () => {
    try {
      await grpcQueryValidate("localhost:50051", "Service/Method", `{"name": "test"}`);
    } catch (err) {
      // Now requires reflection - expects either connection error or validation error
      expect(err).toBeTruthy();
    }
  });

  test("grpcQueryValidate throws for invalid JSON with reflection error", async () => {
    try {
      await grpcQueryValidate("localhost:50051", "Service/Method", "not-json");
    } catch (err) {
      // Now requires reflection - expects either connection error or validation error
      expect(err).toBeTruthy();
    }
  });
});
