import {chdir} from "process";
import {mock} from "bun:test";
import {ListTablesSQLSource, TestSQLSource} from "../main/api.ts";
import {Database} from "bun:sqlite";
import {formatSize} from "../renderer/lib/utils.ts";

// better-sqlite3 is not supported in Bun (native addon).
// Mock it with a thin adapter wrapping bun:sqlite.
// TODO: remove after https://github.com/oven-sh/bun/issues/4290 is fixed
export class BetterLikeDB {
  #db: Database;
  constructor(path: string) {
    this.#db = new Database(path);
  }
  prepare(sql: string) {
    const stmt = this.#db.query(sql);
    return {
      all: () => stmt.all() as Record<string, unknown>[],
    };
  }
  close() {
    this.#db.close();
  }
}


mock.module("better-sqlite3", () => ({
  default: BetterLikeDB,
}));

const id = "RjB0YRMNVwhxUYhaTF-Rn";
chdir("/home/rprtr258/pr/apiary");
await TestSQLSource(id);
const tables = await ListTablesSQLSource(id);
for (const {name, rowCount, sizeBytes} of tables.toSorted((a, b) => b.rowCount - a.rowCount)) {
  console.log(`${name.padEnd(23)} ${rowCount === 0 ? "empty" : `(${rowCount} rows, ${formatSize(sizeBytes)})`}`);
}
