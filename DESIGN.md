---
name: apiary
description: Dark, dense desktop workbench for authoring and inspecting API requests, built on a dark design-token system. Neutral chrome, quiet controls, and a strict "color carries meaning" system where protocol, HTTP method, and status hues ride on top of the neutral field.
colors:
  canvas: "#141414"
  surface: "#141414"
  surface-raised: "#242424"
  surface-input: "transparent"
  surface-footer: "transparent"
  surface-active: "#2e2e2e"
  surface-hover: "#3b3b3b"
  sidebar: "#1f1f1f"
  tabbar: "#242424"
  modal-surface: "#242424"
  row-even: "#141414"
  row-odd: "#1f1f1f"
  row-highlight: "#242424"
  text-primary: "#ffffff"
  text-emphasis: "#ffffff"
  text-muted: "#c9c9c9"
  text-faint: "#828282"
  text-disabled: "#696969"
  text-hint: "#828282"
  primary: "#1971c2"
  primary-strong: "#228be6"
  focus: "#228be6"
  hover-accent: "#228be6"
  tag-success: "#a9e34b"
  tag-info: "#4dabf7"
  tag-warning: "#ffd43b"
  tag-error: "#ff8787"
  kind-http: "#a9e34b"
  kind-http-source: "#a9e34b"
  kind-sql: "#a5d8ff"
  kind-sql-source: "#748ffc"
  kind-grpc: "#3bc9db"
  kind-jq: "#9775fa"
  kind-redis: "#ff8787"
  kind-md: "#748ffc"
  kind-diff: "#69db7c"
  kind-mcp: "#ffffff"
  method-unknown-bg: "#2e2e2e"
  method-unknown-fg: "#ffffff"
  method-get-bg: "#18291b"
  method-get-fg: "#69db7c"
  method-post-bg: "#162634"
  method-post-fg: "#4dabf7"
  method-put-bg: "#362b12"
  method-put-fg: "#ffd43b"
  method-delete-bg: "#361d1d"
  method-delete-fg: "#ffa8a8"
  method-patch-bg: "#231d35"
  method-patch-fg: "#b197fc"
  method-head-bg: "#142b2e"
  method-head-fg: "#3bc9db"
  method-options-bg: "#252f16"
  method-options-fg: "#a9e34b"
  marker-table-bg: "#162634"
  marker-table-fg: "#4dabf7"
  callout-error-bg: "#361d1d"
  callout-error-fg: "#ffa8a8"
  diff-added-bg: "rgba(47, 158, 68, 0.15)"
  diff-removed-bg: "rgba(250, 82, 82, 0.15)"
  diff-updated-bg: "rgba(250, 176, 5, 0.15)"
  notification-error: "#e03131"
  notification-warning: "#f08c00"
  notification-info: "#1971c2"
typography:
  display-lg:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 2em
    fontWeight: "700"
    lineHeight: 1.2
  body-md:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.55
  body-sm:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.45
  label-sm:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: "700"
  caption:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 11px
    fontWeight: "400"
  code:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 8px
  circle: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 0.5em
  lg: 1em
  splitter: 5px
  sidebar: 300px
  sidebar-collapsed: 3em
