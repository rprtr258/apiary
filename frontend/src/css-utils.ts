import {css} from "./styles.ts";

/**
 * CSS Utility Functions for apiary Design System
 * These utilities generate CSS classes using the existing css() function
 */

// Spacing Utilities
export const spacing = {
  // Padding
  p: (value: string) => css(`padding: ${value};`),
  px: (value: string) => css(`padding-left: ${value}; padding-right: ${value};`),
  py: (value: string) => css(`padding-top: ${value}; padding-bottom: ${value};`),
  pt: (value: string) => css(`padding-top: ${value};`),
  pr: (value: string) => css(`padding-right: ${value};`),
  pb: (value: string) => css(`padding-bottom: ${value};`),
  pl: (value: string) => css(`padding-left: ${value};`),
  
  // Margin
  m: (value: string) => css(`margin: ${value};`),
  mx: (value: string) => css(`margin-left: ${value}; margin-right: ${value};`),
  my: (value: string) => css(`margin-top: ${value}; margin-bottom: ${value};`),
  mt: (value: string) => css(`margin-top: ${value};`),
  mr: (value: string) => css(`margin-right: ${value};`),
  mb: (value: string) => css(`margin-bottom: ${value};`),
  ml: (value: string) => css(`margin-left: ${value};`),
  
  // Gap
  gap: (value: string) => css(`gap: ${value};`),
  gapX: (value: string) => css(`column-gap: ${value};`),
  gapY: (value: string) => css(`row-gap: ${value};`),
};

// Typography Utilities
export const typography = {
  // Font Size
  textXs: css(`font-size: var(--font-size-xs);`),
  textSm: css(`font-size: var(--font-size-sm);`),
  textMd: css(`font-size: var(--font-size-md);`),
  textLg: css(`font-size: var(--font-size-lg);`),
  textXl: css(`font-size: var(--font-size-xl);`),
  textXxl: css(`font-size: var(--font-size-xxl);`),
  
  // Font Weight
  fontLight: css(`font-weight: var(--font-weight-light);`),
  fontRegular: css(`font-weight: var(--font-weight-regular);`),
  fontMedium: css(`font-weight: var(--font-weight-medium);`),
  fontSemibold: css(`font-weight: var(--font-weight-semibold);`),
  fontBold: css(`font-weight: var(--font-weight-bold);`),
  
  // Text Color
  textPrimary: css(`color: var(--color-text-primary);`),
  textSecondary: css(`color: var(--color-text-secondary);`),
  textTertiary: css(`color: var(--color-text-tertiary);`),
  textDisabled: css(`color: var(--color-text-disabled);`),
  textInverse: css(`color: var(--color-text-inverse);`),
  
  // Text Alignment
  textLeft: css(`text-align: left;`),
  textCenter: css(`text-align: center;`),
  textRight: css(`text-align: right;`),
  textJustify: css(`text-align: justify;`),
  
  // Line Height
  leadingTight: css(`line-height: var(--line-height-tight);`),
  leadingNormal: css(`line-height: var(--line-height-normal);`),
  leadingRelaxed: css(`line-height: var(--line-height-relaxed);`),
  leadingLoose: css(`line-height: var(--line-height-loose);`),
  
  // Font Family
  fontSans: css(`font-family: var(--font-family);`),
  fontMono: css(`font-family: var(--font-family-mono);`),
};

