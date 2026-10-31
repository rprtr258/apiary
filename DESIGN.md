---
name: apiary
version: 2
description: A calm, precise desktop workbench for authoring and inspecting API requests. Cool slate surfaces separated by soft luminance steps and hairlines, one blue action color, and a single memorable system - protocol chips - where every request kind, HTTP method and status has its own fixed, harmonized hue.
colors:
  # Surfaces: cool slate, five clear steps. Depth = luminance + hairline, not shadow.
  canvas: "#0c0d10"
  surface: "#14161b"
  surface-sunken: "#0f1115"
  surface-raised: "#1b1e24"
  surface-overlay: "#21252d"
  surface-hover: "#20242b"
  surface-active: "#272c35"
  surface-selected: "#1c2433"
  row-odd: "#171a20"
  # Hairlines
  border-subtle: "#1f232a"
  border: "#2a2f38"
  border-strong: "#3a404b"
  # Text
  text-primary: "#f2f4f8"
  text-emphasis: "#d6dae2"
  text-muted: "#a4abb8"
  text-faint: "#7c8493"
  text-disabled: "#565d6b"
  # Action & focus (the only non-semantic color in the chrome)
  primary: "#2f6fed"
  primary-hover: "#4a82f2"
  primary-pressed: "#2560d6"
  on-primary: "#ffffff"
  accent-text: "#7aa7ff"
  accent-tint: "rgba(47, 111, 237, 0.16)"
  focus-ring: "rgba(110, 160, 255, 0.55)"
  scrim: "rgba(6, 7, 9, 0.62)"
  # Status (text and tinted chips only, never solid fills)
  status-success: "#4cd08a"
  status-info: "#6ea0ff"
  status-warning: "#f0b95a"
  status-error: "#f26d78"
  # Request kinds (chip foreground; chip background is always 14% of the same hue)
  kind-http: "#4cd08a"
  kind-http-source: "#4cd08a"
  kind-sql: "#7ec8e8"
  kind-sql-source: "#5aa9d6"
  kind-grpc: "#4fd6d0"
  kind-jq: "#c39bf0"
  kind-redis: "#f07f7f"
  kind-md: "#8aa8f0"
  kind-diff: "#a3d977"
  kind-mcp: "#e6e9ef"
  # HTTP methods (foreground; background = rgba of the same hue at 14%)
  method-get-fg: "#4cd08a"
  method-get-bg: "rgba(76, 208, 138, 0.14)"
  method-post-fg: "#7fb0ff"
  method-post-bg: "rgba(127, 176, 255, 0.14)"
  method-put-fg: "#f0b95a"
  method-put-bg: "rgba(240, 185, 90, 0.14)"
  method-patch-fg: "#e58ad0"
  method-patch-bg: "rgba(229, 138, 208, 0.14)"
  method-delete-fg: "#f2828a"
  method-delete-bg: "rgba(242, 130, 138, 0.14)"
  method-head-fg: "#5fd1c9"
  method-head-bg: "rgba(95, 209, 201, 0.14)"
  method-options-fg: "#cfd76a"
  method-options-bg: "rgba(207, 215, 106, 0.14)"
  method-unknown-fg: "#9aa2b1"
  method-unknown-bg: "rgba(154, 162, 177, 0.14)"
  marker-table-fg: "#6fb8ea"
  marker-table-bg: "rgba(111, 184, 234, 0.14)"
  marker-tool-fg: "#e6e9ef"
  marker-tool-bg: "rgba(230, 233, 239, 0.10)"
typography:
  display:
    fontFamily: "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 22px
    fontWeight: "600"
    lineHeight: 1.25
    letterSpacing: -0.01em
  title:
    fontFamily: "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 15px
    fontWeight: "600"
    lineHeight: 1.35
  body-md:
    fontFamily: "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.5
  body-sm:
    fontFamily: "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 1.45
  caption:
    fontFamily: "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.4
  chip:
    fontFamily: "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 11px
    fontWeight: "600"
    lineHeight: 1
    letterSpacing: 0.03em
  code:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 1.6
