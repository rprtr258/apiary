import * as t from "@/types.ts";

export type KindEntry<Req, Resp> = {
  request: Req,
  responses: { // TODO: remove
    SentAt: string,
    ReceivedAt: string,
    Response: Resp,
  }[],
};

type v1 = {
  "$version": 1,
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
  [t.Kind.DIFF]:       Record<t.RequestID, KindEntry<t.DiffRequest, t.DiffResponse>>,
  [t.Kind.SQLSource]:  Record<t.RequestID, t.SQLSourceRequest>,
  [t.Kind.HTTPSource]: Record<t.RequestID, t.HTTPSourceRequest>,
  [t.Kind.MCP]:        Record<t.RequestID, t.MCPRequest>,
};

export default v1;
