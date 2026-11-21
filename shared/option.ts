type Some = {kind: "some"};
type None = {kind: "none"};
export type Option<T> = (Some & {
  value: T,
} | None) & {
  isSome(): this is Some,
  isNone(): this is None,
  unwrap(): T,
  map<U>(f: (value: T) => U): Option<U>,
  flatMap<U>(f: (value: T) => Option<U>): Option<U>,
  getOr(fallback: T): T,
};

export const none: Option<never> & None = {
  kind: "none",
  isSome(): this is Some {
    return false;
  },
  isNone(): this is None {
    return true;
  },
  unwrap(): never {
    throw new Error("Option is None");
  },
  map<U>(_: (value: never) => U): Option<U> {
    return none;
  },
  flatMap<U>(_: (_: never) => Option<U>): Option<U> {
    return none;
  },
  getOr<U>(fallback: U): U {
    return fallback;
  },
};

export function some<T>(value: T): Option<T> & Some {
  return {
    kind: "some",
    value,
    isSome(): this is Some {
      return true;
    },
    isNone(): this is None {
      return false;
    },
    unwrap(): T {
      return value;
    },
    map<U>(f: (value: T) => U): Option<U> {
      return some(f(value));
    },
    flatMap<U>(f: (value: T) => Option<U>): Option<U> {
      return f(value);
    },
    getOr(_: T): T {
      return value;
    },
  };
}
