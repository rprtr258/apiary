---
name: apiary
description: Dark, dense desktop workbench for authoring and inspecting API requests, styled after the ef "Instrument" system - deep blue-black neutrals, hairline borders, quiet Inter type, and a strict "color carries meaning" rule where protocol, HTTP method, and status hues ride on top of the neutral field.
colors:
  bg: "#101318"
  bg2: "#0b0e12"
  pane: "#14171c"
  ink: "#e7eaf0"
  faint: "#8b93a1"
  hair: "#262b36"
  accent: "#93c5fd"
  accent-ink: "#101318"
  ok: "#5eead4"
  warn: "#fcd34d"
  err: "#f87171"
  result: "#5eead4"
  sel: "#1e3a5f"
  green: "#22c55e"
  type: "#c4b5fd"
  on-fill: "#ffffff"
  primary: "{colors.accent}"
  method-get: "{colors.green}"
  method-post: "{colors.accent}"
  method-put: "{colors.warn}"
  method-delete: "{colors.err}"
  method-patch: "{colors.type}"
  method-head: "{colors.ok}"
  method-options: "{colors.result}"
  method-other: "{colors.faint}"
  kind-http: "{colors.green}"
  kind-http-source: "{colors.green}"
  kind-sql: "{colors.accent}"
  kind-sql-source: "{colors.accent}"
  kind-grpc: "{colors.ok}"
  kind-jq: "{colors.type}"
  kind-redis: "{colors.err}"
  kind-md: "{colors.accent}"
  kind-diff: "{colors.green}"
  kind-mcp: "{colors.ink}"
typography:
  display-lg:
    fontFamily: Inter, Helvetica Neue, system-ui, sans-serif
    fontSize: 2em
    fontWeight: "700"
    lineHeight: 1.2
  body-md:
    fontFamily: Inter, Helvetica Neue, system-ui, sans-serif
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 1.45
  body-sm:
    fontFamily: Inter, Helvetica Neue, system-ui, sans-serif
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.45
  label-sm:
    fontFamily: JetBrains Mono, Fira Code, ui-monospace, monospace
    fontSize: 10px
    fontWeight: "700"
  caption:
    fontFamily: Inter, Helvetica Neue, system-ui, sans-serif
    fontSize: 11px
    fontWeight: "400"
  code:
    fontFamily: JetBrains Mono, Fira Code, ui-monospace, monospace
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  circle: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 0.5em
  lg: 1em
  splitter: 6px
  sidebar: 300px
  sidebar-collapsed: 3em
