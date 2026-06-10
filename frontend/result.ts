export type Result<T> = ({
  kind: "ok",
  value: T,
} | {
  kind: "err",
  value: string,
}) & {
  map: <U>(f: (value: T) => U) => Result<U>,
  map_or_else: <U>(fe: (value: T) => U, fv: (value: string) => U) => U,
};

export function ok<T>(value: T): Result<T> {
  return {
    kind: "ok",
    value: value,
    map: (f) => ok(f(value)),
    map_or_else: (fv, _fe) => fv(value),
  };
}

export function err<T>(value: string): Result<T> {
  return {
    kind: "err",
    value: value,
    map: () => err(value),
    map_or_else: (_fv, fe) => fe(value),
  };
}
