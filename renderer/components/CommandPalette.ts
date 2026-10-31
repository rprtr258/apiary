import {m, DOMNode, setDisplay, clone} from "../lib/utils.ts";
import {css, setClass} from "../lib/styles.ts";
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
    background-color: var(--color-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
  `),
  header: css(`
    display: flex;
    border-bottom: 1px solid var(--color-dark-4);
  `),
  input: css(`
    width: 100%;
    padding: 12px 16px;
    background-color: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-bright);
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
      background-color: var(--color-dark-6);
    }
  `),
  itemSelected: css(`
    background-color: var(--color-dark-5);
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
    color: var(--color-bright);
    font-size: 14px;
    flex-grow: 1;
  `),
  itemShortcut: css(`
    display: flex;
    align-items: center;
    gap: 2px;
  `),
  shortcutSeparator: css(`
    color: var(--color-dimmed);
    font-size: 12px;
  `),
  shortcutKey: css(`
    padding: 2px 6px;
    background-color: var(--color-default);
    border: 1px solid var(--color-default-border);
    border-radius: var(--radius-sm);
    color: var(--color-default-color);
    font-size: 11px;
    font-family: var(--font-family-monospace);
  `),
  footer: css(`
    padding: 12px 16px;
    display: flex;
    justify-content: center;
    gap: 24px;
    border-top: 1px solid var(--color-dark-4);
  `),
  footerItem: css(`
    display: flex;
    align-items: center;
    gap: 6px;
  `),
  footerKey: css(`
    padding: 2px 6px;
    background-color: var(--color-default);
    border: 1px solid var(--color-default-border);
    border-radius: var(--radius-sm);
    color: var(--color-default-color);
    font-size: 11px;
    font-family: var(--font-family-monospace);
  `),
  footerLabel: css(`
    color: var(--color-dimmed);
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
      item.prefix !== undefined ? item.prefix : item.group !== undefined ? item.group+":" : null,
      m("div", {class: styles.itemLabel}, item.label),
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
      setClass(el, value, styles.itemSelected);
    },
  };
}

const styleEmpty = css(`
  padding: 32px;
  text-align: center;
  color: var(--color-dimmed);
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

      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget !== null && modalContent.contains(relatedTarget)) {
        return;
      }

      props.on.close();
    },
  });
  const listContainer = m("div", {class: styles.body});
  const modalContent = m("div", {
    class: styles.modal,
    onkeydown: handleKeyDown,
  },
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
        (item.group?.toLowerCase().includes(search) ?? false);
      if (matches)
        filteredIndexes.push(i);
      setDisplay(itemElements[i].el, matches);
    }

    setDisplay(elEmpty, filteredIndexes.length === 0);
  }
  function updateSelection(): void {
    if (filteredIndexes.length === 0)
      return;

    selectedIndex = selectedIndex % filteredIndexes.length;

    for (const [i, element] of itemElements.entries()) {
      element.selected = i === filteredIndexes[selectedIndex];
    }

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
