import Split, {SplitInstance} from "split-grid";
import {DOMNode, m, setDisplay} from "../lib/utils.ts";
import NButton from "./button.ts";
import {css} from "../lib/styles.ts";

export function NScrollbar(...children: HTMLElement[]) {
  return m("div", {
    class: "h100",
    style: {
      overflowY: "auto",
      minHeight: "0",
    },
  }, children);
}

type NTabsProps = {
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  tabs: {
    name: DOMNode,
    style?: Partial<CSSStyleDeclaration>,
    class?: string,
    disabled?: boolean,
    elem?: DOMNode,
    onSelect?: () => void,
  }[],
};
// Inner tabs, styled after the outer layout tabs (renderer/layout/styles.ts) but tighter;
// keep the two visually consistent when the layout tabs change.
const tabsCls = {
  container: css({display: "flex", flexDirection: "column", width: "100%"}),
  header: css({display: "flex", flexDirection: "row", alignItems: "stretch", flex: "0 0 auto", overflow: "hidden", background: "var(--color-dark-7)", borderBottom: "1px solid var(--color-dark-4)", userSelect: "none"}),
  tab: [
    css({display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap", color: "var(--color-dimmed)", background: "none", border: "none", borderRight: "1px solid var(--color-dark-4)", font: "inherit"}),
    css.raw(":not(:disabled):hover{background:var(--color-dark-6); color:var(--color-text);}"),
    css.raw(":disabled{color:var(--color-disabled-color); cursor:default;}"),
  ],
  tabActive: css({background: "var(--color-body)", color: "var(--color-bright)", boxShadow: "inset 0 2px 0 var(--color-blue-6)"}),
  content: css({height: "100%", flexShrink: "1", minHeight: "0"}),
};
export function NTabs(props: NTabsProps): HTMLElement {
  const tab_buttons = props.tabs.map((tab, i) => m("button", {
    class: tabsCls.tab,
    disabled: tab.disabled,
    onclick: () => update(i),
  }, tab.name));
  const tabs = props.tabs.map(tab => m("div", {
    style: {
      ...tab.style,
      display: "none",
    },
    class: [tabsCls.content, tab.class ?? null],
  }, tab.elem ?? null));

  let tab_idx = -1;
  const update = (new_tab_idx: number): void => {
    if (tab_idx === new_tab_idx) {
      return;
    }
    if (props.tabs[new_tab_idx].disabled ?? false) {
      return;
    }
    if (new_tab_idx < 0 || new_tab_idx >= props.tabs.length) {
      throw new Error(`Tab ${new_tab_idx} not found in ${props.tabs.length} tabs`);
    }
    if (tab_idx >= 0) {
      tab_buttons[tab_idx].classList.remove(tabsCls.tabActive);
      tabs[tab_idx].style.display = "none";
    }
    tab_buttons[new_tab_idx].classList.add(tabsCls.tabActive);
    tabs[new_tab_idx].style.display = props.tabs[new_tab_idx].style?.display ?? "block";
    tab_idx = new_tab_idx;
    props.tabs[new_tab_idx].onSelect?.();
  };
  { // init
    const firstEnabledIndex = props.tabs.findIndex(v => !(v.disabled ?? false));
    if (firstEnabledIndex >= 0)
      update(firstEnabledIndex);
  }

  return m("div", {class: ["h100", tabsCls.container, props.class ?? null], style: props.style},
    m("div", {class: tabsCls.header}, tab_buttons),
    tabs,
  );
}

type NSplitProps = {
  direction?: "horizontal" | "vertical",
  sizes?: readonly [string, string],
  gutterSize?: number,
  style?: Partial<CSSStyleDeclaration>,
  snap?: number,
};
const s = css.raw(`:hover {background-color: mediumblue;}`);
export function NSplit(left: HTMLElement, right: HTMLElement, props: NSplitProps) {
  const {
    direction = "vertical",
    sizes: actualSizes = ["1fr", "1fr"],
    gutterSize = 5,
    snap: snapOffset = 50,
  } = props;

  const templateProp = direction === "horizontal" ? "gridTemplateColumns" : "gridTemplateRows";
  const template = actualSizes.join(` ${gutterSize}px `);
  const style: Partial<CSSStyleDeclaration> = {
    ...props.style,
    display: "grid",
    [templateProp]: template,
  };

  left.style.minWidth = "0";
  left.style.minHeight = "0";
  right.style.minWidth = "0";
  right.style.minHeight = "0";

  const el_line = m("hr", {
    class: s,
    style: {
      cursor: direction === "horizontal" ? "col-resize" : "row-resize",
      border: "none",
      margin: "0", // keep the gutter inside its grid gap regardless of any stylesheet styling `hr`
      width: direction === "horizontal" ? `${gutterSize}px` : "100%",
      height: direction === "vertical" ? `${gutterSize}px` : "100%",
    },
  });

  const el = m("div", {class: "h100", style}, [left, el_line, right]);

  const split_option_key = direction === "horizontal" ? "columnGutters" : "rowGutters";
  const splitInstance: SplitInstance = Split({
    [split_option_key]: [{track: 1, element: el_line, minSize: 0}],
    snapOffset,
  });

  let leftVisible = true;
  let rightVisible = true;

  const key = direction === "horizontal" ? "gridColumn" : "gridRow";
  const updateVisibility = () => {
    if (!leftVisible && !rightVisible) {
      throw new Error("Cannot hide both sides of NSplit");
    }

    if (leftVisible && rightVisible) {
      setDisplay(left, true);
      setDisplay(right, true);
      setDisplay(el_line, true);
      left.style[key] = "";
      right.style[key] = "";
    } else {
      setDisplay(left, leftVisible);
      setDisplay(right, rightVisible);
      setDisplay(el_line, false);
      const [el_fill, el_empty] = leftVisible ? [left, right] : [right, left];
      el_fill.style[key] = "1 / -1";
      el_empty.style[key] = "";
    }
  };

  return {
    element: el,
    set leftVisible(value: boolean) {
      leftVisible = value;
      updateVisibility();
    },
    set rightVisible(value: boolean) {
      rightVisible = value;
      updateVisibility();
    },
    unmount() {
      splitInstance.destroy();
    },
  };
}

type NModalProps = {
  title: string,
  text: {
    positive: string,
    negative: string,
  },
  on: {
    positive_click: () => void,
    negative_click: () => void,
    show?: () => void,
    close: () => void,
  },
};
export function NModal({title, text, on}: NModalProps, ...children: DOMNode[]) {
  const modal = Modal({
    title,
    children,
    buttons: [
      {id: "positive", text: text.positive},
      {id: "negative", text: text.negative},
    ],
    on: {close: (id?: "positive" | "negative") => {
      if (id === undefined)
        return on.close();

      switch (id) {
        case "positive": on.positive_click(); break;
        case "negative": on.negative_click(); break;
      }
      modal.display = false;
    }, show: on.show},
  });
  return modal;
};

const style_overlay = {
  placeSelf: "center",
  position: "fixed",
  zIndex: "100",
  height: "100vh",
  width: "100vw",
  left: "0",
  top: "0",
  alignContent: "center",
  justifyItems: "center",
  backdropFilter: "blur(3px)",
};
const style_modal = {
  backgroundColor: "var(--color-default)",
  boxShadow: "var(--shadow-lg)",
  borderRadius: "var(--radius-md)",
  width: "40%",
  height: "20%",
  padding: "1em",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

type ModalProps = {
  title: DOMNode,
  children: DOMNode[],
  buttons: {id: string, text: string}[],
  on: {
    close(id?: string): void,
    show?: () => void,
  },
};

// TODO: use https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
export function Modal(
  {title, children: content, buttons, on}: ModalProps,
  children: DOMNode[] = [],
) {
  let show = false; // TODO: signal as in dropdown
  const el_modal = m("div", {style: style_modal},
    m("h3", {}, title),
    m("div", {}, content),
    m("div",
      {style: {display: "flex", justifyContent: "space-around"}},
      buttons.map(b =>
        NButton({
          style: {padding: "0.5em 1em"},
          on: {click: () => on.close(b.id)},
        }, b.text).el,
      ),
    ),
    ...children,
  );
  const element = m("div", {
    style: style_overlay,
    onclick: e => {
      // clicking on overlay outside of modal, hides everything
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      if (el_modal.contains(elementAtPoint))
        return;
      on.close();
    },
  }, el_modal);
  setDisplay(element, false); // hide initially; show flag starts false, keep DOM in sync
  return {
    element,
    get display(): boolean {
      return show;
    },
    set display(v: boolean) {
      if (show === v)
        return;
      if (v) {
        setDisplay(element, true);
        // Defer to ensure the modal is rendered before calling on.show
        queueMicrotask(() => on.show?.());
      } else {
        on.close();
        setDisplay(element, false);
      }
      show = v;
    },
  };
}
