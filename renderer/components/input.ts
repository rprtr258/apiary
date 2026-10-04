import {m, DOMNode, setDisplay} from "../lib/utils.ts";
import {css} from "../lib/styles.ts";

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error", // TODO: highlight with red, method to update
  value?: string,
  on?: {
    update: (value: string) => void,
    keydown?: (e: KeyboardEvent) => void,
  },
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  autofocus?: boolean,
};
export function NInput(props: NInputProps) {
  const el = m("input", {
    style: props.style,
    value: props.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => props.on?.update((e.target as HTMLInputElement).value),
    onkeydown: props.on?.keydown,
    disabled: props.disabled,
  });

  if (props.autofocus ?? false) {
    queueMicrotask(() => el.focus());
  }

  return el;
}

export function NInputGroup(props: {style: Partial<CSSStyleDeclaration>}, ...children: DOMNode[]) {
  return m("div", props, children);
}

export type SelectOption<T> = {
  label: string,
  value?: T,
};
type NSelectProps<T> = {
  label?: string,
  options: SelectOption<T>[],
  placeholder?: string,
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  on: {update: (value: T) => void},
};
export function NSelect<T>(props: NSelectProps<T>): {el: HTMLElement, reset: () => void} {
  let current: number | null = props.options.findIndex(opt => opt.label === props.label);
  if (current === -1) {
    if (props.placeholder === undefined) {
      throw new Error(`Option ${props.label} not found in ${JSON.stringify(props.options)}`);
    }
    current = null;
  }

  const el_placeholder = m("option", {
    value: "",
    disabled: props.placeholder === undefined ? true : undefined,
    hidden: true,
    selected: current === null ? true : undefined,
  }, props.placeholder ?? "");
  const el_opts = props.options.map(({label, value}, i) => m("option", {
    value: String(i),
    selected: i === current ? true : undefined, // NOTE: any value makes selected, so we explicitly set undefined
    disabled: value === undefined ? true : undefined,
  }, label));

  const el = m("select", {
    style: props.style,
    onchange: (e: Event) => {
      const i = parseInt((e.target! as HTMLSelectElement).value);
      const value = props.options[i].value;
      if (current !== null) {
        el_opts[current].selected = false;
      }
      el_opts[i].selected = true;
      current = i;
      props.on.update(value!);
    },
  },
    el_placeholder,
    ...el_opts,
  );

  // Workaround for happy-dom bug: set selectedIndex after creating select
  if (current !== null) {
    el.selectedIndex = current + 1; // +1 for placeholder
  }

  return {
    el,
    reset() {
      if (current === null)
        return;

      el_opts[current].selected = false;
      el_placeholder.selected = true;
      current = null;
      el.selectedIndex = 0; // Select placeholder
    },
  };
}

type NSelectInputProps = {
  placeholder?: string,
  options: () => SelectOption<string>[], // label is shown to the user and used as input text, value is reported on update
  value?: string,
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  on?: {update: (value: string) => void},
};

const selectInputStyles = {
  popup: css(`
    position: fixed;
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    background: #2a2a2a;
    color: #ffffff;
    border: 1px solid #404040;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  `),
  item: css(`
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
  `),
  itemHighlighted: css(`
    background-color: #404040;
  `),
  itemDisabled: css(`
    color: #666666;
    cursor: not-allowed;
  `),
};

type SelectInputItem = {label: string, disabled: boolean};

