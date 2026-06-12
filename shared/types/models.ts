export type RequestID = string;

export type KV = {
  key: string,
  value: string,
};

export enum Kind {
  HTTP = "http",
  SQL = "sql",
  MD = "md",
  SQLSource = "sql-source",
  JQ = "jq",
  REDIS = "redis",
  GRPC = "grpc",
  HTTPSource = "http-source",
  DIFF = "diff",
}

export type GetResponse = {
  Request: Request,
  History: Response[],
};

export type requestPreview = {
  name: string,
  kind: Kind,
  subKind: string,
};

export type Tree = {
  IDs: RequestID[],
  Dirs: Record<string, Tree>,
};

export type ListResponse = {
  Tree: Tree,
  Requests: Record<string, requestPreview>,
};

// JSONSchema represents the structure of a JSON schema
export type JSONSchema = { // TODO: reuse from lib
  type: "object",
  properties: Record<string, JSONSchema>,
  oneOf?: JSONSchema[],
} | {
  type: "array",
  items: JSONSchema,
} | {
  type: "number" | "integer" | "string",
};

export type AuthConfig = {
  type: "none",
} | {
  type: "basic",
  username: string,
  password: string,
} | {
  type: "bearer",
  token: string,
} | {
  type: "apikey",
  key: string,
  value: string,
} | {
  type: "oauth",
  token: string,
};
export type AuthType = AuthConfig["type"];

export enum Database {
  POSTGRES = "postgres",
  MYSQL = "mysql",
  SQLITE = "sqlite",
  CLICKHOUSE = "clickhouse",
}
export enum ColumnType {
  STRING = "string",
  NUMBER = "number",
  TIME = "time",
  BOOLEAN = "boolean",
}

export type ColumnInfo = {
  name: string,
  type: string,
  nullable: boolean,
  defaultValue: string,
};
export type ConstraintInfo = {
  name: string,
  type: string,
  definition: string,
};
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
export type ResponseInfo = {
  description: string,
  content?: Record<string, MediaTypeInfo>,
};
export type MediaTypeInfo = {
  schema: JSONSchema,
  example?: unknown,
};
export type RequestBodyInfo = {
  description: string,
  required: boolean,
  content: Record<string, MediaTypeInfo>,
};
export type ParameterInfo = {
  name: string,
  in: string,
  description: string,
  required: boolean,
  schema: Record<string, unknown>,
  example?: unknown,
};
export type EndpointInfo = {
  path: string,
  method: string,
  summary: string,
  parameters: ParameterInfo[],
  requestBody?: RequestBodyInfo,
  responses: Record<string, ResponseInfo>,
};
export type ForeignKey = {
  column: string,
  table: string,
  to: string,
};

export type grpcServiceMethods = {
  service: string,
  methods: string[],
};

export type GRPCRequest = {
  target: string,
  method: string,
  payload: string,
  metadata: KV[],
};
export type GRPCResponse = {
  response: string,
  code: number,
  metadata: KV[],
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

export type HTTPSourceRequest = {
  serverUrl: string,
  specSource: "file" | "url",
  specData: string,
  auth: AuthConfig,
};

export type IndexInfo = {
  name: string,
  definition: string,
};
export type JQRequest = {
  query: string,
  json: string,
};
export type JQResponse = {
  response: string[],
};

export type MDRequest = {
  data: string,
};
export type MDResponse = {
  data: string,
};

// Go type: time
type Time = string;

export type RedisRequest = {
  dsn: string,
  query: string,
};
export type RedisResponse = {
  response: string,
};
export type Response = {
  sent_at: Time,
  received_at: Time,
  response: unknown,
};
export type Request = {
  ID: string,
  Path: string,
  Data: unknown,
  Responses: Response[],
};

export type SQLRequest = {
  dsn: string,
  database: Database,
  query: string,
};
export type SQLResponse = {
  columns: string[],
  types: string[],
  rows: unknown[][],
};
export type SQLSourceRequest = {
  database: Database,
  dsn: string,
};
export type TableInfo = {
  name: string,
  rowCount: number,
  sizeBytes: number,
};
export type TableSchema = {
  columns: ColumnInfo[],
  constraints: ConstraintInfo[],
  foreign_keys: ForeignKey[],
  indexes: IndexInfo[],
};
