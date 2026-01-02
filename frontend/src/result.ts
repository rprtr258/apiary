export type Result<T> = ({
  kind: "ok",
  value: T,
} | {
  kind: "err",
  value: string,
}) & {
  map: <U>(f: (value: T) => U) => Result<U>,
};

export function ok<T>(value: T): Result<T> {
  return {
    kind: "ok",
    value: value,
    map: (f) => ok(f(value)),
  };
}

export function err<T>(value: string): Result<T> {
  return {
    kind: "err",
    value: value,
    map: () => err(value),
  };
}
