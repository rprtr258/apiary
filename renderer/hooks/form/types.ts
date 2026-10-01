export type FormField<T> = {
  value: T,
  touched: boolean,
  dirty: boolean,
  errors: string[],
  validate: () => string[],
  setValue: (value: T) => void,
  updateValue: (fn: (prev: T) => T) => void,
  setTouched: (touched: boolean) => void,
  reset: () => void,
};
