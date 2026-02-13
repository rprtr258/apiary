import {css} from "../styles.ts";
import {cls} from "../css-utils.ts";
import {DOMNode, m} from "../utils.ts";

/**
 * Design System Components for apiary
 * Enhanced components with consistent styling, accessibility, and theming
 */

// ============================================================================
// Enhanced Button Component
// ============================================================================

export interface EButtonProps {
  /** Button variant */
  variant?: "primary" | "secondary" | "tertiary" | "success" | "warning" | "error" | "ghost",
  /** Button size */
  size?: "xs" | "sm" | "md" | "lg" | "xl",
  /** Whether the button is disabled */
  disabled?: boolean,
  /** Whether the button is in loading state */
  loading?: boolean,
  /** Whether the button should take full width */
  fullWidth?: boolean,
  /** Additional CSS class */
  class?: string,
  /** Inline styles */
  style?: Partial<CSSStyleDeclaration>,
  /** Click handler */
  on: {click: () => void},
  /** ARIA label for accessibility */
  "aria-label"?: string,
  /** Button type */
  type?: "button" | "submit" | "reset",
}

// Button variant styles
const buttonVariants = {
  primary: css(`
    background-color: var(--color-primary);
    color: var(--color-text-inverse);

    &:hover:not(:disabled) {
      background-color: var(--color-primary-hover);
    }

    &:active:not(:disabled) {
      background-color: var(--color-primary-active);
    }
  `),

  secondary: css(`
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);

    &:hover:not(:disabled) {
      background-color: var(--color-hover);
      border-color: var(--color-border-light);
    }

    &:active:not(:disabled) {
      background-color: var(--color-active);
    }
  `),

  tertiary: css(`
    background-color: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);

    &:hover:not(:disabled) {
      background-color: var(--color-hover);
      border-color: var(--color-border-light);
    }

    &:active:not(:disabled) {
      background-color: var(--color-active);
    }
  `),

  success: css(`
    background-color: var(--color-success);
    color: var(--color-text-inverse);

    &:hover:not(:disabled) {
      background-color: var(--color-success-hover);
    }

    &:active:not(:disabled) {
      background-color: var(--color-success-active);
    }
  `),

  warning: css(`
    background-color: var(--color-warning);
    color: var(--color-text-inverse);

    &:hover:not(:disabled) {
      background-color: var(--color-warning-hover);
    }

    &:active:not(:disabled) {
      background-color: var(--color-warning-active);
    }
  `),

  error: css(`
    background-color: var(--color-error);
    color: var(--color-text-inverse);

    &:hover:not(:disabled) {
      background-color: var(--color-error-hover);
    }

    &:active:not(:disabled) {
      background-color: var(--color-error-active);
    }
  `),

  ghost: css(`
    background-color: transparent;
    color: var(--color-text-primary);
    border: none;

    &:hover:not(:disabled) {
      background-color: var(--color-hover);
    }

    &:active:not(:disabled) {
      background-color: var(--color-active);
    }
  `),
};

// Button size styles
const buttonSizes = {
  xs: css(`
    padding: var(--spacing-xxs) var(--spacing-sm);
    font-size: var(--font-size-xs);
    height: 24px;
    min-width: 24px;
  `),

  sm: css(`
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-sm);
    height: 32px;
    min-width: 32px;
  `),

  md: css(`
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: var(--font-size-md);
    height: 40px;
    min-width: 40px;
  `),

  lg: css(`
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: var(--font-size-lg);
    height: 48px;
    min-width: 48px;
  `),

  xl: css(`
    padding: var(--spacing-lg) var(--spacing-xxl);
    font-size: var(--font-size-xl);
    height: 56px;
    min-width: 56px;
  `),
};

// Base button styles
const buttonBase = css(`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-medium);
  border-radius: var(--border-radius-md);
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal);
  gap: var(--spacing-sm);
  white-space: nowrap;
  user-select: none;

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  &.full-width {
    width: 100%;
  }

  &.loading {
    position: relative;
    color: transparent !important;

    &::after {
      content: '';
      position: absolute;
      width: 1em;
      height: 1em;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`);

export function EButton(props: EButtonProps, ...children: DOMNode[]) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";

  const buttonClass = cls(
    buttonBase,
    buttonVariants[variant],
    buttonSizes[size],
    props.fullWidth === true ? css(`width: 100%;`) : "",
    props.loading === true ? css(`position: relative; color: transparent !important;`) : "",
    props.class ?? "",
  );

  const isDisabled = props.disabled === true || props.loading === true;

  return m("button", {
    class: buttonClass,
    style: props.style,
    disabled: isDisabled ? true : undefined,
    onclick: isDisabled ? undefined : props.on.click,
    type: props.type ?? "button",
    "data-variant": variant,
    "data-size": size,
  }, props.loading === true ? [LoadingSpinner({size: "sm"}), ...children] : children);
}

