---
name: apiary
description: Dark, dense desktop workbench for authoring and inspecting API requests. Near-black neutral chrome, quiet native controls, and a strict "color carries meaning" system where protocol, HTTP method, and status hues ride on top of the neutral field.
colors:
  canvas: "#000000"
  surface: "#222222"
  surface-raised: "#2a2a2a"
  surface-input: "#1a1a1a"
  surface-footer: "#1f1f1f"
  surface-active: "#353535"
  surface-hover: "#404040"
  surface-selected: "#202020"
  modal-surface: "#444444"
  row-even: "#020202"
  row-odd: "#101010"
  text-primary: "#ffffff"
  text-emphasis: "#e0e0e0"
  text-muted: "#cccccc"
  text-faint: "#888888"
  text-disabled: "#666666"
  text-hint: "#808080"
  primary: "#0b74e0"
  primary-strong: "#007bff"
  focus: "#354be3"
  hover-accent: "#0000cd"
  tag-success: "#00ff00"
  tag-info: "#0000ff"
  tag-warning: "#ffff00"
  tag-error: "#ff0000"
  kind-http: "#00ff00"
  kind-http-source: "#00ff00"
  kind-sql: "#add8e6"
  kind-sql-source: "#70a0e8"
  kind-grpc: "#00ffff"
  kind-jq: "#ee82ee"
  kind-redis: "#e87070"
  kind-md: "#70a0e8"
  kind-diff: "#70e888"
  kind-mcp: "#ffffff"
  method-unknown-bg: "#3a3a3a"
  method-unknown-fg: "#c0c0c0"
  method-get-bg: "#1a5f3a"
  method-get-fg: "#70e888"
  method-post-bg: "#2a3a5f"
  method-post-fg: "#85b4ee"
  method-put-bg: "#5f4a1a"
  method-put-fg: "#e8c070"
  method-delete-bg: "#5f1a1a"
  method-delete-fg: "#e98a8a"
  method-head-bg: "#1a5f5f"
  method-head-fg: "#70e8e8"
  method-options-bg: "#5f5f1a"
  method-options-fg: "#e8e870"
  marker-table-bg: "#1a3a5f"
  marker-table-fg: "#70c0e8"
typography:
  display-lg:
    fontFamily: Avenir, Helvetica, Arial, sans-serif
    fontSize: 2em
    fontWeight: "700"
    lineHeight: 1.2
  body-md:
    fontFamily: Avenir, Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.4
  body-sm:
    fontFamily: Avenir, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.4
  label-sm:
    fontFamily: Avenir, Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: "700"
  caption:
    fontFamily: Avenir, Helvetica, Arial, sans-serif
    fontSize: 11px
    fontWeight: "400"
  code:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 1.5
rounded:
  sm: 4px
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
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    padding: "0.5em 1em"
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
  chip-tool:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
  kind-badge:
    backgroundColor: "{colors.surface-selected}"
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
  modal-dialog:
    backgroundColor: "{colors.modal-surface}"
    width: "40%"
    height: "20%"
    padding: "{spacing.lg}"
  palette-dialog:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.sm}"
  palette-input:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-primary}"
  table-row-even:
    backgroundColor: "{colors.row-even}"
  table-row-odd:
    backgroundColor: "{colors.row-odd}"
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
    textColor: "{colors.text-disabled}"
  kind-badge-http:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-http}"
  kind-badge-http-source:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-http-source}"
  kind-badge-sql:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-sql}"
  kind-badge-sql-source:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-sql-source}"
  kind-badge-grpc:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-grpc}"
  kind-badge-jq:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-jq}"
  kind-badge-redis:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-redis}"
  kind-badge-md:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-md}"
  kind-badge-diff:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-diff}"
  kind-badge-mcp:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.kind-mcp}"
---

# apiary — Design System

## Overview

apiary is a cross-platform desktop tool for authoring and running API requests
(HTTP, SQL, gRPC, Redis, JQ, Markdown, and source/table explorers) in dockable
tabs. Visually it is a **dense, near-black developer workbench**: an almost
pitch-black field with quiet panes, native dark form controls, and color used
almost exclusively as *data markers* — never as decoration.

