// Runs the TypeScript unit tests and the Go wasm-engine tests in parallel,
// preserving their combined exit status (fails if either side fails).
// Outputs are captured per side and replayed afterwards so the interleaved
// output stays readable; full logs are written to /tmp for debugging.
import {spawn} from "node:child_process";
import {openSync} from "node:fs";
import path from "node:path";

function runToLog(label: string, args: string[], logPath: string): Promise<number> {
  return new Promise((resolve) => {
    const fd = openSync(logPath, "w");
    const child = spawn(args[0], args.slice(1), {
      stdio: ["ignore", fd, fd],
      env: {...process.env, APIARY_TEST_LOG: logPath},
    });
    child.on("exit", (code) => {
      process.stdout.write(`\n--- ${label} finished with exit code ${code ?? -1} (log: ${logPath}) ---\n`);
      resolve(code ?? -1);
    });
  });
}

const logs = {
  ts: path.join("/tmp", "apiary-test-unit.log"),
  go: path.join("/tmp", "apiary-test-go.log"),
};

const [tsCode, goCode] = await Promise.all([
  runToLog("TypeScript tests", ["bun", "run", "test:unit"], logs.ts),
  runToLog("Go tests", ["bun", "run", "test:go"], logs.go),
]);

for (const logPath of [logs.ts, logs.go]) {
  const content = (await Bun.file(logPath).text()).trimEnd();
  if (content.length > 0) {
    console.log(`\n=== ${logPath} ===`);
    console.log(content);
  }
}

if (tsCode !== 0 || goCode !== 0) {
  process.exit(1);
}
console.log("\nAll tests passed");
