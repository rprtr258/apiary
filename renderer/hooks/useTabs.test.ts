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

    expect(tabs.activeTabIndex.value).toBe(0);
  });

  test("initializes with specified initial tab", () => {
    const tabs = useTabs({
      tabs: mockTabs,
      initialTab: "tab2",
    });

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

  test("changes active tab with setActiveTabByIndex", () => {
    const tabChangeMock = mock((tabID: string) => void tabID);
    const tabs = useTabs({
      tabs: mockTabs,
      on: {tabChange: tabChangeMock},
    });

    tabs.setActiveTabByIndex(3); // tab4
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

  test("tabs property returns the original tabs array", () => {
    const tabs = useTabs({
      tabs: mockTabs,
    });

    expect(tabs.tabs).toBe(mockTabs);
    expect(tabs.tabs.length).toBe(4);
  });
});
