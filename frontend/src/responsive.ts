import {css} from "./styles.ts";
import {signal, m, type DOMNode} from "./utils.ts";

/**
 * Responsive Layout System for apiary
 * Provides breakpoints, responsive utilities, and layout components
 */

// ============================================================================
// Breakpoints
// ============================================================================

export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

// ============================================================================
// Breakpoint Signal
// ============================================================================

/**
 * Reactive signal that tracks the current breakpoint
 */
export const currentBreakpoint = signal<Breakpoint>("lg");

/**
 * Initialize breakpoint tracking
 */
export function initBreakpointTracking(): void {
  const updateBreakpoint = () => {
    const width = window.innerWidth;
    
    if (width < breakpoints.sm) {
      currentBreakpoint.update(() => "xs");
    } else if (width < breakpoints.md) {
      currentBreakpoint.update(() => "sm");
    } else if (width < breakpoints.lg) {
      currentBreakpoint.update(() => "md");
    } else if (width < breakpoints.xl) {
      currentBreakpoint.update(() => "lg");
    } else if (width < breakpoints.xxl) {
      currentBreakpoint.update(() => "xl");
    } else {
      currentBreakpoint.update(() => "xxl");
    }
  };
  
  // Initial update
  updateBreakpoint();
  
  // Update on resize with debounce
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("resize", () => {
    if (resizeTimeout !== undefined) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(updateBreakpoint, 100);
  });
}

// ============================================================================
// Responsive Utility Functions
// ============================================================================

/**
 * Check if current breakpoint is mobile (xs or sm)
 */
export function isMobile(): boolean {
  const bp = currentBreakpoint.value;
  return bp === "xs" || bp === "sm";
}

/**
 * Check if current breakpoint is tablet (md)
 */
export function isTablet(): boolean {
  return currentBreakpoint.value === "md";
}

/**
 * Check if current breakpoint is desktop (lg, xl, xxl)
 */
export function isDesktop(): boolean {
  const bp = currentBreakpoint.value;
  return bp === "lg" || bp === "xl" || bp === "xxl";
}

/**
 * Check if current breakpoint is at least the specified breakpoint
 */
export function isAtLeast(breakpoint: Breakpoint): boolean {
  const currentWidth = window.innerWidth;
  return currentWidth >= breakpoints[breakpoint];
}

/**
 * Check if current breakpoint is at most the specified breakpoint
 */
export function isAtMost(breakpoint: Breakpoint): boolean {
  const currentWidth = window.innerWidth;
  return currentWidth <= breakpoints[breakpoint];
}

/**
 * Check if current breakpoint is between two breakpoints (inclusive)
 */
export function isBetween(min: Breakpoint, max: Breakpoint): boolean {
  const currentWidth = window.innerWidth;
  return currentWidth >= breakpoints[min] && currentWidth <= breakpoints[max];
}

// ============================================================================
// Responsive CSS Utilities
// ============================================================================

/**
 * Create a responsive CSS class that applies styles at specific breakpoints
 */
export function responsive(
  styles: string,
  breakpoint: Breakpoint = "md",
  direction: "up" | "down" = "up",
): string {
  if (direction === "up") {
    return css(`@media (min-width: ${breakpoints[breakpoint]}px) { ${styles} }`);
  } else {
    return css(`@media (max-width: ${breakpoints[breakpoint] - 1}px) { ${styles} }`);
  }
}

/**
 * Create responsive visibility classes
 */
export const responsiveVisibility = {
  hiddenOnMobile: css(`@media (max-width: ${breakpoints.md - 1}px) { display: none !important; }`),
  hiddenOnTablet: css(`@media (min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px) { display: none !important; }`),
  hiddenOnDesktop: css(`@media (min-width: ${breakpoints.lg}px) { display: none !important; }`),
  visibleOnMobile: css(`@media (max-width: ${breakpoints.md - 1}px) { display: block !important; }`),
  visibleOnTablet: css(`@media (min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px) { display: block !important; }`),
  visibleOnDesktop: css(`@media (min-width: ${breakpoints.lg}px) { display: block !important; }`),
};

// ============================================================================
// Responsive Layout Components
// ============================================================================

/**
 * Container component with responsive max-width
 */
