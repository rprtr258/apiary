export type DIFFRequest = {
  left: string,
  right: string,
};

export type DIFFResponse = {
  diff: string,
  stats: string,
  leftType: string,
  rightType: string,
};
