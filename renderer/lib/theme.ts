// Design tokens with the dark color scheme baked into :root: the app is
// dark-only, so per-color "filled" variants resolve to shade 8, "light"
// backgrounds to rgba(shade-6, 0.15) and text shades follow the dark scheme.
// Component styles reference the CSS variables; SVG presentation attributes
// cannot resolve custom properties, so the shades used in SVG code are also
// exported as TS constants.

const palettes: Record<string, string[]> = {
  dark: ["#c9c9c9", "#b8b8b8", "#828282", "#696969", "#424242", "#3b3b3b", "#2e2e2e", "#242424", "#1f1f1f", "#141414"],
  gray: ["#f8f9fa", "#f1f3f5", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd", "#868e96", "#495057", "#343a40", "#212529"],
  red: ["#fff5f5", "#ffe3e3", "#ffc9c9", "#ffa8a8", "#ff8787", "#ff6b6b", "#fa5252", "#f03e3e", "#e03131", "#c92a2a"],
  pink: ["#fff0f6", "#ffdeeb", "#fcc2d7", "#faa2c1", "#f783ac", "#f06595", "#e64980", "#d6336c", "#c2255c", "#a61e4d"],
  grape: ["#f8f0fc", "#f3d9fa", "#eebefa", "#e599f7", "#da77f2", "#cc5de8", "#be4bdb", "#ae3ec9", "#9c36b5", "#862e9c"],
  violet: ["#f3f0ff", "#e5dbff", "#d0bfff", "#b197fc", "#9775fa", "#845ef7", "#7950f2", "#7048e8", "#6741d9", "#5f3dc4"],
  indigo: ["#edf2ff", "#dbe4ff", "#bac8ff", "#91a7ff", "#748ffc", "#5c7cfa", "#4c6ef5", "#4263eb", "#3b5bdb", "#364fc7"],
  blue: ["#e7f5ff", "#d0ebff", "#a5d8ff", "#74c0fc", "#4dabf7", "#339af0", "#228be6", "#1c7ed6", "#1971c2", "#1864ab"],
  cyan: ["#e3fafc", "#c5f6fa", "#99e9f2", "#66d9e8", "#3bc9db", "#22b8cf", "#15aabf", "#1098ad", "#0c8599", "#0b7285"],
  teal: ["#e6fcf5", "#c3fae8", "#96f2d7", "#63e6be", "#38d9a9", "#20c997", "#12b886", "#0ca678", "#099268", "#087f5b"],
  green: ["#ebfbee", "#d3f9d8", "#b2f2bb", "#8ce99a", "#69db7c", "#51cf66", "#40c057", "#37b24d", "#2f9e44", "#2b8a3e"],
  lime: ["#f4fce3", "#e9fac8", "#d8f5a2", "#c0eb75", "#a9e34b", "#94d82d", "#82c91e", "#74b816", "#66a80f", "#5c940d"],
  yellow: ["#fff9db", "#fff3bf", "#ffec99", "#ffe066", "#ffd43b", "#fcc419", "#fab005", "#f59f00", "#f08c00", "#e67700"],
  orange: ["#fff4e6", "#ffe8cc", "#ffd8a8", "#ffc078", "#ffa94d", "#ff922b", "#fd7e14", "#f76707", "#e8590c", "#d9480f"],
};

// dark palette by shade for SVG attributes (0 = lightest text, 4 = borders, 6 = raised surfaces, 7 = body)
export const dark: string[] = palettes.dark;
export const white: string = "#ffffff";

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const themeCss = [
  ":root {",
  "  --scale: 1;",
  ...Object.entries(palettes)
    .flatMap(([name, shades]) => [...shades.entries()]
      .map(([i, hex]) => `  --color-${name}-${i}: ${hex};`)),
  "  --color-white: #ffffff;",
  "  --color-black: #000000;",
  // dark color scheme semantics. The app keeps its original high-contrast
  // layering: a deep near-black field (dark-9 body) with raised chrome one
  // to two steps lighter (dark-7 default surfaces, dark-6 hover).
  "  --color-scheme: dark;",
  "  --color-bright: var(--color-white);",
  "  --color-text: var(--color-dark-0);",
  "  --color-body: var(--color-dark-9);",
  "  --color-error: var(--color-red-8);",
  "  --color-placeholder: var(--color-dark-3);",
  "  --color-anchor: var(--color-blue-4);",
  "  --color-default: var(--color-dark-7);",
  "  --color-default-hover: var(--color-dark-6);",
  "  --color-default-color: var(--color-white);",
  "  --color-default-border: var(--color-dark-4);",
  "  --color-dimmed: var(--color-dark-2);",
  "  --color-disabled: var(--color-dark-8);",
  "  --color-disabled-color: var(--color-dark-3);",
  "  --color-disabled-border: var(--color-dark-4);",
  // per-color variant variables (dark scheme: filled = shade 8, light = rgba(shade-6, 0.15))
  ...Object.keys(palettes).flatMap(name => [
    `  --color-${name}-text: var(--color-${name}-4);`,
    `  --color-${name}-filled: var(--color-${name}-8);`,
    `  --color-${name}-filled-hover: var(--color-${name}-9);`,
    `  --color-${name}-light: ${rgba(palettes[name][6], 0.15)};`,
    `  --color-${name}-light-hover: ${rgba(palettes[name][6], 0.2)};`,
    `  --color-${name}-light-color: var(--color-${name}-3);`,
    `  --color-${name}-outline: var(--color-${name}-4);`,
    `  --color-${name}-outline-hover: ${rgba(palettes[name][4], 0.05)};`,
  ]),
  // primary color = blue
  "  --primary-color-filled: var(--color-blue-filled);",
  "  --primary-color-filled-hover: var(--color-blue-filled-hover);",
  "  --primary-color-light: var(--color-blue-light);",
  "  --primary-color-light-hover: var(--color-blue-light-hover);",
  "  --primary-color-light-color: var(--color-blue-light-color);",
  "  --primary-color-contrast: var(--color-white);",
  // radii (defaults at scale 1)
  "  --radius-xs: 2px;",
  "  --radius-sm: 4px;",
  "  --radius-default: 4px;",
  "  --radius-md: 8px;",
  "  --radius-lg: 16px;",
  "  --radius-xl: 32px;",
  // Input component (defaults at scale 1)
  "  --input-height-1: 30px;",
  "  --input-height-2: 36px;",
  "  --input-height-3: 42px;",
  "  --input-height-4: 50px;",
  "  --input-height-5: 60px;",
  "  --input-padding-y-xs: 5px;",
  "  --input-padding-y-sm: 6px;",
  "  --input-padding-y-md: 8px;",
  "  --input-padding-y-lg: 10px;",
  "  --input-padding-y-xl: 13px;",
  "  --input-height: var(--input-height-2);",
  "  --input-radius: var(--radius-default);",
  // Button component (defaults at scale 1)
  "  --button-height-1: 30px;",
  "  --button-height-2: 36px;",
  "  --button-height-3: 42px;",
  "  --button-height-4: 50px;",
  "  --button-height-5: 60px;",
  "  --button-padding-x-1: 14px;",
  "  --button-padding-x-2: 18px;",
  "  --button-padding-x-3: 22px;",
  "  --button-padding-x-4: 26px;",
  "  --button-padding-x-5: 30px;",
  "  --button-height: var(--button-height-2);",
  "  --button-padding-x: var(--button-padding-x-2);",
  // spacing (defaults)
  "  --spacing-xs: 10px;",
  "  --spacing-sm: 12px;",
  "  --spacing-md: 16px;",
  "  --spacing-lg: 20px;",
  "  --spacing-xl: 32px;",
  // typography (defaults)
  "  --font-size-1: 12px;",
  "  --font-size-2: 14px;",
  "  --font-size-3: 16px;",
  "  --font-size-4: 18px;",
  "  --font-size-5: 20px;",
  "  --line-height-xs: 1.4;",
  "  --line-height-sm: 1.45;",
  "  --line-height-md: 1.55;",
  "  --line-height-lg: 1.6;",
  "  --line-height-xl: 1.65;",
  "  --line-height: 1.55;",
  "  --heading-font-weight: 700;",
  "  --font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;",
  "  --font-family-headings: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;",
  "  --font-family-monospace: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;",
  // shadows (defaults at scale 1)
  "  --shadow-xs: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);",
  "  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 15px -5px rgba(0, 0, 0, 0.05);",
  "  --shadow-md: 0 1px 3px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.05);",
  "  --shadow-lg: 0 1px 3px rgba(0, 0, 0, 0.05), 0 28px 23px -7px rgba(0, 0, 0, 0.05);",
  "  --shadow-xl: 0 1px 3px rgba(0, 0, 0, 0.05), 0 36px 28px -7px rgba(0, 0, 0, 0.05);",
  "}",
  // body defaults
  "body {",
  "  background-color: var(--color-body);",
  "  color: var(--color-text);",
  "  font-family: var(--font-family);",
  "  font-size: var(--font-size-3);",
  "  line-height: var(--line-height);",
  "}",
].join("\n");

let installed = false;
export function installTheme(): void {
  if (installed)
    return;
  installed = true;
  const style = document.createElement("style");
  style.id = "app-theme";
  style.textContent = themeCss;
  document.head.appendChild(style);
}
