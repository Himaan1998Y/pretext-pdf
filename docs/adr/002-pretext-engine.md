# ADR 002 — Use @chenglou/pretext for text measurement and layout

**Status:** Accepted  
**Date:** 2026-04-07

## Context

PDF generation requires precise per-character text measurement to know where lines break,
how wide each word is, and how tall each paragraph is. Without accurate measurement, text
overflows page boundaries or leaves unexpected gaps.

`@cantoo/pdf-lib` can draw text but has no layout engine — it places glyphs at coordinates
you provide. Getting those coordinates right requires a separate measurement step.

Options considered:
1. Use canvas (`@napi-rs/canvas` / browser `OffscreenCanvas`) directly for measurement.
2. Use `@chenglou/pretext` — a dedicated text-layout engine that wraps canvas and exposes
   line-break and measurement primitives matching CSS inline-layout semantics.

## Decision

Use `@chenglou/pretext` for all text measurement and line-breaking. Use `@cantoo/pdf-lib`
only for PDF assembly (drawing, font embedding, page creation).

## Alternatives considered

- **Direct canvas measurement** — requires implementing word-wrap, CJK line-breaking,
  RTL/bidi resolution, and hyphenation manually. All of these have subtle edge cases
  (e.g. CSS trailing-whitespace behavior, opening-bracket rules for CJK). `@chenglou/pretext`
  has already solved them upstream.
- **Puppeteer/headless Chrome layout** — accurate but introduces a 150 MB+ binary dependency.
  A non-starter for serverless and LLM use cases.

## Consequences

- Text layout matches browser inline-layout semantics (intentional — users find it predictable).
- CJK line-breaking, bidi text, and letterSpacing are handled by upstream `@chenglou/pretext`
  rather than hand-rolled code.
- We track `@chenglou/pretext` bumps via Renovate. API changes are rare but do happen
  (e.g. native `letterSpacing` support added in 0.0.6).
- The library is ESM-only because `@chenglou/pretext` is ESM-only.