Three concrete rules give the app its identity:

1. **Neutrals carry the UI.** All chrome, text, surfaces, borders, and data
   tables live on a grayscale ramp between `canvas #000000` and
   `text-primary #ffffff`. Nothing in the application frame is colored.
2. **Color means protocol.** Every request kind, HTTP method, and response
   status has a fixed hue. `HTTP`/`GET` is green, `POST` blue, `DELETE` red,
   `REDIS` red, `JQ` violet, `GRPC` cyan, and so on. If you see saturated color
   in apiary, it is identifying a protocol entity or a status — never a button
   or background.
3. **The canvas is only ever one of two depths: chrome or chip.** Chrome
   surfaces are grayscale; the only colored blocks are small "chips" (kind
   badges, method markers, table/endpoint/tool markers) built as a bright text
   hue on a dim hue-matched background.

**Sources of truth.** Styles are injected at runtime by the `css`/`css.raw`
utilities in `renderer/lib/styles.ts`; the remaining visual weight comes from
three third-party dark themes (GoldenLayout dark, CodeMirror GitHub-Dark via
`@fsegurai/codemirror-theme-github-dark`, github-markdown-css) and from native
controls driven by `color-scheme: dark` in `index.html`. The protocol hue maps
live in `renderer/sidebar/shared.ts` (`badge()`) and `renderer/sidebar/tree.ts`
(`httpMethodPropsMap`). When in doubt, read those files before adding a new
color.

## Colors

All colors are used on a near-black field, so the palette is split into
neutral surfaces, text, interactive accents, and the protocol hue system.

### Neutral chrome & surfaces

| Token | Value | Used for |
|---|---|---|
| `canvas` | `#000000` | GoldenLayout dock canvas, splitters, gaps, tool chips |
| `surface` | `#222222` | Pane content (GoldenLayout dark theme) |
| `surface-raised` | `#2a2a2a` | Menus, dropdowns, palette dialog |
| `surface-input` | `#1a1a1a` | Palette search field |
| `surface-footer` | `#1f1f1f` | Palette footer |
| `surface-active` | `#353535` | Palette option hover / current row |
| `surface-hover` | `#404040` | Row hover, menu borders |
| `surface-selected` | `#202020` | Selected chips/badges, table highlight |
| `modal-surface` | `#444444` | Modal dialog body |
| `row-even` / `row-odd` | `#020202` / `#101010` | Zebra striping of data tables |

Hairlines on menus, dropdowns, and the palette use a `1px` line in the same
`#404040` value as `surface-hover`; the command-palette outline ring is
`#7068ab`. Both hairline colors are chrome-only and never used as
backgrounds.

Data tables alternate `row-even #020202` and `row-odd #101010`; hovering a cell
or column header raises it to `surface-selected #202020` (also defined as the
CSS variables `--row-highlight` / `--col-highlight` in `index.html`).

### Text

| Token | Value | Used for |
|---|---|---|
| `text-primary` | `#ffffff` | Primary text, menu items, active values |
| `text-emphasis` | `#e0e0e0` | Tree/sidebar request labels, emphasized content |
| `text-muted` | `#cccccc` | Secondary labels, palette body text |
| `text-faint` | `#888888` | Hints, iconography, helper text |
| `text-disabled` | `#666666` | Disabled/inactive controls |
| `text-hint` | `#808080` | Placeholder states ("(None)", idle icons) |

Keep readable text at `text-emphasis` or brighter; `text-hint` and below are
for metadata, empty states, and icons only.

### Interactive accents

`primary #0b74e0` is the single action color (primary `NButton`); the sort
affirmations use `primary-strong #007bff`; the focused GoldenLayout tab glows
with `focus #354be3`; a drag-hovered splitter tints `hover-accent #0000cd`
(legacy `mediumblue`). Selection tints may be translucent blues, e.g. the
sort-priority badge uses `rgba(0, 100, 255, 0.3)` over the zebra rows.

### Protocol hue system (the identity)

Two strata of saturated color exist; do not conflate them.

