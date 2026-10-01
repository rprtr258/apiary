import {Option, none, option} from "@/option.ts";
import {signal, Signal} from "../../lib/utils.ts";
import {FormField} from "./types.ts";

export type SelectOption<T> = {
  label: string,
  value: T,
  disabled?: boolean,
};

export type UseSelectOptions<T> = {
  options: SelectOption<T>[],
  initialValue?: T,
  placeholder?: string,
  validate?: (value: Option<T>) => string[],
  on?: {
    change?: (value: Option<T>) => void,
    blur?: (value: Option<T>) => void,
  },
};

export type UseSelectResult<T> = FormField<Option<T>> & {
  // State
  touchedSignal: Signal<boolean>,
  options: SelectOption<T>[],
  placeholder?: string,

  // Getters
  get selectedOption(): Option<SelectOption<T>>,
  get optionByValue(): (value: T) => Option<SelectOption<T>>,
  get isValid(): boolean,

  // Event handlers
  on: {
    change: (value: Option<T>) => void,
    blur: () => void,
  },

  // Actions
  clear: () => void,
};

// Headless hook for select/dropdown field management
export function useSelect<T>({
  options: selectOptions,
  initialValue,
  placeholder,
  validate = () => [],
  on: {
    change: onChange = () => {},
    blur: onBlur = () => {},
  } = {},
}: UseSelectOptions<T>): UseSelectResult<T> {
  // Deliberately exposed without a production subscriber — side-effect-free escape hatch for
  // tests/inspection (see useRequest's requestSignal note in docs/dev/ARCHITECTURE.md).
  const valueSignal = signal<Option<T>>(option(initialValue));
  const touchedSignal = signal<boolean>(false);
  // Plain locals: no production consumer subscribes to dirty/errors (read via getters).
  let dirty = false;
  let errors: string[] = [];

  const validateField = (): string[] => {
    errors = validate(valueSignal.value);
    return errors;
  };

  const handleChange = (value: Option<T>): void => {
    valueSignal.update(() => value);
    dirty = true;
    validateField();

    onChange(value);
  };

  const handleBlur = (): void => {
    touchedSignal.update(() => true);
    validateField();
    onBlur(valueSignal.value);
  };

  const updateValue = (fn: (prev: Option<T>) => Option<T>): void => {
    valueSignal.update(fn);
    dirty = true;
    validateField();
  };

  const setValue = (value: Option<T>): void => {
    updateValue(() => value);
  };

  const setTouched = (touched: boolean): void => {
    touchedSignal.update(() => touched);
    if (touched) {
      validateField();
    }
  };

  const reset = (): void => {
    valueSignal.update(() => option(initialValue));
    touchedSignal.update(() => false);
    dirty = false;
    errors = [];
  };

  const getSelectedOption = (): Option<SelectOption<T>> => {
    return valueSignal.value.flatMap(v => option(selectOptions.find(opt => opt.value === v)));
  };

  const getOptionByValue = (value: T): Option<SelectOption<T>> => {
    return option(selectOptions.find(opt => opt.value === value));
  };

  const clear = (): void => {
    valueSignal.update(() => none);
    touchedSignal.update(() => true);
    dirty = true;
    validateField();
  };

  const isValid = (): boolean => {
    return errors.length === 0;
  };

  return {
    // FormField interface
    get value(): Option<T> { return valueSignal.value; },
    get touched(): boolean { return touchedSignal.value; },
    get dirty(): boolean { return dirty; },
    get errors(): string[] { return errors; },
    validate: validateField,
    setValue,
    updateValue,
    setTouched,
    reset,

    // Additional properties
    touchedSignal,
    options: selectOptions,
    placeholder,
    get selectedOption() {return getSelectedOption();},
    optionByValue: getOptionByValue,
    get isValid() {return isValid();},
    on: {
      change: handleChange,
      blur: handleBlur,
    },
    clear,
  };
}
