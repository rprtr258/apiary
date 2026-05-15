import {readFile} from "fs/promises";
import * as t from "./types/models.ts";

export type RequestID = string;

type KV = {
  key: string,
  value: string,
};

type RequestsData = {
  [t.Kind.HTTP]: Record<RequestID, {
    request: {
      headers: KV[],
      body: string,
      method: string,
      url: string,
    },
  }>,
	[t.Kind.SQL]: Record<RequestID, {
    request: {
      database: string,
      dsn: string,
      query: string,
    },
  }>,
	[t.Kind.SQLSource]: Record<RequestID, {
    database: string,
    dsn: string,
  }>,
	[t.Kind.MD]: Record<RequestID, {
    request: {
      database: string,
    },
  }>,
	[t.Kind.JQ]: Record<RequestID, {
    request: {
      database: string,
    },
  }>,
	[t.Kind.REDIS]: Record<RequestID, {
    request: {
      database: string,
    },
  }>,
	[t.Kind.GRPC]: Record<RequestID, {
    request: {
      metadata: KV[],
      method: string,
      payload: string,
      target: string,
    },
  }>,
	[t.Kind.HTTPSource]: {
    database: string,
  },
	[t.Kind.DIFF]: {
    left: string,
    right: string,
  },
};

type DB = {
  "$version": number,
  app_version: string, // TODO: remove?
  request: {
    id: RequestID,
    kind: t.Kind,
    path: string,
  }[],
  response: Record<RequestID, {
    id: string,
    sent_at: string,
    received_at: string,
  }[]>,
} & RequestsData;

export function extractSubKind(
  j: DB,
  kind: t.Kind,
  id: RequestID,
): string {
  const entry = (j[kind] as Record<string, unknown>)[id];
  switch (kind) {
    case t.Kind.HTTP:
      return (entry as RequestsData[t.Kind.HTTP][string]).request.method;
    case t.Kind.SQL:
      return (entry as RequestsData[t.Kind.SQL][string]).request.database;
    case t.Kind.SQLSource:
      return (entry as RequestsData[t.Kind.SQLSource][string]).database;
    // case database.Kind.HTTPSource: // TODO: swagger version
    default:
      return "";
  }
}

export async function load(): Promise<DB> {
  const b = await readFile("db.json");
  return JSON.parse(b.toString()) as DB;
}