// Layout Utilities
export const layout = {
  // Display
  block: css(`display: block;`),
  inlineBlock: css(`display: inline-block;`),
  inline: css(`display: inline;`),
  flex: css(`display: flex;`),
  inlineFlex: css(`display: inline-flex;`),
  grid: css(`display: grid;`),
  inlineGrid: css(`display: inline-grid;`),
  hidden: css(`display: none;`),
  
  // Flex Direction
  flexRow: css(`flex-direction: row;`),
  flexRowReverse: css(`flex-direction: row-reverse;`),
  flexCol: css(`flex-direction: column;`),
  flexColReverse: css(`flex-direction: column-reverse;`),
  
  // Flex Justify Content
  justifyStart: css(`justify-content: flex-start;`),
  justifyEnd: css(`justify-content: flex-end;`),
  justifyCenter: css(`justify-content: center;`),
  justifyBetween: css(`justify-content: space-between;`),
  justifyAround: css(`justify-content: space-around;`),
  justifyEvenly: css(`justify-content: space-evenly;`),
  
  // Flex Align Items
  itemsStart: css(`align-items: flex-start;`),
  itemsEnd: css(`align-items: flex-end;`),
  itemsCenter: css(`align-items: center;`),
  itemsBaseline: css(`align-items: baseline;`),
  itemsStretch: css(`align-items: stretch;`),
  
  // Flex Wrap
  flexWrap: css(`flex-wrap: wrap;`),
  flexWrapReverse: css(`flex-wrap: wrap-reverse;`),
  flexNowrap: css(`flex-wrap: nowrap;`),
  
  // Grid
  gridCols: (value: string) => css(`grid-template-columns: ${value};`),
  gridRows: (value: string) => css(`grid-template-rows: ${value};`),
  gridFlowRow: css(`grid-auto-flow: row;`),
  gridFlowCol: css(`grid-auto-flow: column;`),
  gridFlowDense: css(`grid-auto-flow: dense;`),
  
  // Position
  static: css(`position: static;`),
  fixed: css(`position: fixed;`),
  absolute: css(`position: absolute;`),
  relative: css(`position: relative;`),
  sticky: css(`position: sticky;`),
  
  // Width & Height
  wFull: css(`width: 100%;`),
  hFull: css(`height: 100%;`),
  wScreen: css(`width: 100vw;`),
  hScreen: css(`height: 100vh;`),
  wAuto: css(`width: auto;`),
  hAuto: css(`height: auto;`),
  
  // Overflow
  overflowAuto: css(`overflow: auto;`),
  overflowHidden: css(`overflow: hidden;`),
  overflowVisible: css(`overflow: visible;`),
  overflowScroll: css(`overflow: scroll;`),
  overflowXAuto: css(`overflow-x: auto;`),
  overflowYAuto: css(`overflow-y: auto;`),
  overflowXHidden: css(`overflow-x: hidden;`),
  overflowYHidden: css(`overflow-y: hidden;`),
};

// Visual Utilities
export const visual = {
  // Background Colors
  bgPrimary: css(`background-color: var(--color-bg-primary);`),
  bgSecondary: css(`background-color: var(--color-bg-secondary);`),
  bgTertiary: css(`background-color: var(--color-bg-tertiary);`),
  bgSurface: css(`background-color: var(--color-bg-surface);`),
  bgElevated: css(`background-color: var(--color-bg-elevated);`),
  
  bgTransparent: css(`background-color: transparent;`),
  bgCurrent: css(`background-color: currentColor;`),
  
  // Border
  border: css(`border: 1px solid var(--color-border);`),
  borderLight: css(`border: 1px solid var(--color-border-light);`),
  borderHeavy: css(`border: 1px solid var(--color-border-heavy);`),
  borderTop: css(`border-top: 1px solid var(--color-border);`),
  borderRight: css(`border-right: 1px solid var(--color-border);`),
  borderBottom: css(`border-bottom: 1px solid var(--color-border);`),
  borderLeft: css(`border-left: 1px solid var(--color-border);`),
  
  borderNone: css(`border: none;`),
  
  // Border Radius
  roundedXs: css(`border-radius: var(--border-radius-xs);`),
  roundedSm: css(`border-radius: var(--border-radius-sm);`),
  roundedMd: css(`border-radius: var(--border-radius-md);`),
  roundedLg: css(`border-radius: var(--border-radius-lg);`),
  roundedXl: css(`border-radius: var(--border-radius-xl);`),
  roundedFull: css(`border-radius: var(--border-radius-full);`),
  
  roundedTop: css(`border-top-left-radius: var(--border-radius-md); border-top-right-radius: var(--border-radius-md);`),
  roundedRight: css(`border-top-right-radius: var(--border-radius-md); border-bottom-right-radius: var(--border-radius-md);`),
  roundedBottom: css(`border-bottom-left-radius: var(--border-radius-md); border-bottom-right-radius: var(--border-radius-md);`),
  roundedLeft: css(`border-top-left-radius: var(--border-radius-md); border-bottom-left-radius: var(--border-radius-md);`),
  
  // Shadows
  shadowXs: css(`box-shadow: var(--shadow-xs);`),
  shadowSm: css(`box-shadow: var(--shadow-sm);`),
  shadowMd: css(`box-shadow: var(--shadow-md);`),
  shadowLg: css(`box-shadow: var(--shadow-lg);`),
  shadowXl: css(`box-shadow: var(--shadow-xl);`),
  shadowInset: css(`box-shadow: var(--shadow-inset);`),
  shadowNone: css(`box-shadow: none;`),
  
  // Opacity
  opacity0: css(`opacity: 0;`),
  opacity25: css(`opacity: 0.25;`),
  opacity50: css(`opacity: 0.5;`),
  opacity75: css(`opacity: 0.75;`),
  opacity100: css(`opacity: 1;`),
  
  // Cursor
  cursorAuto: css(`cursor: auto;`),
  cursorDefault: css(`cursor: default;`),
  cursorPointer: css(`cursor: pointer;`),
  cursorWait: css(`cursor: wait;`),
  cursorText: css(`cursor: text;`),
  cursorMove: css(`cursor: move;`),
  cursorNotAllowed: css(`cursor: not-allowed;`),
  cursorHelp: css(`cursor: help;`),
  cursorProgress: css(`cursor: progress;`),
  cursorGrab: css(`cursor: grab;`),
  cursorGrabbing: css(`cursor: grabbing;`),
  
  // User Select
  selectNone: css(`user-select: none;`),
  selectText: css(`user-select: text;`),
  selectAll: css(`user-select: all;`),
  selectAuto: css(`user-select: auto;`),
  
  // Pointer Events
  pointerEventsNone: css(`pointer-events: none;`),
  pointerEventsAuto: css(`pointer-events: auto;`),
};

