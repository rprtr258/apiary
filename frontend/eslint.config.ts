import js from "@eslint/js";
import {defineConfig} from "eslint/config"; // eslint-disable-line
import globals from "globals";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
  {
    ignores: ["wailsjs/**"],
  },
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
      "@stylistic/semi": ["error", "always"],
      "@stylistic/member-delimiter-style": ["error", {
        "multiline": {delimiter: "comma", requireLast: true},
        "singleline": {delimiter: "comma", requireLast: false},
      }],
      "import/extensions": ["error", "always"],
      "@typescript-eslint/no-floating-promises": ["off"],
      "@typescript-eslint/no-misused-promises": ["off"],
      "@typescript-eslint/no-unused-vars": ["off"/*"error", {argsIgnorePattern: "^_"}*/], // TODO: get back
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
      // "@typescript-eslint/no-non-null-assertion": "error", // TODO: get back maybe
      "@typescript-eslint/restrict-plus-operands": ["error", {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumberAndString: false,
        allowRegExp: false,
        skipCompoundAssignments: false,
      }],
    },
  },
]);
