# ADR 005 — ESM-only output (no CommonJS dual publish)

**Status:** Accepted  
**Date:** 2026-04-07

## Context

Node.js supports two module systems: CommonJS (`require`) and ES Modules (`import`).
Libraries can publish one or both via the `package.json#exports` conditional map.

## Decision

Publish ESM only. `package.json` sets `"type": "module"`. No CJS build, no dual publish.

## Rationale

1. **Upstream constraint** — `@chenglou/pretext` is ESM-only. A CJS build of `pretext-pdf`
   would need to either bundle `@chenglou/pretext` (defeating the purpose of peer deps and
   adding maintenance burden) or use a dynamic `import()` workaround that breaks many
   CJS-first build tools.

2. **Browser compatibility** — ESM is the native module format for browsers and bundlers
   (Vite, webpack, Rollup, esm.sh). CJS is a Node.js-only concept. An ESM-only library
   works everywhere; a CJS library requires a bundler polyfill for browser use.

3. **Reduced build complexity** — dual publishing requires maintaining two transpilation
   pipelines, two sets of type declarations, and careful conditional exports. The ecosystem
   is moving to ESM-only (Node 18+ LTS, Vitest, many new packages). The risk of breaking
   CJS consumers is low for a new library with no existing CJS user base.

## Alternatives considered

- **Dual CJS + ESM publish** — adds ~30% build complexity, requires `"exports"` conditional
  maps, and creates subtle interop issues (e.g. named export mismatches between CJS and ESM).
  The benefit is backward compat for consumers using `require()` — but Node 18+ can load
  ESM via dynamic `import()` even from CJS code.
- **CJS-only** — ruled out immediately. `@chenglou/pretext` is ESM-only; browser use would
  require a bundler shim; the ecosystem direction is ESM.

## Consequences

- Consumers must use `import`, not `require`. This is documented prominently in README.
- Node.js ≥ 18 is required (ESM support stabilized in 18 LTS). Node 16 is EOL.
- TypeScript projects need `"moduleResolution": "bundler"` or `"node16"` in tsconfig —
  `"node10"` (old default) cannot resolve the `exports` map.
- CJS consumers can use dynamic `import('pretext-pdf')` — this works in Node 18+ and
  is the standard migration path.
