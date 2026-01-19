import Split, {SplitInstance} from "split-grid";
import {DOMNode, m, setDisplay} from "../utils.ts";
import {css} from "../styles.ts";
import {ETabs, EModal} from "./design-system.ts";
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
  return ETabs({
    tabs: props.tabs.map(tab => ({
      name: tab.name,
      disabled: tab.disabled,
      content: tab.elem ?? null,
    })),
    class: `h100 ${props.class ?? ""}`,
    style: props.style,
  });
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
  const modal = EModal({
    title,
    children,
    buttons: [
      {id: "positive", text: text.positive, variant: "primary"},
      {id: "negative", text: text.negative, variant: "secondary"},
    ],
    on: {close: (id?: string) => {
      if (id === undefined) {
        on.close();
        modal.hide();
        return;
      }

      switch (id) {
        case "positive": on.positive_click(); break;
        case "negative": on.negative_click(); break;
      }
      modal.hide();
    }, show: on.show},
    size: "md",
    showCloseButton: false,
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
    show?: () => void,
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
        }, b.text).el,
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
      // Defer to ensure the modal is rendered before calling on.show
      queueMicrotask(() => on.show?.());
    },
    hide() {
      on.close();
      setDisplay(element, false);
    },
  };
  return EModal({
    title,
    children: [...content, ...children],
    buttons: buttons.map(button => ({
      id: button.id,
      text: button.text,
      variant: button.id === "positive" ? "primary" : "secondary",
    })),
    on,
    size: "md",
    showCloseButton: false,
  });
}
