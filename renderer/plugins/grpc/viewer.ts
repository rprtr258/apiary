import * as t from "@/types.ts";
import {get_request, last_history_entry} from "../../store.ts";
import {m, setDisplay, Signal} from "../../lib/utils.ts";
import ParamsList from "../../components/ParamsList.ts";
import {NInput, NButton, NInputGroup, NSelect} from "../../components/input.ts";
import {useRequest} from "../../hooks/useRequest.ts";
import {NTabs, NSplit} from "../../components/layout.ts";
import {NTag, NTable, NEmpty, tagColors} from "../../components/dataview.ts";
import ViewJSON from "../../components/ViewJSON.ts";
import {api} from "../../api.ts";
import notification from "../../lib/notification.ts";

type Request = {kind: t.Kind.GRPC} & t.GRPCRequest;

function responseBadge(response: {code: number}) {
  const code = response.code;
  const tooltip = code in t.GRPCCodes ? `${code} ${t.GRPCCodes[code as keyof typeof t.GRPCCodes]}` : `${code}`;

  return NTag({
    label: tooltip,
    color: tagColors[code === 0 ? "success" : "error"],
    tooltip,
  });
}

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>, // TODO: remove, show by default
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: t.HistoryEntry): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  const el_response = NEmpty({description: "Send request or choose one from history."});
  const el_view_response_body = ViewJSON("");
  const tbody = m("tbody", {});
  const el_metadata_table = NTable({striped: true, size: "small", "single-column": true, "single-line": false}, [
    m("colgroup", {},
      m("col", {style: {width: "50%"}}),
      m("col", {style: {width: "50%"}}),
    ),
    m("thead", {},
      m("tr", {},
        m("th", {}, "NAME"),
        m("th", {}, "VALUE"),
      ),
    ),
    tbody,
  ]);
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const badgeContainer = m("span", {});
  let tabsReplaced = false;
  const tabsElement = NTabs({
    class: "h100",
    tabs: [
      {
        name: badgeContainer,
        disabled: true,
      },
      {
        name: "Body",
        elem: el_view_response_body.el,
      },
      {
        name: "Metadata",
        style: {flexGrow: "1"},
        elem: el_metadata_table,
      },
    ],
  });
  const update_response = (response: t.GRPCResponse | undefined) => {
    if (response === undefined)
      return;

    badgeContainer.replaceChildren(responseBadge(response));
    el_view_response_body.update(response.response);
    tbody.replaceChildren(...response.metadata.map(header => m("tr", {},
      m("td", {}, header.key),
      m("td", {}, header.value),
    )));

    if (!tabsReplaced) {
      el_response.replaceChildren(tabsElement);
      tabsReplaced = true;
    }
  };

  let methods: {[service: string]: string[]} = {};
  let loading_methods = false;
  const requestHook = useRequest<t.GRPCRequest>({initialRequest: {
    target: "",
    method: "",
    payload: "",
    metadata: [],
  }, on: {update: on.update}});
  const el_send = NButton({
    primary: true,
    on: {click: on.send},
    disabled: true,
  }, "Send");
  const targetInput = NInput({
    placeholder: "Addr",
    value: "",
    on: {update: (target: string) => update_request({target})},
  });
  const method_select = NSelect({
    label: "",
    options: [],
    placeholder: "Method",
    disabled: loading_methods,
    on: {update: (method: string) => update_request({method})},
  });

  const el_input_group = NInputGroup({style: {
    gridColumn: "span 2",
    display: "grid",
    gridTemplateColumns: "1fr 10fr 1fr",
  }}, method_select.el, targetInput, el_send.el);

  function update_request(patch: Partial<t.GRPCRequest>): void {
    el_send.disabled = true;
    requestHook.update(patch).finally(() => {
      el_send.disabled = false;
    }).catch(() => {
      targetInput.value = requestHook.requestSignal.value.target;
      try {
        method_select.set(requestHook.requestSignal.value.method);
      } catch {}
      // TODO: metadata list not re-synced on failed persist (ParamsList exposes no update API)
    });
  }

  return {
    loaded: (r: get_request): void => {
      const request = r.request as Request;
      requestHook.requestSignal.value = request;
      targetInput.value = request.target;
      method_select.set(request.method);

      loading_methods = true;
      api.grpcMethods(r.request.id).then(res => {
        if (res.kind === "err") {
          notification("error", "Error fetching GRPC methods", {content: res.value});
          return;
        }
        methods = res.value;
        method_select.setOptions(Object.entries(methods)
          .sort(([s1], [s2]) => s1.localeCompare(s2))
          .flatMap(([service, methods]) => [{
            label: service,
            value: undefined,
            disabled: true,
          }, ...methods.map(method => ({
            label: method,
            value: service + "." + method,
          }))]));
      }).catch(() => {
      }).finally(() => {
        loading_methods = false;
        // The select is created while methods are still loading; re-enable it once they
        // settle — unless they failed and it stayed empty (nothing to select).
        method_select.el.disabled = Object.keys(methods).length === 0;
      });

      update_response(last_history_entry(r)?.response as t.GRPCResponse | undefined);

      const el_req_tabs = NTabs({
        class: "h100",
        tabs: [
          {
            name: "Request",
            class: "h100",
            // elem: EditorJSON({
            //   class: "h100",
            //   value: request.payload,
            //   on: {update: (payload: string) => update_request({payload})},
            // }),
          },
          {
            name: "Metadata",
            style: {display: "flex", flexDirection: "column", flexGrow: "1"},
            elem: [
              ParamsList({
                value: request.metadata,
                on: {update: (value: t.KV[]) => update_request({metadata: value})},
              }),
            ],
          },
        ],
      });

      const split = NSplit(el_req_tabs, el_response, {direction: "horizontal", style: {minHeight: "0"}});
      unmounts.push(() => split.unmount());
      const el_split = split.element;
      const el_container = m("div", {
        class: "h100",
        style: {
          display: "flex",
          flexDirection: "column",
        },
      }, el_input_group, el_split);
      unmounts.push(show_request.sub(function*() {
        while (true) {
          const show_request = yield;
          split.leftVisible = show_request;
          setDisplay(el_input_group, show_request);
        }
      }()));
      el.replaceChildren(el_container);
    },
    push_history_entry(he) {
      update_response(he.response as t.GRPCResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
