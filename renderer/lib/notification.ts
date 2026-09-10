import {css} from "./styles.ts";
import {m} from "./utils.ts";

let box: HTMLElement | undefined;

const boxClass = css(`
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
`);

const itemClass = css(`
  white-space: pre-line;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 4px;
  background: #b91c1c;
  color: white;
`);

export default (() => {
  const notify = (args: Record<string, unknown>): void => {
    if (box === undefined) {
      box = m("div", {class: boxClass});
      document.body.appendChild(box);
    }

    const textContent = Object.entries({title: "Error", ...args}).map(([k, arg]) => k+": "+String(arg)).join("\n");
    const el = m("div", {class: itemClass}, textContent);
    box.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  };
  return {
    error: notify,
  };
})();
