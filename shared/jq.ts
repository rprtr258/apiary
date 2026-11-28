import jqWasm from "jq-wasm";

// Real jq parses its input itself, including streams of newline/whitespace
// separated documents; invalid input just fails with a non-zero exit code.
export async function jq(json: string, query: string): Promise<string[]> {
  const result = await jqWasm.raw(json, query, ["-r"]);
  if (result.exitCode !== 0) {
    throw new Error(`jq error: ${result.stderr}`);
  }

  return result.stdout
    .split("\n")
    .filter(line => line.length > 0);
}
