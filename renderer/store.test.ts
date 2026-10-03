import {describe, expect, test, mock, beforeEach} from "bun:test";
import {Kind, type HTTPRequest, type Request} from "@/types.ts";

// Store-level regression for the persistSeqs/lastPersisted staleness rules: update_request
// must undo to the newest *persisted* state, including when an older overlapping persist
// succeeds late (after a newer one started), so the next full-Data persist cannot drop it.
let resolvePersist: ((res: {kind: string, value: unknown}) => void)[] = [];
mock.module("./api.ts", () => ({api: {
  request_update: () => new Promise(res => {resolvePersist.push(res);}),
}}));

const {update_request, store} = await import("./store.ts");
const {PersistRevertedError} = await import("./hooks/useRequest.ts");

const base: Request = {id: "r1", path: "/r1", kind: Kind.HTTP, url: "http://x", method: "GET", body: "", headers: []};

describe("update_request rollback target", () => {
  beforeEach(() => {
    resolvePersist = [];
    store.requests2 = {r1: {request: {...base}, history: []}};
    // reset per-id state via deleteRequest's cleanup path is async (fetch); clear directly
    // through a fresh id instead to avoid touching module internals.
  });

  test("late success of an older persist becomes the rollback target of a newer failure", async () => {
    const p1 = update_request("r1", {url: "http://a"}); // seq 1, optimistic = base + a
    const p2 = update_request("r1", {url: "http://ab"}); // seq 2, optimistic = base + ab

    // Older persist succeeds late (superseded): backend truth is now base+a.
    resolvePersist[0]({kind: "ok", value: {}});
    await p1;
    // Newer persist fails: must roll back to the last *persisted* state (base+a), not pre-patch.
    resolvePersist[1]({kind: "err", value: "boom"});
    expect(await p2.then(() => null, (e: unknown) => e)).toBeInstanceOf(PersistRevertedError);

    expect((store.requests2["r1"].request as HTTPRequest).url).toBe("http://a");
  });

  test("out-of-order success below the recorded one does not regress the rollback target", async () => {
    const p1 = update_request("r1", {url: "http://a"}); // seq 1
    const p2 = update_request("r1", {url: "http://ab"}); // seq 2

    // Newer persist succeeds first: backend truth is base+ab.
    resolvePersist[1]({kind: "ok", value: {}});
    await p2;
    // Older success arrives late: must not regress the undo target below base+ab.
    resolvePersist[0]({kind: "ok", value: {}});
    await p1;

    const p3 = update_request("r1", {url: "http://abc"});
    resolvePersist[2]({kind: "err", value: "boom"});
    expect(await p3.then(() => null, (e: unknown) => e)).toBeInstanceOf(PersistRevertedError);
    expect((store.requests2["r1"].request as HTTPRequest).url).toBe("http://ab");
  });
});
