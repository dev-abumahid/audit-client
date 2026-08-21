import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
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
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // jsx-a11y/flatConfigs.recommended (extended above) already sets
      // role-has-required-aria-props/role-supports-aria-props/aria-props/
      // aria-proptypes/aria-unsupported-elements/interactive-supports-focus
      // to 'error' — re-declared here anyway, as a readable, explicit
      // record of exactly which rules matter for the bug class this repo
      // audit was checking for (custom toggle-switch controls with no ARIA
      // switch semantics: no role="switch"/aria-checked). This block is a
      // no-op against the defaults, not new coverage; it exists so a
      // future reader doesn't have to open jsx-a11y's source to know these
      // are load-bearing for that specific bug.
      // See docs/design-docs/2026-08-theme-improvement-initiative.md
      // (Phase A1) for context.
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      // The 8 rules below are real jsx-a11y/recommended rules that DO
      // surface a substantial pre-existing backlog when run at 'error'
      // (confirmed via `npm run lint`: ~79 warnings across layouts, KRI
      // modals, IntelligencePage.tsx, SitesEntities.tsx, and others).
      // Downgraded to 'warn' so the lint gate stays green without this
      // PR fixing an unrelated backlog. Follow-up: tighten each back to
      // 'error' once its own backlog is cleared. The first three are the
      // ones most relevant to the toggle-switch bug class this PR exists
      // to catch (an interactive control built on a non-interactive
      // element, or with a click handler but no keyboard equivalent) —
      // prioritize clearing those first.
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
      'jsx-a11y/aria-role': 'warn',
    },
  },
])
