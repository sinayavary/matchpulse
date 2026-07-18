import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/coverage/**", "**/next-env.d.ts", "prisma/migrations/**", "official-txline-examples/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: { globals: { console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly", AbortController: "readonly", fetch: "readonly", window: "readonly", structuredClone: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly" } },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "off",
      "no-useless-escape": "off",
      "no-empty-pattern": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/triple-slash-reference": "off"
    }
  }
);