// ============================================================================
// Loading Spinner Component
// ============================================================================

export interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl",
  color?: "primary" | "success" | "warning" | "error" | "info" | "current",
}

const spinnerSizes = {
  xs: css(`width: 12px; height: 12px;`),
  sm: css(`width: 16px; height: 16px;`),
  md: css(`width: 20px; height: 20px;`),
  lg: css(`width: 24px; height: 24px;`),
  xl: css(`width: 32px; height: 32px;`),
};

const spinnerColors = {
  primary: css(`border-color: var(--color-primary); border-top-color: transparent;`),
  success: css(`border-color: var(--color-success); border-top-color: transparent;`),
  warning: css(`border-color: var(--color-warning); border-top-color: transparent;`),
  error: css(`border-color: var(--color-error); border-top-color: transparent;`),
  info: css(`border-color: var(--color-info); border-top-color: transparent;`),
  current: css(`border-color: currentColor; border-top-color: transparent;`),
};

const spinnerBase = css(`
  display: inline-block;
  border: 2px solid;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`);

export function LoadingSpinner(props: LoadingSpinnerProps) {
  const size = props.size ?? "md";
  const color = props.color ?? "current";

  return m("span", {
    class: cls(spinnerBase, spinnerSizes[size], spinnerColors[color]),
    title: "Loading...",
  });
}

// ============================================================================
// Enhanced Input Component
// ============================================================================

export interface EInputProps {
  value: string,
  placeholder?: string,
  disabled?: boolean,
  readonly?: boolean,
  type?: "text" | "password" | "email" | "number" | "search",
  size?: "sm" | "md" | "lg",
  fullWidth?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  on?: {update: (value: string) => void},
  "aria-label"?: string,
}

const inputSizes = {
  sm: css(`
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-sm);
    height: 32px;
  `),

  md: css(`
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-md);
    height: 40px;
  `),

  lg: css(`
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: var(--font-size-lg);
    height: 48px;
  `),
};

const inputBase = css(`
  display: block;
  width: 100%;
  background-color: var(--color-bg-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family);
  transition: all var(--transition-normal);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-focus);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--color-bg-secondary);
  }

  &:read-only {
    background-color: var(--color-bg-secondary);
    cursor: default;
  }

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &.full-width {
    width: 100%;
  }

  &.error {
    border-color: var(--color-error);

    &:focus {
      border-color: var(--color-error);
      box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2);
    }
  }

  &.success {
    border-color: var(--color-success);

    &:focus {
      border-color: var(--color-success);
      box-shadow: 0 0 0 2px rgba(0, 168, 84, 0.2);
    }
  }
`);

export function EInput(props: EInputProps) {
  const size = props.size ?? "md";

  const inputClass = cls(
    inputBase,
    inputSizes[size],
    props.fullWidth === true ? css(`width: 100%;`) : "",
    props.class ?? "",
  );

  return m("input", {
    class: inputClass,
    style: props.style,
    value: props.value,
    placeholder: props.placeholder,
    disabled: props.disabled === true ? true : undefined,
    readOnly: props.readonly === true ? true : undefined,
    type: props.type ?? "text",
    oninput: props.on !== undefined ? (e: Event) => props.on!.update((e.target as HTMLInputElement).value) : undefined,
  });
}

// ============================================================================
// Card Component
// ============================================================================

export interface CardProps {
  title?: string,
  subtitle?: string,
  children: DOMNode[],
  variant?: "default" | "outlined" | "filled" | "elevated",
  padding?: "none" | "sm" | "md" | "lg" | "xl",
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
}

const cardVariants = {
  default: css(`
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-border);
  `),

  outlined: css(`
    background-color: transparent;
    border: 1px solid var(--color-border);
  `),

  filled: css(`
    background-color: var(--color-bg-tertiary);
    border: none;
  `),

  elevated: css(`
    background-color: var(--color-bg-surface);
    border: none;
    box-shadow: var(--shadow-md);
  `),
};

const cardPaddings = {
  none: css(`padding: 0;`),
  sm: css(`padding: var(--spacing-sm);`),
  md: css(`padding: var(--spacing-md);`),
  lg: css(`padding: var(--spacing-lg);`),
  xl: css(`padding: var(--spacing-xl);`),
};

