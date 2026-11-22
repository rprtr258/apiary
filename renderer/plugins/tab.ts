import {m} from "../lib/utils.ts";
import {NIcon} from "../components/dataview.ts";
import {Eye, EyeClosed} from "../components/icons.ts";
import {TabModifier} from "./types.ts";

// Eye toggle in the tab: shows/hides the editor pane via show_request.
export const eyeTabModifier: TabModifier = (tab, {show_request}) => {
  const eye = m("span", {
    title: "Hide request",
    onclick: () => show_request.update(b => !b),
  });
  const unsub = show_request.sub(function*() {
    while (true) {
      const value = yield;
      eye.title = value ? "Hide request" : "Show request";
      eye.replaceChildren(NIcon({
        component: value ? Eye : EyeClosed,
        class: "highlight-red",
      }));
    }
  }());
  tab.element.prepend(eye);
  return unsub;
};
