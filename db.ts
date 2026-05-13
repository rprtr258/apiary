import {readFile} from "fs/promises";
import * as database from "./frontend/wailsjs/go/models.ts";

export type RequestID = string;

type KV = {
  key: string,
  value: string,
};

type RequestsData = {
  [database.Kind.HTTP]: Record<RequestID, {
    request: {
      headers: KV[],
      body: string,
      method: string,
      url: string,
    },
  }>,
	[database.Kind.SQL]: Record<RequestID, {
    request: {
      database: string,
      dsn: string,
      query: string,
    },
  }>,
	[database.Kind.SQLSource]: Record<RequestID, {
    database: string,
    dsn: string,
  }>,
	[database.Kind.MD]: Record<RequestID, {
    request: {
      database: string,
    },
  }>,
	[database.Kind.JQ]: Record<RequestID, {
    request: {
      database: string,
    },
  }>,
	[database.Kind.REDIS]: Record<RequestID, {
    request: {
      database: string,
    },
  }>,
	[database.Kind.GRPC]: Record<RequestID, {
    request: {
      metadata: KV[],
      method: string,
      payload: string,
      target: string,
    },
  }>,
	[database.Kind.HTTPSource]: {
    database: string,
  },
	[database.Kind.DIFF]: {
    left: string,
    right: string,
  },
};

type DB = {
  "$version": number,
  app_version: string, // TODO: remove?
  request: Array<{
    id: RequestID,
    kind: database.Kind,
    path: string,
  }>,
  response: Array<Record<RequestID, {
    id: string,
    sent_at: string,
    received_at: string,
  }>>,
} & RequestsData;

export function extractSubKind(
  j: DB,
  kind: database.Kind,
  id: RequestID,
): string {
  const entry = (j[kind] as Record<string, unknown>)[id];
  switch (kind) {
    case database.Kind.HTTP:
      return (entry as RequestsData[database.Kind.HTTP][string]).request.method;
    case database.Kind.SQL:
      return (entry as RequestsData[database.Kind.SQL][string]).request.database;
    case database.Kind.SQLSource:
      return (entry as RequestsData[database.Kind.SQLSource][string]).database;
    // case database.Kind.HTTPSource: // TODO: swagger version
    default:
      return "";
  }
}

export async function load(): Promise<DB> {
  const b = await readFile("db.json");
  return JSON.parse(b.toString()) as DB;
}