rounded:
  xs: 3px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  circle: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  row-height: 28px
  control-height: 30px
  splitter-hit: 9px
  sidebar: 280px
  sidebar-collapsed: 48px
shadows:
  overlay-sm: "0 4px 16px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(255, 255, 255, 0.04)"
  overlay-lg: "0 24px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)"
motion:
  fast: "120ms cubic-bezier(0.2, 0, 0, 1)"
  overlay: "160ms cubic-bezier(0.2, 0, 0, 1)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: "{spacing.control-height}"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-emphasis}"
    rounded: "{rounded.md}"
    height: "{spacing.control-height}"
    padding: "0 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    height: "{spacing.control-height}"
    padding: "0 10px"
  input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "{spacing.control-height}"
    padding: "0 10px"
  # The focus ring is a stroke, and the design.md component model has no outline
  # sub-token, so it is modeled like the splitter hairline: a component whose
  # fill is the stroke color.
  focus-ring:
    size: "2px"
    backgroundColor: "{colors.focus-ring}"
  chip:
    typography: "{typography.chip}"
    rounded: "{rounded.sm}"
    padding: "3px 6px"
  # Chip fg and its 14% tint live on separate components: pairing them as
  # backgroundColor/textColor on one component trips the design.md linter's
  # alpha-blind contrast check (the tint would be compared against its own hue,
  # 1.00:1). Composited contrast is asserted in the accessibility floor.
  chip-method-get:
    textColor: "{colors.method-get-fg}"
  chip-method-get-tint:
    backgroundColor: "{colors.method-get-bg}"
  chip-method-post:
    textColor: "{colors.method-post-fg}"
  chip-method-post-tint:
    backgroundColor: "{colors.method-post-bg}"
  chip-method-put:
    textColor: "{colors.method-put-fg}"
  chip-method-put-tint:
    backgroundColor: "{colors.method-put-bg}"
  chip-method-patch:
    textColor: "{colors.method-patch-fg}"
  chip-method-patch-tint:
    backgroundColor: "{colors.method-patch-bg}"
  chip-method-delete:
    textColor: "{colors.method-delete-fg}"
  chip-method-delete-tint:
    backgroundColor: "{colors.method-delete-bg}"
  chip-method-head:
    textColor: "{colors.method-head-fg}"
  chip-method-head-tint:
    backgroundColor: "{colors.method-head-bg}"
  chip-method-options:
    textColor: "{colors.method-options-fg}"
  chip-method-options-tint:
    backgroundColor: "{colors.method-options-bg}"
  chip-method-other:
    textColor: "{colors.method-unknown-fg}"
  chip-method-other-tint:
    backgroundColor: "{colors.method-unknown-bg}"
  chip-table:
    textColor: "{colors.marker-table-fg}"
  chip-table-tint:
    backgroundColor: "{colors.marker-table-bg}"
  chip-tool:
    textColor: "{colors.marker-tool-fg}"
  chip-tool-tint:
    backgroundColor: "{colors.marker-tool-bg}"
  status-text-success:
    textColor: "{colors.status-success}"
  status-text-info:
    textColor: "{colors.status-info}"
  status-text-warning:
    textColor: "{colors.status-warning}"
  status-text-error:
    textColor: "{colors.status-error}"
  kind-badge:
    typography: "{typography.chip}"
    rounded: "{rounded.sm}"
    padding: "3px 6px"
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
  request-label:
    textColor: "{colors.text-emphasis}"
  empty-label:
    textColor: "{colors.text-faint}"
  tree-row:
    height: "{spacing.row-height}"
    rounded: "{rounded.md}"
  tree-row-hover:
    backgroundColor: "{colors.surface-hover}"
  tree-row-selected:
    backgroundColor: "{colors.surface-selected}"
  dropdown-menu:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "4px"
  combobox-popup:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "4px"
  combobox-option-highlighted:
    backgroundColor: "{colors.surface-active}"
  combobox-option-disabled:
    textColor: "{colors.text-disabled}"
  modal-dialog:
    backgroundColor: "{colors.surface-overlay}"
    rounded: "{rounded.xl}"
    width: "min(480px, 90vw)"
    padding: "{spacing.xl}"
  modal-scrim:
    backgroundColor: "{colors.scrim}"
  palette-dialog:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    width: "min(600px, 90vw)"
  palette-input:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    height: "48px"
  palette-option-hover:
    backgroundColor: "{colors.surface-hover}"
  palette-option-selected:
    backgroundColor: "{colors.surface-active}"
  palette-hint:
    textColor: "{colors.text-faint}"
  palette-footer:
    backgroundColor: "{colors.surface-sunken}"
  table-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  table-row-even:
    backgroundColor: "transparent"
  table-row-odd:
    backgroundColor: "{colors.row-odd}"
  table-row-hover:
    backgroundColor: "{colors.surface-hover}"
  sort-arrow-active:
    textColor: "{colors.accent-text}"
  sort-arrow-inactive:
    textColor: "{colors.text-disabled}"
  sort-priority-badge:
    backgroundColor: "{colors.accent-tint}"
    rounded: "{rounded.circle}"
  splitter:
    width: "1px"
    backgroundColor: "{colors.border-subtle}"
  splitter-hover:
    backgroundColor: "{colors.primary}"
  divider:
    height: "1px"
    backgroundColor: "{colors.border}"
  scrollbar-thumb:
    backgroundColor: "{colors.border-strong}"
    rounded: "{rounded.xs}"
  pane-content:
    backgroundColor: "{colors.surface}"
  dock-canvas:
    backgroundColor: "{colors.canvas}"
  dock-tab-focused:
    textColor: "{colors.text-primary}"
  label-secondary:
    textColor: "{colors.text-muted}"
