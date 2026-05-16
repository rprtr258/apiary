import {m, DOMNode, setDisplay, clone} from "../utils.ts";
import {css} from "../styles.ts";
import {KeyESC, KeyDown, KeyUp, KeyEnter} from "./icons.ts";

export const styles = {
  overlay: css(`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    justify-content: left;
    align-items: center;
    padding-top: 2vh;
  `),
  modal: css(`
    width: 600px;
    max-width: 90vw;
    max-height: 90%;
    background-color: #2a2a2a;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  `),
  header: css(`
    display: flex;
    border: 1px solid #7068ab;
  `),
  input: css(`
    width: 100%;
    padding: 12px 16px;
    background-color: #1a1a1a;
    border: none;
    border-radius: 4px;
    color: #ffffff;
    font-size: 14px;
    outline: none;
  `),
  body: css(`
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  `),
  item: css(`
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    &:hover {
      background-color: #353535;
    }
  `),
  itemSelected: css(`
    background-color: #404040;
  `),
  itemContent: css(`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    overflow: clip;
    white-space: nowrap;
  `),
  itemLabel: css(`
    color: #ffffff;
    font-size: 14px;
    flex-grow: 1;
  `),
  itemShortcut: css(`
    display: flex;
    align-items: center;
    gap: 2px;
  `),
  shortcutSeparator: css(`
    color: #888888;
    font-size: 12px;
  `),
  shortcutKey: css(`
    padding: 2px 6px;
    background-color: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 3px;
    color: #cccccc;
    font-size: 11px;
    font-family: monospace;
  `),
  footer: css(`
    padding: 12px 16px;
    display: flex;
    justify-content: center;
    gap: 24px;
    background-color: #1f1f1f;
  `),
  footerItem: css(`
    display: flex;
    align-items: center;
    gap: 6px;
  `),
  footerKey: css(`
    padding: 2px 6px;
    background-color: #2a2a2a;
    border: 1px solid #404040;
    border-radius: 3px;
    color: #cccccc;
    font-size: 11px;
    font-family: monospace;
  `),
  footerLabel: css(`
    color: #888888;
    font-size: 12px;
  `),
};

export type Item = {
  label: string,
  shortcut?: string[],
  group?: string,
  prefix?: DOMNode,
  perform: () => void,
};

type ItemProps = {
  item: Item,
  on: {select?: () => void},
};

type ItemComponent = ReturnType<typeof Item>;

function Item({item, on}: ItemProps) {
  const el = m("div", {
    class: styles.item,
    tabIndex: 0,
    onclick: on.select,
  },
    m("div", {class: styles.itemContent},
      // prefix
      item.prefix !== undefined ? item.prefix : item.group !== undefined ? item.group+":" : null,
      // label
      m("div", {class: styles.itemLabel}, item.label),
      // postfix
      (item.shortcut ?? []).length > 0 ?
        m("div", {class: styles.itemShortcut},
          item.shortcut!.flatMap((key, i) => [
            i > 0 ?  m("span", {class: styles.shortcutSeparator}, "+") : null,
            m("kbd", {class: styles.shortcutKey}, key),
          ]),
        ) : null,
      ),
  );
  return {
    el,
    set selected(value: boolean) {
      el.classList.toggle(styles.itemSelected, value);
    },
  };
}

const styleEmpty = css(`
  padding: 32px;
  text-align: center;
  color: #888888;
  font-style: italic;
`);

function Empty() {
  return m("div", {class: styleEmpty}, "No results found.");
}

export function Footer() {
  return m("div", {class: styles.footer},
    m("div", {class: styles.footerItem},
      m("kbd", {class: styles.footerKey}, clone(KeyEnter)),
      m("span", {class: styles.footerLabel}, "to select"),
    ),
    m("div", {class: styles.footerItem},
      m("kbd", {class: styles.footerKey}, clone(KeyDown)),
      m("kbd", {class: styles.footerKey}, clone(KeyUp)),
      m("span", {class: styles.footerLabel}, "to navigate"),
    ),
    m("div", {class: styles.footerItem},
      m("kbd", {class: styles.footerKey}, clone(KeyESC)),
      m("span", {class: styles.footerLabel}, "to close"),
    ),
  );
}

type Props = {
  placeholder?: string,
  items: () => Item[],
  on: {
    close: () => void,
  },
};

export function CommandPalette(props: Props) {
  let searchValue = "";
  let selectedIndex = 0;

  let items: Item[] = [];
  let filteredIndexes: number[] = [];
  let itemElements: ItemComponent[] = [];
  const elEmpty = Empty();

  const input = m("input", {
    type: "text",
    class: styles.input,
    placeholder: props.placeholder ?? "Type a command or search...",
    autofocus: true,
    value: searchValue,
    oninput: (e: Event) => {
      searchValue = (e.target as HTMLInputElement).value;
      updateFilter();
      updateSelection();
    },
    onblur: (e: FocusEvent) => {
      if (!document.hasFocus())
        return;

      // Check if focus is moving to an element inside the modal
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget !== null && modalContent.contains(relatedTarget)) {
        // Focus is moving to a modal item, don't close
        return;
      }

      props.on.close();
    },
  });
  // Body with items list - will be updated dynamically
  const listContainer = m("div", {class: styles.body});
  const modalContent = m("div", {
    class: styles.modal,
    onkeydown: handleKeyDown,
  },
    // Header with search input
    m("div", {class: styles.header}, input),
    elEmpty,
    listContainer,
    Footer(),
  );

  const el = m("div", {
    class: styles.overlay,
    onclick: (e: MouseEvent) => {
      if (e.target === el) {
        props.on.close();
      }
    },
  }, modalContent);

  function updateFilter(): void {
    const search = searchValue.toLowerCase();
    filteredIndexes = [];
    for (const [i, item] of items.entries()) {
      const matches = search === "" ||
        item.label.toLowerCase().includes(search) ||
        item.group?.toLowerCase().includes(search) === true;
      if (matches)
        filteredIndexes.push(i);
      setDisplay(itemElements[i].el, matches);
    }

    // Handle empty state
    setDisplay(elEmpty, filteredIndexes.length === 0);
  }
  function updateSelection(): void {
    if (filteredIndexes.length === 0)
      return;

    selectedIndex = selectedIndex % filteredIndexes.length;

    // update selection on existing elements
    for (const [i, element] of itemElements.entries()) {
      element.selected = i === filteredIndexes[selectedIndex];
    }

    // Scroll selected item into view
    const selectedElement = itemElements[filteredIndexes[selectedIndex]].el;
    selectedElement.scrollIntoView({block: "nearest", behavior: "smooth"});
  }

  function handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        props.on.close();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (filteredIndexes.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredIndexes.length;
          updateSelection();
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filteredIndexes.length > 0) {
          selectedIndex = (selectedIndex - 1 + filteredIndexes.length) % filteredIndexes.length;
          updateSelection();
        }
        break;
      case "Enter":
        e.preventDefault();
        if (filteredIndexes.length > 0)
          selectItem(items[filteredIndexes[selectedIndex]]);
        break;
    }
  }

  function selectItem(item: Item): void {
    item.perform();
    props.on.close();
  }

  return {
    el,
    set visible(value: boolean) {
      setDisplay(el, value);
      if (value) {
        setDisplay(el, true);
        searchValue = "";
        input.value = "";
        selectedIndex = 0;
        input.focus();

        items = props.items();
        itemElements = items.map(item => Item({
          item,
          on: {select: () => selectItem(item)},
        }));
        listContainer.replaceChildren(...itemElements.map(item => item.el));
        updateFilter();
        updateSelection();
      }
    },
  };
}
