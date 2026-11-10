import type {Rule} from "eslint";

// Full-line `//` comments that merely narrate the code they precede carry no
// information beyond that code, and are a hallmark of LLM-generated slop
// ("// Create the shaders" above two createShader calls). A house comment
// must instead state a why: constraints, provenance, failure modes, or a
// decision the code cannot show. This rule flags the narrating kind: a short
// comment whose content words all appear among the tokens of the code line
// directly beneath it.

const STOPWORDS: ReadonlySet<string> = new Set([
  // Articles, pronouns, prepositions, conjunctions, copulas, auxiliaries.
  "a", "an", "the", "this", "that", "these", "those", "it", "its", "their", "our", "we", "you", "i",
  "and", "or", "of", "to", "in", "on", "for", "with", "at", "by", "from", "into", "over", "under", "as", "if", "then", "than", "when", "while", "but", "not", "no", "yes", "via", "per", "both", "all", "each", "also", "so", "up", "out", "there", "here", "below", "above",
  "is", "are", "be", "was", "were", "been", "being", "has", "have", "had", "having", "will", "would", "shall", "should", "can", "could", "may", "might", "must", "do", "does", "did", "done",
  // Ordinals and positional filler.
  "first", "second", "third", "one", "two", "three", "new", "next", "last", "own", "same", "other", "another", "only", "just",
  // Narration verbs, plus the filler nouns that restatements lean on.
  "create", "creates", "creating", "make", "makes", "making", "build", "builds", "building", "set", "sets", "setting", "get", "gets", "getting", "init", "initialize", "initializes", "initializing", "initialise", "initialises", "initialising", "update", "updates", "updating", "add", "adds", "adding", "remove", "removes", "removing", "delete", "deletes", "call", "calls", "calling", "use", "uses", "using", "used", "loop", "loops", "looping", "iterate", "iterates", "iterating", "check", "checks", "checking", "declare", "declares", "declaring", "define", "defines", "defining", "return", "returns", "returning", "construct", "constructs", "constructing", "handle", "handles", "handling", "setup", "configure", "configures", "configuring", "run", "runs", "running", "start", "starts", "starting", "stop", "stops", "stopping", "apply", "applies", "applying", "compute", "computes", "computing", "convert", "converts", "converting", "register", "registers", "registering", "bind", "binds", "binding", "attach", "attaches", "attaching", "allocate", "allocates", "allocating", "fill", "fills", "filling", "copy", "copies", "copying", "parse", "parses", "parsing", "fetch", "fetches", "fetching", "read", "reads", "reading", "write", "writes", "writing", "send", "sends", "sending", "load", "loads", "loading", "store", "stores", "storing", "spawn", "spawns", "spawning", "function", "helper", "util", "utils", "variable", "constant", "field", "fields", "property", "properties", "value", "values", "data", "result", "results", "item", "items", "element", "elements", "list", "array", "object", "objects", "entry", "entries", "key", "keys", "option", "options", "param", "params", "parameter", "parameters", "argument", "arguments", "args", "code", "line", "lines", "file", "block", "step", "steps", "case", "cases", "type", "types", "name", "names",
]);

const depluralize = (word: string): string =>
  word.endsWith("ies") ? `${word.slice(0, -3)}y`
  : word.endsWith("s") ? word.slice(0, -1)
  : word;

const codeTokens = (codeLine: string): Set<string> => {
  const parts = new Set<string>();
  for (const token of codeLine.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) {
    const segments = token
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/[\s_]+/);
    for (const segment of segments) {
      const lower = segment.toLowerCase();
      parts.add(lower);
      parts.add(depluralize(lower));
    }
  }
  return parts;
};

export const noRestatingComments: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {description: "Disallows comments that restate the code they precede instead of explaining why."},
    schema: [],
    messages: {
      restating: "This comment restates the code below it. Comments must explain why (constraints, provenance, failure modes), not narrate what the next lines already show; delete it or make it carry information the code does not.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program(): void {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== "Line")
            continue;

          const location = comment.loc;
          if (location === undefined || location === null)
            continue;

          const startLine = location.start.line;
          const before = sourceCode.lines[startLine - 1].slice(0, location.start.column).trim();
          if (before !== "")
            continue; // trailing comment on a code line

          if (startLine > 1 && sourceCode.lines[startLine - 2].trimStart().startsWith("//"))
            continue; // continuation of a multi-line comment block

          const text = comment.value.trim();
          if (text === "" || /^[-=~*/#_+\s]/.test(text))
            continue; // empty or a visual divider
          if (/^eslint-disable|^ts-|^@ts-|^generated by/i.test(text))
            continue; // tooling directives

          const words = text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [];
          const content = [...new Set(words.filter((w) => !STOPWORDS.has(w) && w.length >= 3))];
          if (content.length === 0 || content.length > 4)
            continue; // empty of substance, or long enough to be a real explanation

          let line = startLine + 1;
          while (line <= sourceCode.lines.length) {
            const trimmed = sourceCode.lines[line - 1].trim();
            if (trimmed === "" || trimmed.startsWith("//")) {
              line += 1;
              continue;
            }
            break;
          }
          if (line > sourceCode.lines.length)
            continue;

          const parts = codeTokens(sourceCode.lines[line - 1]);
          if (content.every((w) => parts.has(w) || parts.has(depluralize(w))))
            context.report({node: comment, messageId: "restating"});
        }
      },
    };
  },
};
