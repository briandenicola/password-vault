# ADR-0004: PrimeVue v4 for the UI (exit Vue 2 compat)

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The SPA is Vue 3 but ran through `@vue/compat` (the temporary migration build,
MODE 2) and **`bootstrap-vue@2`**, which is Vue 2-only and dragged **EOL
`vue@2.7.16`** into the dependency tree. This blocks a clean Vue 3 future and
ships unsupported code. We needed a maintained component library with a modern
look and, ideally, a built-in password field with a strength meter.

## Decision

Replace bootstrap-vue with **PrimeVue v4** (Aura theme + `primeicons`). Register
components on the app instance in `main.js`. Map: `b-table`→`DataTable`,
`b-modal`/`$refs.show()`→`Dialog` with `v-model:visible`, and
InputText/Textarea/Select/Checkbox/RadioButton/Tag/Message/Button for forms.
Remove `@vue/compat` and `bootstrap-vue`; **keep Bootstrap CSS (BS5)** for
grid/spacing utilities only (framework-agnostic, no Vue dependency).

## Consequences

- `npm ls vue` shows only `vue@3`; no EOL Vue 2 in the tree.
- Modals use reactive `v-model:visible` instead of `$refs`; tables get built-in
  sort/paginate/expansion (helps FE-14).
- PrimeVue's `Password` component can later deliver the FE-1 strength meter.
- New UI work must use PrimeVue components, not `b-*` (see repository memory).
- Validate UI changes with a real-browser (Puppeteer) smoke pass — node-based
  Vitest misses browser-only bugs (e.g. unbound `setTimeout` "Illegal invocation").