// Semantic Color Utilities
export const semantic = {
  // Text Colors
  textPrimary: css(`color: var(--color-primary);`),
  textSuccess: css(`color: var(--color-success);`),
  textWarning: css(`color: var(--color-warning);`),
  textError: css(`color: var(--color-error);`),
  textInfo: css(`color: var(--color-info);`),
  
  // Background Colors
  bgPrimary: css(`background-color: var(--color-primary);`),
  bgSuccess: css(`background-color: var(--color-success);`),
  bgWarning: css(`background-color: var(--color-warning);`),
  bgError: css(`background-color: var(--color-error);`),
  bgInfo: css(`background-color: var(--color-info);`),
  
  // Border Colors
  borderPrimary: css(`border-color: var(--color-primary);`),
  borderSuccess: css(`border-color: var(--color-success);`),
  borderWarning: css(`border-color: var(--color-warning);`),
  borderError: css(`border-color: var(--color-error);`),
  borderInfo: css(`border-color: var(--color-info);`),
  
  // Fill Colors (for SVGs)
  fillPrimary: css(`fill: var(--color-primary);`),
  fillSuccess: css(`fill: var(--color-success);`),
  fillWarning: css(`fill: var(--color-warning);`),
  fillError: css(`fill: var(--color-error);`),
  fillInfo: css(`fill: var(--color-info);`),
  
  // Stroke Colors (for SVGs)
  strokePrimary: css(`stroke: var(--color-primary);`),
  strokeSuccess: css(`stroke: var(--color-success);`),
  strokeWarning: css(`stroke: var(--color-warning);`),
  strokeError: css(`stroke: var(--color-error);`),
  strokeInfo: css(`stroke: var(--color-info);`),
};

// Interactive State Utilities
export const interactive = {
  // Hover States
  hoverBg: css(`&:hover { background-color: var(--color-hover); }`),
  hoverTextPrimary: css(`&:hover { color: var(--color-primary); }`),
  hoverBorderPrimary: css(`&:hover { border-color: var(--color-primary); }`),
  hoverShadowMd: css(`&:hover { box-shadow: var(--shadow-md); }`),
  hoverScale: css(`&:hover { transform: scale(1.02); }`),
  hoverTranslateY: css(`&:hover { transform: translateY(-1px); }`),
  
  // Active States
  activeBg: css(`&:active { background-color: var(--color-active); }`),
  activeScale: css(`&:active { transform: scale(0.98); }`),
  activeTranslateY: css(`&:active { transform: translateY(0); }`),
  
  // Focus States
  focusRing: css(`&:focus { outline: 2px solid var(--color-focus); outline-offset: 2px; }`),
  focusRingPrimary: css(`&:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }`),
  focusWithinRing: css(`&:focus-within { outline: 2px solid var(--color-focus); outline-offset: 2px; }`),
  
  // Disabled States
  disabled: css(`&:disabled { opacity: 0.5; cursor: not-allowed; }`),
  disabledPointerEvents: css(`&:disabled { pointer-events: none; }`),
  
  // Selected States
  selectedBg: css(`&[aria-selected="true"] { background-color: var(--color-selected); }`),
  selectedTextPrimary: css(`&[aria-selected="true"] { color: var(--color-primary); }`),
  
  // Checked States
  checkedBgPrimary: css(`&:checked { background-color: var(--color-primary); }`),
  checkedBorderPrimary: css(`&:checked { border-color: var(--color-primary); }`),
};

