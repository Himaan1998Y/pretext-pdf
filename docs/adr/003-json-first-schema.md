# ADR 003 — JSON-first document schema (not JSX/React components)

**Status:** Accepted  
**Date:** 2026-04-07  
**Revisited:** 2026-04-20 (React wrapper explored and deprioritized — see below)

## Context

The library needs a way for callers to describe a document. Two dominant approaches exist:

1. **JSX/React component tree** — `<Document><Heading level={1}>Title</Heading></Document>`
2. **Plain JSON/object schema** — `{ content: [{ type: 'heading', level: 1, text: 'Title' }] }`

## Decision

Use a plain JSON schema (`PdfDocument`). JSX is explicitly out of scope for the core library.

## Rationale

The primary consumers of this library are:
- **LLMs** — large language models that emit structured JSON natively. A JSX API would require
  the LLM to emit code that is then executed, introducing a code-execution dependency. A JSON
  API lets the LLM emit the document directly in one shot, with no `eval`.
- **Server-side TypeScript/JavaScript** — plain objects are easier to construct, serialize,
  validate, and pass across process boundaries than React component trees.
- **CLI and stdin/stdout pipelines** — `echo '{"content":[...]}' | pretext-pdf` works
  trivially with JSON; it would require a build step with JSX.

## Alternatives considered

- **`pretext-pdf-react` declarative wrapper** — explored in April 2026. The JSON schema is
  already LLM-friendly and `esm.sh` covers browser consumers. The wrapper was deprioritized
  because it adds a React dependency without materially improving the LLM use case (LLMs
  can already emit valid JSON schemas directly). Tracked in ROADMAP "Under consideration".
- **pdfmake-style document descriptor** — evaluated and ruled out. pdfmake's schema has
  accumulated decades of quirks and uses implicit inheritance (style cascading) that makes
  it hard to validate strictly. A compat shim is provided (`pretext-pdf/compat`) for
  migration, but the core API is intentionally simpler.

## Consequences

- The schema is serializable — documents can be stored, transmitted, diff'd, and validated
  without executing any code.
- TypeScript type safety is full — `PdfDocument` and all element types are exported and
  versioned.
- Adding a React wrapper later is still possible and backward-compatible — it would just
  produce a `PdfDocument` object and call `render()`.
