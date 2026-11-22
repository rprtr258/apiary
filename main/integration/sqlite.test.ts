import {describe, test, expect, beforeAll, mock} from "bun:test";
import {mkdtemp} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import * as sql from "../database/sql.ts";
import * as sql_source from "../database/sql_source.ts";
import {BetterLikeDB} from "../database/mock_better_sqlite3.ts";

// better-sqlite3 is a native addon unsupported by bun; the mock bridges it to
// bun:sqlite so the sqlite driver runs against a real SQLite engine.
mock.module("better-sqlite3", () => ({
  default: BetterLikeDB,
}));

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);

// sqlite runs on a real engine via the bun:sqlite-backed better-sqlite3 mock:
// pragmas must ride table-valued functions with bound args and
// quoteIdent must double backticks stored inside identifiers.
describe.if(IS_INTEGRATION)("sql crafted table names (sqlite)", () => {
  let dsn = "";

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sqlite-crafted-integration"));
    dsn = path.join(dir, "apiary-crafted.db");
    await sql.send({dsn, database: "sqlite", query: `CREATE TABLE "a\`b" ("c\`d" TEXT)`});
    await sql.send({dsn, database: "sqlite", query: `INSERT INTO "a\`b" VALUES ('xyz')`});
    await sql.send({dsn, database: "sqlite", query: `CREATE TABLE "o'brien" (id INTEGER PRIMARY KEY, p INT REFERENCES "o'brien"(id))`});
    await sql.send({dsn, database: "sqlite", query: `CREATE TABLE "up\`d" (id INTEGER PRIMARY KEY, "c\`d" TEXT)`});
    await sql.send({dsn, database: "sqlite", query: `INSERT INTO "up\`d" VALUES (1, 'x')`});
  });

  test("listTables handles quote characters in table and column names", async () => {
    const tables = await sql.listTables({database: "sqlite", dsn});
    expect(tables.find(t => t.name === "a`b")).toEqual({name: "a`b", rowCount: 1, sizeBytes: 3});
  });

  test("describeTable handles a single quote in the table name", async () => {
    const schema = await sql.describeTable({dsn, database: "sqlite"}, "o'brien");
    expect(schema.columns.map(c => c.name)).toEqual(["id", "p"]);
    expect(schema.constraints.map(c => c.columns)).toEqual([["id"]]);
    expect(schema.foreign_keys.map(f => f.table)).toEqual(["o'brien"]);
  });

  test("counts and updates through quoteIdent", async () => {
    const count = await sql_source.countRowsSQLSource({dsn, database: "sqlite"}, "up`d", {kind: "simple", column: "c`d", op: "=", value: "x"});
    expect(count).toBe(1);
    await sql_source.updateTableRows({dsn, database: "sqlite", readOnly: false}, "up`d", ["id"],
      [{pkValues: [1], column: "c`d", value: `w"x'z`}]);
    const res = await sql.send({dsn, database: "sqlite", query: `SELECT "c\`d" FROM "up\`d"`});
    expect(res.rows).toEqual([[`w"x'z`]]);
  });
});
