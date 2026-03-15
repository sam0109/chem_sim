import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      boundaries,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      // Resolve TypeScript imports so the boundaries plugin can map
      // relative import paths (e.g. '../store/simulationStore') to
      // their full project-relative paths for element-type matching.
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
      },
      // Define architectural layers as element types.
      // Uses mode: "folder" (default) with right-to-left matching so both
      // file paths and relative import targets are resolved correctly.
      'boundaries/elements': [
        { type: 'data', pattern: 'data', mode: 'folder' },
        { type: 'engine', pattern: 'engine', mode: 'folder' },
        { type: 'io', pattern: 'io', mode: 'folder' },
        { type: 'store', pattern: 'store', mode: 'folder' },
        { type: 'renderer', pattern: 'renderer', mode: 'folder' },
        { type: 'ui', pattern: 'ui', mode: 'folder' },
        { type: 'root', pattern: 'src/*', mode: 'file' },
      ],
    },
    rules: {
      // Enforce architectural layer boundaries.
      // Default: disallow all cross-layer imports, then whitelist valid ones.
      //
      // Allowed dependency graph (see CLAUDE.md § Architecture):
      //   data     → (nothing — leaf/foundation layer)
      //   engine   → data, io
      //   io       → data
      //   store    → data, root (worker-comms.ts)
      //   renderer → data, store
      //   ui       → data, store
      //   root     → data, io, store, renderer, ui (App.tsx wires everything)
      //
      // Each layer may always import from itself (intra-layer).
      'boundaries/element-types': [2, {
        default: 'disallow',
        rules: [
          { from: ['data'], allow: ['data'] },
          { from: ['engine'], allow: ['engine', 'data', 'io'] },
          { from: ['io'], allow: ['io', 'data'] },
          { from: ['store'], allow: ['store', 'data', 'root'] },
          { from: ['renderer'], allow: ['renderer', 'data', 'store'] },
          { from: ['ui'], allow: ['ui', 'data', 'store'] },
          { from: ['root'], allow: ['root', 'data', 'io', 'store', 'renderer', 'ui'] },
        ],
      }],
    },
  },
])