---

# apiary - Design System (v2)

## Overview

apiary is a cross-platform desktop tool for authoring and running API requests
(HTTP, SQL, gRPC, Redis, JQ, Markdown, and source/table explorers) in dockable
tabs. The goal of this version is **quiet confidence**: a workbench that
disappears around your work, with enough polish that it feels deliberate rather
than default.

The look is a cool slate dark theme. Panes are separated by small steps of
luminance and 1px hairlines, corners are softly rounded, text is set in a
humane engineering sans, and nothing moves unless you moved it. The one thing
you should remember about apiary is its **protocol chips**: every kind of
request, HTTP method and result carries a fixed hue, and nothing else in the
interface does.

Four rules hold the system together:

1. **Neutrals carry the UI.** Chrome, text, surfaces and borders live on the
   slate ramp. The only chrome color is the single blue action color.
2. **Color means protocol.** Saturated color identifies a request kind, an HTTP
   method or a status. It is never decoration, never a button, never a large
   fill.
3. **One chip anatomy.** Every marker (kind, method, table, tool, status) is the
   same small shape: bright hue text on a 14% tint of that same hue, 4px
   radius. Learn one, read them all.
4. **Depth is luminance first, shadow last.** Raise a surface by one step or add
   a hairline. Only floating overlays get a shadow.

**What changed from v1.** Pure black and neon (`#000`, `#00ff00`, `#0000ff`)
gave way to a harmonized slate and a hue set tuned to equal perceived
brightness, so no protocol shouts louder than another. Native, unstyled controls
became one consistent control family. Type moved from a 16px base with 11px
data to a 14px base with a 12px minimum. Fixed-percentage modals, the violet
palette ring and the heavy zebra stripes were retired. A full mapping is in
*Migration from v1* at the end.

**Sources of truth.** Styles are injected at runtime by the `css`/`css.raw`
utilities in `renderer/lib/styles.ts`. Tokens above should be emitted once as
CSS custom properties on `:root` (for example `--surface`, `--border`,
`--kind-http`) and consumed everywhere by name. Third-party themes (GoldenLayout
dark, CodeMirror GitHub-Dark via `@fsegurai/codemirror-theme-github-dark`,
github-markdown-css) are re-tinted once, globally, to match the slate ramp.
Protocol hue maps live in `renderer/sidebar/shared.ts` (`badge()`) and
`renderer/sidebar/tree.ts` (`httpMethodPropsMap`); update those with the tokens
here. `color-scheme: dark` stays on `:root` in `index.html` so scrollbars and
form internals match.

