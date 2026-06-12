import {readFile, writeFile} from "fs/promises";
import {nanoid} from "nanoid";
import * as t from "./shared/types/models.ts";

export function generateID(): t.RequestID {
  return nanoid();
}

type KindEntry<Req, Resp> = {
  request: Req,
  responses: { // TODO: remove
    SentAt: string,
    ReceivedAt: string,
    Response: Resp,
  }[],
};

type dbJSON = {
  "$version": 1,
  app_version: string,
  request?: {
    id: t.RequestID,
    kind: t.Kind,
    path: string,
  }[],
  [t.Kind.HTTP]:       Record<t.RequestID, KindEntry<t.HTTPRequest, t.HTTPResponse>>,
  [t.Kind.SQL]:        Record<t.RequestID, KindEntry<t.SQLRequest, t.SQLResponse>>,
  [t.Kind.JQ]:         Record<t.RequestID, KindEntry<t.JQRequest, t.JQResponse>>,
  [t.Kind.MD]:         Record<t.RequestID, KindEntry<t.MDRequest, t.MDResponse>>,
  [t.Kind.REDIS]:      Record<t.RequestID, KindEntry<t.RedisRequest, t.RedisResponse>>,
  [t.Kind.GRPC]:       Record<t.RequestID, KindEntry<t.GRPCRequest, t.GRPCResponse>>,
  [t.Kind.DIFF]:       Record<t.RequestID, KindEntry<t.DIFFRequest, t.DIFFResponse>>,
  [t.Kind.SQLSource]:  Record<t.RequestID, t.SQLSourceRequest>,
  [t.Kind.HTTPSource]: Record<t.RequestID, t.HTTPSourceRequest>,
};

type HistoryEntry<_Req, Resp> = {
  SentAt: Date,
  ReceivedAt: Date,
  // Request: Req, // TODO: use
  Response: Resp,
};

export type HistoryEntry2 = // TODO: just Request["Responses"][number]
  | HistoryEntry<t.HTTPRequest, t.HTTPResponse>
  | HistoryEntry<t.SQLRequest, t.SQLResponse>
  | HistoryEntry<t.JQRequest, t.JQResponse>
  | HistoryEntry<t.RedisRequest, t.RedisResponse>
  | HistoryEntry<t.GRPCRequest, t.GRPCResponse>
;

export type Request = {
  ID:        t.RequestID,
  Path:      string,
} & (
  | {Kind: t.Kind.HTTP} & {
    Data: t.HTTPRequest,
    Responses: HistoryEntry<t.HTTPRequest, t.HTTPResponse>[],
  }
  | {Kind: t.Kind.SQL} & {
    Data: t.SQLRequest,
    Responses: HistoryEntry<t.SQLRequest, t.SQLResponse>[],
  }
  | {Kind: t.Kind.JQ} & {
    Data: t.JQRequest,
    Responses: HistoryEntry<t.JQRequest, t.JQResponse>[],
  }
  | {Kind: t.Kind.MD} & {
    Data: t.MDRequest,
    Responses: [],
  }
  | {Kind: t.Kind.REDIS} & {
    Data: t.RedisRequest,
    Responses: HistoryEntry<t.RedisRequest, t.RedisResponse>[],
  }
  | {Kind: t.Kind.GRPC} & {
    Data: t.GRPCRequest,
    Responses: HistoryEntry<t.GRPCRequest, t.GRPCResponse>[],
  }
  | {Kind: t.Kind.DIFF} & {
    Data: t.DIFFRequest,
    Responses: [],
  }
  | {Kind: t.Kind.SQLSource} & {
    Data: t.SQLSourceRequest,
    Responses: [],
  }
  | {Kind: t.Kind.HTTPSource} & {
    Data: t.HTTPSourceRequest,
    Responses: [],
  }
);

export type DB = Record<t.RequestID, Request>;

