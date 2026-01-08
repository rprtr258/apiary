import {DOMNode, m} from "../utils.ts";

export function NScrollbar(...children: HTMLElement[]) {
  return m("div", {
    style: {
      overflowY: "auto",
    },
  }, children);
}

type NTabsProps = {
  type: "card" | "line",
  size: "small",
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

  return m("div", {
    class: props.class,
    style: props.style,
  },
    m("div", {class: "h100", style: tabStyles.container},
      m("div", {style: tabStyles.header}, tab_buttons),
      tabs,
    ),
  );
}

const tabStyles = (() => {
  const base = {
      // padding: "4px 5px",
      // cursor: "pointer",
      // border: "1px solid transparent",
      // borderBottom: "none",
      // borderRadius: "3px 3px 0 0",
      // position: "relative",
  };

  return {
    container: {
      // fontFamily: "Arial, sans-serif",
      // display: "grid",
      // gridTemplateRows: "1.8em 1fr",
    },
    header: {
      // display: "flex",
      // borderBottom: "1px solid #303030",
    },
    tab: {
      disabled: {
        ...base,
        // background: "gray",
        // fontWeight: "italic",
      },
      inactive: {
        ...base,
        // background: "#7068ab",
        // borderColor: "#454566",
      },
      active: {
        ...base,
        // background: "#ddd3f5",
        // borderColor: "#656596",
        // borderBottom: "3px solid white",
        // fontWeight: "bold",
      },
    },
    content: {
      // padding: "2px",
    },
  };
})();

export function NSpace(props: Record<string, unknown>, children: DOMNode[]) {
  return m("div", props, children);
};

function Overlay(props: {on: {close: () => void}}, child: HTMLElement) {
  const dom = m("div", {
    class: "overlay",
    style: {
      placeSelf: "center",
      position: "fixed",
      zIndex: "100",
      height: "100%",
      width: "100%",
      alignContent: "center",
      justifyItems: "center",
      backdropFilter: "blur(3px)",
    },
    onclick: props.on.close,
  }, child);
  document.body.appendChild(dom);
  return dom;
};
type NModalProps = {
  show: boolean,
  preset: "dialog",
  title: string,
  text: {
    positive: string,
    negative: string,
  },
  on: {
    positive_click: () => void,
    negative_click: () => void,
    close: () => void, // TODO: call on close/outer click
  },
};
export function NModal(props: NModalProps, ...children: DOMNode[]) {
  // return m("dialog", vnode.children);
  return Modal({
    show: props.show,
    title: props.title,
    content: children,
    buttons: [
      {id: "positive", text: props.text.positive},
      {id: "negative", text: props.text.negative},
    ],
    on: {close: (id: "positive" | "negative") => {
      switch (id) {
        case "positive":
          props.on.positive_click();
          break;
        case "negative":
          props.on.negative_click();
          break;
        default:
          // TODO: never called, see not on on.close prop
          props.on.close();
          break;
      }
    }},
  });
};
type ModalProps = {
  show: boolean,
  title: DOMNode,
  content: DOMNode[],
  buttons: {id: string, text: string}[],
  on: {
    close(id: string): void,
  },
};
export function Modal(
  {show, title, content, buttons, on}: ModalProps,
  children: DOMNode[] = [],
) {
  let clickedId: string | null = null;

  if (!show || clickedId != null) {
    // We need to allow the Overlay component execute its
    // exit animation. Because it is a child of this component,
    // it will not fire when this component is removed.
    // Instead, we need to remove it first before this component
    // goes away.
    // When a button is clicked, we omit the Overlay component
    // from this Modal component's next view render, which will
    // trigger Overlay's onbeforeremove hook.
    return null;
  }
  return Overlay(
  {
    on: {close: () => {
      if (clickedId !== null)
        on.close(clickedId);
      // m.redraw();
    }},
  },
    m("div", {
      class: "modal",
      style: {
        backgroundColor: "#646464",
        width: "20%",
        height: "20%",
        padding: "1em",
      },
    },
      m("h3", {}, title),
      m("div", {class: "modal-content"}, content),
      m("div",
        {class: "modal-buttons"},
        buttons.map(b =>
          m("button", {
            type: "button",
            disabled: clickedId != null,
            onclick() {
              clickedId = b.id;
            },
          }, b.text),
        ),
      ),
      ...children,
    ),
  );
}
