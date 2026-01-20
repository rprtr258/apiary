import {describe, expect, test, mock} from "bun:test";
import {useInput} from "./useInput.ts";
import {collectSignalValues} from "../test-helpers.ts";

describe("useInput", () => {
  test("should initialize with default empty value", () => {
    const hook = useInput();

    expect(hook.value).toBe("");
    expect(hook.touched).toBe(false);
    expect(hook.dirty).toBe(false);
    expect(hook.errors).toEqual([]);
    expect(hook.isValid).toBe(true);
  });

  test("should initialize with provided initial value", () => {
    const hook = useInput({initialValue: "initial text"});

    expect(hook.value).toBe("initial text");
    expect(hook.touched).toBe(false);
    expect(hook.dirty).toBe(false);
    expect(hook.errors).toEqual([]);
  });

  test("should handle change events", () => {
    const onChange = mock((_value: string) => {});
    const hook = useInput({on: {change: onChange}});

    hook.on.change("new value");

    expect(hook.value).toBe("new value");
    expect(hook.dirty).toBe(true);
    expect(hook.touched).toBe(false); // Change doesn't mark as touched
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("new value");
  });

  test("should handle blur events", () => {
    const onBlur = mock((_value: string) => {});
    const hook = useInput({on: {blur: onBlur}});

    hook.on.blur();

    expect(hook.touched).toBe(true);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith("");
  });

  test("should handle focus events", () => {
    const hook = useInput();

    hook.on.focus();

    expect(hook.touched).toBe(true);
  });

  test("should validate on change when validate function provided", () => {
    const validate = mock((value: string) => {
      if (value.length < 3) return ["Value must be at least 3 characters"];
      return [];
    });

    const hook = useInput({validate});

    hook.on.change("ab"); // Too short

    expect(hook.errors).toEqual(["Value must be at least 3 characters"]);
    expect(hook.isValid).toBe(false);
    // validate is called once in handleChange
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith("ab");

    hook.on.change("abcd"); // Valid

    expect(hook.errors).toEqual([]);
    expect(hook.isValid).toBe(true);
    // validate is called 1 more time
    expect(validate).toHaveBeenCalledTimes(2);
    expect(validate).toHaveBeenCalledWith("abcd");
  });

  test("should validate on blur when validate function provided", () => {
    const validate = mock((value: string) => {
      if (value === "") return ["Value is required"];
      return [];
    });

    const hook = useInput({validate});

    hook.on.blur();

    expect(hook.errors).toEqual(["Value is required"]);
    expect(hook.isValid).toBe(false);
    // validate is called once in handleBlur
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith("");
  });

  test("should set value directly", () => {
    const hook = useInput({initialValue: "initial"});

    hook.setValue("new value");

    expect(hook.value).toBe("new value");
    expect(hook.dirty).toBe(true);
  });

  test("should update value using updateValue function", () => {
    const hook = useInput({initialValue: "hello"});

    hook.updateValue(prev => prev + " world");

    expect(hook.value).toBe("hello world");
    expect(hook.dirty).toBe(true);
  });

  test("should set touched state", () => {
    const hook = useInput();

    hook.setTouched(true);
    expect(hook.touched).toBe(true);

    hook.setTouched(false);
    expect(hook.touched).toBe(false);
  });

  test("should reset to initial state", () => {
    const hook = useInput({initialValue: "initial"});

    hook.on.change("changed value");
    hook.on.blur();

    expect(hook.value).toBe("changed value");
    expect(hook.touched).toBe(true);
    expect(hook.dirty).toBe(true);

    hook.reset();

    expect(hook.value).toBe("initial");
    expect(hook.touched).toBe(false);
    expect(hook.dirty).toBe(false);
    expect(hook.errors).toEqual([]);
  });

  test("should clear value", () => {
    const hook = useInput({initialValue: "initial value"});

    hook.clear();

    expect(hook.value).toBe("");
    expect(hook.touched).toBe(true);
    expect(hook.dirty).toBe(true);
  });

  test("should update signals when state changes", () => {
    const hook = useInput();

    const valueCollector = collectSignalValues(hook.valueSignal);
    const touchedCollector = collectSignalValues(hook.touchedSignal);
    const dirtyCollector = collectSignalValues(hook.dirtySignal);
    const errorsCollector = collectSignalValues(hook.errorsSignal);

    hook.on.change("first change");
    hook.on.blur();
    hook.on.change("second change");
    hook.clear();

    expect(valueCollector.values.length).toBe(3); // 3 changes
    expect(touchedCollector.values).toEqual([true]);
    expect(dirtyCollector.values).toEqual([true]);
    expect(errorsCollector.values).toEqual([]);

    // Clean up
    valueCollector.unsubscribe();
    touchedCollector.unsubscribe();
    dirtyCollector.unsubscribe();
    errorsCollector.unsubscribe();
  });

  test("should not call onChange when value is set via setValue", () => {
    const onChange = mock((_value: string) => {});
    const hook = useInput({on: {change: onChange}});

    hook.setValue("direct set");

    expect(onChange).toHaveBeenCalledTimes(0);
    expect(hook.value).toBe("direct set");
  });

  test("should validate when setTouched is called with true", () => {
    const validate = mock((value: string) => {
      if (value === "") return ["Required"];
      return [];
    });

    const hook = useInput({validate});

    hook.setTouched(true);

    expect(hook.errors).toEqual(["Required"]);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  test("should not validate when setTouched is called with false", () => {
    const validate = mock((_value: string) => []);
    const hook = useInput({validate});

    hook.setTouched(false);

    expect(validate).toHaveBeenCalledTimes(0);
  });

  test("should handle validation errors in signals", () => {
    const validate = (_value: string) => {
      return ["Too short"];
    };

    const hook = useInput({validate});

    const errorsCollector = collectSignalValues(hook.errorsSignal);

    hook.on.change("hi");

    expect(errorsCollector.values).toEqual([["Too short"]]);

    errorsCollector.unsubscribe();
  });

  test("should be valid when no validate function provided", () => {
    const hook = useInput();

    hook.on.change("any value");
    hook.on.blur();

    expect(hook.isValid).toBe(true);
    expect(hook.errors).toEqual([]);
  });
});