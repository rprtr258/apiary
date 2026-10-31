import {m} from "../lib/utils.ts";
import {css, Size} from "../lib/styles.ts";
import {inputBase, sizeStyle} from "./input.ts";

export type SelectOption<T> = {
  label: string,
  value?: T,
  disabled?: boolean,
};

// Native select keeps its popup but gets the Select chrome: surface from
// inputBase plus the dimmed chevron as a background image (appearance:none
// removes the UA arrow).
const selectBase = [
  inputBase,
  css.raw(":not(:disabled){cursor:pointer; padding-right:calc(var(--input-height) - 2px); background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23828282' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\"); background-repeat:no-repeat; background-position:right calc((var(--input-height) - 18px) / 2) center; background-size:16px;}"),
].join(" ");

export function NSelect<T>(props: {
  label?: string,
  options: SelectOption<T>[],
  placeholder?: string,
  size?: Size,
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  on: {update: (value: T) => void},
}): {
  el: HTMLSelectElement,
  reset: () => void,
  set: (value: T) => void,
  setOptions: (options: SelectOption<T>[]) => void,
} {
  let current: T | undefined = props.label === undefined || props.label === "" ?
    undefined :
    props.options.find(opt => opt.label === props.label && opt.value !== undefined)?.value;
  if (props.label !== undefined && props.label !== "" && current === undefined && props.placeholder === undefined) {
    throw new Error(`Option ${props.label} not found in ${JSON.stringify(props.options)}`);
  }

  const el_placeholder = m("option", {
    value: "",
    disabled: props.placeholder === undefined ? true : undefined,
    hidden: true,
  }, props.placeholder ?? "");

  function selectedIndex(options: SelectOption<T>[]): number {
    if (current === undefined)
      return 0; // 0 = placeholder
    return options.findIndex(opt => opt.value === current) + 1; // +1 for it
  }

  // NOTE: any value makes selected, so we explicitly set undefined
  const renderOptions = (options: SelectOption<T>[]): HTMLOptionElement[] => options.map(({label, value, disabled}, i) => m("option", {
    value: String(i),
    selected: current !== undefined && current === value ? true : undefined,
    disabled: (disabled ?? false) || value === undefined ? true : undefined,
  }, label));
  let el_opts = renderOptions(props.options);
  const el = m("select", {
    class: selectBase,
    style: {...sizeStyle(props.size), ...props.style},
    // m() maps props to attributes, and in HTML presence of "disabled" disables
    // regardless of value - so a false must become undefined (attribute omitted).
    disabled: props.disabled === true ? true : undefined,
    onchange: (e: Event) => {
      const i = parseInt((e.target! as HTMLSelectElement).value);
      el_opts[i].selected = true;
      const value = props.options[i]?.value;
      if (value === undefined) {
        return; // header (no value) or placeholder: no selection
      }
      current = value;
      props.on.update(value);
    },
  },
    el_placeholder,
    ...el_opts,
  );

  // Workaround for happy-dom bug: set selectedIndex after creating select
  el.selectedIndex = selectedIndex(props.options);

  return {
    el,
    set: (value: T): void => {
      // Programmatic value sync (e.g. reverting the DOM after a failed persist): silent, fires no props.on.update.
      const i = props.options.findIndex(opt => opt.value === value);
      if (i === -1) {
        throw new Error(`Option ${String(value)} not found in ${JSON.stringify(props.options)}`);
      }
      current = value;
      el.selectedIndex = i + 1; // +1 for placeholder
    },
    reset() {
      current = undefined;
      el.selectedIndex = 0; // Select placeholder
    },
    setOptions: (options: SelectOption<T>[]): void => {
      props.options = options;
      if (current !== undefined && !options.some(opt => opt.value === current)) {
        current = undefined; // the selected value is gone with the old options: back to the placeholder
      }
      el_opts = renderOptions(options);
      el.replaceChildren(el_placeholder, ...el_opts);
      // Re-sync the visible selection: the current value may have arrived with the new
      // options (or vanished with them), mirroring the happy-dom workaround above.
      el.selectedIndex = selectedIndex(options);
    },
  };
}

const selectInputStyles = {
  popup: css(`
    position: fixed;
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    background: var(--color-default);
    color: var(--color-bright);
    border: 1px solid var(--color-default-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
  `),
  item: css(`
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
  `),
  itemHighlighted: css(`
    background-color: var(--color-dark-5);
  `),
  itemDisabled: css(`
    color: var(--color-disabled-color);
    cursor: not-allowed;
  `),
};

type SelectInputItem = {label: string, disabled: boolean};

let selectInputCounter = 0;
export function NSelectInput(props: {
  placeholder?: string,
  options: () => SelectOption<string>[], // label is shown to the user and used as input text, value is reported on update
  value?: string,
  size?: Size,
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  on?: {update: (value: string) => void},
}): {
  el: HTMLDivElement,
  set: (value: string) => void,
} {
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
    class: inputBase,
    style: {...sizeStyle(props.size), ...props.style},
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
      // Programmatic value sync (e.g. reverting the DOM after a failed persist): shows the
      // option's label for the value, silent (fires no props.on.update).
      el_input.value = byValue.get(value)?.label ?? value;
    },
  };
}