const cardBase = css(`
  border-radius: var(--border-radius-lg);
  transition: all var(--transition-normal);

  &:hover {
    box-shadow: var(--shadow-md);
  }
`);

const cardTitleStyle = css(`
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
`);

const cardSubtitleStyle = css(`
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
`);

export function Card(props: CardProps) {
  const variant = props.variant ?? "default";
  const padding = props.padding ?? "md";

  const cardClass = cls(
    cardBase,
    cardVariants[variant],
    cardPaddings[padding],
    props.class ?? "",
  );

  const children: DOMNode[] = [];
  if (props.title !== undefined && props.title !== "") {
    children.push(m("h3", {class: cardTitleStyle}, props.title));
  }
  if (props.subtitle !== undefined && props.subtitle !== "") {
    children.push(m("p", {class: cardSubtitleStyle}, props.subtitle));
  }
  children.push(...props.children);

  return m("div", {
    class: cardClass,
    style: props.style,
  }, children);
}

// ============================================================================
// Badge Component
// ============================================================================

export interface BadgeProps {
  children: DOMNode[],
  variant?: "default" | "primary" | "success" | "warning" | "error" | "info",
  size?: "xs" | "sm" | "md",
  rounded?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
}

const badgeVariants = {
  default: css(`
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  `),

  primary: css(`
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
  `),

  success: css(`
    background-color: var(--color-success);
    color: var(--color-text-inverse);
  `),

  warning: css(`
    background-color: var(--color-warning);
    color: var(--color-text-inverse);
  `),

  error: css(`
    background-color: var(--color-error);
    color: var(--color-text-inverse);
  `),

  info: css(`
    background-color: var(--color-info);
    color: var(--color-text-inverse);
  `),
};

const badgeSizes = {
  xs: css(`
    padding: var(--spacing-xxs) var(--spacing-xs);
    font-size: var(--font-size-xs);
    height: 16px;
  `),

  sm: css(`
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-sm);
    height: 20px;
  `),

  md: css(`
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-md);
    height: 24px;
  `),
};

const badgeBase = css(`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-medium);
  border-radius: var(--border-radius-sm);
  white-space: nowrap;

  &.rounded {
    border-radius: var(--border-radius-full);
  }
`);

export function Badge(props: BadgeProps) {
  const variant = props.variant ?? "default";
  const size = props.size ?? "md";

  const badgeClass = cls(
    badgeBase,
    badgeVariants[variant],
    badgeSizes[size],
    props.rounded === true ? css(`border-radius: var(--border-radius-full);`) : "",
    props.class ?? "",
  );

  return m("span", {
    class: badgeClass,
    style: props.style,
  }, props.children);
}

// ============================================================================
// Typography Components
// ============================================================================

export function Heading1(props: {children: DOMNode[], class?: string}) {
  return m("h1", {
    class: cls(
      css(`
        font-size: var(--font-size-xxxl);
        font-weight: var(--font-weight-bold);
        line-height: var(--line-height-tight);
        margin: 0 0 var(--spacing-lg) 0;
        color: var(--color-text-primary);
      `),
      props.class ?? "",
    ),
  }, props.children);
}

export function Heading2(props: {children: DOMNode[], class?: string}) {
  return m("h2", {
    class: cls(
      css(`
        font-size: var(--font-size-xxl);
        font-weight: var(--font-weight-bold);
        line-height: var(--line-height-tight);
        margin: 0 0 var(--spacing-md) 0;
        color: var(--color-text-primary);
      `),
      props.class ?? "",
    ),
  }, props.children);
}

export function Heading3(props: {children: DOMNode[], class?: string}) {
  return m("h3", {
    class: cls(
      css(`
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-normal);
        margin: 0 0 var(--spacing-md) 0;
        color: var(--color-text-primary);
      `),
      props.class ?? "",
    ),
  }, props.children);
}

export function Heading4(props: {children: DOMNode[], class?: string}) {
  return m("h4", {
    class: cls(
      css(`
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-normal);
        margin: 0 0 var(--spacing-sm) 0;
        color: var(--color-text-primary);
      `),
      props.class ?? "",
    ),
  }, props.children);
}