components:
  button:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    typography: "{typography.body-md}"
  button-hover:
    backgroundColor: "{colors.sel}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    padding: "4px 10px"
  input:
    backgroundColor: "{colors.bg2}"
    textColor: "{colors.ink}"
    padding: "4px 8px"
    typography: "{typography.body-md}"
  input-placeholder:
    textColor: "{colors.faint}"
  input-error:
    backgroundColor: "color-mix(in srgb, {colors.err} 10%, transparent)"
  input-success:
    backgroundColor: "color-mix(in srgb, {colors.green} 10%, transparent)"
  select-popup:
    backgroundColor: "{colors.pane}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xs}"
  select-option:
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  select-option-highlighted:
    backgroundColor: "{colors.sel}"
  select-option-disabled:
    textColor: "{colors.faint}"
  tag-success:
    textColor: "{colors.green}"
  tag-info:
    textColor: "{colors.accent}"
  tag-warning:
    textColor: "{colors.warn}"
  tag-error:
    textColor: "{colors.err}"
  chip-method-get:
    backgroundColor: "color-mix(in srgb, {colors.method-get} 25%, transparent)"
    textColor: "{colors.method-get}"
  chip-method-post:
    backgroundColor: "color-mix(in srgb, {colors.method-post} 25%, transparent)"
    textColor: "{colors.method-post}"
  chip-method-put:
    backgroundColor: "color-mix(in srgb, {colors.method-put} 25%, transparent)"
    textColor: "{colors.method-put}"
  chip-method-delete:
    backgroundColor: "color-mix(in srgb, {colors.method-delete} 25%, transparent)"
    textColor: "{colors.method-delete}"
  chip-method-patch:
    backgroundColor: "color-mix(in srgb, {colors.method-patch} 25%, transparent)"
    textColor: "{colors.method-patch}"
  chip-method-head:
    backgroundColor: "color-mix(in srgb, {colors.method-head} 25%, transparent)"
    textColor: "{colors.method-head}"
  chip-method-options:
    backgroundColor: "color-mix(in srgb, {colors.method-options} 25%, transparent)"
    textColor: "{colors.method-options}"
  chip-method-other:
    backgroundColor: "color-mix(in srgb, {colors.method-other} 25%, transparent)"
    textColor: "{colors.method-other}"
  chip-table:
    backgroundColor: "color-mix(in srgb, {colors.kind-sql-source} 25%, transparent)"
    textColor: "{colors.kind-sql-source}"
  chip-tool:
    textColor: "{colors.ink}"
  kind-badge:
    typography: "{typography.label-sm}"
    rounded: 2px
    padding: "2px 4px"
  request-label:
    textColor: "{colors.ink}"
  empty-label:
    textColor: "{colors.faint}"
  dropdown-menu:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  combobox-popup:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  combobox-option-highlighted:
    backgroundColor: "{colors.sel}"
  combobox-option-disabled:
    textColor: "{colors.faint}"
  modal-dialog:
    backgroundColor: "{colors.pane}"
    rounded: "{rounded.lg}"
    width: "40%"
    height: "20%"
    padding: "{spacing.lg}"
  palette-dialog:
    backgroundColor: "{colors.pane}"
    rounded: "{rounded.lg}"
  palette-input:
    backgroundColor: transparent
    textColor: "{colors.ink}"
  table-row-even:
    backgroundColor: "{colors.bg2}"
  table-row-odd:
    backgroundColor: "{colors.bg}"
  hairline:
    size: "1px"
    backgroundColor: "{colors.hair}"
  schema-node-header:
    textColor: "{colors.on-fill}"
  scrollbar:
    width: 12px
    height: 12px
  scrollbar-thumb:
    backgroundColor: "{colors.hair}"
    rounded: 6px
  scrollbar-thumb-hover:
    backgroundColor: "{colors.faint}"
  splitter:
    height: "{spacing.splitter}"
  splitter-hover:
    backgroundColor: "{colors.accent}"
  pane-content:
    backgroundColor: "{colors.bg}"
  dock-tab-focused:
    textColor: "{colors.accent}"
  palette-option-hover:
    backgroundColor: "{colors.sel}"
  palette-option-selected:
    backgroundColor: "{colors.sel}"
  palette-hint:
    textColor: "{colors.faint}"
  palette-footer:
    backgroundColor: "{colors.bg2}"
  label-secondary:
    textColor: "{colors.faint}"
  sort-arrow-active:
    textColor: "{colors.accent}"
  sort-arrow-inactive:
    textColor: "{colors.faint}"
  kind-badge-http:
    textColor: "{colors.kind-http}"
  kind-badge-http-source:
    textColor: "{colors.kind-http-source}"
  kind-badge-sql:
    textColor: "{colors.kind-sql}"
  kind-badge-sql-source:
    textColor: "{colors.kind-sql-source}"
  kind-badge-grpc:
    textColor: "{colors.kind-grpc}"
  kind-badge-jq:
    textColor: "{colors.kind-jq}"
  kind-badge-redis:
    textColor: "{colors.kind-redis}"
  kind-badge-md:
    textColor: "{colors.kind-md}"
  kind-badge-diff:
    textColor: "{colors.kind-diff}"
  kind-badge-mcp:
    textColor: "{colors.kind-mcp}"
---

# apiary - Design System

## Overview

apiary is a cross-platform desktop tool for authoring and running API requests
(HTTP, SQL, gRPC, Redis, JQ, Markdown, and source/table explorers) in dockable
tabs. Visually it is a **dense, deep-blue-black developer workbench** in the
ef "Instrument" style: quiet surfaces separated by hairline borders, small
colorless Inter type, and color used almost exclusively as *data markers* -
never as decoration.

Three concrete rules give the app its identity:

1. **Neutrals carry the UI.** All chrome, text, surfaces, borders, and data
   tables live on the blue-black ramp between `bg2 #0b0e12` and `ink #e7eaf0`,
   separated by `hair` hairlines. Nothing in the application frame is colored.
2. **Color means protocol.** Every request kind, HTTP method, and response
   status has a fixed hue drawn from the semantic token set (`green`,
   `accent`, `warn`, `err`, `ok`, `type`, `result`). If you see saturated color
   in apiary, it is identifying a protocol entity or a status - never a button
   or background.
