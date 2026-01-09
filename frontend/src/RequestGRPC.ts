import {database} from "../wailsjs/go/models.ts";
import {NInput, NButton, NInputGroup, NSelect} from "./components/input.ts";
import {NTabs, NSplit} from "./components/layout.ts";
import {NTag, NTable, NEmpty} from "./components/dataview.ts";
import {GRPCCodes, HistoryEntry} from "./api.ts";
import ViewJSON from "./components/ViewJSON.ts";
import ParamsList from "./components/ParamsList.ts";
import {get_request, last_history_entry} from "./store.ts";
import {m, setDisplay, Signal} from "./utils.ts";

type Request = {kind: database.Kind.GRPC} & database.GRPCRequest;

function responseBadge(response: {code: number}) {
  const code = response.code;
  return NTag({
    type: (code === 0 ? "success" : "error") as "success" | "info" | "warning",
    size: "small",
    round: true,
  }, `${code ?? "N/A"} ${GRPCCodes[code as keyof typeof GRPCCodes]}`);
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
  push_history_entry(he: HistoryEntry): void, // show last history entry
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  const el_response = NEmpty({description: "Send request or choose one from history."});
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const update_response = (response: database.GRPCResponse | undefined) => {
    if (response === undefined) return;

    el_response.replaceChildren(NTabs({
      class: "h100",
      tabs: [
        {
          name: responseBadge(response),
          disabled: true,
        },
        {
          name: "Body",
          elem: el_view_response_body.el,
        },
        {
          name: "Metadata",
          style: {flexGrow: "1"},
          elem: NTable({striped: true, size: "small", "single-column": true, "single-line": false}, [
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
            ...response.metadata.map(header => m("tr", {},
              m("td", {}, header.key),
              m("td", {}, header.value),
            )),
          ]),
        },
      ],
    }));
    el_view_response_body.update(response.response);
  };

  const methods : {
    service: string,
    methods: string[],
  }[] = [];
  let loading_methods = false;
  return {
    loaded: (r: get_request): void => {
      // const notification = useNotification();

      // watch(() => request.value?.target, async () => {
      //   loadingMethods.value = true;
      //   const res = await api.grpcMethods(id);
      //   loadingMethods.value = false;
      //   if (res.kind === "err") {
      //     notification.error({title: "Error fetching GRPC methods", content: res.value});
      //     return;
      //   }
      //   methods.value = res.value;
      // }, {immediate: true});

      const el_send = NButton({
        type: "primary",
        on: {click: on.send},
        disabled: true,
      }, "Send");

      // TODO: group by service
      const selectOptions = methods.flatMap(svc => [{
        label: svc.service,
      }, ...svc.methods.map(method => ({
        label: method,
        value: svc.service + "." + method,
      }))]);

      const request = r.request as Request;
      const update_request = (patch: Partial<database.GRPCRequest>): void => {
        loading_methods = true;
        el_send.disabled = true;
        on.update(patch).then(() => {
          loading_methods = false;
          el_send.disabled = false;
        });
      };
      update_response(last_history_entry(r)?.response as database.GRPCResponse | undefined);

      const el_input_group = NInputGroup({style: {
        gridColumn: "span 2",
        display: "grid",
        gridTemplateColumns: "1fr 10fr 1fr",
      }},
        NSelect({
          label: request.method,
          options: selectOptions,
          placeholder: "Method",
          disabled: loading_methods,
          on: {update: (method: string) => update_request({method})},
        }).el,
        NInput({
          placeholder: "Addr",
          value: request.target,
          on: {update: (target: string) => update_request({target})},
        }),
        el_send,
      );

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
                on: {update: (value: database.KV[]) => update_request({metadata: value})},
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
      el.replaceChildren(el_container);
      unmounts.push(show_request.sub(show_request => {
        split.leftVisible = show_request;
        setDisplay(el_input_group, show_request);
      }, true));
    },
    push_history_entry(he) {
      update_response(he.response as database.GRPCResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