// Animation Utilities
export const animation = {
  // Transitions
  transitionFast: css(`transition: all var(--transition-fast);`),
  transitionNormal: css(`transition: all var(--transition-normal);`),
  transitionSlow: css(`transition: all var(--transition-slow);`),
  transitionBounce: css(`transition: all var(--transition-bounce);`),
  
  transitionColors: css(`transition: color var(--transition-normal), background-color var(--transition-normal), border-color var(--transition-normal);`),
  transitionTransform: css(`transition: transform var(--transition-normal);`),
  transitionOpacity: css(`transition: opacity var(--transition-normal);`),
  transitionShadow: css(`transition: box-shadow var(--transition-normal);`),
  
  // Animations
  animatePulse: css(`animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;`),
  animateSpin: css(`animation: spin 1s linear infinite;`),
  animatePing: css(`animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;`),
  animateBounce: css(`animation: bounce 1s infinite;`),
  animateFadeIn: css(`animation: fadeIn 0.3s ease-out;`),
  animateFadeOut: css(`animation: fadeOut 0.3s ease-out;`),
  animateSlideInUp: css(`animation: slideInUp 0.3s ease-out;`),
  animateSlideInDown: css(`animation: slideInDown 0.3s ease-out;`),
  animateSlideInLeft: css(`animation: slideInLeft 0.3s ease-out;`),
  animateSlideInRight: css(`animation: slideInRight 0.3s ease-out;`),
  
  // Animation Keyframes (to be added to global styles)
  keyframes: {
    pulse: `@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`,
    spin: `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`,
    ping: `@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }`,
    bounce: `@keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); } }`,
    fadeIn: `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`,
    fadeOut: `@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }`,
    slideInUp: `@keyframes slideInUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`,
    slideInDown: `@keyframes slideInDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`,
    slideInLeft: `@keyframes slideInLeft { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`,
    slideInRight: `@keyframes slideInRight { from { transform: translateX(10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`,
  },
};

// Z-index Utilities
export const zIndex = {
  dropdown: css(`z-index: var(--z-index-dropdown);`),
  sticky: css(`z-index: var(--z-index-sticky);`),
  fixed: css(`z-index: var(--z-index-fixed);`),
  modalBackdrop: css(`z-index: var(--z-index-modal-backdrop);`),
  modal: css(`z-index: var(--z-index-modal);`),
  popover: css(`z-index: var(--z-index-popover);`),
  tooltip: css(`z-index: var(--z-index-tooltip);`),
};

// Request Kind Color Utilities
export const requestKind = {
  // Text Colors
  textHttp: css(`color: var(--color-kind-http);`),
  textSql: css(`color: var(--color-kind-sql);`),
  textGrpc: css(`color: var(--color-kind-grpc);`),
  textJq: css(`color: var(--color-kind-jq);`),
  textRedis: css(`color: var(--color-kind-redis);`),
  textMd: css(`color: var(--color-kind-md);`),
  textSqlSource: css(`color: var(--color-kind-sqlsource);`),
  textHttpSource: css(`color: var(--color-kind-httpsource);`),
  
  // Background Colors
  bgHttp: css(`background-color: var(--color-kind-http);`),
  bgSql: css(`background-color: var(--color-kind-sql);`),
  bgGrpc: css(`background-color: var(--color-kind-grpc);`),
  bgJq: css(`background-color: var(--color-kind-jq);`),
  bgRedis: css(`background-color: var(--color-kind-redis);`),
  bgMd: css(`background-color: var(--color-kind-md);`),
  bgSqlSource: css(`background-color: var(--color-kind-sqlsource);`),
  bgHttpSource: css(`background-color: var(--color-kind-httpsource);`),
  
  // Border Colors
  borderHttp: css(`border-color: var(--color-kind-http);`),
  borderSql: css(`border-color: var(--color-kind-sql);`),
  borderGrpc: css(`border-color: var(--color-kind-grpc);`),
  borderJq: css(`border-color: var(--color-kind-jq);`),
  borderRedis: css(`border-color: var(--color-kind-redis);`),
  borderMd: css(`border-color: var(--color-kind-md);`),
  borderSqlSource: css(`border-color: var(--color-kind-sqlsource);`),
  borderHttpSource: css(`border-color: var(--color-kind-httpsource);`),
};