**1. Kind badges (request rows in the tree).** Bold uppercase 2–4 letter
labels (`HTTP`, `SQL`, `GRPC`, `JQ`, `MD`, `REDIS`, `DIFF`, `MCP`, plus `HTTP*`
and `SQL*` for source requests) rendered on `surface-selected #202020`, colored
per kind: `kind-http #00ff00`, `kind-sql #add8e6`, `kind-grpc #00ffff`,
`kind-jq #ee82ee`, `kind-redis #e87070`, `kind-md #70a0e8`, `kind-diff
#70e888`, `kind-mcp #ffffff`, `kind-sql-source #70a0e8`, `kind-http-source
#00ff00`.

**2. Tinted chips (dim background, bright text).** Discovered endpoints,
tables, and tools render as a bright label on a *dim, hue-matched* background —
e.g. a `GET` endpoint chip is `method-get-fg #70e888` on `method-get-bg
#1a5f3a`. The full HTTP method set is fixed:

| Method | Background | Foreground |
|---|---|---|
| GET | `method-get-bg #1a5f3a` | `method-get-fg #70e888` |
| POST | `method-post-bg #2a3a5f` | `method-post-fg #85b4ee` |
| PUT | `method-put-bg #5f4a1a` | `method-put-fg #e8c070` |
| DELETE | `method-delete-bg #5f1a1a` | `method-delete-fg #e98a8a` |
| HEAD | `method-head-bg #1a5f5f` | `method-head-fg #70e8e8` |
| OPTIONS | `method-options-bg #5f5f1a` | `method-options-fg #e8e870` |
| other/unknown | `method-unknown-bg #3a3a3a` | `method-unknown-fg #c0c0c0` |

Discovered tables use `marker-table-bg #1a3a5f` / `marker-table-fg #70c0e8`
("TBL"); discovered MCP tools use a black chip (`canvas`) with white text
("TOOL"). Fallback "EP" endpoints reuse the GET green pair.

**3. Sparse status tags.** Small one-to-three character markers (HTTP status
codes, tree method tags, `StatusLabel`) may use the pure keyword hues exactly
as defined by `NTag`: `tag-success #00ff00` (lime), `tag-info #0000ff` (blue),
`tag-warning #ffff00` (yellow), `tag-error #ff0000` (red). These are
full-saturation by design and reserved for isolated text markers — never as
backgrounds or fills. Response codes map `2xx → success`, `3xx–4xx →
warning`, `5xx → error`, with the code spelled in the tooltip.

Error affordances that are not protocol-related stay muted: destructive-row
icons use a softened `#ff4444` and hover states of `.highlight-red` resolve to
`#ff0000`.

## Typography

The typeface is **Avenir**, falling back to Helvetica/Arial, for all UI text;
monospace is used only where data or code is displayed (editors, JSON views,
identifiers, table blobs).

The default body size is the platform default (`body-md 16px`); dense
secondary text is sized in `em` relative to it — `0.875em ≈ 14px` (`body-sm`)
for request headers, `0.8em ≈ 13px` for labels, `0.7em ≈ 11px` (`caption`) for
table cells and metadata. Keep this em-relative practice so text scales with
the base.

- **`display-lg`** (2em, bold) — large status/result codes (e.g. `NResult`
  headings).
- **`label-sm`** (12px, bold) — kind badges, method chips, and all protocol
  labels. Protocol labels are always uppercase text set in `label-sm`; the
  casing is part of the identity and must not be lowered.
- **`code`** (monospace, 13px) — code and JSON. All editor surfaces
  (CodeMirror) use the GitHub-Dark palette; plain `Json`/`pre` views keep the
  same mono discipline.
- Plain prose in results/docs renders through github-markdown-css in dark mode.

## Layout

apiary is a docking workbench: a **fixed `sidebar 300px`** request tree on the
left and a GoldenLayout dock canvas on the right, joined by a `5px` splitter
(`NSplit`). The sidebar can collapse to a `sidebar-collapsed 3em` rail showing
only the expand chevron. Everything else — request tabs, result panes, viewer
panels — is a user-dockable GoldenLayout component; never build a fixed
sidebar into a component that is meant to be docked.

