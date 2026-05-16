let style: Element | null = null;
function getStyle(): Element {
  if (style !== null)
    return style;

  style = document.querySelector("#dynamic-styles");
  if (style !== null)
    return style;

  style = document.createElement("style");
  style.id = "dynamic-styles";
  document.head.appendChild(style);
  return style;
}

function append(s: string): void {
  getStyle().textContent += s + "\n";
}

let nextID = -1;
function genClass(): string {
  nextID++;
  return `z${nextID}`;
}

export const css = Object.assign((s: string): string => {
  const id = genClass();
  append(`.${id} { ${s} }`);
  return id;
}, {
  raw(s: string): string {
    const id = genClass();
    append(`.${id}${s}`);
    return id;
  },
});
