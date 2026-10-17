import * as t from "@/types.ts";
import v1, {KindEntry} from "./db.v1.ts";

type DraftEntry = {
  id: t.RequestID,
  n: number,
};

// v2 mirrors the in-memory DB; history timestamps (SentAt/ReceivedAt) are ISO
// strings on disk and revived to Dates by load().
type v2 = {
  "$version": 2,
  request?: {
    id: t.RequestID,
    kind: t.Kind,
    path: string,
  }[],
  drafts: DraftEntry[],
  [t.Kind.HTTP]:       Record<t.RequestID, KindEntry<t.HTTPRequest>>,
  [t.Kind.SQL]:        Record<t.RequestID, KindEntry<t.SQLRequest>>,
  [t.Kind.JQ]:         Record<t.RequestID, KindEntry<t.JQRequest>>,
  [t.Kind.MD]:         Record<t.RequestID, KindEntry<t.MDRequest>>,
  [t.Kind.REDIS]:      Record<t.RequestID, KindEntry<t.RedisRequest>>,
  [t.Kind.GRPC]:       Record<t.RequestID, KindEntry<t.GRPCRequest>>,
  [t.Kind.DIFF]:       Record<t.RequestID, KindEntry<t.DiffRequest>>,
  [t.Kind.SQLSource]:  Record<t.RequestID, t.SQLSourceRequest>,
  [t.Kind.HTTPSource]: Record<t.RequestID, t.HTTPSourceRequest>,
  [t.Kind.MCP]:        Record<t.RequestID, t.MCPRequest>,
};
export default v2;

export function migration_v1_v2(v1: v1): v2 {
  return {
    $version: 2,
    request: v1.request,
    drafts: [],
    [t.Kind.HTTP]:       v1[t.Kind.HTTP],
    [t.Kind.SQL]:        v1[t.Kind.SQL],
    [t.Kind.JQ]:         v1[t.Kind.JQ],
    [t.Kind.MD]:         v1[t.Kind.MD],
    [t.Kind.REDIS]:      v1[t.Kind.REDIS],
    [t.Kind.GRPC]:       v1[t.Kind.GRPC],
    [t.Kind.DIFF]:       v1[t.Kind.DIFF],
    [t.Kind.SQLSource]:  v1[t.Kind.SQLSource],
    [t.Kind.HTTPSource]: v1[t.Kind.HTTPSource],
    [t.Kind.MCP]:        v1[t.Kind.MCP],
  };
}
