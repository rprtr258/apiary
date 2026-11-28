import js from "@eslint/js";
import {defineConfig} from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import jest from "eslint-plugin-jest";
import {
  commentHygiene,
  mdParser,
  noBooleanLiteralCompare,
  noRestatingComments,
  noUnusedClassMembers,
} from "@rprtr258/eslint-rules";

export default defineConfig([
  {
    files: ["**/*.{ts}"],
    plugins: {js},
    ...js.configs.recommended,
    languageOptions: {globals: globals.browser},
  },
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts", "*.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      "@stylistic": stylistic,
      import: importPlugin,
      local: {rules: {
        "no-unused-class-members": noUnusedClassMembers,
        "comment-hygiene": commentHygiene,
        "no-boolean-literal-compare": noBooleanLiteralCompare,
        "no-restating-comments": noRestatingComments,
      }},
    },
    rules: {
      "eqeqeq": ["error", "always"],
      "object-curly-spacing": ["error", "never"],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "quotes": ["error", "double", {
        allowTemplateLiterals: true,
        avoidEscape: false,
      }],
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name='forEach']",
        message: "forEach is prohibited. Use for..of or functional methods with value return.",
      }, {
        selector: "AssignmentExpression:not(ExpressionStatement > AssignmentExpression):not(ForStatement > AssignmentExpression)",
        message: "Assignment inside an expression is prohibited.",
      }, {
        selector: "ImportDeclaration[importKind='type']",
        message: "import type statements are prohibited. Import types just by name.",
      }, {
        selector: "ImportSpecifier[importKind='type']",
        message: "Inline type imports are prohibited. Import types just by name.",
      }],
      "local/no-boolean-literal-compare": "error",
      "local/no-restating-comments": "error",
      "local/no-unused-class-members": "error",
      "local/comment-hygiene": "error",
      "@typescript-eslint/array-type": "error",
      "@stylistic/semi": ["error", "always"],
      "@stylistic/member-delimiter-style": ["error", {
        "multiline": {delimiter: "comma", requireLast: true},
        "singleline": {delimiter: "comma", requireLast: false},
      }],
      "import/extensions": ["error", "ignorePackages"],
      "@typescript-eslint/no-floating-promises": ["off"],
      "@typescript-eslint/no-misused-promises": ["off"],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowNumber: false,
        allowString: false,
        allowAny: false,
        allowNullableBoolean: false,
        allowNullableEnum: false,
        allowNullableNumber: false,
        allowNullableObject: false,
        allowNullableString: false,
      }],
      "@typescript-eslint/no-unnecessary-condition": ["error", {"allowConstantLoopConditions": true}],
      "@typescript-eslint/restrict-plus-operands": ["error", {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumberAndString: false,
        allowRegExp: false,
        skipCompoundAssignments: false,
      }],
      "@typescript-eslint/require-await": "off",
    },
  },
  // Layering: renderer must not reach into the main
  // process and vice versa; shared/ is the only cross-layer module. The
  // e2e specs reseed db.json behind the running app, so they get a narrow
  // exception for the db file-format modules (renderer/e2e override below).
  {
    files: ["shared/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/main/**", "**/renderer/**", "main/**", "renderer/**"],
          message: "shared/ must not import from main/ or renderer/",
        }],
      }],
    },
  },
  {
    files: ["renderer/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/main/**", "main/**"],
          message: "renderer must not import from main/; share types via shared/",
        }],
      }],
    },
  },
  {
    files: ["main/**", "main.ts", "preload.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/renderer/**", "renderer/**"],
          message: "main must not import from renderer/; share types via shared/",
        }],
      }],
    },
  },
  {
    files: ["renderer/e2e/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/main/**", "!**/main/db.v*.ts"],
          message: "e2e may import only the db file-format modules (db.v*.ts) for reseeding",
        }],
      }],
    },
  },
  {
    files: ["**/*.test.ts"],
    plugins: {jest},
    settings: {jest: {globalPackage: "bun:test"}},
    rules: {
      // bun-types types the async matchers (.rejects/.resolves) as void although
      // they return a promise at runtime (test.d.ts: rejects: Matchers<unknown>),
      // so: type-based no-floating-promises cannot see unawaited assertions and
      // type-based await-thenable false-positives on the correct `await`. The
      // syntactic valid-expect + alwaysAwait enforces the awaits instead.
      "jest/valid-expect": ["error", {alwaysAwait: true}],
      "@typescript-eslint/await-thenable": "off",
    },
  },
  {
    // Generated declaration files: class methods there are public API surface
    // for the generated runtime/consumers, and JSDoc @public tags would not
    // survive regeneration.
    files: ["**/*.d.ts"],
    rules: {"local/no-unused-class-members": "off"},
  },
  {
    files: ["**/*.md"],
    languageOptions: {parser: mdParser},
    rules: {"local/comment-hygiene": ["error", {prose: true}]},
  },
]);
