import * as t from "@/types.ts";
import {NSelect} from "./components/input_select.ts";
import {NTabs} from "./components/layout.ts";
import {m} from "./lib/utils.ts";
import {createTreeView} from "./sidebar/tree.ts";
import {newRequestKind} from "./sidebar/shared.ts";

export {globalDropdown, newRequestKind, newRequestName, renameID, renameInit, renameValue, sidebarHidden} from "./sidebar/shared.ts";

export const sidebar = function() {
  const tree = createTreeView();

  const new_select = NSelect<t.Kind>({
    on: {update: (value: t.Kind) => {
      newRequestKind.value = value;
      new_select.reset();
    }},
    placeholder: "New",
    options: t.Kinds.map((kind: t.Kind) => ({label: kind.toUpperCase(), value: kind})),
  });

  const el = m("aside", {style: {
    color: "rgba(255, 255, 255, 0.82)",
    backgroundColor: "rgb(24, 24, 28)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
  }},
    NTabs({
      style: {minHeight: "0"},
      tabs: [
        {
          name: "Collection",
          class: "h100",
          style: {
            display: "flex",
            flexDirection: "column",
          },
          elem: [
            new_select.el,
            tree.el,
          ],
        },
      ],
    }),
  );

  return el;
}();
