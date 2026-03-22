import {sendSQL} from "../main/database/sql.ts";

type i64 = number;
type f64 = number;
type NodeSum =
  | {
    "Node Type": "Result",
  }
  | {
    "Node Type": "Hash Join",
    "Join Type": "Inner",
    "Inner Unique": boolean,
    "Hash Cond": string,
    "Plans": Node[],
  }
  | {
    "Node Type": "Seq Scan",
    "Parent Relationship": "Outer",
    "Relation Name": string,
    "Schema": string,
    "Alias": string,
  }
  | {
    "Node Type": "Hash",
    "Parent Relationship": "Inner",
    "Hash Buckets": i64,
    "Original Hash Buckets": i64,
    "Hash Batches": i64,
    "Original Hash Batches": i64,
    "Peak Memory Usage": i64,
    "Plans": Node[],
  }
;

type Node = NodeSum & {
  Output: string[],
  "Async Capable": boolean,
  "Parallel Aware": boolean,
  "Startup Cost": i64,
  "Total Cost": f64,
  "Plan Rows": i64,
  "Plan Width": i64,
  "Actual Startup Time": f64,
  "Actual Total Time": f64,
  "Actual Rows": i64,
  "Actual Loops": i64,
  "Shared Hit Blocks": i64,
  "Shared Read Blocks": i64,
  "Shared Dirtied Blocks": i64,
  "Shared Written Blocks": i64,
  "Local Hit Blocks": i64,
  "Local Read Blocks": i64,
  "Local Dirtied Blocks": i64,
  "Local Written Blocks": i64,
  "Temp Read Blocks": i64,
  "Temp Written Blocks": i64,
};

type Data = {
  Plan: Node,
  Triggers: {
    "Trigger Name": string,
    Relation: string,
    Time: f64,
    Calls: string,
  }[],
  Planning: {
    "Shared Hit Blocks": i64,
    "Shared Read Blocks": i64,
    "Shared Dirtied Blocks": i64,
    "Shared Written Blocks": i64,
    "Local Hit Blocks": i64,
    "Local Read Blocks": i64,
    "Local Dirtied Blocks": i64,
    "Local Written Blocks": i64,
    "Temp Read Blocks": i64,
    "Temp Written Blocks": i64,
  },
  "Planning Time": f64,
  "Execution Time": f64,
};

const dsn = "postgres:password@localhost:5432/postgres?sslmode=disable";
const analyze_prefix = "EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) ";
// const query = "SELECT 1";
const query = "SELECT * FROM employees e JOIN departments d ON e.department_id = d.id";

console.log(query);
const result = await sendSQL({database: "postgres", dsn, query: analyze_prefix + query});
const analyze = result.rows[0][0] as Data[];
console.log(JSON.stringify(analyze[0], null, 2));
