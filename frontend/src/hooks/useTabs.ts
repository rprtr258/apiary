import {arrayGet as get, signal, Signal} from "../utils.ts";

export type TabConfig<K> = {
  id: K,
  label: string,
  disabled: boolean,
  icon?: string,
};

export type UseTabsOptions<K> = {
  tabs: TabConfig<K>[],
  initialTab?: K,
  on?: {tabChange?: (tabID: K) => void},
};

export type UseTabsResult<K> = {
  // State
  tabs: TabConfig<K>[],
  activeTab: Signal<K>,
  activeTabIndex: Signal<number>,

  // Getters
  get isTabDisabled(): (tabID: K) => boolean,
  get tabIndex(): (tabID: K) => number,
  get tabByID(): (tabID: K) => TabConfig<K> | undefined,

  // Actions
  setActiveTab: (tabID: K) => void,
  setActiveTabByIndex: (index: number) => void,
  nextTab: () => void,
  prevTab: () => void,
};

/** Headless hook for tab management */
export function useTabs<K>(options: UseTabsOptions<K>): UseTabsResult<K> {
  const {tabs, initialTab, on: {tabChange: onTabChange} = {}} = options;
  if (tabs.length === 0)
    throw new Error("at least one tab required");

  const initialIndex = initialTab !== undefined
    ? tabs.findIndex(tab => tab.id === initialTab)
    : tabs.findIndex(tab => tab.disabled !== true);

  if (initialIndex === -1)
    if (initialTab !== undefined)
      throw new Error(`Tab "${String(initialTab)}" not found or disabled`);
    else
      throw new Error("No enabled tabs available");
  if (tabs[initialIndex].disabled === true)
    throw new Error(`Tab "${String(tabs[initialIndex].id)}" is disabled`);

  const activeTabIndex = signal<number>(initialIndex);
  const activeTab = signal<K>(tabs[activeTabIndex.value].id);

  const setActiveTab = (tabID: K): void => {
    const index = tabs.findIndex(tab => tab.id === tabID);
    if (index === -1) {
      throw new Error(`Tab with id "${String(tabID)}" not found`);
    }
    if (index === activeTabIndex.value) {
      return;
    }

    const tab = tabs[index];
    if (tab.disabled) {
      throw new Error(`Tab "${String(tabID)}" is disabled`);
    }

    activeTabIndex.update(() => index);
    activeTab.update(() => tabID);
    if (onTabChange !== undefined) {
      onTabChange(tabID);
    }
  };

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
    activeTab.update(() => tab.id);
    if (onTabChange !== undefined) {
      onTabChange(tab.id);
    }
  };

  const nextTab = (): void => {
    let nextIndex = (activeTabIndex.value + 1) % tabs.length;
    let attempts = 0;

    // Skip disabled tabs
    while (tabs[nextIndex]?.disabled === true && attempts < tabs.length) {
      nextIndex = (nextIndex + 1) % tabs.length;
      attempts++;
    }

    const nextTab = tabs[nextIndex];
    if (!nextTab.disabled) {
      setActiveTabByIndex(nextIndex);
    }
  };

  const prevTab = (): void => {
    let prevIndex = (activeTabIndex.value - 1 + tabs.length) % tabs.length;
    let attempts = 0;

    // Skip disabled tabs
    while (tabs[prevIndex]?.disabled === true && attempts < tabs.length) {
      prevIndex = (prevIndex - 1 + tabs.length) % tabs.length;
      attempts++;
    }

    const prevTab = tabs[prevIndex];
    if (!prevTab.disabled) {
      setActiveTabByIndex(prevIndex);
    }
  };

  const isTabDisabled = (tabId: K): boolean => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.disabled === true;
  };

  const getTabIndex = (tabId: K): number => {
    return tabs.findIndex(tab => tab.id === tabId);
  };

  const getTabById = (tabId: K): TabConfig<K> | undefined => {
    return tabs.find(tab => tab.id === tabId);
  };

  return {
    tabs,
    activeTab,
    activeTabIndex,
    isTabDisabled,
    tabIndex: getTabIndex,
    tabByID: getTabById,
    setActiveTab,
    setActiveTabByIndex,
    nextTab,
    prevTab,
  };
}