Inside panels, layout is dense and em-relative:

- Tree rows are flex rows with `sm 8px` gaps between the kind badge and the
  label; labels truncate with ellipsis; nesting indents progressively.
- Virtual children (tables/endpoints/tools) render inside their source with
  narrow chips (`min-width 2em`) above the label.
- Groups of controls inside a request use `md 0.5em` gaps; `ParamsList` and
  key/value rows use `sm 8px`; chip padding is `2px 4px` (`xxs/xs`).
- Modals are centered dialogs of `width 40%` / `height 20%` with `lg 1em`
  padding; `NTabs` present a plain row of text buttons with `0.5em` spacing.
- All scrollable regions use the thin `NScrollbar` container.

## Elevation & Depth

Depth comes from **luminance, not shadows**. Hierarchy is expressed by raising
a surface's value (`#020202` zebra → `#202020` hover → `#404040` selected) and
by borders, so the app stays flat and quiet. The only shadowed, elevated
surfaces are overlays that must visually detach from the canvas:

- **Dropdown/context menus** (`z-index: 1000`): `surface-raised #2a2a2a` with a
  `1px border`, `4px` radius, and `0 2px 8px rgba(0, 0, 0, 0.5)`.
- **Command palette**: `surface-raised` with a violet `#7068ab` outline ring and
  `0 10px 30px rgba(0, 0, 0, 0.3)` over a `rgba(0, 0, 0, 0.5)` scrim.
- **Modal** (`z-index: 100`): full-viewport overlay with `backdrop-filter:
  blur(3px)` over the dimmed canvas; the dialog body is `modal-surface #444444`
  — the brightest neutral in the app — signaling it sits above everything.
- GoldenLayout raises the focused tab header to `#222222` with a `focus
  #354be3` underline glow; the drag proxy is `#444444`.

Do not add box shadows to in-canvas chrome or data tables; use a border or a
`surface-*` step instead.

## Shapes

Corner radii are minimal because the content is dense and data-dense:

- **`rounded.sm` = 4px** — menus, dropdowns, and palette only.
- **`rounded.circle`** (a `9999px` radius, i.e. fully round) — numeric sort-priority badges and type dots in
  table headers/cells.
- **Chips (kind badges, method markers) are square** — `2px 4px` padding, no
  radius. They read as tightly set type, not as pills.
- **Native controls keep their platform shape.** Inputs, selects, buttons, and
  scrollbars are deliberately unstyled and themed by `color-scheme: dark`;
  never round or re-skin them with custom CSS.

## Components

The component kit (`renderer/components/`, prefixed `N`) is small and direct.
All values below reference the frontmatter tokens.

**Buttons (`NButton`)** — `button-primary` is the filled action button:
`#0b74e0` background, white text. Non-primary buttons are left unstyled so they
fall back to native dark controls. Button states are opacity-only: loading
drops to `0.8` with a spinner glyph (`⏳`) and a `wait` cursor; disabled drops
to `0.6` with `not-allowed`. Primary blue never appears on non-interactive
elements.

**Tags (`NTag`)** — colored text markers. The four semantic types map exactly
to `tag-success #00ff00` / `tag-info #0000ff` / `tag-warning #ffff00` /
`tag-error #ff0000`. Callers override with the kind or method foreground when
rendering protocol labels (request rows), or pass an explicit style for tinted
chips (endpoint rows, `chip-method-*`, `chip-table`, `chip-tool`).

**Request tree rows** — flex rows of `kind-badge` + `request-label`. The badge
is `surface-selected #202020` with bold, colored, uppercase kind text per the
`kind-*` tokens; the label is `text-emphasis #e0e0e0`. Loading sources pulse
(`1.5s` opacity keyframes); empty children show the `empty-label` "(None)" in
italic `text-hint`.