let selectInputCounter = 0;
export function NSelectInput(props: NSelectInputProps): {el: HTMLDivElement} {
  const popupID = `nselect-input-popup-${selectInputCounter++}`;

  let byLabel = new Map<string, SelectOption<string>>();
  let byValue = new Map<string | undefined, SelectOption<string>>();
  let items: SelectInputItem[] = [];
  let highlighted = -1;
  let isOpen = false;

  const el_popup = m("div", {id: popupID, class: selectInputStyles.popup, role: "listbox", style: {display: "none"}});

  const select = (label: string): void => {
    el_input.value = label;
    props.on?.update(byLabel.get(label)?.value ?? label);
  };

  const render = (): void => {
    el_popup.replaceChildren(...items.map((item, i) => {
      const el_item = m("div", {
        class: [
          selectInputStyles.item,
          i === highlighted && !item.disabled ? selectInputStyles.itemHighlighted : "",
          item.disabled ? selectInputStyles.itemDisabled : "",
        ].filter(c => c !== "").join(" "),
        role: "option",
      }, item.label);
      if (item.disabled) {
        el_item.setAttribute("aria-disabled", "true");
      }
      if (!item.disabled) {
        el_item.addEventListener("mousedown", (e: MouseEvent) => {
          e.preventDefault(); // keep focus on input, so blur does not close the popup before selection
          select(item.label);
          close();
        });
        el_item.addEventListener("mouseover", () => {
          if (highlighted !== i) {
            highlighted = i;
            render();
          }
        });
      }
      return el_item;
    }));
  };

  const refresh = (filter: string): void => {
    const options = props.options();
    byLabel = new Map(options.map(option => [option.label, option]));
    byValue = new Map(options.map(option => [option.value, option]));
    const f = filter.toLowerCase();
    const filtered = options.filter(option => option.label.toLowerCase().includes(f));
    // "none" is an empty-state placeholder: shown (disabled, unpickable) only
    // when nothing matches - no options exist or the filter matches none.
    items = filtered.length === 0
      ? [{label: "none", disabled: true}]
      : filtered.map(option => ({label: option.label, disabled: false}));
    highlighted = items.findIndex(item => !item.disabled);
    render();
  };

  const onOutsidePointerDown = (e: PointerEvent): void => {
    if (e.target !== el_input && !el_popup.contains(e.target as Node)) {
      close();
    }
  };

  const onWindowScroll = (e: Event): void => {
    // A scroll inside the popup list itself must keep the popup open; only a
    // scroll elsewhere moves the input away from its fixed-position popup.
    if (!el_popup.contains(e.target as Node)) {
      close();
    }
  };

  const open = (): void => {
    if (isOpen) {
      return;
    }
    isOpen = true;
    el_input.setAttribute("aria-expanded", "true");
    const rect = el_input.getBoundingClientRect();
    el_popup.style.left = `${rect.left}px`;
    el_popup.style.top = `${rect.bottom}px`;
    el_popup.style.minWidth = `${rect.width}px`;
    el_popup.style.display = "";
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onWindowScroll, true);
  };

  const close = (): void => {
    if (!isOpen) {
      return;
    }
    isOpen = false;
    el_popup.style.display = "none";
    el_input.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    window.removeEventListener("resize", close);
    window.removeEventListener("scroll", onWindowScroll, true);
  };

  refresh("");

  const el_input = m("input", {
    style: props.style,
    value: props.value === undefined ? undefined : (byValue.get(props.value)?.label ?? props.value),
    placeholder: props.placeholder,
    disabled: props.disabled,
    onfocus: () => {
      refresh(el_input.value);
      open();
    },
    oninput: (e: Event) => {
      const label = (e.target as HTMLInputElement).value;
      props.on?.update(byLabel.get(label)?.value ?? label);
      if (isOpen) {
        refresh(label);
      }
    },
    onkeydown: (e: KeyboardEvent) => {switch (e.key) {
      case "ArrowDown": case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) {
          refresh(el_input.value);
          open();
          return;
        }
        const dir = e.key === "ArrowDown" ? 1 : -1;
        if (highlighted === -1) {
          highlighted = dir === 1 ? -1 : items.length; // wrap ends: down starts at 0, up at last item
        }
        for (let i = 0; i < items.length; i++) {
          highlighted = (highlighted + dir + items.length) % items.length;
          if (!items[highlighted].disabled) {
            break;
          }
        }
        if (items[highlighted].disabled) {
          highlighted = -1; // all items disabled
        }
        render();
        return;
      }
      case "Enter": {
        if (isOpen && highlighted >= 0 && !items[highlighted].disabled) {
          e.preventDefault();
          select(items[highlighted].label);
          close();
        }
        return;
      }
      case "Escape": {
        close();
        return;
      }
    }},
    onblur: close,
  });
  el_input.setAttribute("aria-expanded", "false");

  return {
    // NOTE: the wrapper generates no box (the input stays the NInputGroup grid item),
    // and the fixed-position popup is out of flow, so it does not become a grid item either.
    el: m("div", {style: {display: "contents"}}, el_input, el_popup),
  };
}

type NButtonProps = {
  primary?: boolean,
  disabled?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  on: {click: () => void | Promise<void>},
};

const btnStyles = {
  primary: css(`
    background-color: #0b74e0;
    color: white;
    border: 1px solid #0b74e0;
  `),
  loading: css(`
    opacity: 0.8;
    cursor: wait;
  `),
  disabled: css(`
    opacity: 0.6;
    cursor: not-allowed;
  `),
};

export function NButton(props: NButtonProps, ...children: DOMNode[]) {
  let disabled = props.disabled ?? false;
  let loading = false;

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      textWrapMode: "nowrap",
      ...props.style,
    },
    class: props.class,
    onclick: async (): Promise<void> => {
      if (disabled || loading) {
        return;
      }

      loading = true;
      update();
      try {
        await props.on.click();
      } finally {
        loading = false;
        update();
      }
  }}, el_clock, children);
  function update() {
    el.classList.toggle(btnStyles.loading, loading);
    el.classList.toggle(btnStyles.disabled, !loading && disabled);
    el.classList.toggle(btnStyles.primary, !loading && !disabled && (props.primary ?? false));

    setDisplay(el_clock, loading);
    el.disabled = disabled || loading;
  }
  update(); // initial update
  return {
    el,
    set loading(value: boolean) {
      loading = value;
      update();
    },
    set disabled(value: boolean) {
      disabled = value;
      update();
    },
  };
}