3. **Color rides as text + tint, never as a block.** Protocol entities appear
   as small badges/chips: a colored label (with a matching hairline border for
   kind badges) on the neutral field, optionally over a `25% color-mix` tint
   of the same hue. No large colored fills.

**Sources of truth.** The token layer lives in the `:root` block of
`index.html` (the ef `studio.css` dark theme; one apiary extension token,
`on-fill`, for text on saturated data-viz fills). Styles are injected at
runtime by the `css`/`css.raw` utilities in `renderer/lib/styles.ts`. Shared
control styling lives in `renderer/components/input.ts` (`inputBase`) and
`renderer/components/button.ts` (`btnStyles.base`). The protocol hue maps live
in `renderer/plugins/http_source/item.ts` (`httpMethodPropsMap`), the root
badges of each `renderer/plugins/<kind>/index.ts`, and `tagColors` in
`renderer/components/dataview.ts`. When in doubt, read those files before
adding a new color.

## Colors

All colors are used on a deep blue-black field, so the palette is split into
neutral surfaces, text, one interactive accent, and the semantic/protocol hue
system. Every value below is a CSS custom property on `:root` in `index.html`;
components reference them as `var(--...)` - no hex literals in components.

### Neutral chrome & surfaces

| Token | Value | Used for |
|---|---|---|
| `bg` | `#101318` | Main field, pane content, data tables (odd rows) |
| `bg2` | `#0b0e12` | Recessed chrome: sidebar, tab bars, status strips, inputs, table even rows |
| `pane` | `#14171c` | Floating surfaces: menus, dropdown popups, modals, palette dialog, schema-canvas node bodies |
| `hair` | `#262b36` | All 1px separators: borders, splitters, input/button outlines, grid dots |

Depth steps are `bg2` (recessed) -> `bg` (field) -> `pane` (raised). Hairlines
are chrome-only and never used as backgrounds.

Data tables alternate `bg2` and `bg`; hovering a cell or column header raises
it to `sel #1e3a5f` (defined as the `--row-highlight` / `--col-highlight`
variables in `index.html`).

### Text

| Token | Value | Used for |
|---|---|---|
| `ink` | `#e7eaf0` | Primary text, labels, active values, icons on neutral field |
| `faint` | `#8b93a1` | Hints, placeholders, secondary labels, inactive tabs, empty states |
| `on-fill` | `#ffffff` | Text on saturated data-viz fills (schema canvas node headers) |

Keep readable text at `ink`; `faint` is for metadata, placeholders, and icons
only. There is no mid-gray text tier - content is either readable or faint.

### Interactive accents

`accent #93c5fd` is the single action color: primary `NButton` fill (with
`accent-ink #101318` text), input focus borders, splitter/drag hover, active
sort arrows, dock-tab focus bar. Hover/selection on rows and options is
`sel #1e3a5f`. Both are one hue each - never introduce a second accent.

### Semantic hues (status)

| Token | Value | Used for |
|---|---|---|
| `ok` | `#5eead4` | Healthy/teal states, `HEAD`, `GRPC` |
| `warn` | `#fcd34d` | Warnings, dirty cells, `PUT` |
| `err` | `#f87171` | Errors, destructive actions, `DELETE`, `REDIS` |
| `result` | `#5eead4` | Query result lines, `OPTIONS` |
| `green` | `#22c55e` | Success states, added diff lines, `GET`, `HTTP` |
| `type` | `#c4b5fd` | Type-ish/labels, `PATCH`, `JQ` |

Status backgrounds are always `color-mix(in srgb, <token> N%, transparent)`
tints (10% for input states, 25% for chips) - never solid fills.

### Protocol hue system (the identity)

Two strata of saturated color exist; do not conflate them.

**1. Kind badges (request rows in the tree).** Bold uppercase 2-4 letter
labels (`HTTP`, `SQL`, `GRPC`, `JQ`, `MD`, `REDIS`, `DIFF`, `MCP`, plus `HTTP*`
and `SQL*` for source requests) rendered as colored text inside a `1px` border
of the same hue (`NTag` bordered, `2px` radius, transparent background):
`kind-http green`, `kind-sql accent`, `kind-grpc ok`, `kind-jq type`,
`kind-redis err`, `kind-md accent`, `kind-diff green`, `kind-mcp ink`.

**2. Tinted chips (token text on a 25% tint).** Discovered endpoints, tables,
and tools render as a token-colored label over a `color-mix(... 25%,
transparent)` background of the same hue - e.g. a `GET` endpoint chip is
`green` text on a `25% green` tint. The full HTTP method set is fixed:

