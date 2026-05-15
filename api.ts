import {extractSubKind, load, RequestID} from "./db.ts";
import * as t from "./types/models.ts";

export async function List(): Promise<t.ListResponse> {
  const j = await load();
  const tree: t.Tree = {IDs: {}, Dirs: {}};
  const requests: Record<RequestID, t.requestPreview> = {};
  for (const req of j.request) {
    const kind = req.kind;
    const path = req.path;
    const subKind = extractSubKind(j, kind, req.id);

    requests[req.id] = {
      kind: kind,
      subKind: subKind,
    };

    // Build tree: split path by "/", create nested Dirs, put entry in IDs
    const parts = path.split("/");
    let current = tree;
    for (const part of parts.slice(0, -1)) {
      if (part === "") {
        continue;
      }
      if (part in current.Dirs) {
        current = current.Dirs[part]!;
      } else if (part in current.IDs) {
        current = current.Dirs[part];
      } else {
        const child: t.Tree = {IDs: {}, Dirs: {}};
        current.Dirs[part] = child;
        current = child;
      }
    }
    current.IDs[req.id] = parts.slice(-1)[0];
  }

  return {
    Tree: tree,
    Requests: requests,
  };
}

export async function Get(id: RequestID): Promise<t.GetResponse> {
  const j = await load();
  const req = j.request.find(r => r.id === id)!; // TODO: map
  const entry = j[req.kind][id];
  return {
    Request: {
      ID: id,
      Path: req.path,
      Data: entry.request,
      Responses: entry.responses,
    },
    History: entry.responses,
  };
}