components:
  dock-canvas:
    backgroundColor: "{colors.canvas}"
  sidebar-aside:
    backgroundColor: "{colors.sidebar}"
  tabbar:
    backgroundColor: "{colors.tabbar}"
  dock-tab-active:
    backgroundColor: "{colors.canvas}"
  button:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "#1864ab"
  callout-error:
    backgroundColor: "{colors.callout-error-bg}"
    textColor: "{colors.callout-error-fg}"
  diff-line-added:
    backgroundColor: "{colors.diff-added-bg}"
  diff-line-removed:
    backgroundColor: "{colors.diff-removed-bg}"
  diff-line-updated:
    backgroundColor: "{colors.diff-updated-bg}"
  notification-error-accent:
    backgroundColor: "{colors.notification-error}"
  notification-warning-accent:
    backgroundColor: "{colors.notification-warning}"
  notification-info-accent:
    backgroundColor: "{colors.notification-info}"
  tag-success:
    textColor: "{colors.tag-success}"
  tag-info:
    textColor: "{colors.tag-info}"
  tag-warning:
    textColor: "{colors.tag-warning}"
  tag-error:
    textColor: "{colors.tag-error}"
  chip-method-get:
    backgroundColor: "{colors.method-get-bg}"
    textColor: "{colors.method-get-fg}"
  chip-method-post:
    backgroundColor: "{colors.method-post-bg}"
    textColor: "{colors.method-post-fg}"
  chip-method-put:
    backgroundColor: "{colors.method-put-bg}"
    textColor: "{colors.method-put-fg}"
  chip-method-delete:
    backgroundColor: "{colors.method-delete-bg}"
    textColor: "{colors.method-delete-fg}"
  chip-method-patch:
    backgroundColor: "{colors.method-patch-bg}"
    textColor: "{colors.method-patch-fg}"
  chip-method-head:
    backgroundColor: "{colors.method-head-bg}"
    textColor: "{colors.method-head-fg}"
  chip-method-options:
    backgroundColor: "{colors.method-options-bg}"
    textColor: "{colors.method-options-fg}"
  chip-method-other:
    backgroundColor: "{colors.method-unknown-bg}"
    textColor: "{colors.method-unknown-fg}"
  chip-table:
    backgroundColor: "{colors.marker-table-bg}"
    textColor: "{colors.marker-table-fg}"
  kind-badge:
    backgroundColor: "transparent"
    typography: "{typography.label-sm}"
    padding: "2px 4px"
  request-label:
    textColor: "{colors.text-emphasis}"
  empty-label:
    textColor: "{colors.text-hint}"
  dropdown-menu:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  dropdown-item-hover:
    backgroundColor: "{colors.surface-hover}"
  combobox-popup:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  combobox-option-highlighted:
    backgroundColor: "{colors.surface-hover}"
  combobox-option-disabled:
    textColor: "{colors.text-disabled}"
  modal-dialog:
    backgroundColor: "{colors.modal-surface}"
    rounded: "{rounded.md}"
    width: "40%"
    height: "20%"
    padding: "{spacing.lg}"
  palette-dialog:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
  palette-input:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-primary}"
  table-row-even:
    backgroundColor: "{colors.row-even}"
  table-row-odd:
    backgroundColor: "{colors.row-odd}"
  table-row-highlight:
    backgroundColor: "{colors.row-highlight}"
  splitter:
    height: "{spacing.splitter}"
  splitter-hover:
    backgroundColor: "{colors.hover-accent}"
  pane-content:
    backgroundColor: "{colors.surface}"
  dock-tab-focused:
    textColor: "{colors.focus}"
  palette-option-hover:
    backgroundColor: "{colors.surface-active}"
  palette-option-selected:
    backgroundColor: "{colors.surface-hover}"
  palette-hint:
    textColor: "{colors.text-faint}"
  palette-footer:
    backgroundColor: "{colors.surface-footer}"
  label-secondary:
    textColor: "{colors.text-muted}"
  sort-arrow-active:
    textColor: "{colors.primary-strong}"
  sort-arrow-inactive:
    textColor: "{colors.text-faint}"
  kind-badge-http:
    backgroundColor: "transparent"
    textColor: "{colors.kind-http}"
  kind-badge-http-source:
    backgroundColor: "transparent"
    textColor: "{colors.kind-http-source}"
  kind-badge-sql:
    backgroundColor: "transparent"
    textColor: "{colors.kind-sql}"
  kind-badge-sql-source:
    backgroundColor: "transparent"
    textColor: "{colors.kind-sql-source}"
  kind-badge-grpc:
    backgroundColor: "transparent"
    textColor: "{colors.kind-grpc}"
  kind-badge-jq:
    backgroundColor: "transparent"
    textColor: "{colors.kind-jq}"
  kind-badge-redis:
    backgroundColor: "transparent"
    textColor: "{colors.kind-redis}"
  kind-badge-md:
    backgroundColor: "transparent"
    textColor: "{colors.kind-md}"
  kind-badge-diff:
    backgroundColor: "transparent"
    textColor: "{colors.kind-diff}"
  kind-badge-mcp:
    backgroundColor: "transparent"
    textColor: "{colors.kind-mcp}"
