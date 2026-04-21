import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import autoFixPlugin from "eslint-plugin-autofix"
import importPlugin from "eslint-plugin-import"
import prettierPlugin from "eslint-plugin-prettier"
import reactPlugin from "eslint-plugin-react"
import { defineConfig, globalIgnores } from "eslint/config"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "**/next-env.d.ts",
    "node_modules/**",
    "generated/**",
  ]),
  {
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
      react: reactPlugin,
      autofix: autoFixPlugin,
    },
    rules: {
      // "no-console": "warn",
      "no-redeclare": "warn",
      "spaced-comment": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",
      "import/no-dynamic-require": "warn",
      "import/no-nodejs-modules": "warn",
      "prettier/prettier": "warn",
      "react/display-name": "error",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/self-closing-comp": [
        "error",
        {
          component: true,
          html: true,
        },
      ],
      "autofix/no-unused-vars": [
        "warn",
        {
          args: "none",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
])

export default eslintConfig