| Method | Text hue |
|---|---|
| GET | `green` |
| POST | `accent` |
| PUT | `warn` |
| DELETE | `err` |
| PATCH | `type` |
| HEAD | `ok` |
| OPTIONS | `result` |
| other/unknown | `faint` |

Discovered tables use `accent` ("TBL"); discovered MCP tools use plain `ink`
text ("TOOL").

**3. Sparse status tags.** Small one-to-three character markers (HTTP status
codes, tree method tags, `StatusLabel`) use the semantic hues exactly as
defined by `NTag`/`tagColors`: `green` (success), `accent` (info), `warn`
(warning), `err` (error). These are text markers by design and reserved for
isolated labels - never as backgrounds or fills. Response codes map
`2xx -> success`, `3xx/4xx -> warning`, `5xx -> error`, with the code spelled
in the tooltip.

Error affordances that are not protocol-related stay muted: destructive icons
use `err`, and `.highlight-red` resolves to `err` on hover.

## Typography

The typeface is **Inter** (`Inter, Helvetica Neue, system-ui`), at a 13px/1.45
base set on `body` in `index.html`; monospace (**JetBrains Mono**, falling back
to Fira Code / ui-monospace) is used where data or code is displayed (editors,
JSON views, palette shortcuts, kbd hints, identifiers).

Dense secondary text is sized in `em` relative to the 13px base - `0.875em ≈
11px` for request headers, `0.8em ≈ 10px` for labels, `0.7em ≈ 9px` for table
cells and metadata. Keep this em-relative practice so text scales with the
base.

- **`display-lg`** (2em, bold) - large status/result codes (e.g. `NEmpty`
  headings).
- **`label-sm`** (JetBrains Mono 10px, bold) - kind badges, method chips, and
  all protocol labels. Protocol labels are always uppercase text set in
  `label-sm`; the casing is part of the identity and must not be lowered.
- **`code`** (JetBrains Mono 12px/1.5) - code and JSON. All editor surfaces
  (CodeMirror) use the GitHub-Dark palette; plain `Json`/`pre` views keep the
  same mono discipline.
- Plain prose in results/docs renders through github-markdown-css in dark
  mode.

## Layout

apiary is a docking workbench: a **fixed `sidebar 300px`** request tree on the
left and a dock canvas on the right, joined by a `6px` splitter (`NSplit`).
The sidebar can collapse to a `sidebar-collapsed 3em` rail showing only the
expand chevron. Everything else - request tabs, result panes, viewer panels -
is a user-dockable layout component; never build a fixed sidebar into a
component that is meant to be docked.

Inside panels, layout is dense and em-relative:

- Tree rows are flex rows with `sm 8px` gaps between the kind badge and the
  label; labels truncate with ellipsis; nesting indents progressively. Rows
  are hard-capped to the sidebar width: every label ellipsizes (`min-width:
  0`, `overflow-x: clip`, `text-overflow: ellipsis`, nowrap) and the row
  itself clips `overflow-x`, so a horizontal scrollbar can never appear -
  deep nesting shrinks the indent gutter instead of widening the pane.
- Virtual children (tables/endpoints/tools) render inside their source with
  narrow chips (`min-width 2em`) above the label.
- Groups of controls inside a request use `md 0.5em` gaps; `ParamsList` and
  key/value rows use `sm 8px`; chip padding is `2px 4px` (`xxs/xs`).
- Modals are centered dialogs of `width 40%` / `height 20%` with `lg 1em`
  padding; `NTabs` present a plain row of text buttons with `0.5em` spacing.
- All scrollable regions use the thin `NScrollbar` container; scrollbars
  themselves are styled globally in `index.html` - a `12px` webkit scrollbar
  with a transparent track/corner and a `4px`-wide rounded thumb in `hair`,
  brightening to `faint` on hover. Every scrollable region (dock panes, tree,
  tables, editors) picks these up automatically; never restyle scrollbars
  per component.

## Elevation & Depth

Depth comes from **luminance steps and hairlines, not shadows**: `bg2`
(recessed chrome) -> `bg` (field) -> `pane` (floating). A surface rises by
moving up that ramp and gaining a `1px hair` border. The only shadowed
surfaces are overlays that must visually detach from the field:

