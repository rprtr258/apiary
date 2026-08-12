import * as t from "@/types.ts";
import {NEmpty, NIcon, NList, NListItem} from "./components/dataview.ts";
import {DoubleLeftOutlined, DoubleRightOutlined} from "./components/icons.ts";
import {NSelect} from "./components/input.ts";
import {NTabs} from "./components/layout.ts";
import {store} from "./store.ts";
import {m, setDisplay} from "./lib/utils.ts";
import {createTreeView} from "./sidebar/tree.ts";
import {newRequestKind, sidebarHidden} from "./sidebar/shared.ts";

export {globalDropdown, newRequestKind, newRequestName, renameID, renameInit, renameValue, sidebarHidden} from "./sidebar/shared.ts";

function fromNow(date: Date): string {
  const now = new Date();

  const milliseconds = now.getTime() - date.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours   / 24);
  const weeks   = Math.floor(days    /  7);
  const months  = Math.floor(weeks   /  4);
  const years   = Math.floor(months  / 12);

  switch (true) {
    case years   > 0: return years   === 1 ? "a year ago"   : `${years} years ago`;
    case months  > 0: return months  === 1 ? "a month ago"  : `${months} months ago`;
    case weeks   > 0: return weeks   === 1 ? "a week ago"   : `${weeks} weeks ago`;
    case days    > 0: return days    === 1 ? "yesterday"    : `${days} days ago`;
    case hours   > 0: return hours   === 1 ? "an hour ago"  : `${hours} hours ago`;
    case minutes > 0: return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
    default:          return "just now";
  }
}

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
      newRequestKind.update(() => value);
      new_select.reset();
    }},
    placeholder: "New",
    options: t.Kinds.map((kind: t.Kind) => ({label: kind.toUpperCase(), value: kind})),
  });

  // TODO: whole history in reverse order
  const history = [] as t.HistoryEntry[];

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
        {
          name: "History",
          style: {flexGrow: "1"},
          elem: (() => {
            if (store.requestID() === null)
              return NEmpty({description: "Not implemented"});
            if (history.length === 0)
              return NEmpty({description: "No history yet"});
            return [
              NList(history.map(r =>
                NListItem({
                  class: ["history-card", "card"].join(" "),
                  // on: {click: () => selectRequest(r.request.id)},
                }, [
                  m("span", {style: {color: "grey"}, class: "date"}, fromNow(r.sent_at)),
                ]),
              )),
            ];
          })(),
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
