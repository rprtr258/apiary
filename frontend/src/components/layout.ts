import Split, {SplitInstance} from "split-grid";
import {DOMNode, m, setDisplay} from "../utils.ts";
import {NButton} from "./input.ts";

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
  }[],
};
export function NTabs(props: NTabsProps): HTMLElement {
  const tab_buttons = props.tabs.map((tab, i) => m("button", {
    disabled: tab.disabled,
    style: (tab.disabled ?? false) ? tabStyles.tab.disabled : tabStyles.tab.inactive,
    onclick: () => update(i),
  }, tab.name));
  const tabs = props.tabs.map(tab => m("div", {
    style: {
      height: "100%",
      ...tabStyles.content,
      ...tab.style,
      display: "none",
    },
    class: tab.class,
  }, tab.elem ?? null));

  let tab_idx = -1;
  const update = (new_tab_idx: number): void => {
    if (tab_idx == new_tab_idx) {
      return;
    }
    if (props.tabs[new_tab_idx].disabled ?? false) {
      return;
    }
    if (new_tab_idx < 0 || new_tab_idx >= props.tabs.length) {
      throw new Error(`Tab ${new_tab_idx} not found in ${props.tabs.length} tabs`);
    }
    if (tab_idx >= 0) {
      Object.assign(tab_buttons[tab_idx].style, tabStyles.tab.inactive); // TODO: classes
      tabs[tab_idx].style.display = "none";
    }
    Object.assign(tab_buttons[new_tab_idx].style, tabStyles.tab.active); // TODO: classes
    tabs[new_tab_idx].style.display = props.tabs[new_tab_idx].style?.display ?? "block";
    tab_idx = new_tab_idx;
  };
  { // init
    const firstEnabledIndex = props.tabs.findIndex(v => !(v.disabled ?? false));
    if (firstEnabledIndex >= 0)
      update(firstEnabledIndex);
  }

  return m("div", {class: "h100" + " " + (props.class ?? ""), style: {...tabStyles.container, ...props.style}},
    m("div", {style: tabStyles.header}, tab_buttons),
    tabs,
  );
}

const tabStylesBase = {
  // padding: "4px 5px",
  // cursor: "pointer",
  // border: "1px solid transparent",
  // borderBottom: "none",
  // borderRadius: "3px 3px 0 0",
  // position: "relative",
};

const tabStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  header: {
    // display: "flex",
    // borderBottom: "1px solid #303030",
  },
  tab: {
    disabled: {
      ...tabStylesBase,
      // background: "gray",
      // fontWeight: "italic",
    },
    inactive: {
      ...tabStylesBase,
      // background: "#7068ab",
      // borderColor: "#454566",
    },
    active: {
      ...tabStylesBase,
      // background: "#ddd3f5",
      // borderColor: "#656596",
      // borderBottom: "3px solid white",
      // fontWeight: "bold",
    },
  },
  content: {
    flexShrink: "1",
    minHeight: "0",
    // padding: "2px",
  },
};

type NSplitProps = {
  direction?: "horizontal" | "vertical",
  sizes?: readonly [string, string],
  gutterSize?: number,
  style?: Partial<CSSStyleDeclaration>,
};
export function NSplit(left: HTMLElement, right: HTMLElement, props: NSplitProps) {
  const {direction = "vertical", sizes: actualSizes = ["1fr", "1fr"], gutterSize = 5} = props;

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
    style: {
      cursor: direction === "horizontal" ? "col-resize" : "row-resize",
      border: "none",
      backgroundColor: "white",
      width: direction === "horizontal" ? `${gutterSize}px` : "100%",
      height: direction === "vertical" ? `${gutterSize}px` : "100%",
    },
  });

  const el = m("div", {class: "h100", style}, [left, el_line, right]);

  const split_option_key = direction === "horizontal" ? "columnGutters" : "rowGutters";
  const splitInstance: SplitInstance = Split({
    [split_option_key]: [{track: 1, element: el_line, minSize: 0}],
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
      splitInstance?.destroy?.();
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
      modal.hide();
    }},
  });
  return {
    element: modal.element,
    show(): void {
      modal.show();
    },
    hide(): void {
      modal.hide();
    },
  };
};

type ModalProps = {
  title: DOMNode,
  children: DOMNode[],
  buttons: {id: string, text: string}[],
  on: {
    close(id?: string): void,
  },
};
// TODO: use https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
export function Modal(
  {title, children: content, buttons, on}: ModalProps,
  children: DOMNode[] = [],
) {
  const overlayStyle = {
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
  const modalStyle = {
    backgroundColor: "#444444",
    width: "40%",
    height: "20%",
    padding: "1em",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };
  const el_modal = m("div", {style: modalStyle},
    m("h3", {}, title),
    m("div", {}, content),
    m("div",
      {style: {display: "flex", justifyContent: "space-around"}},
      buttons.map(b =>
        NButton({
          style: {padding: "0.5em 1em"},
          on: {click: () => on.close(b.id)},
        }, b.text),
      ),
    ),
    ...children,
  );
  const element = m("div", {
    style: overlayStyle,
    onclick: e => {
      // clicking on overlay outside of modal, hides everything
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      if (el_modal.contains(elementAtPoint))
        return;
      on.close();
    },
  }, el_modal);
  return {
    element,
    show() {
      setDisplay(element, true);
    },
    hide() {
      on.close();
      setDisplay(element, false);
    },
  };
}