- **Dropdown/context menus and select popups** (`z-index: 1000`): `pane` body,
  `1px hair` border, `8px` radius, `0 2px 8px rgba(0, 0, 0, 0.5)` shadow;
  popup option lists get `4px` inner padding with `4px` rounded rows.
- **Command palette**: `pane` body, `1px hair` border, `8px` radius,
  `0 18px 48px rgba(0, 0, 0, 0.25)` shadow over a
  `color-mix(in srgb, ink 22%, transparent)` blur scrim.
- **Modal** (`z-index: 100`): the same blur-scrim overlay; the dialog body is
  `pane` with a `hair` border and `8px` radius.
- The dock layout marks the focused tab with an `inset 0 2px 0 accent` bar;
  the drag proxy is a `pane` chip with a `hair` border.

Do not add box shadows to in-canvas chrome or data tables; use a hairline or
luminance step instead.

## Shapes

Corner radii follow the control's role:

- **Inputs are square** (no radius) - text fields, selects, cell editors, and
  the palette input are square hairline boxes; the palette input is fully
  borderless with a single `border-bottom` hairline.
- **`rounded.md` = 6px** - buttons (`NButton`) and the small rows inside
  menus/popups.
- **`rounded.lg` = 8px** - floating surfaces: dropdown menus, select popups,
  the palette dialog, and modals.
- **`rounded.sm` = 4px** - option rows inside the 8px popups.
- **`rounded.circle`** (a `9999px` radius, i.e. fully round) - numeric
  sort-priority badges and type dots in table headers/cells.
- **Chips (kind badges, method markers) are square** - `2px 4px` padding, `2px`
  radius on bordered badges. They read as tightly set type, not as pills.

## Components

The component kit (`renderer/components/`, prefixed `N`) is small and direct.  All values below reference the frontmatter tokens.

**Buttons (`NButton`)** - every button gets the shared `button` base (ef `tb-btn`): transparent body, `hair` border, `6px` radius, `4px 10px` padding, `ink` text, `sel` hover; disabled drops to `0.4` opacity with `not-allowed` and no hover fill. `button-primary` is the filled action button: `accent` background, `accent-ink` text, `accent` border, and it keeps its fill on hover. Loading drops to `0.8` with a spinner glyph (`⏳`) and a `wait` cursor. `accent` never appears on non-interactive elements.

**Inputs (`NInput`, `NSelectInput`, table cell editors)** - every text field shares `inputBase`: square (no radius), `bg2` body, `hair` border, `4px 8px` padding, `ink` text, no glow. Placeholders are `faint`; focus is expressed solely by the border turning `accent`. Validation states tint border and body with the same hue at `10%`: `err` for invalid, `green` for success. Callers pass inline `style` only for metrics (width, grid placement) - colors come from the tokens.

**Tags (`NTag`)** - colored text markers. The four semantic types map exactly to `tag-success green` / `tag-info accent` / `tag-warning warn` / `tag-error err`. `bordered: true` adds a `1px` border of the same color (`2px` radius) - the kind-badge treatment. Callers override with the kind or method hue when rendering protocol labels (request rows), or pass a `25% color-mix` tint background for chips (`chip-method-*`, `chip-table`).

**Request tree rows** - flex rows of `kind-badge` + `request-label`. The badge is bold uppercase `label-sm` text in the kind hue inside a matching `1px` border, on the neutral field; the label is `ink`. Loading sources pulse (`1.5s` opacity keyframes); empty children show the `empty-label` "(None)" in italic `faint`.

**Data tables (`DataTable`, `NTable`)** - fixed-layout tables with zebra rows (`bg2`/`bg`), hover/header highlight at `sel`, type icons in `faint` at 15px, and an accent sort language: the active column's sort arrow is `accent`, inactive is `faint`, and multi-column sort order shows as a circular badge with `color-mix(in srgb, accent 30%, transparent)` fill and `ink` text. Cells keep `caption` sizing for density; cell editing outlines are `warn` (dirty) and `err` (invalid), and the cell editor is a square `inputBase` field with an `accent` border.

**Dropdowns/menus** - `globalDropdown` renders fixed-position menus with the `dropdown-menu` tokens (`pane` body on a `hair` border, `8px` radius, `0 2px 8px rgba(0,0,0,0.5)`, `min-width 120px`, `z-index 1000`), clamped to the viewport; items are `ink` text raising `sel` on hover.

