import {NInput, NButton, NInputGroup, NSelect} from "./components/input";
import {NTabs} from "./components/layout";
import {NTag, NTable, NEmpty} from "./components/dataview";
import {GRPCCodes, HistoryEntry} from "./api";
import {database} from '../wailsjs/go/models';
import EditorJSON from "./components/EditorJSON";
import ViewJSON from "./components/ViewJSON";
import ParamsList from "./components/ParamsList";
import {get_request, last_history_entry, useNotification} from "./store";
import {m, Signal} from "./utils";

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
} {
  el.append(NEmpty({
    description: "Loading request...",
    class: "h100",
    style: {"justify-content": "center"},
  }));

  const el_response = NEmpty({
    description: "Send request or choose one from history.",
    class: "h100",
    style: {"justify-content": "center"},
  });
  const el_view_response_body = ViewJSON("");
  const update_response = (response: database.GRPCResponse | null) => {
    if (response === null) {return;}

    el_response.replaceChildren(NTabs({
      type: "card",
      size: "small",
      style: {"overflow-y": "auto"},
      tabs: [
        {
          name: responseBadge(response),
          disabled: true,
        },
        {
          name: "Body",
          style: {"overflow-y": "auto"},
          elem: el_view_response_body.el,
        },
        {
          name: "Metadata",
          style: {flex: 1},
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
      const update_requestt = (patch: Partial<database.GRPCRequest>): void => {
        loading_methods = true;
        el_send.disabled = true;
        on.update(patch).then(() => {
          loading_methods = false;
          el_send.disabled = false;
        });
      };
      update_response((last_history_entry(r)?.response as database.GRPCResponse | undefined) ?? null);

      el.replaceChildren(m("div", {
        class: "h100",
        style: {
          display: "grid",
          "grid-template-columns": "1fr 1fr",
          "grid-template-rows": "auto 1fr",
          "grid-column-gap": ".5em",
        },
      }, [
        NInputGroup({style: {
          "grid-column": "span 2",
          display: "grid",
          "grid-template-columns": "1fr 10fr 1fr",
        }},
          NSelect({
            label: request.method,
            options: selectOptions,
            placeholder: "Method",
            disabled: loading_methods,
            style: {width: "10%", "min-width": "18em"},
            on: {update: (method: string) => update_requestt({method})},
          }).el,
          NInput({
            placeholder: "Addr",
            value: request.target,
            on: {update: (target: string) => update_requestt({target})},
          }),
          el_send,
        ),
        NTabs({
          type: "line",
          size: "small",
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
              style: {display: "flex", "flex-direction": "column", flex: 1},
              elem: [
                ParamsList({
                  value: request.metadata,
                  on: {update: (value: database.KV[]) => update_requestt({metadata: value})},
                }),
                // ...request.headers.map((obj, i) => m("div", {
                //   style: {display: "flex", "flex-direction": "row"},
                // }, [
                //   NInput({type: "text", value: obj.key,   style: {flex: 1}}),
                //   NInput({type: "text", value: obj.value, style: {flex: 1}}),
                // ])),
                // m("div", {
                //   style: {display: "flex", "flex-direction": "row"},
                // }, [
                //   NInput({type: "text", ref: "key",   value: pending.key,   style: {flex: 1}),
                //   NInput({type: "text", ref: "value", value: pending.value, style: {flex: 1}),
                // ]),
              ],
            },
          ],
        }),
        el_response,
      ]));
    },
    push_history_entry(he) {
      update_response(he.response as database.GRPCResponse);
    },
  };
}

// <style lang="css" scoped>
// .n-tab-pane {
//   height: 100% !important;
// }
// </style>
