import {signal, Signal} from "../../utils.ts";
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
  dirtySignal: Signal<boolean>,
  errorsSignal: Signal<string[]>,

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

  const valueSignal = signal(initialValue ?? "");
  const touchedSignal = signal<boolean>(false);
  const dirtySignal = signal<boolean>(false);
  const errorsSignal = signal<string[]>([]);

  const validateField = (): string[] => {
    if (validate === undefined) {
      return [];
    }

    const errors = validate(valueSignal.value);
    errorsSignal.update(() => errors);
    return errors;
  };

  const handleChange = (inputValue: string): void => {
    valueSignal.update(() => inputValue);
    dirtySignal.update(() => true);

    if (validate !== undefined) {
      const errors = validate(inputValue);
      errorsSignal.update(() => errors);
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
    dirtySignal.update(() => true);
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
    dirtySignal.update(() => false);
    errorsSignal.update(() => []);
  };

  const clear = (): void => {
    valueSignal.update(() => "");
    touchedSignal.update(() => true);
    dirtySignal.update(() => true);
    validateField();
  };

  return {
    // FormField interface
    get value(): string { return valueSignal.value; },
    get touched(): boolean { return touchedSignal.value; },
    get dirty(): boolean { return dirtySignal.value; },
    get errors(): string[] { return errorsSignal.value; },
    validate: validateField,
    setValue,
    updateValue,
    setTouched,
    reset,

    // Additional properties
    valueSignal,
    touchedSignal,
    dirtySignal,
    errorsSignal,
    get isValid(): boolean {return errorsSignal.value.length === 0;},
    on: {
      change: handleChange,
      blur: handleBlur,
      focus: handleFocus,
    },
    clear,
  };
}
