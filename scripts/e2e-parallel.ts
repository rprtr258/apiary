import {spawn} from "bun";
import {styleText} from "util";

async function runCommand(command: string, cwd = ".", env: Record<string, string> = {}, timeoutMs = 300000) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`::group::[${timestamp}] ${styleText("green", `Running: ${command}`)}`);
  try {
    const proc = spawn(["bash", "-c", command], {
      cwd,
      stdout: "inherit",
      stderr: "inherit",
      env: {...process.env, ...env},
      timeout: timeoutMs,
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Command failed: ${command}`);
    }
  } finally {
    console.log("::endgroup::");
  }
}

async function all(...values: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(values);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(f.reason);
    }
    throw new Error(`${failures.length} task(s) failed`);
  }
}

async function main() {
  console.log("Starting parallel E2E setup...");

  const aptPackages = [
    // Basic build tools
    "pkg-config",
    // GTK and WebKit for Wails
    "libgtk-3-dev", "libwebkit2gtk-4.0-dev",
  ];

  await all(
    (async () => {
      await runCommand("sudo apt-get update");
      await runCommand(`sudo apt-get install -y ${aptPackages.join(" ")}`);
    })(),
    runCommand("go install github.com/wailsapp/wails/v2/cmd/wails@latest", ".."),
    runCommand("bun install", "."),
    runCommand("bunx playwright install"),
  );

  await runCommand("wails doctor");
  await runCommand("bun run test:e2e");

  console.log("E2E tests completed successfully!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