export function Container(props: {
  children: DOMNode[],
  size?: "sm" | "md" | "lg" | "xl" | "full",
  padding?: "none" | "sm" | "md" | "lg" | "xl",
  class?: string,
}) {
  const sizeClasses = {
    sm: css(`max-width: ${breakpoints.sm}px;`),
    md: css(`max-width: ${breakpoints.md}px;`),
    lg: css(`max-width: ${breakpoints.lg}px;`),
    xl: css(`max-width: ${breakpoints.xl}px;`),
    full: css(`max-width: 100%;`),
  };
  
  const paddingClasses = {
    none: css(`padding: 0;`),
    sm: css(`padding: 0 var(--spacing-sm);`),
    md: css(`padding: 0 var(--spacing-md);`),
    lg: css(`padding: 0 var(--spacing-lg);`),
    xl: css(`padding: 0 var(--spacing-xl);`),
  };
  
  const size = props.size ?? "xl";
  const padding = props.padding ?? "md";
  
  const containerClass = css(`
    width: 100%;
    margin: 0 auto;
    ${sizeClasses[size]}
    ${paddingClasses[padding]}
    
    @media (max-width: ${breakpoints.sm}px) {
      padding: 0 var(--spacing-sm);
    }
  `);
  
  return m("div", {
    class: `${containerClass} ${props.class ?? ""}`,
  }, props.children);
}

/**
 * Grid component with responsive columns
 */
export function Grid(props: {
  children: DOMNode[],
  cols?: number | {xs?: number, sm?: number, md?: number, lg?: number, xl?: number},
  gap?: "none" | "sm" | "md" | "lg" | "xl",
  class?: string,
}) {
  const gap = props.gap ?? "md";
  const gapClasses = {
    none: css(`gap: 0;`),
    sm: css(`gap: var(--spacing-sm);`),
    md: css(`gap: var(--spacing-md);`),
    lg: css(`gap: var(--spacing-lg);`),
    xl: css(`gap: var(--spacing-xl);`),
  };
  
  // Generate responsive grid template columns
  let gridTemplateColumns = "";
  if (typeof props.cols === "number") {
    gridTemplateColumns = `repeat(${props.cols}, 1fr)`;
  } else if (props.cols !== undefined) {
    const {xs, sm, md, lg, xl} = props.cols;
    gridTemplateColumns = `
      ${xs !== undefined ? `@media (max-width: ${breakpoints.sm - 1}px) { grid-template-columns: repeat(${xs}, 1fr); }` : ""}
      ${sm !== undefined ? `@media (min-width: ${breakpoints.sm}px) and (max-width: ${breakpoints.md - 1}px) { grid-template-columns: repeat(${sm}, 1fr); }` : ""}
      ${md !== undefined ? `@media (min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px) { grid-template-columns: repeat(${md}, 1fr); }` : ""}
      ${lg !== undefined ? `@media (min-width: ${breakpoints.lg}px) and (max-width: ${breakpoints.xl - 1}px) { grid-template-columns: repeat(${lg}, 1fr); }` : ""}
      ${xl !== undefined ? `@media (min-width: ${breakpoints.xl}px) { grid-template-columns: repeat(${xl}, 1fr); }` : ""}
    `;
  } else {
    gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
  }
  
  const gridClass = css(`
    display: grid;
    ${gapClasses[gap]}
    ${gridTemplateColumns}
    
    @media (max-width: ${breakpoints.sm}px) {
      grid-template-columns: 1fr;
    }
  `);
  
  return m("div", {
    class: `${gridClass} ${props.class ?? ""}`,
  }, props.children);
}

/**
 * Stack component for vertical spacing
 */
export function Stack(props: {
  children: DOMNode[],
  direction?: "vertical" | "horizontal",
  spacing?: "none" | "sm" | "md" | "lg" | "xl",
  align?: "start" | "center" | "end" | "stretch",
  justify?: "start" | "center" | "end" | "between" | "around",
  responsive?: boolean,
  class?: string,
}) {
  const direction = props.direction ?? "vertical";
  const isVertical = direction === "vertical";
  const spacing = props.spacing ?? "md";
  const align = props.align ?? "stretch";
  const justify = props.justify ?? "start";
  
  const spacingClasses = {
    none: css(`gap: 0;`),
    sm: css(`gap: var(--spacing-sm);`),
    md: css(`gap: var(--spacing-md);`),
    lg: css(`gap: var(--spacing-lg);`),
    xl: css(`gap: var(--spacing-xl);`),
  };
  
  const alignClasses = {
    start: css(`align-items: flex-start;`),
    center: css(`align-items: center;`),
    end: css(`align-items: flex-end;`),
    stretch: css(`align-items: stretch;`),
  };
  
  const justifyClasses = {
    start: css(`justify-content: flex-start;`),
    center: css(`justify-content: center;`),
    end: css(`justify-content: flex-end;`),
    between: css(`justify-content: space-between;`),
    around: css(`justify-content: space-around;`),
  };
  
  const baseClass = css(`
    display: flex;
    flex-direction: ${isVertical ? "column" : "row"};
    ${spacingClasses[spacing]}
    ${alignClasses[align]}
    ${justifyClasses[justify]}
  `);
  
  const responsiveClass = props.responsive === true
    ? css(`
        @media (max-width: ${breakpoints.md}px) {
          flex-direction: column;
        }
      `)
    : "";
  
  return m("div", {
    class: `${baseClass} ${responsiveClass} ${props.class ?? ""}`,
  }, props.children);
}

