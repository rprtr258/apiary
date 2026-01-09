import {NEmpty, NList} from "./dataview.ts";
import {NInput} from "./input.ts";
import {Modal} from "./layout.ts";
import {KeyESC, KeyDown, KeyUp, KeyEnter} from "./icons.ts";
import {m, DOMNode} from "../utils.ts";

type DialogProps = {
  visible: boolean,
  on: {
    close: () => void,
  },
  header: DOMNode,
  body: DOMNode,
  footer: DOMNode,
};
function Dialog(props: DialogProps) {
  const modal = Modal({
    title: "COMMAND PALETTE",
    children: [""],
    buttons: [{id: "", text: ""}],
    on: {
      close: props.on.close,
    },
  }, [
    m("div", {class: "command-palette"}, [
      m("div", {class: "command-palette-header"}, props.header),
      m("div", {class: "command-palette-body"}, props.body),
      m("div", {class: "command-palette-footer"}, props.footer),
    ]),
  ]);
  if (!props.visible) // TODO: use reactively
    modal.hide();
  return modal.element;
};

function Group(props: {heading: string}, children: DOMNode[] = []) {
  return m("div", {}, [props.heading, children.flatMap(v => [v, m("hr")])]);
};

type ItemProps = {
  value: string,
  shortcut?: string[],
  on: {select?: () => void},
};
function Item(props: ItemProps, children: DOMNode = []) {
  return m("div", {}, [
    m("div", {class: "command-palette-item"}, [
      children,
      m("span", {class: "command-palette-item-value"}, props.value),
      m("span", {class: "command-palette-item-shortcut"}, props.shortcut ?? []),
    ]),
    m("button", {onclick: props.on.select}, ["Select"]),
  ]);
};

const Footer = m("ul", {class: "command-palette-commands"}, [
  m("li", {},
    m("kbd", {class: "command-palette-commands-key"}, KeyEnter),
    m("span", {class: "command-palette-Label"}, "to select"),
  ),
  m("li", {},
    m("kbd", {class: "command-palette-commands-key"}, KeyDown),
    m("kbd", {class: "command-palette-commands-key"}, KeyUp),
    m("span", {class: "command-palette-Label"}, "to navigate"),
  ),
  m("li", {},
    m("kbd", {class: "command-palette-commands-key"}, KeyESC),
    m("span", {class: "command-palette-Label"}, "to close"),
  ),
]);

export default {
  Dialog,
  Group,
  Item,
  Footer,
  Input: NInput,
  List: NList,
  Empty: NEmpty,
};