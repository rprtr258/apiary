export type DiffRequest = {
  left: string,
  right: string,
};

export type DiffResponse = {
  diff: string,
  stats: string,
  leftType: string,
  rightType: string,
};
