# Headless Hooks Architecture

## Overview
The headless hooks architecture separates business logic from UI rendering in the apiary frontend. This approach improves testability, maintainability, and enables UI flexibility.

## Architecture Principles
1. **Logic Separation**: Hooks contain only business logic, no UI rendering
2. **Reusability**: Same logic can power different UI implementations
3. **Testability**: Pure logic hooks can be tested without UI dependencies
4. **Composability**: Hooks can be combined to build complex features

## Available Hooks

### `useTabs`
Manages tab state and navigation logic.

```typescript
const {activeTab, setActiveTab, nextTab, prevTab} = useTabs({
  tabs: [
    {id: "tab1", label: "Tab 1", disabled: false},
    {id: "tab2", label: "Tab 2", disabled: true},
  ],
  initialTab: "tab1",
  on: {tabChange: (tabID) => console.log("Tab changed:", tabID)},
});
```

### `useRequest`
Manages HTTP request state with loading and error handling.

```typescript
import {useRequest} from "../hooks/useRequest.ts";

const {request, loading, error, update, reset} = useRequest({
  initialRequest: {
    url: "https://api.example.com/data",
    method: "GET",
    body: "",
    headers: [{key: "Content-Type", value: "application/json"}],
  },
  on: {
    update: async (request) => {
      console.log("Request updated:", request);
    },
  },
});

// Update request properties
await update({method: "POST", body: JSON.stringify({data: "test"})});

// Reset to initial state
reset();
```

### `useResponse`
Manages HTTP response state with loading and error handling.

```typescript
import {useResponse} from "../hooks/useResponse.ts";

const {response, loading, error, update, clear} = useResponse({
  initialResponse: {
    code: 200,
    body: "{\"message\": \"success\"}",
    headers: [{key: "Content-Type", value: "application/json"}],
  },
});

// Update with new response
update({
  code: 201,
  body: "{\"id\": 123}",
  headers: [{key: "Location", value: "/api/resource/123"}],
});

// Clear response
clear();
```

### Form Hooks

#### `useInput`
Manages input field state with validation.

```typescript
const nameInput = useInput({
  initialValue: "",
  validate: (value) => ({
    valid: value.length > 0,
    errors: value.length === 0 ? ["Name is required"] : [],
  }),
  on: {change: (value) => console.log("Name changed:", value)},
});
```

#### `useSelect`
Manages select/dropdown state.

```typescript
const countrySelect = useSelect({
  options: [
    {label: "USA", value: "us"},
    {label: "Canada", value: "ca"},
  ],
  placeholder: "Select country",
  on: {change: (value) => console.log("Country selected:", value)},
});
```

#### `useButton`
Manages button state with loading support.

```typescript
const submitButton = useButton({
  on: {click: async () => {
    console.log("Button clicked");
    await submitForm();
  }},
  disabled: false,
  loading: false,
});
```

## Usage with Components

### Direct Hook Usage

You can also use hooks directly for custom UI implementations:

```typescript
// Custom tab component using useTabs
function CustomTabs({tabs}) {
  const {activeTab, setActiveTab} = useTabs({tabs});

  return m("div", {},
    tabs.map(tab => m("button", {
      onclick: () => setActiveTab(tab.id),
      disabled: tab.disabled,
      style: {fontWeight: activeTab.value === tab.id ? "bold" : "normal"},
    }, tab.label))
  );
}
```

## Benefits

### 1. Improved Testability
```typescript
// Test hook logic without UI
test("useTabs manages tab state correctly", () => {
  const {activeTab, setActiveTab} = useTabs({
    tabs: [{id: "tab1", label: "Tab 1"}],
  });

  expect(activeTab.value).toBe("tab1");
  setActiveTab("tab2");
  expect(activeTab.value).toBe("tab2");
});
```

### 2. UI Flexibility
- Same logic can power different design systems
- Easy to swap UI implementations
- Consistent behavior across different UIs

### 3. Maintainability
- Logic changes in one place affect all usages
- Clear separation of concerns
- Easier to debug and reason about

## Migration Guide

### For New Components
1. Create headless hook for business logic
2. Create UI component that uses the hook
3. Export both hook and component

### For Existing Components
1. Extract logic into headless hook
2. Update component to use the hook
3. Maintain backward compatibility
4. Add new features via hook options

## Future Hooks (Planned)
1. **`useEditor`**: CodeMirror management
2. **`useAuthForm`**: Authentication forms

## Best Practices
1. **Keep Hooks Pure**: No side effects, no UI rendering
2. **Type Safety**: Use TypeScript for all hooks
3. **Composability**: Design hooks to work together
4. **Documentation**: Document hook APIs and usage
5. **Testing**: Write tests for hook logic
