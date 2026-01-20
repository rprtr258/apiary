import {describe, test, expect, mock} from "bun:test";
import {useTabs} from "./useTabs.ts";

describe("useTabs", () => {
  const mockTabs = [
    {id: "tab1", label: "Tab 1", disabled: false},
    {id: "tab2", label: "Tab 2", disabled: false},
    {id: "tab3", label: "Tab 3", disabled: true},
    {id: "tab4", label: "Tab 4", disabled: false},
  ];

  test("initializes with first enabled tab by default", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(tabs.activeTab.value).toBe("tab1");
    expect(tabs.activeTabIndex.value).toBe(0);
  });

  test("initializes with specified initial tab", () => {
    const tabs = useTabs({
      tabs: mockTabs,
      initialTab: "tab2",
    });

    expect(tabs.activeTab.value).toBe("tab2");
    expect(tabs.activeTabIndex.value).toBe(1);
  });

  test("throws error when initial tab is disabled", () => {
    expect(() => {
      useTabs({
        tabs: mockTabs,
        initialTab: "tab3",
      });
    }).toThrow("Tab \"tab3\" is disabled");
  });

  test("throws error when initial tab not found", () => {
    expect(() => {
      useTabs({
        tabs: mockTabs,
        initialTab: "nonexistent",
      });
    }).toThrow("Tab \"nonexistent\" not found or disabled");
  });

  test("throws error when no enabled tabs available", () => {
    const allDisabledTabs = [
      {id: "tab1", label: "Tab 1", disabled: true},
      {id: "tab2", label: "Tab 2", disabled: true},
    ];

    expect(() => {
      useTabs({
        tabs: allDisabledTabs,
      });
    }).toThrow("No enabled tabs available");
  });

  test("throws error when tabs array is empty", () => {
    expect(() => {
      useTabs({
        tabs: [],
      });
    }).toThrow("at least one tab required");
  });

  test("changes active tab with setActiveTab", () => {
    const tabChangeMock = mock((tabID: string) => void tabID);
    const tabs = useTabs({
      tabs: mockTabs,
      on: {tabChange: tabChangeMock},
    });

    tabs.setActiveTab("tab2");
    expect(tabs.activeTab.value).toBe("tab2");
    expect(tabs.activeTabIndex.value).toBe(1);
    expect(tabChangeMock).toHaveBeenCalledTimes(1);
    expect(tabChangeMock).toHaveBeenCalledWith("tab2");
  });

  test("throws error when setting active tab to disabled tab", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(() => {
      tabs.setActiveTab("tab3");
    }).toThrow("Tab \"tab3\" is disabled");
  });

  test("throws error when setting active tab to non-existent tab", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(() => {
      tabs.setActiveTab("nonexistent");
    }).toThrow("Tab with id \"nonexistent\" not found");
  });

  test("changes active tab with setActiveTabByIndex", () => {
    const tabChangeMock = mock((tabID: string) => void tabID);
    const tabs = useTabs({
      tabs: mockTabs,
      on: {tabChange: tabChangeMock},
    });

    tabs.setActiveTabByIndex(3); // tab4
    expect(tabs.activeTab.value).toBe("tab4");
    expect(tabs.activeTabIndex.value).toBe(3);
    expect(tabChangeMock).toHaveBeenCalledTimes(1);
    expect(tabChangeMock).toHaveBeenCalledWith("tab4");
  });

  test("throws error when setting active tab by out of bounds index", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(() => {
      tabs.setActiveTabByIndex(10);
    }).toThrow("Tab index 10 out of bounds");
  });

  test("throws error when setting active tab by index to disabled tab", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(() => {
      tabs.setActiveTabByIndex(2); // tab3 is disabled
    }).toThrow("Tab at index 2 is disabled");
  });

  test("navigates to next tab with nextTab", () => {
    const tabChangeMock = mock((tabID: string) => void tabID);
    const tabs = useTabs({
      tabs: mockTabs,
      on: {tabChange: tabChangeMock},
    });

    // Start at tab1
    tabs.nextTab(); // Should go to tab2
    expect(tabs.activeTab.value).toBe("tab2");
    expect(tabs.activeTabIndex.value).toBe(1);
    expect(tabChangeMock).toHaveBeenCalledTimes(1);
    expect(tabChangeMock).toHaveBeenCalledWith("tab2");

    tabs.nextTab(); // Should skip tab3 (disabled) and go to tab4
    expect(tabs.activeTab.value).toBe("tab4");
    expect(tabs.activeTabIndex.value).toBe(3);
    expect(tabChangeMock).toHaveBeenCalledTimes(2);
    expect(tabChangeMock).toHaveBeenCalledWith("tab4");

    tabs.nextTab(); // Should wrap around to tab1
    expect(tabs.activeTab.value).toBe("tab1");
    expect(tabs.activeTabIndex.value).toBe(0);
    expect(tabChangeMock).toHaveBeenCalledTimes(3);
    expect(tabChangeMock).toHaveBeenCalledWith("tab1");
  });

  test("navigates to previous tab with prevTab", () => {
    const tabChangeMock = mock((tabID: string) => void tabID);
    const tabs = useTabs({
      tabs: mockTabs,
      initialTab: "tab4",
      on: {tabChange: tabChangeMock},
    });

    // Start at tab4
    tabs.prevTab(); // Should go to tab2 (skip tab3 disabled)
    expect(tabs.activeTab.value).toBe("tab2");
    expect(tabs.activeTabIndex.value).toBe(1);
    expect(tabChangeMock).toHaveBeenCalledTimes(1);
    expect(tabChangeMock).toHaveBeenCalledWith("tab2");

    tabs.prevTab(); // Should go to tab1
    expect(tabs.activeTab.value).toBe("tab1");
    expect(tabs.activeTabIndex.value).toBe(0);
    expect(tabChangeMock).toHaveBeenCalledTimes(2);
    expect(tabChangeMock).toHaveBeenCalledWith("tab1");

    tabs.prevTab(); // Should wrap around to tab4
    expect(tabs.activeTab.value).toBe("tab4");
    expect(tabs.activeTabIndex.value).toBe(3);
    expect(tabChangeMock).toHaveBeenCalledTimes(3);
    expect(tabChangeMock).toHaveBeenCalledWith("tab4");
  });

  test("does not change tab when all other tabs are disabled", () => {
    const tabsWithOneEnabled = [
      {id: "tab1", label: "Tab 1", disabled: false},
      {id: "tab2", label: "Tab 2", disabled: true},
      {id: "tab3", label: "Tab 3", disabled: true},
    ];

    const tabs = useTabs({
      tabs: tabsWithOneEnabled,
    });

    // Should stay on tab1 since others are disabled
    tabs.nextTab();
    expect(tabs.activeTab.value).toBe("tab1");
    expect(tabs.activeTabIndex.value).toBe(0);

    tabs.prevTab();
    expect(tabs.activeTab.value).toBe("tab1");
    expect(tabs.activeTabIndex.value).toBe(0);
  });

  test("checks if tab is disabled with isTabDisabled", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(tabs.isTabDisabled("tab1")).toBe(false);
    expect(tabs.isTabDisabled("tab2")).toBe(false);
    expect(tabs.isTabDisabled("tab3")).toBe(true);
    expect(tabs.isTabDisabled("tab4")).toBe(false);
    expect(tabs.isTabDisabled("nonexistent")).toBe(false); // Returns false for non-existent tabs
  });

  test("gets tab index with tabIndex", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(tabs.tabIndex("tab1")).toBe(0);
    expect(tabs.tabIndex("tab2")).toBe(1);
    expect(tabs.tabIndex("tab3")).toBe(2);
    expect(tabs.tabIndex("tab4")).toBe(3);
    expect(tabs.tabIndex("nonexistent")).toBe(-1);
  });

  test("gets tab by ID with tabByID", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(tabs.tabByID("tab1")).toEqual(mockTabs[0]);
    expect(tabs.tabByID("tab2")).toEqual(mockTabs[1]);
    expect(tabs.tabByID("tab3")).toEqual(mockTabs[2]);
    expect(tabs.tabByID("tab4")).toEqual(mockTabs[3]);
    expect(tabs.tabByID("nonexistent")).toBeUndefined();
  });

  test("tabs property returns the original tabs array", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(tabs.tabs).toBe(mockTabs);
    expect(tabs.tabs.length).toBe(4);
  });
});