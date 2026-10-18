import * as t from "@/types.ts";
import v2, {DraftEntry} from "./db.v2.ts";
import {KindEntry} from "./db.v1.ts";

// v3 = v2 plus the manual sidebar order overlay (tree); everything else is
// carried over unchanged.
type v3 = {
  "$version": 3,
  request?: {
    id: t.RequestID,
    kind: t.Kind,
    path: string,
  }[],
  drafts: DraftEntry[],
  // Manual sidebar order per directory: key = directory path ("" = root),
  // value = that directory's children in manually-arranged order. Children
  // missing from the list fall back to name-sorted after the listed ones;
  // dirs are implied by request paths, so only the overlay is persisted.
  tree: Record<string, t.TreeChild[]>,
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
export default v3;

export function migration_v2_v3(v2: v2): v3 {
  return {
    ...v2,
    $version: 3,
    tree: {},
  };
}
