import {database} from "../../wailsjs/go/models.ts";
import {m} from "../utils.ts";
import {NIcon} from "./dataview.ts";
import {DeleteOutline} from "./icons.ts";

type Props = {
  value: database.KV[],
  on: {
    update: (value: database.KV[]) => void,
  },
};

const input_style = {
  padding: "4px 8px",
  border: "1px solid #ccc",
  "border-radius": "4px",
};

declare const is_id: unique symbol;
type ID = number & {[is_id]: true};

export default function(props: Props) {
  const {value} = props;
  const gen_id: () => ID = (() => {
    let internal_id = -1 as ID;
    return (): ID => {
      internal_id = internal_id + 1 as ID;
      return internal_id;
    };
  })();
  const ids = props.value.map(_ => gen_id());
  const new_el_row = (id: ID, kv: database.KV) => [
    m("input", {
      type: "text",
      placeholder: "Header",
      value: kv.key,
      oninput: (e: Event) => update_kv(id, "key", (e.target as HTMLInputElement).value),
      onblur: () => unfocus_kv(id),
      style: {...input_style, gridColumn: "1/2"},
    }),
    m("input", {
      type: "text",
      placeholder: "Value",
      value: kv.value,
      oninput: (e: Event) => update_kv(id, "value", (e.target as HTMLInputElement).value),
      onblur: () => unfocus_kv(id),
      style: {...input_style, gridColumn: "2/3"},
    }),
    m("button", {
      style: {
        gridColumn: "3/4",
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
        color: "#ff4444",
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
    m("input", {
      type: "text",
      placeholder: "New Header",
      value: "",
      oninput: (e: Event) => add_kv((e.target as HTMLInputElement).value, ""),
      style: input_style,
    }),
    m("input", {
      type: "text",
      placeholder: "New Value",
      value: "",
      oninput: (e: Event) => add_kv("", (e.target as HTMLInputElement).value),
      style: input_style,
    }),
  ];

  const update_kv = (id: ID, field: "key" | "value", new_value: string) => {
    const i = ids.findIndex(id2 => id2 === id);
    value[i][field] = new_value;

    props.on.update(value);
  };

  const el = m("div", {style: {
    padding: "4px 8px",
    "display": "grid",
    gridTemplateColumns: "48% 48% 4%",
    gridColumnGap: "2px",
    gridRowGap: "3px",
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
