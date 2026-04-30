# ADR 001 — Use @cantoo/pdf-lib instead of pdf-lib

**Status:** Accepted  
**Date:** 2026-04-08 (migrated to direct dep 2026-04-20)

## Context

pretext-pdf needs a library to assemble the final PDF — embed fonts, draw pages, write
metadata, and apply encryption. The canonical library is `pdf-lib` (Hopding). However,
`pdf-lib` received its last meaningful commit in November 2021 and is effectively unmaintained.

`@cantoo/pdf-lib` is the actively maintained fork. At migration time it was at v2.6.5 with
107+ releases under its belt, MIT licensed, and API-compatible with `pdf-lib`.

## Decision

Use `@cantoo/pdf-lib` as the sole PDF assembly library and list it as a direct `dependency`
(always installed). Drop the original `pdf-lib` entirely.

## Alternatives considered

- **Keep `pdf-lib`** — unmaintained, bugs won't be fixed, no new PDF features.
- **Switch to `jspdf`** — canvas-based, poor CJK/RTL, limited encryption support.
- **Roll our own PDF assembly** — months of work, not the core value of this library.

## Consequences

- Encryption works out of the box (previously required a separate `npm install @cantoo/pdf-lib`).
- `ENCRYPTION_NOT_AVAILABLE` error code removed.
- The fork is MIT and API-compatible — consumer code that imports from `pretext-pdf` is unaffected.
- Risk: if `@cantoo/pdf-lib` maintenance stops, the same problem recurs. Renovate watchdog
  tracks upstream bumps so we notice quickly.
