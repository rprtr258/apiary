import {spawn} from "bun";
import {styleText} from "util";

async function runCommand(command: string[]) {
  const proc = spawn(command, {
    cwd: ".",
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
    timeout: 300*1000,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}`);
  }
}

type LintFinding = {
  severity: "error" | "warning" | "info",
  path: string,
  message: string,
};

// design.md lint exits 0 even with warnings, so we gate on the findings
// ourselves and fail CI on anything that is not the informational summary.
// Run via pinned bun x (not a devDependency): @google/design.md pulls in
// zod@^3 which would break the repo's zod/v4 MCP typechecking.
async function runDesignLint(): Promise<void> {
  const proc = spawn(["bun", "x", "@google/design.md@0.4.0", "lint", "DESIGN.md", "--format=json"], {
    cwd: ".",
    env: process.env,
    stdout: "pipe",
    stderr: "inherit",
    timeout: 300*1000,
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`design.md lint failed with exit code ${exitCode}`);
  }

  const {findings} = JSON.parse(stdout) as {findings: LintFinding[]};
  const problems = findings.filter(f => ["error", "warning"].includes(f.severity));
  if (problems.length === 0) {
    console.log(styleText("greenBright", "DESIGN.md lint passed"));
    return;
  }

  for (const {severity, path, message} of problems) {
    console.warn(`[design.md:${severity}] ${path}: ${message}`);
  }
  throw new Error(`DESIGN.md lint: ${problems.length} problem(s)`);
}

async function main() {
  console.log(styleText("greenBright", "Starting CI checks..."));
  await Promise.all([
    runCommand(["bun", "run", "typecheck"]),
    runCommand(["bun", "run", "lint"]),
    runCommand(["bun", "run", "test"]),
    runDesignLint(),
  ]);
  console.log(styleText("greenBright", "CI checks completed successfully!"));
}

try {
  await main();
} catch(err) {
  console.error(err);
  process.exit(1);
}
