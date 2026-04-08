# pretext-pdf — Master Remediation & Growth Plan

*Multi-phase, priority-ordered, with explicit check/balance gates between phases.*
*Created: 2026-04-08 | Status: Phase 0 in progress*

---

## How this plan is structured

Three gap categories, three types of urgency:

| Category | Urgency | Why |
|---|---|---|
| **Dependency Risk** | 🔴 Critical / Do First | pdf-lib is abandoned — this is existential. If a CVE drops or @cantoo/pdf-lib diverges further, migration becomes a major rewrite. Fix it while the codebase is small. |
| **Positioning** | 🟡 High / Do in Parallel | Zero-revenue right now despite a working product. Every week without an MCP listing or HN post is organic growth lost. Most positioning tasks take 1–3 days each. |
| **Technical** | 🟢 Medium / Sequence Carefully | Real gaps but none are blocking production use. Sequence by: user-facing impact × implementation risk × dependency on other phases. |

**Rules of this plan:**
1. Each phase has a **gate** — a checklist that must pass before the next phase starts
2. Phases 0 and 1 run in parallel (different domains, no conflict)
3. No phase 3+ work starts until Phase 0's gate passes (dependency risk cleared first)
4. Every feature follows: spec → tests first → implement → gate

---

## PHASE 0 — Dependency Firewall
**Timeline:** Week 1–2 | **Risk:** Existential | **Effort:** 3–4 days | **Status:** 🔄 In Progress

### The problem in one sentence
`pdf-lib` (your PDF encoder — the engine under everything) has been effectively abandoned since November 2021. `@cantoo/pdf-lib` is the actively maintained fork (v2.6.5, 107 published versions, MIT). You already use `@cantoo/pdf-lib` for encryption. The rest of your codebase still imports from `pdf-lib`. This inconsistency must be resolved before any more features are built on top of it.

### 0-A: Audit exact pdf-lib API surface used
Before migrating, map every pdf-lib API call in the codebase:
```bash
grep -rn "from 'pdf-lib'" src/
grep -rn "PDFDocument\|PDFPage\|PDFFont\|PDFName\|PDFString\|PDFNull\|PDFRef\|rgb\|degrees\|StandardFonts" src/
```
Produce a list: `[file:line] → [pdf-lib symbol used]`. This is the migration surface map.

**Files known to use pdf-lib:** `src/index.ts`, `src/render.ts`, `src/fonts.ts`

### 0-B: Verify @cantoo/pdf-lib API compatibility
`@cantoo/pdf-lib` is a drop-in fork of `pdf-lib`. Verify:
- All symbols from the audit above exist in `@cantoo/pdf-lib`
- Run `npm install @cantoo/pdf-lib` as a regular dep (not just devDep/peer) in a test branch
- Replace one file (`src/fonts.ts`) first, run tests — confirm green

### 0-C: Full migration
For each `src/` file that imports from `pdf-lib`:
```typescript
// Before
import { PDFDocument, PDFName, rgb } from 'pdf-lib'
// After
import { PDFDocument, PDFName, rgb } from '@cantoo/pdf-lib'
```

