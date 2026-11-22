import * as t from "@/types.ts";
import type {Request} from "../main/db.ts";

// Last-used connection fields per request kind, kept in renderer localStorage
// (deliberately not db.json: no new persistence, values survive restarts and
// are only lost when renderer storage is cleared). store.ts records a fragment
// from its requestPerform/request_update call sites; creation paths seed it
// back through the optional Create/CreateDraft data argument, which the main
// process spreads over emptyRequestForKind so every other field keeps the
// kind's default. SQL keeps dsn+database as a pair, since a bare dsn could be
// a postgres string seeded into a database: "sqlite" request. Kinds without a
// connection target (MCP, jq, md, diff) are never recorded, and each kind
// tracks only its own fragment (SQLSource activity never updates SQL's entry
// and vice versa).
const localStorageKey = "last-connection";

type Fragments = Partial<Record<t.Kind, Partial<Request["Data"]>>>;

function readAll(): Fragments {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(localStorageKey) ?? "{}");
    return typeof raw === "object" && raw !== null ? raw : {};
  } catch {
    return {};
  }
}

export function lastConnectionSeed(kind: t.Kind): Partial<Request["Data"]> | undefined {
  return readAll()[kind];
}

export function recordLastConnection(kind: t.Kind, data: Request["Data"]): void {
  // data arrives untagged (Data-only from store.ts); re-tag it to narrow per kind
  const tagged = {...data, kind} as t.RequestData;
  const fragment = ((): Partial<Request["Data"]> | undefined => {
    switch (tagged.kind) {
    case t.Kind.HTTP:       return {url: tagged.url};
    case t.Kind.SQL:        return {dsn: tagged.dsn, database: tagged.database};
    case t.Kind.SQLSource:  return {dsn: tagged.dsn, database: tagged.database};
    case t.Kind.REDIS:      return {dsn: tagged.dsn};
    case t.Kind.GRPC:       return {target: tagged.target};
    case t.Kind.HTTPSource: return {serverUrl: tagged.serverUrl};
    default:                return undefined;
    }
  })();
  if (fragment === undefined)
    return;
  localStorage.setItem(localStorageKey, JSON.stringify({...readAll(), [kind]: fragment}));
}
