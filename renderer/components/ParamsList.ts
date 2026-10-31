import * as t from "@/types.ts";
import {m} from "../lib/utils.ts";
import {css} from "../lib/styles.ts";
import {NIcon} from "./dataview.ts";
import {NInput} from "./input.ts";
import {DeleteOutline} from "./icons.ts";

declare const is_id: unique symbol;
type ID = number & {[is_id]: true};

// Inputs render collapsed: no gaps, a single shared 1px border between
// neighbours, square inner corners; only the block's four outer corners
// keep the input rounding. Rows are sized 1px shorter than the inputs so
// each input's top border covers the row above's bottom border, value
// inputs pull 1px over the key input's right border, and the focused
// input is raised so its full border isn't hidden under the overlap (same
// trick as NInputGroup).
const listClass = [
  css.raw(" > input{border-radius:0;}"),
  css.raw(" > input:focus{position:relative; z-index:1;}"),
  css.raw(" > input:nth-child(1){border-start-start-radius:var(--input-radius);}"),
  css.raw(" > input:nth-child(2){border-start-end-radius:var(--input-radius);}"),
  css.raw(" > input:nth-last-child(2){border-end-start-radius:var(--input-radius);}"),
  css.raw(" > input:nth-last-child(1){border-end-end-radius:var(--input-radius);}"),
].join(" ");

export default function(props: {
  value: t.KV[],
  on: {
    update: (value: t.KV[]) => void,
  },
}) {
  const {value} = props;
  const gen_id: () => ID = (() => {
    let internal_id = -1 as ID;
    return (): ID => {
      internal_id = internal_id + 1 as ID;
      return internal_id;
    };
  })();
  const ids = props.value.map(_ => gen_id());
  const new_el_row = (id: ID, kv: t.KV) => [
    NInput({
      placeholder: "Header",
      value: kv.key,
      on: {
        update: v => update_kv(id, "key", v),
        blur: () => unfocus_kv(id),
      },
      style: {gridColumn: "1/2"},
    }),
    NInput({
      placeholder: "Value",
      value: kv.value,
      on: {
        update: v => update_kv(id, "value", v),
        blur: () => unfocus_kv(id),
      },
      style: {gridColumn: "2/3", marginLeft: "-1px"},
    }),
    m("button", {
      style: {
        gridColumn: "3/4",
        margin: "2px 0 2px 2px",
        padding: "4px 8px",
        border: "none",
        backgroundColor: "oklch(0.5 0.1 27)",
        borderRadius: "4px",
        cursor: "pointer",
      },
      onclick: () => delete_kv(id),
    },
      NIcon({
        component: DeleteOutline,
        color: "var(--color-red-6)",
      }),
    ),
  ];
  const el_rows = value.map((kv, i) => {
    const id = ids[i];
    return new_el_row(id, kv);
  });

  const add_kv = (k: string, v: string): void => {
    const id = gen_id();
    ids.push(id);
    const kv = {key: k, value: v};
    value.push(kv);
    const el_row = new_el_row(id, kv);
    el_rows.push(el_row);
    for (const el_child of el_row)
      el.insertBefore(el_child, el_empty[0]);

    if (k !== "") {
      el_empty[0].value = "";
      el_row[0].focus();
      (el_row[0] as HTMLInputElement).selectionStart = el_row[0].value.length;
    } else {
      el_empty[1].value = "";
      el_row[1].focus();
      (el_row[1] as HTMLInputElement).selectionStart = el_row[1].value.length;
    }

    props.on.update(value);
  };

  const el_empty = [
    NInput({
      placeholder: "New Header",
      value: "",
      on: {update: v => add_kv(v, "")},
    }),
    NInput({
      placeholder: "New Value",
      value: "",
      on: {update: v => add_kv("", v)},
      style: {marginLeft: "-1px"},
    }),
  ];

  const update_kv = (id: ID, field: "key" | "value", new_value: string) => {
    const i = ids.findIndex(id2 => id2 === id);
    value[i][field] = new_value;

    props.on.update(value);
  };

  const el = m("div", {class: listClass, style: {
    padding: "4px 8px",
    "display": "grid",
    gridTemplateColumns: "48% 48% 4%",
    gridAutoRows: "calc(var(--input-height) - 1px)",
  }}, [...el_rows, el_empty]);

  const delete_kv = (id: ID) => {
    const i = ids.findIndex(id2 => id2 === id);
    ids.splice(i, 1);
    value.splice(i, 1);
    for (const el_child of el_rows[i])
      el.removeChild(el_child);
    el_rows.splice(i, 1);

    props.on.update(value);
  };
  const unfocus_kv = (id: ID): void => {
    const i = ids.findIndex(id2 => id2 === id);
    const kv = value[i];
    if (kv.key !== "" || kv.value !== "") {
      return;
    }
    delete_kv(id);
  };

  return el;
};
