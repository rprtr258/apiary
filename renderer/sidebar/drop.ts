import type {requestPreview, RequestID, Tree, TreeChild, TreeEntry} from "@/types.ts";
import type {TreeOption} from "../components/dataview.ts";

const joinDir = (dir: string, name: string): string => dir === "" ? name : dir + "/" + name;

const dirname = (path: string): string => path.split("/").slice(0, -1).join("/");

const basename = (path: string): string => path.split("/").slice(-1)[0];

const childRef = (e: TreeEntry): TreeChild =>
  e.kind === "dir" ? {d: e.name} : {r: e.id};

const childKey = (e: TreeChild): string => "r" in e ? `r:${e.r}` : `d:${e.d}`;

// Children of a directory in the order the sidebar renders them (the order
// List() emitted, i.e. manual order plus name-sorted fallback)
function sectionChildren(tree: Tree, dir: string): TreeChild[] {
  let current = tree;
  for (const seg of dir.split("/").filter(s => s !== "")) {
    const next = current.entries.find(e => e.kind === "dir" && e.name === seg);
    if (next === undefined || next.kind !== "dir")
      return [];
    current = next.tree;
  }
  return current.entries.map(childRef);
}

export type Drop = {
  node: TreeOption,
  dragNode: TreeOption,
  dropPosition: "before" | "inside" | "after",
};

export type MoveParams = {
  drag: TreeChild,
  toDir: string,
  // Desired full child order of toDir after the move, as the Move op expects
  order: TreeChild[],
  // Requests whose path changes (id -> new full path), for tab title updates
  renames: Record<RequestID, string>,
  // Dirs to expand so the moved item stays visible
  expand: string[],
};

// Pure decision logic for a sidebar drop: resolves drop geometry (target node
// + before/inside/after) into a Move payload against the current tree.
// Returns undefined for drops that change nothing or cannot apply: dropping
// on the dragged row itself, a dir into its own descendant, a no-op reorder.
export function dropToMove(
  requests: Record<RequestID, requestPreview>,
  tree: Tree,
  drop: Drop,
): MoveParams | undefined {
  const {node, dragNode, dropPosition} = drop;
  if (node.key === dragNode.key)
    return undefined;

  // Requests are keyed by id (their dir comes from the record's path); dirs
  // are keyed by full path
  const dragIsReq = dragNode.key in requests;
  const drag: TreeChild = dragIsReq ? {r: dragNode.key} : {d: basename(dragNode.key)};

  // Target dir plus the drop position within it; "append" (inside a dir /
  // empty tree area) puts the item at the end, before/after next to the
  // target child
  let toDir: string;
  let append: boolean;
  let target: TreeChild | undefined;
  if (node.key === "") {
    toDir = "";
    append = true;
  } else if (node.key in requests) {
    // Request row: sibling position in its dir; "inside" only comes up for
    // rows with children (source requests) and means the position after it
    toDir = dirname(requests[node.key].path);
    append = false;
    target = {r: node.key};
  } else if (dropPosition === "inside") {
    toDir = node.key;
    append = true;
  } else {
    toDir = dirname(node.key);
    append = false;
    target = {d: basename(node.key)};
  }

  if (!dragIsReq && (toDir === dragNode.key || toDir.startsWith(dragNode.key + "/")))
    return undefined; // a directory cannot move into itself

  // The target sequence without the dragged entry (it is already part of it
  // when reordering within one dir); insertion indexes are relative to it.
  // A same-named dir in the target (a merge) matches the dragged child key
  // and is replaced by the dragged entry.
  const current = sectionChildren(tree, toDir);
  const siblings = current.filter(e => childKey(e) !== childKey(drag));
  let order: TreeChild[];
  if (append) {
    order = [...siblings, drag];
  } else {
    const idx = siblings.findIndex(e => childKey(e) === childKey(target!));
    // Target not in the sequence (merge with an equal-named dir): fall back
    // to appending
    const at = idx === -1 ? siblings.length : dropPosition === "before" ? idx : idx + 1;
    order = siblings.toSpliced(at, 0, drag);
  }

  const renames: Record<RequestID, string> = {};
  if (dragIsReq) {
    const newPath = joinDir(toDir, basename(requests[dragNode.key].path));
    if (newPath !== requests[dragNode.key].path)
      renames[dragNode.key] = newPath;
  } else {
    const newDir = joinDir(toDir, basename(dragNode.key));
    if (newDir !== dragNode.key) {
      for (const [id, req] of Object.entries(requests)) {
        if (req.path.startsWith(dragNode.key + "/"))
          renames[id] = newDir + req.path.slice(dragNode.key.length);
      }
    }
  }

  const unchanged = Object.keys(renames).length === 0 &&
    order.length === current.length &&
    order.every((e, i) => childKey(e) === childKey(current[i]));
  if (unchanged)
    return undefined;

  // Ancestors of the new location, so the moved item is visible after the
  // fetch-driven rebuild
  const expand: string[] = [];
  const segs = toDir.split("/").filter(s => s !== "");
  for (let i = 0; i < segs.length; i++)
    expand.push(segs.slice(0, i + 1).join("/"));
  if (!dragIsReq)
    expand.push(joinDir(toDir, basename(dragNode.key)));

  return {drag, toDir, order, renames, expand};
}
