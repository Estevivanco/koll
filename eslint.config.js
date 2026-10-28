import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.recommended,
  // Alone in its object so it stays a global ignore
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  // Hook rules only apply to the React app
  { files: ["apps/web/**/*.{ts,tsx}"], ...reactHooks.configs.flat.recommended },
);