export function BodyText(props: {children: DOMNode[], size?: "sm" | "md" | "lg", class?: string}) {
  const size = props.size ?? "md";
  const sizeClass = {
    sm: css(`font-size: var(--font-size-sm);`),
    md: css(`font-size: var(--font-size-md);`),
    lg: css(`font-size: var(--font-size-lg);`),
  }[size];

  return m("p", {
    class: cls(
      css(`
        font-weight: var(--font-weight-regular);
        line-height: var(--line-height-normal);
        margin: 0 0 var(--spacing-md) 0;
        color: var(--color-text-secondary);
      `),
      sizeClass,
      props.class ?? "",
    ),
  }, props.children);
}

export function Caption(props: {children: DOMNode[], class?: string}) {
  return m("span", {
    class: cls(
      css(`
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-tertiary);
        line-height: var(--line-height-normal);
      `),
      props.class ?? "",
    ),
  }, props.children);
}

// ============================================================================
// Skeleton Loader Component
// ============================================================================

export interface SkeletonProps {
  width?: string,
  height?: string,
  rounded?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
}

const skeletonBase = css(`
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-border) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  &.rounded {
    border-radius: var(--border-radius-md);
  }
`);

export function Skeleton(props: SkeletonProps) {
  const skeletonClass = cls(
    skeletonBase,
    props.rounded === true ? css(`border-radius: var(--border-radius-md);`) : "",
    props.class ?? "",
  );

  return m("div", {
    class: skeletonClass,
    style: {
      width: props.width ?? "100%",
      height: props.height ?? "1em",
      ...props.style,
    },
  });
}

// ============================================================================
// Empty State Component
// ============================================================================

export interface EmptyStateProps {
  title: string,
  description?: string,
  icon?: DOMNode,
  actions?: DOMNode[],
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
}

const emptyStateBase = css(`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xxl) var(--spacing-xl);
  text-align: center;
  color: var(--color-text-secondary);
`);

const emptyStateIconStyle = css(`
  font-size: 48px;
  margin-bottom: var(--spacing-lg);
  opacity: 0.5;
`);

const emptyStateTitleStyle = css(`
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm) 0;
`);

const emptyStateDescriptionStyle = css(`
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-lg) 0;
  max-width: 400px;
`);

const emptyStateActionsStyle = css(`
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
`);

export function EmptyState(props: EmptyStateProps) {
  const children: DOMNode[] = [];
  if (props.icon !== undefined) {
    children.push(m("div", {class: emptyStateIconStyle}, props.icon));
  }
  children.push(m("h3", {class: emptyStateTitleStyle}, props.title));
  if (props.description !== undefined && props.description !== "") {
    children.push(m("p", {class: emptyStateDescriptionStyle}, props.description));
  }
  if (props.actions !== undefined && props.actions.length > 0) {
    children.push(m("div", {class: emptyStateActionsStyle}, props.actions));
  }

  return m("div", {
    class: cls(emptyStateBase, props.class ?? ""),
    style: props.style,
  }, children);
}

// ============================================================================
// Enhanced Tabs Component
// ============================================================================

export interface ETabsProps {
  tabs: {
    name: DOMNode,
    disabled?: boolean,
    content: DOMNode,
  }[],
  variant?: "default" | "pills" | "underline",
  size?: "sm" | "md" | "lg",
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
}

const tabsBase = css(`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
`);

const tabsHeaderBase = css(`
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-xs);
`);

const tabButtonBase = css(`
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
  transition: all var(--transition-normal);
  position: relative;

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    background-color: var(--color-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`);

const tabButtonVariants = {
  default: css(`
    &.active {
      color: var(--color-primary);
      background-color: var(--color-bg-tertiary);
      border-bottom: 2px solid var(--color-primary);
    }
  `),

  pills: css(`
    border-radius: var(--border-radius-full);

    &.active {
      color: var(--color-text-inverse);
      background-color: var(--color-primary);
    }
  `),

  underline: css(`
    border-radius: 0;

    &.active {
      color: var(--color-primary);

      &::after {
        content: '';
        position: absolute;
        bottom: calc(-1 * var(--spacing-xs) - 1px);
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--color-primary);
      }
    }
  `),
};

const tabButtonSizes = {
  sm: css(`padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-sm);`),
  md: css(`padding: var(--spacing-sm) var(--spacing-md); font-size: var(--font-size-md);`),
  lg: css(`padding: var(--spacing-md) var(--spacing-lg); font-size: var(--font-size-lg);`),
};

const tabsContentBase = css(`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--spacing-md) 0;
`);

