import {arrayGet as get, signal, Signal} from "../lib/utils.ts";

export type TabConfig<K> = {
  id: K,
  label: string,
  disabled: boolean,
};

export type UseTabsOptions<K> = {
  tabs: TabConfig<K>[],
  initialTab?: K,
  on?: {tabChange?: (tabID: K) => void},
};

export type UseTabsResult<K> = {
  // State
  tabs: TabConfig<K>[],
  activeTabIndex: Signal<number>,

  // Getters
  get isTabDisabled(): (tabID: K) => boolean,

  // Actions
  setActiveTabByIndex: (index: number) => void,
};

/** Headless hook for tab management; hard-fails on empty or all-disabled tab lists (nothing to select). */
export function useTabs<K>(options: UseTabsOptions<K>): UseTabsResult<K> {
  const {tabs, initialTab, on: {tabChange: onTabChange} = {}} = options;
  if (tabs.length === 0)
    throw new Error("at least one tab required");

  const initialIndex = initialTab !== undefined
    ? tabs.findIndex(tab => tab.id === initialTab)
    : tabs.findIndex(tab => !tab.disabled);

  if (initialIndex === -1)
    if (initialTab !== undefined)
      throw new Error(`Tab "${String(initialTab)}" not found or disabled`);
    else
      throw new Error("No enabled tabs available");
  if (tabs[initialIndex].disabled)
    throw new Error(`Tab "${String(tabs[initialIndex].id)}" is disabled`);

  const activeTabIndex = signal<number>(initialIndex);

  const setActiveTabByIndex = (index: number): void => {
    const tabOpt = get(tabs, index);
    if (tabOpt.isNone()) {
      throw new Error(`Tab index ${index} out of bounds`);
    }

    const tab = tabOpt.value;
    if (tab.disabled) {
      throw new Error(`Tab at index ${index} is disabled`);
    }
    if (index === activeTabIndex.value) {
      return;
    }

    activeTabIndex.update(() => index);
    if (onTabChange !== undefined) {
      onTabChange(tab.id);
    }
  };

  const isTabDisabled = (tabId: K): boolean => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.disabled ?? false;
  };

  return {
    tabs,
    activeTabIndex,
    isTabDisabled,
    setActiveTabByIndex,
  };
}
