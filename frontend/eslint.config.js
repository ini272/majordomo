import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      "playwright.config.ts",
      "scripts/**/*.{ts,tsx,js,mjs,cjs}",
      "*.config.{js,ts,mjs,cjs}",
      "eslint.config.js",
      "vite.config.js",
      "tailwind.config.js",
      "postcss.config.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