## Colors

### Surfaces

Five steps from the window backdrop to the brightest floating layer. Each step
is clearly visible next to its neighbor without any border, and borders add
precision where steps meet.

| Token | Value | Used for |
|---|---|---|
| `canvas` | `#0c0d10` | Window backdrop, gaps between docked panes, splitters' gutters |
| `surface-sunken` | `#0f1115` | Inputs, code wells, palette footer: things you type or read into |
| `surface` | `#14161b` | Pane content, tab bodies, table headers |
| `surface-raised` | `#1b1e24` | Menus, dropdowns, command palette, secondary buttons |
| `surface-overlay` | `#21252d` | Modal dialogs: the brightest neutral, always on top |
| `surface-hover` | `#20242b` | Row, menu and button hover |
| `surface-active` | `#272c35` | Highlighted option, pressed state, current palette row |
| `surface-selected` | `#1c2433` | Selected tree row and selected cell (a faint blue lean marks "chosen") |
| `row-odd` | `#171a20` | Alternate data-table rows (a whisper, not a stripe) |

### Borders

| Token | Value | Used for |
|---|---|---|
| `border-subtle` | `#1f232a` | Pane edges, splitters, table row separators |
| `border` | `#2a2f38` | Inputs, menus, secondary buttons, chip-less dividers |
| `border-strong` | `#3a404b` | Hovered inputs, dropdown outlines, drag handles |

### Text

| Token | Value | Used for |
|---|---|---|
| `text-primary` | `#f2f4f8` | Values you act on: input text, menu items, active tab |
| `text-emphasis` | `#d6dae2` | Request labels, table body text |
| `text-muted` | `#a4abb8` | Secondary labels, table headers |
| `text-faint` | `#7c8493` | Hints, placeholders, idle icons, "(None)" |
| `text-disabled` | `#565d6b` | Disabled controls only |

`text-faint` and brighter all pass 4.5:1 on `surface`. Disabled text is exempt
and must never carry required information.

### Action and focus

`primary #2f6fed` is the one chrome color. Use `primary-hover #4a82f2` and
`primary-pressed #2560d6` for states. White text on `primary` and
`primary-pressed` passes 4.5:1; the lighter hover step sits at 3.6:1 and is used
only transiently, on hover.
`accent-text #7aa7ff` is for links and active sort arrows on dark surfaces.
`accent-tint` (16% primary) marks the sort-priority badge and drag-over targets.

Focus is always visible: `:focus-visible` draws a 2px `focus-ring` outline with a
1px offset on every interactive element. Mouse focus draws nothing.

### Protocol hue system (the identity)

Hues were chosen in a perceptual color space at matching lightness, so a
`DELETE` chip is no louder than a `GET` chip. Never substitute a hue for
another or pick a new one by eye; add it to the tokens first.

**1. Kind badges (request rows in the tree).** `HTTP`, `SQL`, `GRPC`, `JQ`, `MD`,
`REDIS`, `DIFF`, `MCP`, plus `HTTP*` and `SQL*` for source requests. Chip
anatomy, foreground per kind:

| Kind | Token | Value |
|---|---|---|
| HTTP, HTTP* | `kind-http` | `#4cd08a` |
| SQL | `kind-sql` | `#7ec8e8` |
| SQL* | `kind-sql-source` | `#5aa9d6` |
| GRPC | `kind-grpc` | `#4fd6d0` |
| JQ | `kind-jq` | `#c39bf0` |
| REDIS | `kind-redis` | `#f07f7f` |
| MD | `kind-md` | `#8aa8f0` |
| DIFF | `kind-diff` | `#a3d977` |
| MCP | `kind-mcp` | `#e6e9ef` |

The background is the same hue at 14% opacity. No separate neutral plate.

**2. Method and marker chips.** Discovered endpoints, tables and tools use the
same anatomy:

| Method | Foreground | Background |
|---|---|---|
| GET | `#4cd08a` | 14% of fg |
| POST | `#7fb0ff` | 14% of fg |
| PUT | `#f0b95a` | 14% of fg |
| PATCH | `#e58ad0` | 14% of fg |
| DELETE | `#f2828a` | 14% of fg |
| HEAD | `#5fd1c9` | 14% of fg |
| OPTIONS | `#cfd76a` | 14% of fg |
| other/unknown | `#9aa2b1` | 14% of fg |

Discovered tables use `marker-table-*` ("TBL"); discovered MCP tools use
`marker-tool-*` ("TOOL"). Fallback "EP" endpoints reuse the GET pair. PATCH is
new in v2 (it previously fell into "other").

**3. Status.** HTTP status codes and result states use `status-success #4cd08a`,
`status-info #6ea0ff`, `status-warning #f0b95a`, `status-error #f26d78`, either
as colored text or as a status chip (same anatomy, 14% tint). Mapping: `2xx` ->
success, `3xx` -> info, `4xx` -> warning, `5xx` -> error; spell the code in the
tooltip. Never use status colors as solid fills or large areas.

Non-protocol destructive affordances (delete icons, confirm-delete buttons) use
`status-error` text or icon with a `surface-hover` background on hover; they are
not red buttons.

## Typography

Two families, clearly distinct by role.

- **UI: IBM Plex Sans**, with Inter and the system sans as fallbacks. Plex has
  an engineered, slightly technical character that suits a developer tool
  without being cold, and it stays legible at small sizes.
- **Code and data: JetBrains Mono**, falling back to IBM Plex Mono and the
  system mono. Use it only for editors, JSON, identifiers and table blobs. UI
  text is never monospace, and code surfaces never use Plex.

Sizes are in `px` so density is predictable. Nothing in the product is smaller
than 12px.

| Role | Size / weight | Used for |
|---|---|---|
| `display` | 22 / 600, -0.01em | Large result headings (`NEmpty`), empty-state titles |
| `title` | 15 / 600 | Modal titles, panel headers |
| `body-md` | 14 / 400 | Default text, inputs, buttons, menus |
| `body-sm` | 13 / 400 | Tree labels, table cells, request headers |
| `caption` | 12 / 400 | Metadata, hints, palette footer |
| `chip` | 11 / 600, +0.03em | Chips only |
| `code` | 13 / 400, line-height 1.6 | Editors and JSON views |

Rules:

- **Sentence case everywhere.** Menu items, buttons, tabs and column headers are
  sentence case. The only uppercase text in apiary is protocol identifiers
  (`GET`, `HTTP`, `SQL`, `TBL`), because they are identifiers, not labels.
- Use `font-variant-numeric: tabular-nums` for table cells, status codes,
  timings and sizes so columns align.
- Weight carries hierarchy before size: 400 for content, 600 for titles and
  chips. Avoid 700.
- Keep prose lines under 80 characters in docs and result views; markdown
  renders through github-markdown-css re-tinted to the slate ramp.
- Editors use the GitHub-Dark CodeMirror theme with the editor background set to
  `surface-sunken` so code sits in a well.

## Layout

apiary is a docking workbench: a **`sidebar 280px`** request tree on the left and
a GoldenLayout dock canvas on the right. The sidebar collapses to a
`sidebar-collapsed 48px` rail holding only the expand control. Request tabs,
result panes and viewers remain user-dockable GoldenLayout components; never
build a fixed sidebar into a component meant to be docked.

**Panes float on the canvas.** Docked panes use `surface` and sit on `canvas` with
a `2px` gutter, so each pane reads as a calm, separate plate. The gutter is also
the splitter: a `1px` `border-subtle` line with a `9px` invisible hit area that
turns `primary` on hover or drag. No thick blue bars.

