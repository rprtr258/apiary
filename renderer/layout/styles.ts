import {css} from "../lib/styles.ts";

// Layout styling. Each element gets a generated class via the project css() utility.
// Literal "lm_header"/"lm_tab" classes are also added for e2e selector compatibility.

const fullSize = css({width: "100%", height: "100%"});
const noSelect = css({userSelect: "none"});

export const cls = {
  root: [css("position:relative; width:100%; height:100%; overflow:hidden;"), fullSize].join(" "),
  row: [css("display:flex; flex-direction:row; min-width:0; min-height:0;"), fullSize].join(" "),
  column: [css("display:flex; flex-direction:column; min-width:0; min-height:0;"), fullSize].join(" "),
  stack: [css("display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden; position:relative;"), fullSize].join(" "),

  header: [css("display:flex; flex-direction:row; align-items:stretch; flex:0 0 auto; overflow:hidden; background:var(--bg2); border-bottom:1px solid var(--hair);"), noSelect, "lm_header"].join(" "),

  tab: [css("display:flex; align-items:center; gap:4px; padding:4px 10px; cursor:pointer; white-space:nowrap; color:var(--faint); border-right:1px solid var(--hair); max-width:220px;"), noSelect, "lm_tab"].join(" "),
  tabActive: css("background:var(--pane); color:var(--ink);"),
  tabCurrent: css("box-shadow: inset 0 2px 0 var(--accent);"),
  tabHover: css.raw(":hover{background:var(--sel); color:var(--ink);}"),

  tabTitle: css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"),
  tabClose: [css("cursor:pointer; padding:0 2px; opacity:0.6; font-size:14px; line-height:1;"), css.raw(":hover{opacity:1;}")].join(" "),

  items: css("flex:1 1 auto; position:relative; min-width:0; min-height:0; overflow:hidden;"),
  item: css("position:absolute; inset:0; overflow:hidden;"),

  splitter: {
    v: [css("flex:0 0 6px; cursor:col-resize; background:var(--hair); z-index:5;"), css.raw(":hover{background:var(--accent);}")].join(" "),
    h: [css("flex:0 0 6px; cursor:row-resize; background:var(--hair); z-index:5;"), css.raw(":hover{background:var(--accent);}")].join(" "),
    active: css("background:var(--accent) !important;"),
  },

  drop: css("position:absolute; background:color-mix(in srgb, var(--accent) 18%, transparent); border:2px solid color-mix(in srgb, var(--accent) 80%, transparent); pointer-events:none; z-index:50; box-sizing:border-box;"),
  proxy: [css("position:fixed; z-index:99999; pointer-events:none; opacity:0.85; background:var(--pane); color:var(--ink); padding:4px 12px; border:1px solid var(--hair); border-radius:3px; font-size:13px; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6);"), noSelect].join(" "),
};