---

# apiary - Design System

## Overview

apiary is a cross-platform desktop tool for authoring and running API requests
(HTTP, SQL, gRPC, Redis, JQ, Markdown, and source/table explorers) in dockable
tabs. Visually it is a **dense dark developer workbench built on a dark
design-token system**: a deep near-black `#141414` field with raised chrome,
quiet panes, native dark form controls, and color used almost exclusively as
*data markers* - never as decoration.

Three concrete rules give the app its identity:

1. **Neutrals carry the UI.** All chrome, text, surfaces, borders, and data
   tables live on the theme's dark grayscale ramp between `canvas #141414`
   (dark-9) and `text-primary #ffffff`. Nothing in the application frame is
   colored.
2. **Color means protocol.** Every request kind, HTTP method, and response
   status has a fixed theme palette hue. `HTTP`/`GET` is lime, `POST` blue,
   `DELETE` red, `REDIS` red, `JQ` violet, `GRPC` cyan, and so on. If you see
   saturated color in apiary, it is identifying a protocol entity or a status -
   never a button or background.
3. **The canvas is only ever one of two depths: chrome or chip.** Chrome
   surfaces are grayscale; the only colored blocks are small "chips" (kind
   badges, method markers, table/endpoint markers) built as light-variant
   badges: a shade-4 text hue over a tinted
   `rgba(shade-6, 0.15)` background.

**Sources of truth.** The design tokens (dark color scheme: all 14
palettes, radii, spacing, font stacks, shadows, and the semantic variables
`--color-body`, `--color-text`, ...) are defined in
`renderer/lib/theme.ts` and injected into `:root` on startup. The dark-scheme
surface mapping is tuned for the app's original high-contrast layering (deep
`dark-9` body field, `dark-7` raised chrome, `dark-6` hover) while per-color
variants follow the dark-scheme rules (filled = shade 8, light =
rgba(shade-6, 0.15)); component styles
reference the CSS variables and are injected at runtime by the `css`/`css.raw`
utilities in `renderer/lib/styles.ts`. SVG presentation attributes cannot
resolve CSS variables, so the shades used there are exported as TS constants
(`dark`, `white`) from the same module. The remaining visual weight comes from
two third-party dark themes (CodeMirror GitHub-Dark via
`@fsegurai/codemirror-theme-github-dark`, github-markdown-css) and from native
controls driven by `color-scheme: dark` in `index.html`. The protocol hue maps
live in each plugin's `root()` badge (`renderer/plugins/<kind>/index.ts`) and
in `renderer/plugins/http_source/item.ts` (`httpMethodPropsMap`). When in
doubt, read those files before adding a new color.

## Colors

All colors are used on the dark field, so the palette is split into
neutral surfaces, text, interactive accents, and the protocol hue system.
Token values below are the resolved dark-scheme hexes; in code they are
always referenced as CSS variables (`var(--color-body)` etc.), never
as hex literals.

### Neutral chrome & surfaces

| Token | Value | Variable | Used for |
|---|---|---|---|
| `canvas` | `#141414` | `dark-9` / `--color-body` | App field, dock canvas, pane fields, active dock tab |
| `surface` | `#141414` | `--color-body` | Pane content |
| `sidebar` | `#1f1f1f` | `dark-8` | Sidebar aside (one step above the field) |
| `tabbar` | `#242424` | `dark-7` | Dock header / tab bar strips (two steps above the field) |
| `surface-raised` | `#242424` | `dark-7` / `--color-default` | Menus, dropdowns, palette, modal, notifications (detached by border + shadow) |
| `surface-input` | `transparent` | | Palette search field |
| `surface-footer` | `transparent` | | Palette footer (top hairline only) |
| `surface-active` | `#2e2e2e` | `dark-6` | Palette option hover, dock active tab |
| `surface-hover` | `#3b3b3b` | `dark-5` | Row hover, selected/combobox-highlighted rows, table highlight |
| `modal-surface` | `#242424` | `dark-7` / `--color-default` | Modal dialog body |
| `row-even` / `row-odd` | `#141414` / `#1f1f1f` | `body` (dark-9) / `dark-8` | Zebra striping of data tables |
| `row-highlight` | `#242424` | `dark-7` | Cell/column-header hover on data tables |