/**
 * Responsive sidebar layout
 */
export function SidebarLayout(props: {
  sidebar: DOMNode,
  main: DOMNode,
  sidebarWidth?: string,
  sidebarPosition?: "left" | "right",
  collapseBreakpoint?: Breakpoint,
  class?: string,
}) {
  const sidebarWidth = props.sidebarWidth ?? "var(--sidebar-width)";
  const position = props.sidebarPosition ?? "left";
  const breakpoint = props.collapseBreakpoint ?? "md";
  
  const layoutClass = css(`
    display: grid;
    height: 100%;
    grid-template-columns: ${position === "left" ? `${sidebarWidth} 1fr` : `1fr ${sidebarWidth}`};
    grid-template-areas: ${position === "left" ? "\"sidebar main\"" : "\"main sidebar\""};
    gap: 0;
    
    @media (max-width: ${breakpoints[breakpoint] - 1}px) {
      grid-template-columns: 1fr;
      grid-template-areas: "main";
      
      .sidebar {
        position: fixed;
        ${position}: 0;
        top: 0;
        width: ${sidebarWidth};
        height: 100vh;
        z-index: var(--z-index-fixed);
        transform: translateX(${position === "left" ? "-100%" : "100%"});
        transition: transform var(--transition-normal);
        box-shadow: var(--shadow-lg);
      }
      
      .sidebar.open {
        transform: translateX(0);
      }
    }
  `);
  
  const sidebarClass = css(`
    grid-area: sidebar;
    overflow: hidden;
  `);
  
  const mainClass = css(`
    grid-area: main;
    overflow: hidden;
  `);
  
  return m("div", {
    class: `${layoutClass} ${props.class ?? ""}`,
  }, [
    m("div", {class: `sidebar ${sidebarClass}`}, [props.sidebar]),
    m("div", {class: mainClass}, [props.main]),
  ]);
}

/**
 * Responsive modal overlay for mobile
 */
export function ResponsiveModal(props: {
  children: DOMNode[],
  open: boolean,
  onClose: () => void,
  position?: "center" | "bottom",
  class?: string,
}) {
  const position = props.position ?? "center";
  
  const modalClass = css(`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-index-modal);
    display: ${props.open === true ? "flex" : "none"};
    align-items: ${position === "center" ? "center" : "flex-end"};
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.5);
    animation: fadeIn var(--transition-normal);
    
    .modal-content {
      background-color: var(--color-bg-surface);
      border-radius: ${position === "center" ? "var(--border-radius-lg)" : "var(--border-radius-lg) var(--border-radius-lg) 0 0"};
      max-width: ${position === "center" ? "90%" : "100%"};
      max-height: 90vh;
      overflow: auto;
      animation: ${position === "center" ? "scaleIn" : "slideUp"} var(--transition-normal);
      
      @media (min-width: ${breakpoints.md}px) {
        max-width: 600px;
      }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `);
  
  return m("div", {
    class: `${modalClass} ${props.class ?? ""}`,
    onclick: (e: Event) => {
      if (e.target === e.currentTarget) {
        props.onClose();
      }
    },
  }, [
    m("div", {
      class: "modal-content",
    }, props.children),
  ]);
}

// ============================================================================
// Responsive Hook
// ============================================================================

/**
 * Hook to get current breakpoint in components
 */
export function useBreakpoint(): Breakpoint {
  return currentBreakpoint.value;
}

/**
 * Hook to check if current viewport is mobile
 */
export function useIsMobile(): boolean {
  return isMobile();
}

/**
 * Hook to check if current viewport is desktop
 */
export function useIsDesktop(): boolean {
  return isDesktop();
}

// ============================================================================
// Initialize responsive system
// ============================================================================

// Initialize breakpoint tracking when module is loaded
if (typeof window !== "undefined") {
  initBreakpointTracking();
}