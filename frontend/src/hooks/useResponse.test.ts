import {describe, test, expect} from "bun:test";
import {useResponse} from "./useResponse.ts";

describe("useResponse", () => {
  const mockResponse = {
    code: 200,
    body: "{\"message\": \"success\"}",
    headers: [{key: "Content-Type", value: "application/json"}],
  };

  test("initializes with undefined response by default", () => {
    const response = useResponse();

    expect(response.response).toBeUndefined();
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);
  });

  test("initializes with provided initial response", () => {
    const response = useResponse({
      initialResponse: mockResponse,
    });

    expect(response.response).toEqual(mockResponse);
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);
  });

  test("updates response with update method", () => {
    const response = useResponse();

    response.update(mockResponse);

    expect(response.response).toEqual(mockResponse);
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);
  });

  test("clears response with clear method", () => {
    const response = useResponse({
      initialResponse: mockResponse,
    });

    expect(response.response).toEqual(mockResponse);

    response.clear();

    expect(response.response).toBeUndefined();
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);
  });

  test("update clears previous error", () => {
    const response = useResponse();
    response.errorSignal.update(() => new Error("Test error"));
    expect(response.error).not.toBe(null);

    // Simulate an error state (though useResponse doesn't have a way to set error directly)
    // We'll test that update clears any existing error
    response.update(mockResponse);

    expect(response.error).toBe(null);
    expect(response.response).toEqual(mockResponse);
  });

  test("update with undefined clears response", () => {
    const response = useResponse({
      initialResponse: mockResponse,
    });

    response.update(undefined);

    expect(response.response).toBeUndefined();
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);
  });

  test("provides signal accessors", () => {
    const response = useResponse({
      initialResponse: mockResponse,
    });

    expect(response.responseSignal.value).toEqual(mockResponse);
    expect(response.loadingSignal.value).toBe(false);
    expect(response.errorSignal.value).toBe(null);
  });

  test("signals update when response changes", () => {
    const response = useResponse();

    let responseSignalValue = response.responseSignal.value;
    let loadingSignalValue = response.loadingSignal.value;
    let errorSignalValue = response.errorSignal.value;

    response.responseSignal.sub(function*() {
      yield;
      while (true) {
        responseSignalValue = yield;
      }
    }());

    response.loadingSignal.sub(function*() {
      yield;
      while (true) {
        loadingSignalValue = yield;
      }
    }());

    response.errorSignal.sub(function*() {
      yield;
      while (true) {
        errorSignalValue = yield;
      }
    }());

    response.update(mockResponse);

    expect(responseSignalValue).toEqual(mockResponse);
    expect(loadingSignalValue).toBe(false);
    expect(errorSignalValue).toBe(null);
  });

  test("signals update when response is cleared", () => {
    const response = useResponse({
      initialResponse: mockResponse,
    });

    let responseSignalValue = response.responseSignal.value;

    response.responseSignal.sub(function*() {
      yield;
      while (true) {
        responseSignalValue = yield;
      }
    }());

    response.clear();

    expect(responseSignalValue).toBeUndefined();
  });

  test("can update response multiple times", () => {
    const response = useResponse();

    const response1 = {
      code: 200,
      body: "first",
      headers: [],
    };

    const response2 = {
      code: 404,
      body: "not found",
      headers: [{key: "X-Error", value: "true"}],
    };

    response.update(response1);
    expect(response.response).toEqual(response1);

    response.update(response2);
    expect(response.response).toEqual(response2);
  });

  test("getters return current values", () => {
    const response = useResponse();

    expect(response.response).toBeUndefined();
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);

    response.update(mockResponse);

    expect(response.response).toEqual(mockResponse);
    expect(response.loading).toBe(false);
    expect(response.error).toBe(null);
  });

  test("setLoading controls loading state", () => {
    const response = useResponse();

    expect(response.loading).toBe(false);
    expect(response.loadingSignal.value).toBe(false);

    response.setLoading(true);
    expect(response.loading).toBe(true);
    expect(response.loadingSignal.value).toBe(true);

    response.update(mockResponse);
    expect(response.loading).toBe(false);

    response.setLoading(true);
    expect(response.loading).toBe(true);

    response.clear();
    expect(response.loading).toBe(false);
  });
});