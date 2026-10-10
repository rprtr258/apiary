import {Database as BunDB} from "bun:sqlite";

// better-sqlite3 is not supported in Bun (native addon).
// Mock it with a thin adapter wrapping bun:sqlite.
// TODO: remove after https://github.com/oven-sh/bun/issues/4290 is fixed
export class BetterLikeDB {
  #db: BunDB;
  constructor(path: string) {
    this.#db = new BunDB(path);
  }
  prepare(sql: string) {
    const stmt = this.#db.query(sql);
    return {
      all: () => stmt.all() as Record<string, unknown>[],
      run: () => stmt.run() as {changes: number | bigint, lastInsertRowid: number | bigint},
    };
  }
  transaction<T>(fn: () => T): () => T {
    return fn; // bun:sqlite autocommits; matches better-sqlite3 semantics closely enough for tests
  }
  close() {
    this.#db.close();
  }
}