export function ETabs(props: ETabsProps): HTMLElement {
  const variant = props.variant ?? "default";
  const size = props.size ?? "md";

  const tabButtons: HTMLElement[] = [];
  const tabContents: HTMLElement[] = [];

  for (const [i, tab] of props.tabs.entries()) {
    const button = m("button", {
      class: cls(tabButtonBase, tabButtonVariants[variant], tabButtonSizes[size]),
      disabled: tab.disabled === true ? true : undefined,
      onclick: () => updateActiveTab(i),
    }, tab.name);

    const content = m("div", {
      style: {display: "none"},
    }, tab.content);

    tabButtons.push(button);
    tabContents.push(content);
  }

  let activeTabIndex = -1;

  const updateActiveTab = (newIndex: number): void => {
    if (activeTabIndex === newIndex) return;
    if (props.tabs[newIndex]?.disabled === true) return;
    if (newIndex < 0 || newIndex >= props.tabs.length) return;

    // Deactivate current tab
    if (activeTabIndex >= 0) {
      tabButtons[activeTabIndex].classList.remove("active");
      tabContents[activeTabIndex].style.display = "none";
    }

    // Activate new tab
    tabButtons[newIndex].classList.add("active");
    tabContents[newIndex].style.display = "block";
    activeTabIndex = newIndex;
  };

  // Initialize with first enabled tab
  const firstEnabledIndex = props.tabs.findIndex(tab => tab.disabled !== true);
  if (firstEnabledIndex >= 0) {
    updateActiveTab(firstEnabledIndex);
  }

  return m("div", {
    class: cls(tabsBase, props.class ?? ""),
    style: props.style,
  }, [
    m("div", {class: tabsHeaderBase}, tabButtons),
    m("div", {class: tabsContentBase}, tabContents),
  ]);
}

// ============================================================================
// Enhanced Modal Component
// ============================================================================

export interface EModalProps {
  /** Modal title */
  title: DOMNode,
  /** Modal content */
  children: DOMNode[],
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "full",
  /** Whether to show close button */
  showCloseButton?: boolean,
  /** Action buttons */
  buttons?: Array<{
    id: string,
    text: string,
    variant?: "primary" | "secondary" | "tertiary" | "success" | "warning" | "error",
    disabled?: boolean,
  }>,
  /** Event handlers */
  on: {
    /** Called when modal is closed (via close button, backdrop click, or button click) */
    close(id?: string): void,
    show?: () => void,
  },
  /** Additional CSS class */
  class?: string,
  /** Inline styles */
  style?: Partial<CSSStyleDeclaration>,
}

const modalOverlayBase = css(`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-index-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  background-color: var(--color-overlay);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`);

const modalBase = css(`
  background-color: var(--color-bg-primary);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s ease-out;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`);

const modalSizes = {
  sm: css(`width: 400px;`),
  md: css(`width: 500px;`),
  lg: css(`width: 600px;`),
  xl: css(`width: 800px;`),
  full: css(`width: 95vw; height: 95vh;`),
};

const modalHeaderBase = css(`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
`);

const modalTitleBase = css(`
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
`);

const modalCloseButtonBase = css(`
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  padding: var(--spacing-xs);
  border-radius: var(--border-radius-sm);
  line-height: 1;

  &:hover {
    background-color: var(--color-hover);
    color: var(--color-text-primary);
  }

  &:active {
    background-color: var(--color-active);
  }
`);

const modalContentBase = css(`
  flex: 1;
  padding: var(--spacing-xl);
  overflow-y: auto;
  min-height: 0;
`);

const modalFooterBase = css(`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-xl);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-bg-secondary);
`);

