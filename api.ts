import {extractSubKind, load, RequestID} from "./db.ts";
import * as app from "./frontend/wailsjs/go/models.ts";

export async function List(): Promise<app.ListResponse> {
  const j = await load();
  const tree: app.Tree = {IDs: {}, Dirs: {}};
  const requests: Record<RequestID, app.requestPreview> = {};
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
        const child: app.Tree = {IDs: {}, Dirs: {}};
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

export async function Get(id: RequestID): Promise<app.GetResponse> {
  const j = await load();
  const req = j.request.find(r => r.id === id); // TODO: map
  return {
    Request: {
      ID: id,
      Path: req.path,
      Data: j[req.kind][id].request,
      Responses: j[req.kind][id].responses,
    },
    History: j[req.kind][id].responses,
  };
}