Then:
- Remove `pdf-lib` from `dependencies` in `package.json`
- Move `@cantoo/pdf-lib` from `peerDependencies` to `dependencies` (it is now required, not optional)
- Update `peerDependencies` to remove `@cantoo/pdf-lib` (no longer optional)
- Remove the lazy-load pattern for encryption (it's now a direct dep, always available)
- `ENCRYPTION_NOT_AVAILABLE` error code becomes obsolete — remove or repurpose
- Update README to remove the `npm install @cantoo/pdf-lib` instruction in troubleshooting

### 0-D: @chenglou/pretext contingency
`@chenglou/pretext` is v0.0.4, solo author. You can't eliminate this risk but you can prepare:

1. **Pin the version** in `package.json` — change `"^0.0.3"` to exact pin. Prevent surprise breaking changes.
2. **Document the fork plan** — add a comment in `src/measure.ts` above the pretext import
3. **Snapshot the API surface** — write `test/pretext-api-contract.test.ts` that asserts the 3–4 functions you use exist and behave correctly. This becomes a canary.

### Phase 0 Gate ✅
- [ ] `npm ls pdf-lib` returns empty (no more direct dependency)
- [ ] `@cantoo/pdf-lib` in `dependencies` (not peer, not dev)
- [ ] `npm test` — all 303 tests pass
- [ ] `npm run build` — zero TypeScript errors
- [ ] `ENCRYPTION_NOT_AVAILABLE` either removed or repurposed cleanly
- [ ] pretext version pinned
- [ ] `test/pretext-api-contract.test.ts` exists and passes
- [ ] `npm pack --dry-run` succeeds

---

## PHASE 1 — Positioning Blitz
**Timeline:** Week 1–4 (parallel with Phase 0) | **Risk:** Low | **Effort:** 8–10 days total | **Status:** ⏳ Pending

*These are distribution and marketing tasks. They need code, but not pretext-pdf source code. Run them in parallel with Phase 0.*

### 1-A: MCP Server (Days 1–2)
Create a new npm package: `pretext-pdf-mcp`

**Architecture:**
```
pretext-pdf-mcp/
  src/
    index.ts              — MCP server entry, registers tools
    tools/
      generate_pdf.ts     — raw render() wrapper
      generate_invoice.ts — structured invoice template
      generate_report.ts  — section/table report template
  package.json            — "pretext-pdf": "^0.3.1" as dep
  README.md
```

**MCP Tools to expose:**

| Tool | Input | What it does |
|---|---|---|
| `generate_pdf` | Full PdfDocument JSON | Direct render() call, returns base64 PDF |
| `generate_invoice` | `{client, items[], total, date, invoiceNo}` | Pre-built invoice layout, returns PDF |
| `generate_report` | `{title, sections[], author, date}` | Pre-built report layout |
| `list_element_types` | none | Returns the full element type reference for AI context |

**Distribution:** List on Smithery immediately after publishing.

**Check:** Install MCP server in Claude Desktop, generate a test invoice, open the PDF and confirm it renders correctly.

### 1-B: Live Demo (Day 3)
Create a StackBlitz demo showing 4 tabs: Invoice, Report, Resume, Custom.

**Check:** Share the link with 2 people. Can they generate a PDF in under 2 minutes without reading docs?

### 1-C: pdfmake Comparison Article (Days 4–6)
**Title:** "pretext-pdf vs pdfmake: which one for your Node.js project in 2026?"

**Structure:**
1. Head-to-head feature table
2. Typography comparison: side-by-side screenshots (Knuth-Plass vs greedy)
3. Code comparison: same invoice in both libraries
4. Performance comparison
5. When to choose each
6. Migration guide (see 1-D)

**Publish:** DEV.to first, then HN "Show HN."

### 1-D: Migration Guide (Day 7)
`docs/MIGRATION_FROM_PDFMAKE.md` — concrete cheat-sheet with pdfmake → pretext-pdf equivalents.

### 1-E: HN "Show HN" Post (Day 8)
**Title:** `Show HN: JSON → PDF with Knuth-Plass typography, no headless Chrome (Node.js)`

Timing: after comparison article AND demo are live.

### 1-F: GST Invoice Template (Days 9–10)
`examples/gst-invoice-india.ts` — complete GST-compliant invoice with GSTIN, HSN codes, CGST/SGST/IGST breakdown, Indian number formatting.

### Phase 1 Gate ✅
- [ ] `pretext-pdf-mcp` published on npm and listed on Smithery
- [ ] StackBlitz demo URL exists and generates a PDF in <3 clicks
- [ ] Comparison article published with working code examples
- [ ] `docs/MIGRATION_FROM_PDFMAKE.md` committed and linked from README
- [ ] HN Show HN post published
- [ ] `examples/gst-invoice-india.ts` committed and documented
- [ ] Fresh `npm install pretext-pdf` + README Quick Start generates a PDF in <5 minutes

---

## PHASE 2 — Technical Quick Wins
**Timeline:** Week 3–5 | **Prerequisite:** Phase 0 gate | **Effort:** 6–8 days | **Status:** ⏳ Pending

### 2-A: Complete Multi-Column Text Layout
Multi-column is already measured in `measure.ts` but not rendered in `render.ts`. Wire `columnData` into the render stage for paragraphs and rich-paragraphs.

- Split `lines[]` into N chunks of `linesPerColumn`
- Render each chunk at `x + (colIndex * (columnWidth + columnGap))`
- Update paginator — multi-column blocks don't split mid-column
- 6 new tests + example

### 2-B: Remove 10,000-Element Hard Cap
Replace hard error with a `console.warn`. Add "Working with large documents" docs section.

### 2-C: Font Subsetting Pre-computation (Phase 9C)
Wire `collectTextByFont()` (exists but unused in `src/fonts.ts`) into the pipeline. Measure size impact on the Antigravity proposal — target: <60KB (currently 101KB).

### 2-D: RTL Table Cell Alignment Fix
Arabic/Hebrew text in table cells should right-align within the cell boundary. Write failing test first, then fix `renderTableRow()` in `render.ts`.

### Phase 2 Gate ✅
- [ ] Multi-column renders correctly — visual inspection of 3-column layout
- [ ] 15,000-element document renders without throwing
- [ ] Single-page Latin invoice ≤65KB (font subsetting working)
- [ ] RTL table test passes
- [ ] `npm test` — all 330+ tests pass
- [ ] `npm run build` — zero TypeScript errors

---

## PHASE 3 — Cryptographic Signatures (Phase 9A)
**Timeline:** Week 6–8 | **Prerequisite:** Phase 0 gate | **Effort:** 5–7 days | **Status:** ⏳ Pending

### The goal
Real PKCS#7/CMS digital signatures embedded in PDF. What DocuSign, Acrobat, and legal systems recognize. Currently only a visual rectangle.

### New API
Add to `SignatureSpec`:
```typescript
certificate?: Uint8Array       // P12/PFX bytes
certificatePassword?: string   // P12 passphrase
signatureType?: 'visual' | 'cryptographic' | 'both'  // default: 'visual'
```

### New dependencies
`@signpdf/signpdf` as optional peer dep (lazy-loaded, same pattern as old cantoo).

### New error codes
- `SIGNATURE_NOT_AVAILABLE` — dep not installed
- `SIGNATURE_FAILED` — signing failed (invalid cert/password)
- `SIGNATURE_CERTIFICATE_INVALID` — malformed cert bytes

### Tests
8 tests including self-signed P12 fixture generated with openssl.

### Phase 3 Gate ✅
- [ ] `signatureType: 'visual'` — existing tests still pass
- [ ] Self-signed P12 produces digitally signed PDF
- [ ] Acrobat/Preview shows signature present
- [ ] All 8 new tests pass
- [ ] `SIGNATURE_NOT_AVAILABLE` thrown cleanly
- [ ] Full test suite green

---

## PHASE 4 — Footnotes & Endnotes
**Timeline:** Week 8–10 | **Prerequisite:** Phase 2 gate | **Effort:** 6–8 days | **Status:** ⏳ Pending

### New element types
```typescript
{ type: 'footnote-ref', id: string }  // inline superscript number
{ type: 'footnote-def', id: string, text: string }  // bottom-of-page text
```

### Key constraint
Paginator must reserve space at page bottom for footnote defs before placing other content. Two-pass problem within the paginator.

### Validation rules
- Every `footnote-ref` must have a matching `footnote-def` in the document → else `VALIDATION_ERROR`
- Vice versa

### Phase 4 Gate ✅
- [ ] Footnote ref renders as correct superscript number
- [ ] Footnote def renders at bottom of correct page with separator line
- [ ] Orphaned ref or def → `VALIDATION_ERROR`
- [ ] All 8 tests pass
- [ ] Multi-page doc with 5 footnotes — all correctly placed (visual check)
- [ ] Full test suite green

---

## PHASE 5 — Image Floats (Phase 9B)
**Timeline:** Week 12–16 | **Prerequisite:** Phase 4 gate | **Effort:** 10–14 days | **Status:** ⏳ Pending

### ⚠️ Scope constraint (document explicitly)
Implements **constrained float only**: image + immediately adjacent paragraph rendered as a two-column composite block. Does NOT implement full CSS-float semantics (text flowing across multiple paragraphs). That requires a full paginator rewrite.

### New API
```typescript
// Add to ImageElement:
float?: 'left' | 'right'
floatWidth?: number   // default: 35% of content width
floatGap?: number     // default: 12pt
floatText?: string    // the paragraph that wraps alongside
```

### Phase 5 Gate ✅
- [ ] `float: 'left'` and `float: 'right'` both render correctly (visual)
- [ ] Float block does not split across pages
- [ ] `floatWidth` override works
- [ ] No regression in non-float image tests
- [ ] Documentation explicitly states single-paragraph limitation
- [ ] 6 new tests pass

---

## PHASE 6 — Cloud API & Monetization
**Timeline:** Week 10–14 (parallel with 4–5) | **Effort:** 5–7 days | **Status:** ⏳ Pending

### Architecture
New repo `pretext-pdf-api` on OVH VPS via Coolify. Express/Hono server wrapping `render()`.

### Endpoints
- `POST /render` — raw PdfDocument JSON → PDF bytes
- `POST /invoice` — structured invoice data → PDF bytes

### Pricing (MVP)
| Tier | Price | Limit |
|---|---|---|
| Free | $0 | 50 PDFs/month |
| Starter | $19/month | 1,000 PDFs/month |
| Pro | $49/month | 10,000 PDFs/month |
| PAYG | $0.005/PDF | Unlimited |

### Phase 6 Gate ✅
- [ ] API deployed on OVH VPS
- [ ] `POST /render` returns PDF within 3 seconds for 5-page doc
- [ ] API key auth + rate limiting working
- [ ] Landing page with pricing table and code example
- [ ] At least 1 real user generates a PDF

---

## CROSS-CUTTING CHECKS & BALANCES

### Continuous quality gates (every phase)
```bash
npm run build   # Zero TypeScript errors — no exceptions
npm test        # All tests pass — no skipped tests allowed
```

### Before any npm publish
```bash
npm pack --dry-run   # Verify dist/ included, src/ excluded
npm audit            # Zero high/critical vulnerabilities
```

### Before any feature is "done"
- Human has opened the generated PDF in a PDF reader — visual confirmation
- Example file runs without errors and produces a real output file
- Feature documented in README with a code example

### Regression protocol
Tests are **never deleted** — only added. If a test starts failing due to a new feature, that is a bug, not a test to remove.

### Projected test counts

| After Phase | Test Count |
|---|---|
| Phase 0 | 303 (same — no new features) |
| Phase 2 | ~330 |
| Phase 3 | ~338 |
| Phase 4 | ~346 |
| Phase 5 | ~352 |

### Versioning discipline

| Phase | Version Bump | Reason |
|---|---|---|
| Phase 0 | `0.3.1` → `0.4.0` | Breaking: removes pdf-lib peer dep, encryption now built-in |
| Phase 2 | `0.4.x` patches | Additive features |
| Phase 3 | `0.4.x` → `0.5.0` | New optional peer dep |
| Phase 4 | `0.5.x` patches | New element types (additive) |
| Phase 5 | `0.5.x` → `0.6.0` | New element API |

---

## MASTER TIMELINE

```
Week 1   ████ Phase 0: pdf-lib migration (audit + migrate + tests)
Week 2   ████ Phase 0: finalize + gate + Phase 1 starts in parallel
         ████ Phase 1-A: MCP server
Week 3   ████ Phase 1-B/C: Demo + comparison article
         ████ Phase 2: multi-column (already measured, just render)
Week 4   ████ Phase 1-D/E/F: migration guide + HN + GST template
         ████ Phase 2: font subsetting + RTL table fix
Week 5   ████ Phase 2: polish + gate
Week 6   ████ Phase 3: cryptographic signatures
Week 7   ████ Phase 3: tests + docs + gate
Week 8   ████ Phase 4: footnotes (design + impl)
Week 9   ████ Phase 4: tests + gate
Week 10  ████ Phase 6: Cloud API (parallel from here)
Week 12  ████ Phase 5: image floats (hardest work)
Week 14  ████ Phase 5: tests + gate
Week 14+ ████ Phase 6: launch pricing + first users
```

---

## ONE-PAGE PRIORITY MATRIX

| Task | Impact | Effort | Do When |
|---|---|---|---|
| Migrate pdf-lib → @cantoo/pdf-lib | 🔴 Existential | S (3d) | **Now** |
| MCP server | 🟡 High (distribution) | S (2d) | **Now (parallel)** |
| StackBlitz demo | 🟡 High (conversion) | S (1d) | Week 2 |
| pdfmake comparison article | 🟡 High (acquisition) | M (3d) | Week 3 |
| Multi-column render | 🟢 Medium (feature) | S (2d) | Week 3 |
| Font subsetting | 🟢 Medium (size) | S (2d) | Week 4 |
| GST invoice template | 🟡 High (India market) | S (1d) | Week 4 |
| Crypto signatures (Phase 9A) | 🟢 High (legal market) | M (5d) | Week 6 |
| Cloud API | 🟡 High (revenue) | M (5d) | Week 10 |
| Footnotes | 🟢 Medium (feature) | M (6d) | Week 8 |
| Image floats (Phase 9B) | 🟢 Low-Medium | L (12d) | Week 12 |