Hairlines on menus, dropdowns, the dock, and the palette use a `1px` line in
`#424242` (`dark-4`, `--color-default-border`). They are chrome-only
and never used as backgrounds.

Data tables alternate `row-even #141414` and `row-odd #1f1f1f`; hovering a cell
or column header raises it to `row-highlight #242424` (also defined as the CSS
variables `--row-highlight` / `--col-highlight` in `index.html`).

Note on tinted chips: in code their backgrounds are the light-variant
`rgba(shade-6, 0.15)` variables (e.g. `--color-blue-light`); the
backdrop token values below are those tints **composited over the `#141414`
body** so the contract stays checkable.

### Text

| Token | Value | Variable | Used for |
|---|---|---|---|
| `text-primary` | `#ffffff` | `bright` | Primary text, menu items, active values |
| `text-emphasis` | `#ffffff` | `bright` | Tree/sidebar request labels, emphasized content |
| `text-muted` | `#c9c9c9` | `dark-0` / `--color-text` | Secondary labels, palette body text |
| `text-faint` | `#828282` | `dark-2` / `--color-dimmed` | Hints, iconography, helper text, NULL markers |
| `text-disabled` | `#696969` | `dark-3` / `--color-disabled-color` | Disabled/inactive controls |
| `text-hint` | `#828282` | `dark-2` | Placeholder states ("(None)", idle icons) |

Keep readable text at `text-emphasis` or brighter; `text-hint` and below are
for metadata, empty states, and icons only.

### Interactive accents

`primary #1971c2` (`--color-blue-filled`; in the dark scheme the
filled variant resolves to blue-8) is the single action color (primary
`NButton`), hovering to `#1864ab` (blue-9). `primary-strong #228be6` (blue-6)
is the bright interactive blue: sort arrows, the splitter hover tint
(`hover-accent`), the focused dock tab underline (`focus`), and the
drag-highlight border `rgba(34, 139, 230, 0.2)`. The sort-priority badge uses
`rgba(34, 139, 230, 0.15)` (`--color-blue-light`) over the zebra rows.

### Protocol hue system (the identity)

Two strata of saturated color exist; do not conflate them.

**1. Kind badges (request rows in the tree).** Bold uppercase 2-4 letter
labels (`HTTP`, `SQL`, `GRPC`, `JQ`, `MD`, `REDIS`, `DIFF`, `MCP`, plus `HTTP*`
and `SQL*` for source requests) rendered as transparent-background chips with a
`1px currentColor` border, colored per kind with shade-4/2 text hues:
`kind-http #a9e34b` (lime-4), `kind-sql #a5d8ff` (blue-2), `kind-grpc #3bc9db`
(cyan-4), `kind-jq #9775fa` (violet-4), `kind-redis #ff8787` (red-4),
`kind-md #748ffc` (indigo-4), `kind-diff #69db7c` (green-4),
`kind-mcp #ffffff`, `kind-sql-source #748ffc`, `kind-http-source #a9e34b`.

**2. Tinted chips (light-variant: tinted background, shade-4 text).**
Discovered endpoints and tables render as a shade-4 label on a
`rgba(shade-6, 0.15)` background - e.g. a `GET` endpoint chip is
`method-get-fg #69db7c` on `method-get-bg rgba(47, 158, 68, 0.15)`. The full
HTTP method set is fixed:

| Method | Background | Foreground |
|---|---|---|
| GET | `method-get-bg #18291b` | `method-get-fg #69db7c` (green-4) |
| POST | `method-post-bg #162634` | `method-post-fg #4dabf7` (blue-4) |
| PUT | `method-put-bg #362b12` | `method-put-fg #ffd43b` (yellow-4) |
| DELETE | `method-delete-bg #361d1d` | `method-delete-fg #ffa8a8` (red-3) |
| PATCH | `method-patch-bg #231d35` | `method-patch-fg #b197fc` (violet-3) |
| HEAD | `method-head-bg #142b2e` | `method-head-fg #3bc9db` (cyan-4) |
| OPTIONS | `method-options-bg #252f16` | `method-options-fg #a9e34b` (lime-4) |
| other/unknown | `method-unknown-bg #2e2e2e` | `method-unknown-fg #ffffff` |

Discovered tables use `marker-table-bg #162634` /
`marker-table-fg #4dabf7` ("TBL"). DELETE and PATCH text sit one shade
lower (shade-3) than the rest: their shade-4 values fall short of the WCAG AA
4.5:1 contrast the design gate requires on their tints.

**3. Sparse status tags.** Small one-to-three character markers (HTTP status codes, tree method tags, `StatusLabel`) use the shade-4 text hues defined by `NTag`: `tag-success #a9e34b` (lime-4), `tag-info #4dabf7` (blue-4), `tag-warning #ffd43b` (yellow-4), `tag-error #ff8787` (red-4). They are text markers by design and reserved for isolated labels - never as backgrounds or fills. Response codes map `2xx -> success`, `3xx-4xx -> warning`, `5xx -> error`, with the code spelled in the tooltip.

Error affordances that are not protocol-related stay muted: destructive-row
icons use `#fa5252` (red-6), callouts (diff/Markdown failures) use
`callout-error-bg rgba(250, 82, 82, 0.15)` with `#ffa8a8` (red-3) text and a
`#fa5252` (red-6) left rule, and hover states of `.highlight-red` resolve to
`#fa5252`.

## Typography

The typeface is **the theme's sans stack** (`-apple-system, BlinkMacSystemFont,
Segoe UI, Roboto, Helvetica, Arial, sans-serif`, defined as
`--font-family` and set on `body` by `renderer/lib/theme.ts`);
monospace (`--font-family-monospace`, the theme's mono stack) is used
only where data or code is displayed (editors, JSON views, palette key hints,
plan/schema labels, table blobs).

The default body size is the platform default (`body-md 16px`, line-height
`1.55` for `body-md`); dense secondary text is sized in `em` relative to it -
`0.875em ≈ 14px` (`body-sm`, line-height `1.45`) for request headers,
`0.8em ≈ 13px` for labels, `0.7em ≈ 11px` (`caption`) for table cells and
metadata. Keep this em-relative practice so text scales with the base.

- **`display-lg`** (2em, bold) - large status/result codes (e.g. `NEmpty` headings).
- **`label-sm`** (12px, bold) - kind badges, method chips, and all protocol labels. Protocol labels are always uppercase text set in `label-sm`; the casing is part of the identity and must not be lowered.
- **`code`** (monospace, 13px) - code and JSON. All editor surfaces (CodeMirror) use the GitHub-Dark palette; plain `Json`/`pre` views keep the same mono discipline.
- Plain prose in results/docs renders through github-markdown-css in dark mode.

## Layout

apiary is a docking workbench: a **fixed `sidebar 300px`** request tree on the left and a dock canvas on the right, joined by a `5px` splitter (`NSplit`). The sidebar can collapse to a `sidebar-collapsed 3em` rail showing only the expand chevron. Everything else - request tabs, result panes, viewer panels - is a user-dockable layout component; never build a fixed sidebar into a component that is meant to be docked.

Inside panels, layout is dense and em-relative:

- Tree rows are flex rows with `sm 8px` gaps between the kind badge and the label; labels truncate with ellipsis; nesting indents progressively.
- Virtual children (tables/endpoints/tools) render inside their source with narrow chips (`min-width 2em`) above the label.
- Groups of controls inside a request use `md 0.5em` gaps; `ParamsList` and key/value rows use `sm 8px`; chip padding is `2px 4px` (`xxs/xs`).
- Modals are centered dialogs of `width 40%` / `height 20%` with `lg 1em` padding; `NTabs` present a plain row of text buttons with `0.5em` spacing.
- All scrollable regions use the thin `NScrollbar` container.

## Elevation & Depth

Depth comes from **luminance plus the theme's shadow tokens**. Hierarchy is
expressed by raising a surface's value (field `#141414` dark-9 -> raised
`#242424` dark-7 -> hover `#2e2e2e` dark-6 / `#3b3b3b` dark-5) and by
`#424242` borders; the app stays flat and quiet. The
only shadowed, elevated surfaces are overlays that must visually detach from
the canvas, using the shadow variables from `renderer/lib/theme.ts`:

