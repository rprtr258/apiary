import * as t from "./models.ts";

export type KV = {
  key: string,
  value: string,
};

export type HTTPRequest = {
  url: string,
  method: string,
  body: string,
  headers: KV[],
};

export type HTTPResponse = {
  code: number,
  body: string,
  headers: KV[],
};

export const Method = {
  GET:     "GET",
  HEAD:    "HEAD",
  POST:    "POST",
  PUT:     "PUT",
  DELETE:  "DELETE",
  CONNECT: "CONNECT",
  OPTIONS: "OPTIONS",
  TRACE:   "TRACE",
  PATCH:   "PATCH",
} as const;
export type Method = keyof typeof Method;

export const GRPCCodes = {
  0: "OK",
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  6: "ALREADY_EXISTS",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  10: "ABORTED",
  11: "OUT_OF_RANGE",
  12: "UNIMPLEMENTED",
  13: "INTERNAL",
  14: "UNAVAILABLE",
  15: "DATA_LOSS",
  16: "UNAUTHENTICATED",
} as const;
export type GRPCCode = keyof typeof GRPCCodes;

export const HTTPCodes = {
  // 1xx Informational
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",

  // 2xx Success
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",

  // 3xx Redirection
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",

  // 4xx Client Error
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",

  // 5xx Server Error
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
} as const;
export type HTTPCode = keyof typeof HTTPCodes;

export const Database: Record<t.Database, string> = {
  [t.Database.POSTGRES]:   "PostgreSQL",
  [t.Database.MYSQL]:      "MySQL",
  [t.Database.SQLITE]:     "SQLite",
  [t.Database.CLICKHOUSE]: "ClickHouse",
} as const;
export type Database = keyof typeof Database;

export type RequestData =
  | {kind: t.Kind.HTTP }     & t.HTTPRequest
  | {kind: t.Kind.SQL  }     & t.SQLRequest
  | {kind: t.Kind.GRPC }     & t.GRPCRequest
  | {kind: t.Kind.JQ   }     & t.JQRequest
  | {kind: t.Kind.REDIS}     & t.RedisRequest
  | {kind: t.Kind.MD   }     & t.MDRequest
  | {kind: t.Kind.DIFF }     & t.DIFFRequest
  | {kind: t.Kind.SQLSource} & t.SQLSourceRequest
  | {kind: t.Kind.HTTPSource} & t.HTTPSourceRequest
;

export type Request = {
  id: string,
  path: string,
} & RequestData;

export const Kinds = Object.values(t.Kind);
export type ResponseData =
  | {kind: t.Kind.HTTP } & t.HTTPResponse
  | {kind: t.Kind.SQL  } & t.SQLResponse
  | {kind: t.Kind.GRPC } & t.GRPCResponse
  | {kind: t.Kind.JQ   } & t.JQResponse
  | {kind: t.Kind.REDIS} & t.RedisResponse
  | {kind: t.Kind.MD   } & t.MDResponse
  | {kind: t.Kind.DIFF } & t.DIFFResponse
;

export type HistoryEntry = {
  sent_at: Date,
  received_at: Date,
} & (
  {kind: t.Kind.HTTP,  request: t. HTTPRequest, response: t. HTTPResponse} |
  {kind: t.Kind.SQL,   request: t.  SQLRequest, response: t.  SQLResponse} |
  {kind: t.Kind.GRPC,  request: t. GRPCRequest, response: t. GRPCResponse} |
  {kind: t.Kind.JQ,    request: t.   JQRequest, response: t.   JQResponse} |
  {kind: t.Kind.REDIS, request: t.RedisRequest, response: t.RedisResponse} |
  {kind: t.Kind.MD,    request: t.   MDRequest, response: t.   MDResponse} |
  {kind: t.Kind.DIFF,  request: t. DIFFRequest, response: t. DIFFResponse}
);

export type RowValue = Date | string | number | boolean | null;
