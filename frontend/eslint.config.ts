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
      "object-curly-spacing": ["error", "never"],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/member-delimiter-style": ["error", {
        "multiline": {delimiter: "comma", requireLast: true},
        "singleline": {delimiter: "comma", requireLast: false},
      }],
      "import/extensions": ["error", "always"],
      "@typescript-eslint/no-floating-promises": ["off"],
      "@typescript-eslint/no-misused-promises": ["off"],
      "@typescript-eslint/no-unused-vars": ["off"], // TODO: remove
      // "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowNumber: false,
        allowString: false,
      }],
    },
  },
]);
