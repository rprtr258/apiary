export type JQRequest = {
  query: string,
  json: string,
  // Absent in records created before the option existed — treated as false.
  autosend?: boolean,
};

export type JQResponse = {
  response: string[],
};
