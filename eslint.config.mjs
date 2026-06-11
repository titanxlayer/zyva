import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Pragmatic rule levels for an existing codebase: keep these as warnings so
  // CI stays green while we incrementally tighten types. They still show up
  // locally as warnings.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ZYVA: vendored clones, packaging output, and standalone build
    "temp_opencode/**",
    "vendor/**",
    "desktop/**",
    "gateway/**",
    "landing/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
