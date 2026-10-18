import * as t from "@/types.ts";

export type KindEntry<Req> = {
  request: Req,
};

type v1 = {
  "$version": 1,
  request?: {
    id: t.RequestID,
    kind: t.Kind,
    path: string,
  }[],
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

export default v1;
