import {signal, Signal} from "../../lib/utils.ts";
import {FormField} from "./types.ts";

type UseInputOptions = {
  initialValue?: string,
  validate?: (value: string) => string[],
  on?: {
    change?: (value: string) => void,
    blur?: (value: string) => void,
  },
};

type UseInputResult = FormField<string> & {
  // State
  valueSignal: Signal<string>,
  touchedSignal: Signal<boolean>,

  // Getters
  get isValid(): boolean,

  // Event handlers
  on: {
    change: (value: string) => void,
    blur: () => void,
    focus: () => void,
  },

  // Actions
  clear: () => void,
};

/** Headless hook for input field management */
export function useInput(options: UseInputOptions = {}): UseInputResult {
  const {
    initialValue,
    validate,
    on: {
      change: onChange,
      blur: onBlur,
    } = {},
  } = options;

  // Deliberately exposed without a production subscriber — side-effect-free escape hatch for
  // tests/inspection (see useRequest's requestSignal note in docs/dev/ARCHITECTURE.md).
  const valueSignal = signal(initialValue ?? "");
  const touchedSignal = signal<boolean>(false);
  // Plain locals: no production consumer subscribes to dirty/errors (read via getters).
  let dirty = false;
  let errors: string[] = [];

  const validateField = (): string[] => {
    if (validate === undefined) {
      return [];
    }

    errors = validate(valueSignal.value);
    return errors;
  };

  const handleChange = (inputValue: string): void => {
    valueSignal.update(() => inputValue);
    dirty = true;

    if (validate !== undefined) {
      validateField();
    }

    if (onChange !== undefined) {
      onChange(inputValue);
    }
  };

  const handleBlur = (): void => {
    touchedSignal.update(() => true);
    validateField();
    if (onBlur !== undefined) {
      onBlur(valueSignal.value);
    }
  };

  const handleFocus = (): void => {
    touchedSignal.update(() => true);
  };

  const updateValue = (fn: (prev: string) => string): void => {
    valueSignal.update(fn);
    dirty = true;
    validateField();
  };

  const setValue = (value: string): void => {
    updateValue(() => value);
  };

  const setTouched = (touched: boolean): void => {
    touchedSignal.update(() => touched);
    if (touched) {
      validateField();
    }
  };

  const reset = (): void => {
    valueSignal.update(() => initialValue ?? "");
    touchedSignal.update(() => false);
    dirty = false;
    errors = [];
  };

  const clear = (): void => {
    valueSignal.update(() => "");
    touchedSignal.update(() => true);
    dirty = true;
    validateField();
  };

  return {
    // FormField interface
    get value(): string { return valueSignal.value; },
    get touched(): boolean { return touchedSignal.value; },
    get dirty(): boolean { return dirty; },
    get errors(): string[] { return errors; },
    validate: validateField,
    setValue,
    updateValue,
    setTouched,
    reset,

    // Additional properties
    valueSignal,
    touchedSignal,
    get isValid(): boolean {return errors.length === 0;},
    on: {
      change: handleChange,
      blur: handleBlur,
      focus: handleFocus,
    },
    clear,
  };
}
