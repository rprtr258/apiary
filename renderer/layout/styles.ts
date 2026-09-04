import {css} from "../lib/styles.ts";

// Layout styling. Each element gets a generated class via the project css() utility.
// Literal "lm_header"/"lm_tab" classes are also added for e2e selector compatibility.

const fullSize = css("width:100%; height:100%;");
const noSelect = css("user-select:none;");

export const cls = {
  root: css("position:relative; width:100%; height:100%; overflow:hidden;") + " " + fullSize,
  row: css("display:flex; flex-direction:row; min-width:0; min-height:0;") + " " + fullSize,
  column: css("display:flex; flex-direction:column; min-width:0; min-height:0;") + " " + fullSize,
  stack: css("display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden; position:relative;") + " " + fullSize,

  header: css("display:flex; flex-direction:row; align-items:stretch; flex:0 0 auto; overflow:hidden; background:#1a1a1f; border-bottom:1px solid #000;") + " " + noSelect + " lm_header",

  tab: css("display:flex; align-items:center; gap:4px; padding:4px 10px; cursor:pointer; white-space:nowrap; color:#a0a0a0; border-right:1px solid #000; max-width:220px;") + " " + noSelect + " lm_tab",
  tabActive: css("background:#101014; color:#fff;"),
  tabCurrent: css("box-shadow: inset 0 2px 0 #5a8ab5;"),
  tabHover: css.raw(":hover{background:#222227; color:#ddd;}"),

  tabTitle: css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"),
  tabClose: css("cursor:pointer; padding:0 2px; opacity:0.6; font-size:14px; line-height:1;") + css.raw(":hover{opacity:1;}"),

  items: css("flex:1 1 auto; position:relative; min-width:0; min-height:0; overflow:hidden;"),
  item: css("position:absolute; inset:0; overflow:hidden;"),

  splitterV: css("flex:0 0 6px; cursor:col-resize; background:#3a3a40; z-index:5;") + css.raw(":hover{background:#5a8ab5;}"),
  splitterH: css("flex:0 0 6px; cursor:row-resize; background:#3a3a40; z-index:5;") + css.raw(":hover{background:#5a8ab5;}"),
  splitterActive: css("background:#5a8ab5 !important;"),

  drop: css("position:absolute; background:rgba(80,140,220,0.18); border:2px solid rgba(80,140,220,0.8); pointer-events:none; z-index:50; box-sizing:border-box;"),
  proxy: css("position:fixed; z-index:99999; pointer-events:none; opacity:0.85; background:#1a1a1f; color:#fff; padding:4px 12px; border:1px solid #000; border-radius:3px; font-size:13px; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6);") + " " + noSelect,
};