export function EModal(props: EModalProps) {
  const size = props.size ?? "md";
  const showCloseButton = props.showCloseButton ?? true;

  const modalEl = m("div", {
    class: cls(modalBase, modalSizes[size], props.class ?? ""),
    style: props.style,
    onclick: (e: Event) => e.stopPropagation(),
  }, [
    // Header
    m("div", {class: modalHeaderBase}, [
      m("h3", {class: modalTitleBase}, props.title),
      ...(showCloseButton ? [m("button", {
        class: modalCloseButtonBase,
        onclick: () => props.on.close(),
        "aria-label": "Close modal",
      }, "×")] : []),
    ]),

    // Content
    m("div", {class: modalContentBase}, props.children),

    // Footer with buttons
    props.buttons !== undefined && props.buttons.length > 0 ? m("div", {class: modalFooterBase},
      props.buttons.map(button => {
        const variant = button.variant ?? "secondary";
        const isPrimary = variant === "primary";
        const isDisabled = button.disabled === true;
        return m("button", {
          class: cls(
            css(`
              padding: var(--spacing-sm) var(--spacing-lg);
              border-radius: var(--border-radius-md);
              font-size: var(--font-size-md);
              font-weight: var(--font-weight-medium);
              cursor: ${isDisabled ? "not-allowed" : "pointer"};
              opacity: ${isDisabled ? "0.6" : "1"};
              transition: all 0.2s ease;
              border: 1px solid ${isPrimary ? "transparent" : "var(--color-border)"};
              background-color: ${isPrimary ? "var(--color-primary)" : "var(--color-bg-tertiary)"};
              color: ${isPrimary ? "var(--color-text-inverse)" : "var(--color-text-primary)"};

              &:hover:not(:disabled) {
                background-color: ${isPrimary ? "var(--color-primary-hover)" : "var(--color-hover)"};
                border-color: ${isPrimary ? "transparent" : "var(--color-border-light)"};
              }

              &:active:not(:disabled) {
                background-color: ${isPrimary ? "var(--color-primary-active)" : "var(--color-active)"};
              }
            `),
          ),
          disabled: button.disabled === true ? true : undefined,
          onclick: () => props.on.close(button.id),
        }, button.text);
      }),
    ) : null,
  ]);

  const overlayEl = m("div", {
    class: modalOverlayBase,
    onclick: () => props.on.close(),
  }, modalEl);

  return {
    element: overlayEl,
    show() {
      overlayEl.style.display = "flex";
    },
    hide() {
      overlayEl.style.display = "none";
    },
  };
}

// ============================================================================
// Enhanced Select Component
// ============================================================================

export interface ESelectProps<T> {
  /** Currently selected label */
  label?: string,
  /** Available options */
  options: Array<{
    label: string,
    value?: T,
    disabled?: boolean,
  }>,
  /** Placeholder text */
  placeholder?: string,
  /** Select size */
  size?: "sm" | "md" | "lg",
  /** Whether select is disabled */
  disabled?: boolean,
  /** Additional CSS class */
  class?: string,
  /** Inline styles */
  style?: Partial<CSSStyleDeclaration>,
  /** Event handlers */
  on: {
    /** Called when value changes */
    update: (value: T) => void,
  },
}

const selectBase = css(`
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--spacing-sm) center;
  background-size: 16px;
  padding-right: calc(var(--spacing-md) * 2 + 16px);

  &:hover:not(:disabled) {
    border-color: var(--color-border-light);
  }

  &:focus:not(:disabled) {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-alpha);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background-color: var(--color-bg-tertiary);
  }
`);

const selectSizes = {
  sm: css(`padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-sm);`),
  md: css(`padding: var(--spacing-sm) var(--spacing-md); font-size: var(--font-size-md);`),
  lg: css(`padding: var(--spacing-md) var(--spacing-lg); font-size: var(--font-size-lg);`),
};

const optionBase = css(`
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);

  &:disabled {
    color: var(--color-text-tertiary);
  }
`);

export function ESelect<T>(props: ESelectProps<T>): {el: HTMLElement, reset: () => void} {
  const size = props.size ?? "md";

  let current: number | null = props.options.findIndex(opt => opt.label === props.label);
  if (current === -1) {
    if (props.placeholder === undefined) {
      throw new Error(`Option ${props.label} not found in ${JSON.stringify(props.options)}`);
    }
    current = null;
  }

  const el_placeholder = m("option", {
    value: "",
    disabled: props.placeholder === undefined,
    hidden: true,
    selected: current === null,
    class: optionBase,
  }, props.placeholder ?? "");

  const el_opts = props.options.map(({label, value, disabled}, i) => m("option", {
    value: String(i),
    selected: i === current ? true : undefined,
    disabled: value === undefined || disabled === true ? true : undefined,
    class: optionBase,
  }, label));

  const selectEl = m("select", {
    class: cls(selectBase, selectSizes[size], props.class ?? ""),
    style: props.style,
    disabled: props.disabled === true ? true : undefined,
    onchange: (e: Event) => {
      const i = parseInt((e.target! as HTMLSelectElement).value);
      const value = props.options[i].value;
      if (current !== null) {
        el_opts[current].selected = false;
      }
      el_opts[i].selected = true;
      current = i;
      props.on.update(value!);
    },
  }, [
    el_placeholder,
    ...el_opts,
  ]);

  return {
    el: selectEl,
    reset() {
      if (current === null) return;

      el_opts[current].selected = false;
      el_placeholder.selected = true;
      current = null;
    },
  };
}