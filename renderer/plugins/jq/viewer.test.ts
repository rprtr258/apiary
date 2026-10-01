import {describe, test, expect, mock} from "bun:test";
import * as t from "@/types.ts";
import {signal} from "../../lib/utils.ts";
import RequestJQ from "./viewer.ts";

// Regression test for the useRequest seeding bug: the viewer must seed its request hook with
// the loaded request. Updates carry the hook's FULL request to store.update_request, whose
// {...old_data, ...patch} merge persists it — a hook seeded with {query: "", json: ""} wipes
// the json field on the first query edit (and symmetrically the query on the first json edit).
describe("RequestJQ", () => {
  test("editing the query must preserve the loaded json (hook is seeded, not {query: \"\", json: \"\"})", async () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const updates: Partial<t.JQRequest>[] = [];
    const on = {
      update: mock((patch: Partial<t.JQRequest>) => {
        updates.push(patch);
        return Promise.resolve();
      }),
      send: mock(() => Promise.resolve()),
    };

    const component = RequestJQ(el, show_request, on);
    component.loaded({
      request: {id: "test-id", path: "", kind: t.Kind.JQ, query: ".foo", json: "{\"a\": 1}"},
      history: [],
    });

    const el_query = el.querySelector("input[placeholder=\"JQ query\"]") as HTMLInputElement;
    expect(el_query).not.toBeNull();

    el_query.value = ".bar";
    el_query.dispatchEvent(new Event("input", {bubbles: true}));
    await Promise.resolve(); // let the update chain settle

    expect(updates.length).toBe(1);
    // The patch is the hook's full request (id/path/kind ride along at runtime; the store
    // strips them): the loaded json must be carried through, not the hook's default "".
    expect(updates[0]).toMatchObject({query: ".bar", json: "{\"a\": 1}"});
  });
});
