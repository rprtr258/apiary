import {describe, expect, test, mock} from "bun:test";
import {useSelect} from "./useSelect.ts";
import {Option, none, some} from "../../option.ts";
import {collectSignalValues} from "../test-helpers.ts";

describe("useSelect", () => {
  const options = [
    {label: "Option 1", value: "value1"},
    {label: "Option 2", value: "value2"},
    {label: "Option 3", value: "value3", disabled: true},
  ];

  test("should initialize with provided initial value", () => {
    const initialValue = "value1";
    const hook = useSelect({
      options,
      initialValue,
      placeholder: "Select an option",
    });

    expect(hook.value.unwrap()).toEqual(initialValue);
    expect(hook.touched).toBe(false);
    expect(hook.dirty).toBe(false);
    expect(hook.errors).toEqual([]);
    expect(hook.options).toEqual(options);
    expect(hook.placeholder).toBe("Select an option");
  });

  test("should initialize with none as initial value", () => {
    const hook = useSelect({
      options,
    });

    expect(hook.value).toEqual(none);
    expect(hook.touched).toBe(false);
    expect(hook.dirty).toBe(false);
    expect(hook.errors).toEqual([]);
  });

  test("should handle change events", () => {
    const onChange = mock((_value: Option<string>) => {});
    const hook = useSelect({
      options,
      on: {change: onChange},
    });

    const newValue = some("value2");
    hook.on.change(newValue);

    expect(hook.value).toEqual(newValue);
    expect(hook.dirty).toBe(true);
    expect(hook.touched).toBe(false); // Change doesn't mark as touched
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(newValue);
  });

  test("should handle blur events", () => {
    const initialValue = "value1";
    const onBlur = mock((value: Option<string>) => {
      expect(value.unwrap()).toBe(initialValue);
    });
    const hook = useSelect({
      options,
      initialValue,
      on: {blur: onBlur},
    });

    hook.on.blur();

    expect(hook.touched).toBe(true);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test("should validate on change when validate function provided", () => {
    const validate = mock((value: Option<string>) => {
      if (value.isNone()) return ["Selection is required"];
      return [];
    });

    const hook = useSelect({
      options,
      validate,
    });

    hook.on.change(none); // Invalid - no selection

    expect(hook.errors).toEqual(["Selection is required"]);
    expect(hook.isValid).toBe(false);
    // validate should be called
    expect(validate).toHaveBeenCalled();

    hook.on.change(some("value1")); // Valid

    expect(hook.errors).toEqual([]);
    expect(hook.isValid).toBe(true);
    // validate should be called
    expect(validate).toHaveBeenCalled();
  });

  test("should validate on blur when validate function provided", () => {
    const validate = mock((value: Option<string>) => {
      if (value.isNone()) return ["Please select an option"];
      return [];
    });

    const hook = useSelect({
      options,
      validate,
    });

    hook.on.blur();

    expect(hook.errors).toEqual(["Please select an option"]);
    expect(hook.isValid).toBe(false);
    // validate is called once in handleBlur
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith(none);
  });

  test("should set value directly", () => {
    const initialValue = "value1";
    const hook = useSelect({
      options,
      initialValue,
    });

    const newValue = some("value2");
    hook.setValue(newValue);

    expect(hook.value).toEqual(newValue);
    expect(hook.dirty).toBe(true);
  });

  test("should update value using updateValue function", () => {
    const initialValue = "value1";
    const hook = useSelect({
      options,
      initialValue,
    });

    hook.updateValue(prev => prev.isSome() ? some("modified") : none);

    expect(hook.value.isSome()).toBe(true);
    expect(hook.value.unwrap()).toBe("modified");
    expect(hook.dirty).toBe(true);
  });

  test("should set touched state", () => {
    const hook = useSelect({
      options,
    });

    hook.setTouched(true);
    expect(hook.touched).toBe(true);

    hook.setTouched(false);
    expect(hook.touched).toBe(false);
  });

  test("should reset to initial state", () => {
    const initialValue = "value1";
    const hook = useSelect({
      options,
      initialValue,
    });

    hook.on.change(some("value2"));
    hook.on.blur();

    expect(hook.value.isSome()).toBe(true);
    expect(hook.value.unwrap()).toBe("value2");
    expect(hook.touched).toBe(true);
    expect(hook.dirty).toBe(true);

    hook.reset();

    expect(hook.value.isSome()).toBe(true);
    expect(hook.value.unwrap()).toBe("value1");
    expect(hook.touched).toBe(false);
    expect(hook.dirty).toBe(false);
    expect(hook.errors).toEqual([]);
  });

  test("should clear value to none", () => {
    const initialValue = "value1";
    const hook = useSelect({
      options,
      initialValue,
    });

    hook.clear();

    expect(hook.value).toEqual(none);
    expect(hook.touched).toBe(true);
    expect(hook.dirty).toBe(true);
  });

  test("should get selected option", () => {
    const initialValue = "value2";
    const hook = useSelect({
      options,
      initialValue,
    });

    const selected = hook.selectedOption;

    expect(selected.isSome()).toBe(true);
    expect(selected.unwrap()).toEqual({label: "Option 2", value: "value2"});
  });

  test("should get none when no option is selected", () => {
    const hook = useSelect({
      options,
    });

    const selected = hook.selectedOption;

    expect(selected.isNone()).toBe(true);
  });

  test("should get option by value", () => {
    const hook = useSelect({
      options,
    });

    const option1 = hook.optionByValue("value1");
    const option3 = hook.optionByValue("value3");
    const nonExistent = hook.optionByValue("nonexistent");

    expect(option1.isSome()).toBe(true);
    expect(option1.unwrap()).toEqual({label: "Option 1", value: "value1"});

    expect(option3.isSome()).toBe(true);
    expect(option3.unwrap()).toEqual({label: "Option 3", value: "value3", disabled: true});

    expect(nonExistent.isNone()).toBe(true);
  });

  test("should update signals when state changes", () => {
    const hook = useSelect({
      options,
    });

    const touchedCollector = collectSignalValues(hook.touchedSignal);
    const dirtyCollector = collectSignalValues(hook.dirtySignal);
    const errorsCollector = collectSignalValues(hook.errorsSignal);

    hook.on.change(some("value1"));
    hook.on.blur();
    hook.on.change(some("value2"));
    hook.clear();

    expect(touchedCollector.values).toEqual([true]);
    expect(dirtyCollector.values).toEqual([true]);
    expect(errorsCollector.values).toEqual([]);

    touchedCollector.unsubscribe();
    dirtyCollector.unsubscribe();
    errorsCollector.unsubscribe();
  });

  test("should not call onChange when value is set via setValue", () => {
    const onChange = mock((_value: Option<string>) => {});
    const hook = useSelect({
      options,
      on: {change: onChange},
    });

    hook.setValue(some("value1"));

    expect(onChange).toHaveBeenCalledTimes(0);
    expect(hook.value.isSome()).toBe(true);
    expect(hook.value.unwrap()).toBe("value1");
  });

  test("should validate when setTouched is called with true", () => {
    const validate = mock((value: Option<string>) => {
      if (value.isNone()) return ["Required"];
      return [];
    });

    const hook = useSelect({
      options,
      validate,
    });

    hook.setTouched(true);

    expect(hook.errors).toEqual(["Required"]);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  test("should not validate when setTouched is called with false", () => {
    const validate = mock((_value: Option<string>) => []);
    const hook = useSelect({
      options,
      validate,
    });

    hook.setTouched(false);

    expect(validate).toHaveBeenCalledTimes(0);
  });

  test("should handle validation errors in signals", () => {
    const validate = (_value: Option<string>) => {
      return ["Selection required"];
    };

    const hook = useSelect({
      options,
      validate,
    });

    const errorsCollector = collectSignalValues(hook.errorsSignal);

    hook.on.change(none);

    expect(errorsCollector.values).toEqual([["Selection required"]]);

    errorsCollector.unsubscribe();
  });

  test("should be valid when no validate function provided", () => {
    const hook = useSelect({
      options,
    });

    hook.on.change(some("value1"));
    hook.on.blur();

    expect(hook.isValid).toBe(true);
    expect(hook.errors).toEqual([]);
  });

  test("should handle disabled options", () => {
    const hook = useSelect({
      options,
    });

    const disabledOption = hook.optionByValue("value3");

    expect(disabledOption.isSome()).toBe(true);
    expect(disabledOption.unwrap().disabled).toBe(true);
  });
});