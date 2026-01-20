import Split, {SplitInstance} from "split-grid";
import {DOMNode, m, setDisplay} from "../utils.ts";
import {NButton} from "./input.ts";
import {css} from "../styles.ts";
import {useTabs} from "../hooks/useTabs.ts";

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
  initialTab?: number,
  onTabChange?: (index: number) => void,
};

/**
 * NTabs component using headless useTabs hook
 * Separates tab logic from UI rendering
 */
export function NTabs(props: NTabsProps): HTMLElement {
  // Convert tab config to useTabs format
  const tabConfigs = props.tabs.map((tab, index) => ({
    id: index,
    label: typeof tab.name === "string" ? tab.name : `Tab ${index + 1}`,
    disabled: tab.disabled ?? false,
  }));

  // Use the headless hook for tab logic
  const {activeTabIndex, setActiveTabByIndex, isTabDisabled} = useTabs({
    tabs: tabConfigs,
    initialTab: props.initialTab,
    on: {tabChange: index => {
      props.onTabChange?.(index);
    }},
  });

  // Create container
  const container = m("div", {
    class: "h100" + " " + (props.class ?? ""),
    style: {...tabStyles.container, ...props.style},
  });

  // Create header for tab buttons
  const header = m("div", {style: tabStyles.header});
  container.appendChild(header);

  // Create content container for tabs
  const contentContainer = m("div", {style: {flexGrow: "1", position: "relative"}});
  container.appendChild(contentContainer);

  // Store references to tab elements
  const tabButtons: HTMLElement[] = [];
  const tabContents: HTMLElement[] = [];

  // Function to update tab appearance based on active tab
  const updateTabs = (activeIndex: number): void => {
    for (const [i, button] of tabButtons.entries()) {
      const isActive = i === activeIndex;
      const isDisabled = isTabDisabled(i);

      // Update button style
      const buttonStyle = isDisabled
        ? tabStyles.tab.disabled
        : isActive
          ? tabStyles.tab.active
          : tabStyles.tab.inactive;

      Object.assign(button.style, buttonStyle);
    }

    for (const [i, content] of tabContents.entries()) {
      const isActive = i === activeIndex;
      // Update content visibility
      content.style.display = isActive ? (props.tabs[i].style?.display ?? "block") : "none";
    }
  };

  // Create tab buttons and content
  for (const [i, tab] of props.tabs.entries()) {
    // Create tab button
    const button = m("button", {
      disabled: isTabDisabled(i) ? true : undefined,
      style: tabStyles.tab.inactive,
      onclick: () => {
        if (!isTabDisabled(i)) {
          setActiveTabByIndex(i);
          updateTabs(i);
        }
      },
    }, tab.name);
    tabButtons.push(button);
    header.appendChild(button);

    // Create tab content
    const content = m("div", {
      style: {
        height: "100%",
        ...tabStyles.content,
        ...tab.style,
        display: "none", // Initially hidden
        position: "absolute",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
      },
      class: tab.class,
    }, tab.elem ?? null);
    tabContents.push(content);
    contentContainer.appendChild(content);
  }

  // Initial update
  updateTabs(activeTabIndex.value);

  return container;
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
    display: "flex",
    gap: "0.5em",
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
    },
    hide() {
      on.close();
      setDisplay(element, false);
    },
  };
}