- **Dropdown/context menus** (`z-index: 1000`): `surface-raised #242424` with a
  `1px #424242` border, `4px` radius (`rounded.sm`), and
  `var(--shadow-md)`.
- **Command palette**: `#242424` with `8px` radius, `var(--shadow-lg)`,
  and a `#424242` hairline under the search row, over a `rgba(0, 0, 0, 0.5)`
  scrim; the footer is separated by a top hairline instead of a fill.
- **Modal** (`z-index: 100`): full-viewport overlay with
  `backdrop-filter: blur(3px)` over the canvas; the dialog body is
  `modal-surface #242424` with `8px` radius and `var(--shadow-lg)`.
- The dock layout layers three chrome steps above the pane field: the sidebar
  sits at `sidebar #1f1f1f` (dark-8), header/tab bars at `tabbar #242424`
  (dark-7); the focused tab sinks back to the field color (`#141414`, dark-9)
  so it reads as continuous with the pane below, marked by a
  `primary-strong #228be6` underline; the drag proxy is the `default` surface
  (dark-7) with `var(--shadow-md)`.

Do not add box shadows to in-canvas chrome or data tables; use a border or a
luminance step instead.

## Shapes

Corner radii follow the theme's radius tokens:

- **`rounded.sm` = 4px** (`--radius-sm`) - menus, dropdowns, buttons,
  drag proxy, and palette key hints.
- **`rounded.md` = 8px** (`--radius-md`) - command palette and modal.
- **`rounded.circle`** (a `9999px` radius, i.e. fully round) - numeric
  sort-priority badges and type dots in table headers/cells.
- **Chips (kind badges, method markers) are square** - `2px 4px` padding, no
  radius. They read as tightly set type, not as pills.
- **Inputs and selects use the `--input-radius` token (4px)**; only
  scrollbars keep their native shape, themed by `color-scheme: dark`.

## Components

The component kit (`renderer/components/`, prefixed `N`) is small and direct.  All values below reference the frontmatter tokens.

**Buttons (`NButton`)** - The default variant is `button` (raised `--color-default` = dark-7 `#242424` background, `#424242` border, white text, `4px` radius, hover to `#2e2e2e`); `button-primary` is the filled action button: `primary #1971c2` (`--color-blue-filled`) background and border, white text, hovering to `#1864ab`. The `size` prop (`xs`-`xl`, default `sm`) resolves into inline `--button-height`/`--button-padding-x`/`--button-fz` variables - heights 30/36/42/50/60px, inline padding 14-30px, font sizes 12-20px - with `font-weight: 600` and `line-height: 1`; caller styles override. Button states are opacity-only: loading drops to `0.8` with a spinner glyph (`⏳`) and a `wait` cursor; disabled drops to `0.6` with `not-allowed`. Primary blue never appears on non-interactive elements.

**Tags (`NTag`)** - colored text markers. The four semantic types map exactly to `tag-success #a9e34b` (lime-4) / `tag-info #4dabf7` (blue-4) / `tag-warning #ffd43b` (yellow-4) / `tag-error #ff8787` (red-4). Callers override with the kind or method foreground when rendering protocol labels (request rows), or pass an explicit style for tinted chips (endpoint rows, `chip-method-*`, `chip-table`).

**Request tree rows** - flex rows of `kind-badge` + `request-label`. The badge is a transparent chip with a `1px currentColor` border and bold, colored, uppercase kind text per the `kind-*` tokens; the label is `text-emphasis #ffffff`. Loading sources pulse (`1.5s` opacity keyframes); empty children show the `empty-label` "(None)" in italic `text-hint`.

