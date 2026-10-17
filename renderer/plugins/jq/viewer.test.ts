import {describe, test, expect, mock} from "bun:test";
import * as t from "@/types.ts";
import {signal} from "../../lib/utils.ts";
import RequestJQ from "./viewer.ts";

describe("RequestJQ", () => {
  test(`editing the query must preserve the loaded json`, async () => {
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
      request: {id: "test-id", path: "", kind: t.Kind.JQ, query: ".foo", json: `{"a": 1}`},
      history: [],
    });

    const el_query = el.querySelector(`input[placeholder="JQ query"]`) as HTMLInputElement;
    expect(el_query).not.toBeNull();

    el_query.value = ".bar";
    el_query.dispatchEvent(new Event("input", {bubbles: true}));
    await Promise.resolve(); // let the update chain settle

    expect(updates.length).toBe(1);
    expect(updates[0]).toMatchObject({query: ".bar", json: `{"a": 1}`});
  });
});