**Data tables (`DataTable`, `NTable`)** — fixed-layout tables with zebra rows
(`table-row-even` / `table-row-odd`), hover/header highlight at
`surface-selected`, type icons in grey at 15px, and a blue sort language: the
active column's sort arrow is `primary-strong #007bff`, inactive is
`text-disabled #666666`, and multi-column sort order shows as a circular badge
with `rgba(0, 100, 255, 0.3)` fill and white text. Cells keep `caption` sizing
for density.

**Dropdowns/menus** — `globalDropdown` renders fixed-position menus with the
`dropdown-menu` tokens (`surface-raised` on `#404040` border, `4px` radius,
`0 2px 8px rgba(0,0,0,0.5)`, `min-width 120px`, `z-index 1000`), clamped to the
viewport.

**Command palette** — the ⌘K overlay: `palette-dialog` (`surface-raised` body,
violet `#7068ab` outline ring, deep shadow), `palette-input` (`#1a1a1a` field,
white text), option rows that raise `surface-active #353535` on hover and
`surface-hover #404040` when selected, hints in `text-faint`, and a
`surface-footer` hint bar. Row text is `text-muted`.

**Modal (`Modal`, `NModal`)** — centered confirm dialogs per `modal-dialog`;
overlay is the blurred full-screen scrim described under Elevation. Title is an
`h3` in `display-lg`-adjacent weight; the action row (`NButton`s padded
`0.5em 1em`) sits `space-around` at the bottom; clicking outside closes.

**Tabs (`NTabs`)** — the in-panel switcher: plain text buttons with `0.5em`
gaps and no chrome; the active tab is the clicked state of a native button.
Real document tabs live in GoldenLayout and are not restyled per component.

**Icons (`NIcon`)** — inline SVG glyphs (Ant-style outline set) at 1em, colored
via `currentColor`; grey is the default tone for metadata/type icons
(`text-hint`), and protocol/status colors apply only when an icon represents a
protocol entity or result state.

**Editors & code surfaces** — CodeMirror with the GitHub-Dark theme for SQL,
JSON, Markdown and other code; plain `pre`/`Json` views (2-space pretty JSON)
inherit the `code` token. Never apply the Avenir stack or protocol hues inside
an editor.

## Do's and Don'ts

**Do**
- Do use the grayscale ramp for all UI chrome: canvases, panels, text, borders,
  hovers. If a color is not identifying a protocol entity or a status, it
  should be a neutral.
- Do keep the hue system fixed and centralized in `badge()` /
  `httpMethodPropsMap`. A `GET` must always be green `#70e888`-on-`#1a5f3a`-style
  tinted or `#202020`-based, `DELETE` always red, `REDIS` always red — everywhere,
  including newly added request kinds.
- Do render protocol labels as bold, uppercase text in `label-sm` inside a chip;
  kind badges sit on `surface-selected #202020`, tinted method markers use the
  dim-bg/bright-text pairs.
- Do preserve density: em-relative type (0.7–0.875em), `2–8px` padding and gap
  scale, zebra data tables, truncated single-line labels.
- Do reach for native dark controls (inputs, selects, scrollbars) and the
  global themes (GoldenLayout dark, CodeMirror GitHub-Dark); extend them in one
  place instead of styling per component.
- Do add new colors to the token frontmatter (and to the maps in code) when
  adding a protocol kind; never hardcode a one-off hex in a component.

**Don't**
- Don't use protocol hues (lime, blue, yellow, red, cyan, violet…) on buttons,
  backgrounds, body text, or any non-data element. `primary #0b74e0` is the
  only colored control surface.
- Don't apply the pure keyword hues (`tag-*`) as fills or to large areas — they
  are sparse status markers by design.
- Don't add box shadows to in-canvas content; only overlays (menus, palette,
  modal) may carry shadow + blur.
- Don't re-skin GoldenLayout per-pane or override CodeMirror's theme locally;
  change those themes once, globally, if they need to evolve.
- Don't mix typefaces into the Avenir stack for UI text, and don't set UI text
  in monospace — mono is reserved for code/data surfaces.
- Don't invent new radius styles for chips (keep them square) or round native
  form controls.
- Don't restyle or decorate existing `N*` components inline when a token or
  component entry already expresses the intent.
