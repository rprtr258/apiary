import ts from "typescript";
import {AST_NODE_TYPES} from "@typescript-eslint/utils";
import type {TSESTree} from "@typescript-eslint/utils";
import type {RuleDefinition} from "@eslint/core";

type TypeAwareServices = {
  program: ts.Program,
  esTreeNodeToTSNodeMap: {get: (node: TSESTree.Node) => ts.Node},
};

function hasFlag(flags: ts.TypeFlags, flag: ts.TypeFlags): boolean {
  return (flags & flag) !== 0;
}

function isExactBoolean(type: ts.Type): boolean {
  if (hasFlag(type.flags, ts.TypeFlags.Union))
    return (type as ts.UnionType).types.every(part => hasFlag(part.flags, ts.TypeFlags.BooleanLike));
  return hasFlag(type.flags, ts.TypeFlags.BooleanLike);
}

// Operand types where prefixing `!` cannot change the parse (highest-precedence
// expressions); anything else gets wrapped in parentheses in the suggested fix.
const SAFE_NEGATION_OPERANDS = new Set([
  AST_NODE_TYPES.AwaitExpression,
  AST_NODE_TYPES.CallExpression,
  AST_NODE_TYPES.ChainExpression,
  AST_NODE_TYPES.Identifier,
  AST_NODE_TYPES.MemberExpression,
  AST_NODE_TYPES.NewExpression,
  AST_NODE_TYPES.TaggedTemplateExpression,
  AST_NODE_TYPES.TemplateLiteral,
  AST_NODE_TYPES.ThisExpression,
  AST_NODE_TYPES.UnaryExpression,
  AST_NODE_TYPES.UpdateExpression,
]);

// Type-aware replacement for a syntactic boolean-literal-comparison ban:
// flags `x === true` / `x === false` (and `!==`) only when the compared value's type is exactly boolean.
// Union values (e.g. `t.RowValue | null`, `boolean | undefined`) legitimately need explicit comparisons to narrow.
export const noBooleanLiteralCompare: RuleDefinition = {
  meta: {
    type: "problem",
    docs: {description: "Prohibit comparisons against boolean literals on exact boolean values; allow narrowing union values."},
    hasSuggestions: true,
    schema: [],
    messages: {
      noBooleanLiteralCompare: "Do not compare against a boolean literal: replace `{{comparison}}` with `{{replacement}}`. Explicit comparison is only for narrowing union values.",
      replaceWithTruthiness: "Replace with `{{replacement}}`",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode as typeof context.sourceCode & {
      parserServices: TypeAwareServices,
      getText: (node: TSESTree.Node) => string,
    };
    const services = sourceCode.parserServices;
    const checker = services.program.getTypeChecker();

    function check(node: TSESTree.BinaryExpression): void {
      for (const [literal, other] of [[node.left, node.right], [node.right, node.left]]) {
        if (
          literal.type === AST_NODE_TYPES.Literal &&
          (literal.value === true || literal.value === false) &&
          isExactBoolean(checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(other)))
        ) {
          // `x === true` / `x !== false` are plain truthiness; `x === false` / `x !== true` are negations.
          const negate = node.operator === "!==" ? literal.value : !literal.value;
          const operand = sourceCode.getText(other);
          const replacement = negate && !SAFE_NEGATION_OPERANDS.has(other.type) ? `!(${operand})` : negate ? "!"+operand : operand;
          context.report({
            node,
            messageId: "noBooleanLiteralCompare",
            data: {comparison: sourceCode.getText(node), replacement},
            suggest: [{
              messageId: "replaceWithTruthiness",
              data: {replacement},
              fix: fixer => fixer.replaceText(node, replacement),
            }],
          });
          return;
        }
      }
    }

    return {
      "BinaryExpression[operator='===']": check,
      "BinaryExpression[operator='!==']": check,
    };
  },
};
