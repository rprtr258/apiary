import {HistoryEntry, Method as Methods} from "../api.ts";
import {NInputGroup, NInput, NSelect, NButton} from "./input.ts";
import {NTabs, NSplit} from "./layout.ts";
import {NTag, NTable, NEmpty} from "./dataview.ts";
import EditorJSON from "./EditorJSON.ts";
import ViewJSON from "./ViewJSON.ts";
import ParamsList from "./ParamsList.ts";
import {m, setDisplay, Signal, signal} from "../utils.ts";
import {database} from "../../wailsjs/go/models.ts";

// function responseBodyLanguage(contentType: string): string {
//   for (const [key, value] of Object.entries({
//     "application/json;": "json",
//     "text/html;": "html",
//   })) {
//     if (contentType.startsWith(key)) {
//       return value;
//     }
//   }
//   return "text";
// };

export function responseBadge(response: database.HTTPResponse): HTMLElement {
  const code = response.code;
  return NTag({
    type: (
      code < 300 ? "success" :
      code < 500 ? "warning" :
                   "error"
    ) as "success" | "info" | "warning",
    size: "small",
    round: true,
  }, `${code}`);
}