**Spacing runs on a 4px grid**: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`. Group
related controls with `sm`, separate sections with `lg`, and give panels `md`
to `lg` padding. Density comes from a tight row height, not from cramped
padding.

- Tree rows are `28px` tall flex rows with a `sm` gap between the kind chip and the
  label; labels truncate with an ellipsis; each nesting level indents `16px`
  with no guide lines unless the row is focused.
- Virtual children (tables, endpoints, tools) render inside their source with
  chips of a consistent `min-width 2.5em`, right-aligned text, so labels line up.
- Key/value rows (`ParamsList`) use `sm` gaps and the standard `30px` control height.
- Modals are `min(480px, 90vw)` wide with auto height, `xl` padding, and a
  right-aligned action row with `sm` gaps (primary on the right).
- `NTabs` are text tabs with `lg` spacing; the active tab is `text-primary` with a
  2px `primary` underline, inactive tabs `text-muted`.
- All scrollable regions use a thin overlay scrollbar: 10px track, transparent,
  thumb `border-strong`, fully rounded, brightening on hover.

## Elevation & Depth

Hierarchy is read first from luminance (`canvas` -> `surface` -> `surface-raised`
-> `surface-overlay`) and precision from hairlines. In-canvas content (panes,
tables, trees) has no shadow.

Floating layers detach with a hairline plus a soft shadow:

| Layer | Surface | Radius | Shadow | z-index |
|---|---|---|---|---|
| Dropdown, combobox, context menu | `surface-raised` + `border` | `lg 8px` | `overlay-sm` | 1000 |
| Command palette | `surface-raised` + `border-strong` | `xl 12px` | `overlay-lg` | 1100 |
| Modal | `surface-overlay` + `border` | `xl 12px` | `overlay-lg` | 1200 |

The modal and palette sit over a `scrim` with `backdrop-filter: blur(6px)`. The
palette no longer uses a violet ring; violet belongs to `JQ`.

GoldenLayout's focused tab uses `surface` with `text-primary` and a 2px `primary`
underline. The drag proxy is `surface-raised` with `overlay-sm` and 0.92 opacity.

## Shapes

Soft but not bubbly. A small, consistent radius scale replaces v1's all-square look.

| Token | Value | Used for |
|---|---|---|
| `xs` | 3px | Scrollbar thumbs, inline code spans |
| `sm` | 4px | **Chips and badges** |
| `md` | 6px | Buttons, inputs, tree rows, tabs |
| `lg` | 8px | Menus, dropdowns, comboboxes |
| `xl` | 12px | Modal, command palette |
| `circle` | 9999px | Sort-priority badges, type dots, status dots |

Nested radii should step down by the padding between them, so a 6px control in
an 8px menu with 4px padding looks concentric. Panes themselves are square at the
window edge and `lg 8px` where they float on the canvas.

## Components

Controls are now a **styled, consistent family** (v1 used unstyled native
controls). Style them once, globally, from tokens, with `color-scheme: dark` kept
for platform internals like date pickers and scrollbars.

**Buttons (`NButton`)** - `30px` tall, `md` radius, `body-md` at weight 500.
- *Primary*: `primary` fill, `on-primary` text. Hover `primary-hover`, pressed
  `primary-pressed`. One per view where possible.
- *Secondary* (default): `surface-raised` fill, `border`, `text-emphasis`. Hover
  `surface-active`.
- *Ghost*: transparent, `text-muted`; hover `surface-hover` + `text-primary`.
  For toolbar and icon buttons (28px square, `md` radius).
- Loading: replace the label's leading space with a 14px spinner (no emoji),
  keep width stable, `aria-busy` set, `wait` cursor. Disabled: `text-disabled`,
  no hover, `not-allowed` cursor. Transitions use `motion.fast`.
- Primary blue never appears on non-interactive elements.

**Inputs and selects** - `30px` tall, `md` radius, `surface-sunken` fill, `border`;
hover `border-strong`; focus shows the focus ring and a `primary` border.
Placeholder is `text-faint`. Invalid inputs use a `status-error` border with the
message below in `caption`. Selects reuse the input shell with a chevron icon.

**Chips and tags (`NTag`)** - one anatomy: `chip` type (11 / 600, +0.03em),
`3px 6px` padding, `sm` radius, hue text on a 14% hue tint. The semantic
`NTag` types map to `status-*`. Callers override with kind or method hue for
protocol labels. Chips are never interactive; interactive chips (filters) get a
`1px` border in the hue on hover.

**Request tree rows** - `tree-row`: 28px, `md` radius, kind chip + `request-label`
(`body-sm`, `text-emphasis`). Hover `surface-hover`; selected `surface-selected`
with a 2px `primary` bar on the left edge. Loading sources pulse the chip
(opacity 1 -> 0.5, 1.5s); empty children show "(None)" in `text-faint`, italic.

**Data tables (`DataTable`, `NTable`)** - fixed layout, 28px rows, `body-sm` with
tabular numerals, sticky header on `surface` with `text-muted` labels and a
`border-subtle` bottom edge. Rows alternate transparent / `row-odd` for a barely
visible rhythm; hover is `surface-hover`; selected is `surface-selected`. Sort
arrows are `text-disabled` inactive and `accent-text` active; multi-column sort
order is a 16px circular badge in `accent-tint` with `text-primary`. Type icons
are 14px `text-faint`. Cell text truncates; a tooltip reveals the full value.

**Dropdowns and menus** - `dropdown-menu` tokens, `4px` inner padding, items
`28px` tall with `md` radius and `10px` horizontal padding. Hover and keyboard
highlight both use `surface-active`. Separators are `border-subtle` lines with
`4px` vertical margin. Destructive items use `status-error` text. Min-width
`160px`, clamped to the viewport, opens with a 160ms fade and 4px translate
(disabled when reduced motion is on).

**Select input (`NSelectInput`)** - an input paired with an owned popup (a datalist
replacement, since native datalist options cannot be disabled in Chromium). The
popup reuses `combobox-popup` tokens. A disabled "none" placeholder in
`text-disabled` appears only when the filtered list is empty. The highlighted
option (hover and keyboard share one state) uses `surface-active`; option text
is `text-primary`, matched characters are weight 600.

**Command palette** - `palette-dialog`: 600px wide, `xl` radius, `border-strong`,
`overlay-lg`. The search field is borderless, 48px tall, `body-md`, with a
leading search icon and a `border-subtle` rule beneath it. Option rows are 36px
with `md` radius inside 6px of padding; hover `surface-hover`, selected
`surface-active`; hints right-aligned in `text-faint`. The footer is
`surface-sunken` with key hints in `caption`.

**Modal (`Modal`, `NModal`)** - `modal-dialog` on `scrim` + blur. Title in `title`
type, body in `body-md` `text-muted`, `xl` padding, actions right-aligned with
the primary action last. `Esc` and a click on the scrim close it; focus is
trapped and returned on close. Opens with a 160ms fade and 4px rise.

**Tabs (`NTabs`)** - text tabs with the underline treatment above. Real document
tabs live in GoldenLayout and are re-themed once, globally.

**Icons (`NIcon`)** - Ant-style outline glyphs at `16px` (14px inside tables and
chips), `currentColor`, 1.5px stroke look. Default tone is `text-faint`; hue
applies only when the icon represents a protocol entity or a result state.

**Empty and error states** - say what is missing and what to do, in plain
sentence-case copy: "No requests yet. Create one with `Ctrl+N`." Errors state what
went wrong and how to fix it, with `status-error` for the icon only.

**Editors and code surfaces** - CodeMirror GitHub-Dark with its background set to
`surface-sunken`, gutter `text-faint`, selection `accent-tint`. Never apply the
Plex stack or protocol hues inside an editor.

## Motion

Motion answers an action. It never plays on its own, except the loading pulse.

- Hover and press: `motion.fast` (120ms) on background, border and opacity only.
- Overlays (menus, modal, palette): `motion.overlay` (160ms), fade + 4px
  translate, origin near the trigger.
- Nothing animates layout in the dock canvas; panes snap.
- Respect `prefers-reduced-motion: reduce`: drop translates and use opacity-only
  or instant transitions.

## Accessibility floor

- Body and control text 4.5:1 or better; chip text on its 14% tint 4.5:1 or
  better (the hues above were chosen for this on `surface` and `canvas`).
- Every interactive element has a visible `:focus-visible` ring and a hit area of
  at least 28px.
- Color is never the only signal: methods and kinds always carry their text label,
  and status colors accompany the code or an icon.
- Full keyboard use of the tree, palette, menus and comboboxes; `aria-*` roles
  on custom controls.

## Do's and Don'ts

**Do**
- Do build every surface from the slate ramp and every marker from the chip
  anatomy. If a color is not identifying a protocol entity or status, it is a
  neutral or the single `primary`.
- Do keep the hue system fixed and centralized in `badge()` and
  `httpMethodPropsMap`. A `GET` is always green, `DELETE` always rose, `REDIS`
  always coral, everywhere, including newly added request kinds.
- Do consume tokens as CSS custom properties; add a token before adding a color.
- Do keep density through row height and type scale (28px rows, 13px data), not
  through shrinking padding or type below 12px.
- Do raise a surface by one step or add a hairline before reaching for a shadow.
- Do write sentence-case, active-voice copy: "Save request", not "SUBMIT".
- Do re-theme GoldenLayout, CodeMirror and markdown once, globally.

**Don't**
- Don't use protocol hues on buttons, backgrounds, body text or any non-data
  element. `primary` is the only colored control.
- Don't use status colors as solid fills or on large areas.
- Don't add shadows to in-canvas content (panes, trees, tables); only overlays
  get shadow and blur.
- Don't re-skin GoldenLayout per pane or override CodeMirror locally.
- Don't set UI text in monospace, don't set code in Plex, and don't introduce a
  third family.
- Don't use all caps for anything except protocol identifiers.
- Don't invent new radii, new chip shapes, or inline-style `N*` components when a
  token or a component entry already expresses the intent.
- Don't animate anything the user did not trigger.

## Migration from v1

| v1 | v2 |
|---|---|
| `canvas #000000` | `canvas #0c0d10` |
| `surface #222222` | `surface #14161b` |
| `surface-raised #2a2a2a` | `surface-raised #1b1e24` |
| `surface-input #1a1a1a` | `surface-sunken #0f1115` |
| `surface-footer #1f1f1f` | `surface-sunken #0f1115` |
| `surface-active #353535` | `surface-active #272c35` |
| `surface-hover #404040` | `surface-hover #20242b` (borders now use `border*`) |
| `surface-selected #202020` | `surface-selected #1c2433` (kind badge plate removed) |
| `modal-surface #444444` | `surface-overlay #21252d` |
| `row-even #020202` / `row-odd #101010` | transparent / `row-odd #171a20` |
| `text-primary #ffffff` | `#f2f4f8` |
| `text-emphasis #e0e0e0` | `#d6dae2` |
| `text-muted #cccccc` | `#a4abb8` |
| `text-faint #888888`, `text-hint #808080` | merged into `text-faint #7c8493` |
| `text-disabled #666666` | `#565d6b` |
| `primary #0b74e0`, `primary-strong #007bff` | `primary #2f6fed`, sort/links use `accent-text #7aa7ff` |
| `focus #354be3`, `hover-accent #0000cd` | `focus-ring` outline, splitter hover uses `primary` |
| `tag-success/info/warning/error` (neon) | `status-success/info/warning/error` (softened) |
| `kind-*` neon and pastel mix | harmonized `kind-*` set, 14% tint plate |
| `method-*-bg` solid dim fills | 14% alpha tints of each `method-*-fg` |
| `#7068ab` palette ring (violet) | `border-strong` hairline |
| `rounded.sm 4px` menus only, square chips | scale 3/4/6/8/12; chips `sm 4px`, controls `md 6px` |
| Avenir, 16px base, 11px data | IBM Plex Sans, 14px base, 12px minimum |
| monospace | JetBrains Mono |
| modal 40% x 20% | `min(480px, 90vw)`, auto height |
| native unstyled buttons and inputs | one styled control family at 30px |
| 5px blue-on-hover splitter | 1px hairline with 9px hit area |
