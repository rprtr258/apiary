import jqWasm from "jq-wasm";

export async function jq(json: string, query: string): Promise<string[]> {
  // try parse request as json
  try {
    JSON.parse(json);
  } catch (e) {
    return json.split("\n");
  }

  const result = await jqWasm.raw(json, query, ["-r"]);
  if (result.exitCode !== 0) {
    throw new Error(`jq error: ${result.stderr}`);
  }

  return result.stdout
    .split("\n")
    .filter(line => line.length > 0);
}
