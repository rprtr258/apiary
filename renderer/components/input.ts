import {some, none, option} from "@/option.ts";
import {m, DOMNode, setDisplay, arrayGet} from "../lib/utils.ts";
import {css} from "../lib/styles.ts";
import {useInput} from "../hooks/form/useInput.ts";
import {useSelect} from "../hooks/form/useSelect.ts";
import {useButton} from "../hooks/form/useButton.ts";

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error",
  value?: string,
  on?: {
    update: (value: string) => void,
    keydown?: (e: KeyboardEvent) => void,
  },
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  autofocus?: boolean,
};
const inputErrorClass = css("border-color: red; background-color: rgba(255, 0, 0, 0.1);");
const inputSuccessClass = css("border-color: green; background-color: rgba(0, 255, 0, 0.1);");

export function NInput(props: NInputProps) {
  const inputHook = useInput({
    initialValue: props.value,
    on: {
      change: props.on?.update,
    },
  });

  const el = m("input", {
    value: inputHook.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => inputHook.on.change((e.target as HTMLInputElement).value),
    onblur: () => inputHook.on.blur(),
    onfocus: () => inputHook.on.focus(),
    onkeydown: props.on?.keydown,
    disabled: props.disabled,
  });

  // Inline props.style (dynamic) is static per instance — apply once; status colors go through css classes.
  Object.assign(el.style, props.style);
  const restyle = (): void => {
    el.classList.toggle(inputErrorClass, inputHook.touched && props.status === "error");
    el.classList.toggle(inputSuccessClass, inputHook.touched && props.status === "success");
  };
  // Restyle on touched transitions (focus/blur) — value changes can't alter the style
  // (props.style/status are static); the subscription-time resume applies the initial styling.
  inputHook.touchedSignal.sub(function*() {
    while (true) {
      yield;
      restyle();
    }
  }());

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
  disabled?: boolean,
};
type NSelectProps<T> = {
  label?: string,
  options: SelectOption<T>[],
  placeholder?: string,
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  on: {update: (value: T) => void},
};
export function NSelect<T>(props: NSelectProps<T>): {el: HTMLElement, set: (value: T) => void, reset: () => void, setOptions: (options: SelectOption<T>[]) => void} {
  // Find initial value based on label; options without a value are disabled headers
  const selectable = props.options.filter(opt => opt.value !== undefined) as {label: string, value: T, disabled?: boolean}[];
  const initialValue = props.label !== undefined && props.label !== ""
    ? selectable.find(opt => opt.label === props.label)?.value
    : undefined;

  if (initialValue === undefined && props.placeholder === undefined) {
    throw new Error(`Option ${props.label} not found in ${JSON.stringify(props.options)}`);
  }

  const selectHook = useSelect({
    options: selectable,
    initialValue,
    placeholder: props.placeholder,
    on: {
      change: value => {
        if (value.isSome()) {
          props.on.update(value.value);
        }
      },
    },
  });

  const el_placeholder = m("option", {
    value: "",
    disabled: props.placeholder === undefined ? true : undefined,
    hidden: true,
    selected: selectHook.value.isNone() ? true : undefined,
  }, props.placeholder ?? "");
  const el_opts = props.options.map(({label, value, disabled}, i) => m("option", {
    value: String(i),
    selected: (selectHook.value.isSome() && selectHook.value.value === value) ? true : undefined, // NOTE: any value makes selected, so we explicitly set undefined
    disabled: (disabled ?? false) || value === undefined ? true : undefined,
  }, label));

  const el = m("select", {
    style: props.style,
    disabled: (props.disabled ?? false) ? true : undefined,
    onchange: (e: Event) => {
      const i = parseInt((e.target! as HTMLSelectElement).value);
      const value = arrayGet(props.options, i).flatMap(opt => opt.value === undefined ? none : some(opt.value));
      selectHook.on.change(value);
    },
  },
    el_placeholder,
    el_opts,
  );
  // Workaround for happy-dom bug: set selectedIndex after creating select
  if (selectHook.value.isSome()) {
    el.selectedIndex = props.options.findIndex(opt => opt.value === selectHook.value.unwrap()) + 1; // +1 for placeholder
  }

  return {
    el,
    set(value: T) {
      // Programmatic value sync (e.g. reverting the DOM after a failed persist):
      // updates the hook state too — a bare DOM selectedIndex write leaves the hook stale.
      const i = props.options.findIndex(opt => opt.value === value);
      if (i === -1) {
        throw new Error(`Option ${String(value)} not found in ${JSON.stringify(props.options)}`);
      }
      selectHook.setValue(option(value)); // silent: fires no props.on.update
      el.selectedIndex = i + 1; // +1 for placeholder
    },
    reset() {
      selectHook.clear(); // NOTE: back to placeholder state; reset() would restore initialValue while the DOM shows the placeholder
      el.selectedIndex = 0; // Select placeholder
    },
    setOptions(options: SelectOption<T>[]) {
      props.options = options;
      el.replaceChildren(el_placeholder, ...options.map(({label, value, disabled}, i) => m("option", {
        value: String(i),
        selected: (selectHook.value.isSome() && selectHook.value.value === value) ? true : undefined, // NOTE: any value makes selected, so we explicitly set undefined
        disabled: (disabled ?? false) || value === undefined ? true : undefined,
      }, label)));
      // Re-sync the visible selection: the current value may have arrived with the new options
      // (or vanished with them), mirroring the happy-dom selectedIndex workaround above.
      el.selectedIndex = selectHook.value.isSome()
        ? options.findIndex(opt => opt.value === selectHook.value.unwrap()) + 1 // +1 for placeholder
        : 0;
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
export function NSelectInput(props: NSelectInputProps): {el: HTMLDivElement, set: (value: string) => void} {
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
    window.addEventListener("scroll", close, true);
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
    window.removeEventListener("scroll", close, true);
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
    set(value: string): void {
      // Mirror creation semantics: show the option's label, or the raw value for free-text entries.
      el_input.value = byValue.get(value)?.label ?? value;
    },
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
  const buttonHook = useButton({
    on: props.on,
    disabled: props.disabled ?? false,
  });

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      textWrapMode: "nowrap",
      ...props.style,
    },
    onclick: () => buttonHook.on.click(),
    disabled: buttonHook.disabledSignal.value || buttonHook.loadingSignal.value ? true : undefined,
  }, el_clock, children);
  const update = (): void => {
    el.classList.remove(...el.classList);
    // Old NButton was a single state machine: disabled/loading buttons render as
    // such (gray/faded), primary styling only in the active state.
    const loading = buttonHook.loadingSignal.value;
    const disabled = buttonHook.disabledSignal.value;
    el.classList.toggle(btnStyles.primary, (props.primary ?? false) && !disabled && !loading);
    el.classList.toggle(btnStyles.disabled, disabled && !loading);
    el.classList.toggle(btnStyles.loading, loading);
    if (props.class !== undefined)
      el.classList.add(props.class);

    setDisplay(el_clock, buttonHook.loadingSignal.value);
    el.disabled = buttonHook.disabledSignal.value || buttonHook.loadingSignal.value;
  };
  buttonHook.disabledSignal.sub(function*() {
    while (true) {
      yield;
      update();
    }
  }());
  buttonHook.loadingSignal.sub(function*() {
    while (true) {
      yield;
      update();
    }
  }());
  return {
    el,
    set loading(value: boolean) {
      buttonHook.loading = value;
    },
    set disabled(value: boolean) {
      buttonHook.disabled = value;
    },
  };
}