// HTTP Method Color Utilities
export const httpMethod = {
  // Text Colors
  textGet: css(`color: var(--color-method-get);`),
  textPost: css(`color: var(--color-method-post);`),
  textPut: css(`color: var(--color-method-put);`),
  textPatch: css(`color: var(--color-method-patch);`),
  textDelete: css(`color: var(--color-method-delete);`),
  textHead: css(`color: var(--color-method-head);`),
  textOptions: css(`color: var(--color-method-options);`),
  textConnect: css(`color: var(--color-method-connect);`),
  textTrace: css(`color: var(--color-method-trace);`),
  
  // Background Colors
  bgGet: css(`background-color: var(--color-method-get);`),
  bgPost: css(`background-color: var(--color-method-post);`),
  bgPut: css(`background-color: var(--color-method-put);`),
  bgPatch: css(`background-color: var(--color-method-patch);`),
  bgDelete: css(`background-color: var(--color-method-delete);`),
  bgHead: css(`background-color: var(--color-method-head);`),
  bgOptions: css(`background-color: var(--color-method-options);`),
  bgConnect: css(`background-color: var(--color-method-connect);`),
  bgTrace: css(`background-color: var(--color-method-trace);`),
  
  // Border Colors
  borderGet: css(`border-color: var(--color-method-get);`),
  borderPost: css(`border-color: var(--color-method-post);`),
  borderPut: css(`border-color: var(--color-method-put);`),
  borderPatch: css(`border-color: var(--color-method-patch);`),
  borderDelete: css(`border-color: var(--color-method-delete);`),
  borderHead: css(`border-color: var(--color-method-head);`),
  borderOptions: css(`border-color: var(--color-method-options);`),
  borderConnect: css(`border-color: var(--color-method-connect);`),
  borderTrace: css(`border-color: var(--color-method-trace);`),
};

// Composite Utility Classes (commonly used combinations)
export const composite = {
  // Card-like element
  card: css(`
    ${visual.bgSurface}
    ${visual.border}
    ${visual.roundedMd}
    ${spacing.p("var(--spacing-md)")}
    ${interactive.hoverShadowMd}
    ${animation.transitionNormal}
  `),
  
  // Interactive button base
  buttonBase: css(`
    ${layout.inlineFlex}
    ${layout.itemsCenter}
    ${layout.justifyCenter}
    ${typography.fontMedium}
    ${visual.roundedMd}
    ${visual.borderNone}
    ${visual.cursorPointer}
    ${animation.transitionNormal}
    ${interactive.focusRing}
    ${interactive.disabled}
  `),
  
  // Input base
  inputBase: css(`
    ${visual.bgSurface}
    ${visual.border}
    ${visual.roundedMd}
    ${spacing.px("var(--spacing-md)")}
    ${spacing.py("var(--spacing-sm)")}
    ${typography.textMd}
    ${typography.textPrimary}
    ${animation.transitionColors}
    ${interactive.focusRing}
    
    &:focus {
      ${semantic.borderPrimary}
    }
    
    &::placeholder {
      ${typography.textTertiary}
    }
  `),
  
  // Badge base
  badgeBase: css(`
    ${layout.inlineFlex}
    ${layout.itemsCenter}
    ${layout.justifyCenter}
    ${typography.fontSemibold}
    ${typography.textXs}
    ${visual.roundedFull}
    ${spacing.px("var(--spacing-sm)")}
    ${spacing.py("var(--spacing-xxs)")}
    ${typography.textInverse}
  `),
  
  // Tooltip base
  tooltipBase: css(`
    ${visual.bgElevated}
    ${typography.textSm}
    ${typography.textPrimary}
    ${visual.roundedSm}
    ${spacing.p("var(--spacing-sm)")}
    ${visual.shadowMd}
    ${zIndex.tooltip}
    max-width: 300px;
  `),
  
  // Modal backdrop
  modalBackdrop: css(`
    ${layout.fixed}
    ${layout.wScreen}
    ${layout.hScreen}
    ${visual.bgPrimary}
    background-color: rgba(0, 0, 0, 0.5);
    ${zIndex.modalBackdrop}
    ${layout.flex}
    ${layout.itemsCenter}
    ${layout.justifyCenter}
    ${animation.animateFadeIn}
  `),
  
  // Loading spinner
  loadingSpinner: css(`
    ${animation.animateSpin}
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    ${visual.roundedFull}
    width: 1em;
    height: 1em;
  `),
};

// Export all utilities as a single object for convenience
export const utils = {
  spacing,
  typography,
  layout,
  visual,
  semantic,
  interactive,
  animation,
  zIndex,
  requestKind,
  httpMethod,
  composite,
};

// Helper function to combine multiple utility classes
export function cls(...classes: string[]): string {
  return classes.filter(Boolean).join(" ");
}

// Helper function to create responsive utility classes
export function responsive(breakpoint: "sm" | "md" | "lg" | "xl", utility: string): string {
  return css(`@media (min-width: ${breakpoint === "sm" ? "640px" : breakpoint === "md" ? "768px" : breakpoint === "lg" ? "1024px" : "1280px"}) { ${utility} }`);
}