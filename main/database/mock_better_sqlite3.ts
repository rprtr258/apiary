import {Database as BunDB, SQLQueryBindings} from "bun:sqlite";

// better-sqlite3 is not supported in Bun (native addon).
// Mock it with a thin adapter wrapping bun:sqlite.
export class BetterLikeDB {
  #db: BunDB;
  constructor(path: string) {
    this.#db = new BunDB(path);
  }
  prepare(sql: string) {
    const stmt = this.#db.query(sql);
    return {
      all: (...args: SQLQueryBindings[]) => stmt.all(...args) as Record<string, unknown>[],
      run: (...args: SQLQueryBindings[]) => stmt.run(...args) as {changes: number | bigint, lastInsertRowid: number | bigint},
      // better-sqlite3 reader: statement returns data (bun:sqlite exposes the
      // same fact as a non-empty columnNames)
      reader: stmt.columnNames.length > 0,
      columns: () => stmt.columnNames.map((name, i) => ({name, type: stmt.declaredTypes[i] ?? null})),
    };
  }
  transaction<T>(fn: () => T): () => T {
    return fn; // bun:sqlite autocommits; matches better-sqlite3 semantics closely enough for tests
  }
  close() {
    this.#db.close();
  }
}