**Selects (`NSelect`, `NSelectInput`)** - `NSelect` is a native `<select>` dressed in `inputBase` (square hairline box; its option list stays native, themed by `color-scheme: dark`). `NSelectInput` is a text input paired with an owned dropdown list (a datalist replacement, since native datalist options cannot be disabled in Chromium). The popup is a floating surface (`pane` body, `hair` border, `8px` radius, `4px` inner padding, `z-index 1000`) holding `4px`-rounded option rows. A disabled `"none"` placeholder (`faint`, unpickable) appears only when the filtered list is empty - no options exist or the typed filter matches nothing; otherwise the list shows options only. The highlighted option (hover and keyboard share one state) raises `sel`, mirroring the palette's selected row; option text is `ink`.

**Command palette** - the ⌘K overlay: `palette-dialog` (`pane` body, `hair` border, `8px` radius, deep `0 18px 48px` shadow over the `22% ink` blur scrim), `palette-input` (transparent field with a single `border-bottom` hairline, `ink` text), option rows that raise `sel` on hover and when selected, hints and shortcut separators in `faint`, mono `kbd` keys on `bg2` with `hair` borders, and a `bg2` footer hint bar.

**Modal (`Modal`, `NModal`)** - centered confirm dialogs per `modal-dialog` (`pane` body, `hair` border, `8px` radius); overlay is the blurred full-screen scrim described under Elevation. Title is an `h3` in `display-lg`-adjacent weight; the action row (`NButton`s) sits `space-around` at the bottom; clicking outside closes.

**Tabs (`NTabs`)** - the in-panel switcher: plain text buttons with `0.5em` gaps and no chrome; the active tab is `pane` body with an `inset 0 2px 0 accent` focus bar, matching the dock tabs. The dock tab styles live in `renderer/layout/styles.ts` and are mirrored in `renderer/components/layout.ts` - keep the two visually consistent. Real document tabs live in the dock layout and are not restyled per component.

**Icons (`NIcon`)** - inline SVG glyphs (Ant-style outline set) at 1em, colored via `currentColor`; `faint` is the default tone for metadata/type icons, and protocol/status colors apply only when an icon represents a protocol entity or result state. The empty-state glyph (`ResultInfo`) is `accent`.

**Editors & code surfaces** - CodeMirror with the GitHub-Dark theme for SQL, JSON, Markdown and other code; plain `pre`/`Json` views (2-space pretty JSON) inherit the `code` token. Never apply the Inter stack or protocol hues inside an editor.

## Do's and Don'ts

**Do**
- Do use the blue-black neutral ramp for all UI chrome: canvases, panels, text, borders, hovers. If a color is not identifying a protocol entity or a status, it should be a neutral (`bg`, `bg2`, `pane`, `ink`, `faint`, `hair`).
- Do reference tokens as `var(--...)`; never hardcode a hex in a component. Add new colors to the `:root` block in `index.html` and the token frontmatter, and to the hue maps in code (`httpMethodPropsMap`, `<kind>/index.ts` root badges, `tagColors`) when adding a protocol kind.
- Do keep the hue system fixed: a `GET` is always `green`, `DELETE` always `err`, `REDIS` always `err`, `GRPC` always `ok` - everywhere, including newly added request kinds.
- Do render protocol labels as bold uppercase `label-sm` text: kind badges as colored text in a matching `1px` border, tinted method markers as token text on a `25% color-mix` tint.
- Do build form controls from the shared classes: `inputBase` for text fields and selects, `btnStyles.base` for buttons. Extend them in one place instead of styling per component.
- Do preserve density: em-relative type (0.7-0.875em over the 13px base), `2-8px` padding and gap scale, zebra data tables, truncated single-line labels.

**Don't**
- Don't use protocol hues on buttons, backgrounds, body text, or any non-data element. `accent` is the only colored control surface (primary buttons, focus borders, splitter/sort/dock-tab affordances).
- Don't add box shadows to in-canvas content; only overlays (menus, popups, palette, modal) may carry shadow + blur, and depth otherwise comes from the `bg2` -> `bg` -> `pane` luminance ramp and hairlines.
- Don't re-skin the dock layout per-pane or override CodeMirror's theme locally; change those themes once, globally, if they need to evolve.
- Don't set UI text in monospace or in the Avenir stack - Inter is the UI face, mono is reserved for code/data surfaces.
- Don't round inputs (they are square by design), invent new radius styles for chips (keep them square), or restyle existing `N*` components inline when a token or component entry already expresses the intent.
