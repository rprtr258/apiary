import * as t from "@/types.ts";
import {NIcon} from "./components/dataview.ts";
import {DoubleLeftOutlined, DoubleRightOutlined} from "./components/icons.ts";
import {NSelect} from "./components/input.ts";
import {NTabs} from "./components/layout.ts";
import {m, setDisplay} from "./lib/utils.ts";
import {createTreeView} from "./sidebar/tree.ts";
import {newRequestKind, sidebarHidden} from "./sidebar/shared.ts";

export {globalDropdown, newRequestKind, newRequestName, renameID, renameInit, renameValue, sidebarHidden} from "./sidebar/shared.ts";

export const sidebar = function() {
  const collapseButtonClosed = [NIcon({component: DoubleRightOutlined})];
  const collapseButtonOpen = [NIcon({component: DoubleLeftOutlined}), "hide"];
  const collapseButton = m("button", {
    id: "collapse-button",
    type: "button",
    style: {
      color: "black",
      display: "flex",
      gap: ".5em",
      justifyContent: "center",
      alignItems: "center",
    },
  });
  sidebarHidden.sub(function*() {
    while (true) {
      const sidebarHidden = yield;
      collapseButton.replaceChildren(...(sidebarHidden ? collapseButtonClosed : collapseButtonOpen));
      collapseButton.style.cursor = sidebarHidden ? "e-resize" : "w-resize";
      collapseButton.style.height = sidebarHidden ? "100%" : "3em";
    }
  }());

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
    justifyContent: "space-between",
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
    collapseButton,
  );
  sidebarHidden.sub(function*() {
    while (true) {
      const sidebarHidden = yield;
      el.style.gridTemplateRows = sidebarHidden ? "1fr" : "95% 5%";
      setDisplay(el.children[0] as HTMLElement, !sidebarHidden);
    }
  }());

  collapseButton.onclick = () => sidebarHidden.update(v => !v);

  return el;
}();
