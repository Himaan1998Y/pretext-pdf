# ADR 004 — Optional features use peer dependencies, not bundled dependencies

**Status:** Accepted  
**Date:** 2026-04-08

## Context

Several element types require heavy third-party libraries:

| Feature | Library | Size |
| ------- | ------- | ---- |
| SVG / QR / barcode / chart rendering (Node) | `@napi-rs/canvas` | ~40 MB native binary |
| Digital PDF signing | `@signpdf/signpdf` | ~2 MB |
| QR code generation | `qrcode` | ~500 KB |
| Barcode generation | `bwip-js` | ~3 MB |
| Vega-Lite charts | `vega` + `vega-lite` | ~12 MB |
| Markdown parsing | `marked` | ~150 KB |
| Syntax highlighting | `highlight.js` | ~1 MB |

Most users need only a subset of these. Bundling all of them would make every install
40 MB+ and impose native binary compilation (for `@napi-rs/canvas`) on all consumers —
including those who only need text, tables, and headings.

## Decision

All optional features use `peerDependencies` with `peerDependenciesMeta.optional: true`.
Install only what you use. The library throws a clear `DEPENDENCY_MISSING`-family error
with an install instruction when a missing optional dep is invoked at runtime.

`@cantoo/pdf-lib`, `@chenglou/pretext`, `@fontsource/inter`, `bidi-js`, `hypher`, and
`hyphenation.en-us` are mandatory runtime dependencies — every document needs them.

## Alternatives considered

- **Bundle everything** — ballooned install from ~5 MB to ~60 MB. Unacceptable for
  serverless and LLM tool use cases where cold-start time matters.
- **Separate entry points** (`pretext-pdf/charts`, `pretext-pdf/signing`)** — adds
  complexity without reducing install size (npm always installs all deps regardless
  of which entry is imported).

## Consequences

- The happy path (text-heavy documents) has a minimal install footprint (~5 MB including fonts).
- Users who need SVG or charts must run `npm install @napi-rs/canvas` — one extra command,
  documented in README.
- Error messages at runtime are explicit: `"@napi-rs/canvas is required for Node.js usage.
  Install it: npm install @napi-rs/canvas"`. Users are never left wondering why something fails.
- `@napi-rs/canvas` is also listed in `optionalDependencies` so npm installs it automatically
  when possible (e.g. in the dev environment), while still allowing it to be omitted in
  environments where native compilation fails.
