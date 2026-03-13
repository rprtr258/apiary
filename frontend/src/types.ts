import {database} from "../wailsjs/go/models.ts";

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

export const Database: Record<database.Database, string> = {
  [database.Database.POSTGRES]:   "PostgreSQL",
  [database.Database.MYSQL]:      "MySQL",
  [database.Database.SQLITE]:     "SQLite",
  [database.Database.CLICKHOUSE]: "ClickHouse",
} as const;
export type Database = keyof typeof Database;

export type RequestData =
  | {kind: database.Kind.HTTP }     & database.HTTPRequest
  | {kind: database.Kind.SQL  }     & database.SQLRequest
  | {kind: database.Kind.GRPC }     & database.GRPCRequest
  | {kind: database.Kind.JQ   }     & database.JQRequest
  | {kind: database.Kind.REDIS}     & database.RedisRequest
  | {kind: database.Kind.MD   }     & database.MDRequest
  | {kind: database.Kind.SQLSource} & database.SQLSourceRequest
  | {kind: database.Kind.HTTPSource} & database.HTTPSourceRequest
;

export type Request = {
  id: string,
  path: string,
} & RequestData;

export const Kinds = Object.values(database.Kind);
export type ResponseData =
  | {kind: database.Kind.HTTP } & database.HTTPResponse
  | {kind: database.Kind.SQL  } & database.SQLResponse
  | {kind: database.Kind.GRPC } & database.GRPCResponse
  | {kind: database.Kind.JQ   } & database.JQResponse
  | {kind: database.Kind.REDIS} & database.RedisResponse
  | {kind: database.Kind.MD   } & database.MDResponse
;

export type HistoryEntry = {
  sent_at: Date,
  received_at: Date,
} & (
  {kind: database.Kind.HTTP,  request: database. HTTPRequest, response: database. HTTPResponse} |
  {kind: database.Kind.SQL,   request: database.  SQLRequest, response: database.  SQLResponse} |
  {kind: database.Kind.GRPC,  request: database. GRPCRequest, response: database. GRPCResponse} |
  {kind: database.Kind.JQ,    request: database.   JQRequest, response: database.   JQResponse} |
  {kind: database.Kind.REDIS, request: database.RedisRequest, response: database.RedisResponse} |
  {kind: database.Kind.MD,    request: database.   MDRequest, response: database.   MDResponse}
);

export type RowValue = string | number | boolean | null;