export function extractSubKind(
  j: DB,
  id: t.RequestID,
): string {
  const entry = j[id];
  switch (entry.Kind) {
    case t.Kind.HTTP:
      return entry.Data.method;
    case t.Kind.SQL:
      return entry.Data.database;
    case t.Kind.SQLSource:
      return entry.Data.database;
    // case t.Kind.HTTPSource: // TODO: swagger version
    default:
      return "";
  }
}

export async function load(): Promise<DB> {
  // TODO: migrate db
  const b = await readFile("db.json");
  const raw = JSON.parse(b.toString()) as dbJSON;
  const j = Object.fromEntries((raw.request ?? []).map(r => [r.id, (() => {
    const kind: Pick<Request, "Data" | "Responses"> = (() => {
      switch (r.kind) {
      case t.Kind.HTTP:
        const req = raw[r.kind][r.id];
        return {
          Data: req.request,
          Responses: req.responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.SQL:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.JQ:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.MD:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: [],
        };
      case t.Kind.REDIS:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.GRPC:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.DIFF:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: [],
        };
      case t.Kind.SQLSource:
        return {
          Data: raw[r.kind][r.id],
          Responses: [],
        };
      case t.Kind.HTTPSource:
        return {
          Data: raw[r.kind][r.id],
          Responses: [],
        };
      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`unknown kind ${r.kind}`);
      }
    })();

    return {
      ID: r.id,
      Path: r.path,
      Kind: r.kind,
      ...kind,
    } as Request;
  })()]));
  return j;
}

export async function save(j: DB): Promise<void> {
  const raw: dbJSON = {
    $version: 1,
    app_version: "(devel)",
    request: Object.values(j).map(r => ({
      id: r.ID,
      kind: r.Kind,
      path: r.Path,
    })),
    http: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.HTTP).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.HTTPRequest, t.HTTPResponse>])),
    sql: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.SQL).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.SQLRequest, t.SQLResponse>])),
    jq: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.JQ).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.JQRequest, t.JQResponse>])),
    md: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.MD).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.MDRequest, t.MDResponse>])),
    redis: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.REDIS).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.RedisRequest, t.RedisResponse>])),
    grpc: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.GRPC).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.GRPCRequest, t.GRPCResponse>])),
    diff: Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.DIFF).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.DIFFRequest, t.DIFFResponse>])),
    "http-source": Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.HTTPSource).map(([id, r]) => [id,
      r.Data as t.HTTPSourceRequest,
    ])),
    "sql-source": Object.fromEntries(Object.entries(j).filter(([_id, r]) => r.Kind === t.Kind.SQLSource).map(([id, r]) => [id,
      r.Data as t.SQLSourceRequest,
    ])),
  };
  await writeFile("db.json", JSON.stringify(raw, null, 2));
}

export async function create(
  j: DB,
  kind: t.Kind,
  path: string,
  data: Request["Data"],
): Promise<t.RequestID> {
  const id = generateID();
  j[id] = {ID: id, Path: path, Kind: kind, Data: data, Responses: []} as Request;
  await save(j);
  return id;
}

export async function Delete(j: DB, id: t.RequestID): Promise<void> {
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  delete j[id];
  await save(j);
}

export async function rename(j: DB, id: t.RequestID, newName: string): Promise<void> {
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const existing = Object.values(j).find(r => r.Path === newName && r.ID !== id);
  if (existing !== undefined) {
    throw new Error(`request with name ${newName} already exists`);
  }
  const req = j[id];
  req.Path = newName;
  await save(j);
}

export async function update(
  j: DB,
  id: t.RequestID,
  data: Request["Data"],
): Promise<void> {
  if (!(id in j))
    throw new Error(`request ${id} not found`);

  j[id].Data = data;
  await save(j);
}

export async function createResponse(
  j: DB,
  id: t.RequestID,
  response: HistoryEntry2,
): Promise<void> {
  if (!(id in j))
    throw new Error(`request ${id} not found`);

  const req = j[id];
  (req.Responses as HistoryEntry2[]).push(response);
  await save(j);
}