**Data tables (`DataTable`, `NTable`)** - fixed-layout tables with zebra rows (`table-row-even` / `table-row-odd`), hover/header highlight at `row-highlight #242424`, type icons in `text-faint` at 15px, and a blue sort language: the active column's sort arrow is `primary-strong #228be6`, inactive is `text-faint #828282`, and multi-column sort order shows as a circular badge with `rgba(34, 139, 230, 0.15)` (`--color-blue-light`) fill and white text. Cells keep `caption` sizing for density.

**Dropdowns/menus** - `globalDropdown` renders fixed-position menus with the `dropdown-menu` tokens (`surface-raised #242424` on a `#424242` border, `4px` radius, `var(--shadow-md)`, `min-width 120px`, `z-index 1000`), clamped to the viewport; item hover raises `surface-hover #3b3b3b`.

**Inputs (`NInput`, `NSelect`, `NSelectInput`, `NInputGroup`, `ParamsList` rows)** - the Input default variant: a `dark-6 #2e2e2e` field on a `1px #424242` border with `4px` radius (`--input-radius`), fixed height per `size` (`--input-height`: xs `30px`, sm `36px` default, md `42px`, lg `50px`, xl `60px`), inline padding of `height/3`, font size from `--font-size-{size}`, placeholder `#696969` at full opacity, and a `100ms` border-color transition. The `size` prop resolves into inline `--input-height`/`--input-fz` variables that the surface, padding, line-height, and select chevron all derive from; caller styles override them. Focus recolors the border to `primary #1971c2` with no outline; disabled controls dim to `opacity 0.6` with the `disabled` tokens; number spinners and search decorations are stripped. `NSelect` keeps its native popup and adds a dimmed chevron; `NInputGroup` joins its children group-style (square inner ends, half-width shared borders, focused child raised above the overlap). Invalid/success fields tint the border (`error #e03131` / teal-8) and the background (`red-light` / `teal-light`) - the app keeps these tinted states, applied statically on creation and re-evaluated on focus.

**Select input (`NSelectInput`)** - a text input paired with an owned dropdown list (a datalist replacement, since native datalist options cannot be disabled in Chromium). The field carries the shared input styling; the popup reuses the `combobox-popup` tokens (`surface-raised` body on a `#424242` hairline, `4px` radius, `var(--shadow-md)`, `z-index 1000`). A disabled `"none"` placeholder (`text-disabled`, unpickable) appears only when the filtered list is empty - no options exist or the typed filter matches nothing; otherwise the list shows options only. The highlighted option (hover and keyboard share one state) raises `surface-hover #3b3b3b`, mirroring the palette's selected row; option text is `text-primary`.

**Command palette** - the ⌘K overlay: `palette-dialog` (`#242424` body, `8px` radius, `var(--shadow-lg)`), `palette-input` (transparent field, white text, `#424242` bottom hairline), option rows that raise `surface-active #2e2e2e` on hover and `surface-hover #3b3b3b` when selected, hints in `text-faint`, and a footer hint bar separated by a top hairline. Key hints render `Kbd`-style: `#2e2e2e` fill, `#424242` border, `4px` radius, white mono text. Row text is `text-muted`.

**Modal (`Modal`, `NModal`)** - centered confirm dialogs per `modal-dialog` (`#242424`, `8px` radius, `var(--shadow-lg)`); overlay is the blurred full-screen scrim described under Elevation. Title is an `h3` in `display-lg`-adjacent weight; the action row (`NButton`s padded `0.5em 1em`) sits `space-around` at the bottom; clicking outside closes.

**Tabs (`NTabs`)** - the in-panel switcher: a `tabbar`-colored strip (`#242424`, dark-7) over the darker pane field with plain text buttons separated by `#424242` hairlines; hover raises `dark-6 #2e2e2e`, and the active tab sinks to the pane field (`#141414`) with the blue underline, melting into the content below. Real document tabs live in the dock layout and follow the same layering.

