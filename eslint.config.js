import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['server/**'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // server/ is a separate CommonJS Node project (own package.json) — plain
  // require()/module.exports, no React/JSX, so it gets Node globals and
  // just the base recommended rules instead of the frontend config above.
  {
    files: ['server/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
])
