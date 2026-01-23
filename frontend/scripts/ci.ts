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

async function main() {
  console.log(styleText("greenBright", "Starting CI checks..."));
  await Promise.all([
    runCommand(["tsc", "-p", "tsconfig.json"]),
    runCommand(["bun", "run", "lint"]),
    runCommand(["bun", "run", "test"]),
  ]);
  console.log(styleText("greenBright", "CI checks completed successfully!"));
}

try {
  await main();
} catch(err) {
  console.error(err);
  process.exit(1);
}