**Icons (`NIcon`)** - inline SVG glyphs (Ant-style outline set) at 1em, colored via `currentColor`; `text-faint` is the default tone for metadata/type icons, and protocol/status colors apply only when an icon represents a protocol entity or result state.

**Editors & code surfaces** - CodeMirror with the GitHub-Dark theme for SQL, JSON, Markdown and other code; plain `pre`/`Json` views (2-space pretty JSON) inherit the `code` token. Never apply the theme's sans stack or protocol hues inside an editor.

**Notifications** - toast stack in the bottom-right corner: `#242424` body on a `#424242` border, `4px` radius, `var(--shadow-lg)`, with a colored accent bar/dot per severity - `notification-error #e03131` (red-filled), `notification-warning #f08c00` (yellow-filled), `notification-info #1971c2` (blue-filled). Titles are white, detail text `text-faint`.

**Diff/Markdown callouts** - failure blocks use `callout-error-bg rgba(250, 82, 82, 0.15)` with `#ffa8a8` text and a `3px` `#fa5252` left rule; diff line tints use the `diff-added-bg` / `diff-removed-bg` / `diff-updated-bg` rgba fills (green/red/yellow light variants).

**Plan & schema canvases** - SVG surfaces use the hex constants exported from `renderer/lib/theme.ts` (SVG attributes cannot resolve CSS variables): node fills `dark-6 #2e2e2e` with `dark-4 #424242` strokes, white node titles, `dark-2 #828282` edges/muted text. Table node backgrounds stay hash-colored (data-driven hue). The dot grid canvas is `#2e2e2e` with `#3b3b3b` dots.

## Do's and Don'ts

**Do**
- Do use the grayscale ramp for all UI chrome: canvases, panels, text, borders, hovers. If a color is not identifying a protocol entity or a status, it should be a neutral.
- Do reference theme tokens (`var(--color-*)`, `--radius-*`, `--shadow-*`, `--font-family*`) instead of hex values; tokens live in `renderer/lib/theme.ts` (SVG code uses the exported `dark`/`white` constants).
- Do keep the hue system fixed and centralized in each plugin's `root()` badge (`renderer/plugins/<kind>/index.ts`) and `httpMethodPropsMap` (`renderer/plugins/http_source/item.ts`). A `GET` must always be the green light-variant pair (`#69db7c` on `rgba(47, 158, 68, 0.15)`), `DELETE` always red, `REDIS` always red - everywhere, including newly added request kinds.
- Do render protocol labels as bold, uppercase text in `label-sm` inside a chip; kind badges are transparent with a `currentColor` border, tinted method markers use the light-variant pairs.
- Do preserve density: em-relative type (0.7-0.875em), `2-8px` padding and gap scale, zebra data tables, truncated single-line labels.
- Do reach for native dark controls (inputs, selects, scrollbars) and the global themes (CodeMirror GitHub-Dark); extend them in one place instead of styling per component.
- Do add new colors to the token frontmatter (and to the maps in code) when adding a protocol kind; never hardcode a one-off hex in a component.

**Don't**
- Don't use protocol hues (lime, blue, yellow, red, cyan, violet...) on buttons, backgrounds, body text, or any non-data element. `primary #1971c2` is the only colored control surface.
- Don't apply the shade-4 tag hues (`tag-*`) as fills or to large areas - they are sparse status markers by design; tinted chips use the `rgba(shade-6, 0.15)` light-variant pairs instead.
- Don't add box shadows to in-canvas content; only overlays (menus, palette, modal) may carry a shadow token (+ blur for the modal).
- Don't re-skin the dock layout per-pane or override CodeMirror's theme locally; change those themes once, globally, if they need to evolve.
- Don't mix other typefaces into the theme's sans stack for UI text, and don't set UI text in monospace - mono is reserved for code/data surfaces.
- Don't invent new radius styles for chips (keep them square) or round native form controls; use the `--radius-*` tokens (4px/8px) where a radius is needed.
- Don't restyle or decorate existing `N*` components inline when a token or component entry already expresses the intent.
