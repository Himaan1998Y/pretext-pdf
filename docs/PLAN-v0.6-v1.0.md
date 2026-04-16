# pretext-pdf — v0.6 to v1.0 Execution Plan

> Two-week sprint covering dependency upgrade, positioning, technical gaps, and v1.0 readiness.
> Each phase has verifiable gate criteria. Nothing moves forward until the gate passes.

---

## WEEK 1 — Foundations & Positioning

### Phase 1A: Upgrade @chenglou/pretext 0.0.3 → 0.0.5
**Goal:** Eliminate dependency lag. Pick up 2 versions of improvements (better text analysis, measurement precision, extracted bidi-data module).

**Risk assessment:** LOW — pretext-pdf uses only `prepareWithSegments()` and `layoutWithLines()`. Both are unchanged between 0.0.3 and 0.0.5. New `rich-inline` module added but not required.

#### Steps:

1. **1A-1: Bump dependency version**
   - File: `package.json`
   - Change: `"@chenglou/pretext": "0.0.3"` → `"@chenglou/pretext": "0.0.5"`
   - Run: `npm install` to regenerate `package-lock.json`

2. **1A-2: Run contract tests**
   - Run: `npm run test:contract`
   - Verify: `prepareWithSegments` exported as function
   - Verify: `layoutWithLines` exported as function
   - Verify: Both have arity ≤ 4
   - If any fail → abort upgrade, investigate API changes

3. **1A-3: Run full test suite**
   - Run: `npm test` (all 223 tests)
   - Compare: output byte sizes of key examples (e2e, invoice, RTL) against 0.0.3 baseline
   - If any test fails → bisect: is it a behavioral change or a genuine fix?

4. **1A-4: Verify edge cases**
   - Run: `npm run example:rtl` — RTL text (bidi module changed internally)
   - Run: `npm run example:toc` — TOC with two-pass rendering
   - Run: `npm run example:hyperlinks` — rich-paragraph with inline spans
   - Open each output PDF and visually verify no regressions

5. **1A-5: Update documentation**
   - Update `test/pretext-api-contract.test.ts` comment: `Current pinned version: 0.0.5`
   - Update `CHANGELOG.md` with version bump entry under new version heading
   - Update `docs/ROADMAP.md` Phase 0 checklist if applicable

6. **1A-6: Commit and verify CI**
   - Commit: `feat: upgrade @chenglou/pretext to 0.0.5`
   - Push, verify CI passes on Node 18/20/22

**Gate:** All 223+ tests pass. Contract tests pass. 3 example PDFs visually verified. CI green.

---

### Phase 1B: StackBlitz Live Demo
**Goal:** Zero-friction "try pretext-pdf in 2 minutes" experience. No npm install needed.

#### Steps:

1. **1B-1: Create demo project structure**
   - New directory: `demo/stackblitz/`
   - Files needed:
     ```
     demo/stackblitz/
     ├── package.json          # pretext-pdf + vite + minimal deps
     ├── tsconfig.json         # ES2022, NodeNext
     ├── index.html            # Tabs UI shell
     ├── src/
     │   ├── main.ts           # Tab router, render button, PDF preview
     │   ├── tabs/
     │   │   ├── invoice.ts    # GST invoice preset (copy from examples/)
     │   │   ├── report.ts     # Multi-section report preset
     │   │   ├── resume.ts     # One-page resume preset
     │   │   └── custom.ts     # Editable JSON textarea → render
     │   └── preview.ts        # PDF.js viewer or <iframe> with blob URL
     └── vite.config.ts        # Node polyfills for browser (buffer, etc.)
     ```

2. **1B-2: Build the tab UI**
   - 4 tabs: Invoice | Report | Resume | Custom
   - Each tab shows: JSON editor (left) + PDF preview (right)
   - "Generate PDF" button triggers `render()` → blob URL → iframe
   - Show render time and PDF size below preview
   - Minimal styling — use system fonts, no CSS framework

3. **1B-3: Handle browser limitations**
   - pretext-pdf is Node-only. Two approaches:
     - **Option A (recommended):** Run render server-side via StackBlitz WebContainer (Node.js in browser)
     - **Option B (fallback):** API proxy to Cloud endpoint (requires Phase 6)
   - Test: Does StackBlitz WebContainer support `@napi-rs/canvas`? If not, SVG examples need fallback
   - Test: Does `@cantoo/pdf-lib` work in WebContainer? (Should — it's pure JS)

4. **1B-4: Pre-populate examples**
   - Invoice: Copy from `examples/gst-invoice-india.ts`, adapt to INR with 2 items
   - Report: 3 sections, 1 table, 1 callout, TOC enabled
   - Resume: Single-page, heading + paragraphs + skills table + contact info
   - Custom: Empty `{ content: [{ type: 'paragraph', text: 'Hello World' }] }` with full schema comment

5. **1B-5: Test and deploy**
   - Open in StackBlitz: `https://stackblitz.com/github/Himaan1998Y/pretext-pdf/tree/main/demo/stackblitz`
   - Verify: each tab renders a PDF in < 5 seconds
   - Verify: custom tab accepts arbitrary PdfDocument JSON
   - Add StackBlitz badge + link to README.md

**Gate:** All 4 tabs render PDFs. Custom tab accepts freeform JSON. Link in README works.

---

### Phase 1C: "pretext-pdf vs pdfmake" Comparison Article
**Goal:** SEO capture for developers evaluating PDF libraries. Rank for "pdfmake alternative 2026".

#### Structure:

1. **1C-1: Draft article outline**
   ```
   # pretext-pdf vs pdfmake in 2026: An Honest Comparison
   
   ## TL;DR (feature matrix table)
   ## Setup & Boilerplate (code comparison)
   ## Typography Quality (screenshot comparison — Knuth-Plass vs greedy)
   ## Tables (side-by-side code + output)
   ## What pdfmake Has That pretext-pdf Doesn't
     - Browser support (pretext-pdf is Node-only for now)
     - QR codes (pretext-pdf: generate externally + embed)
     - Canvas drawing API (pretext-pdf: use SVG instead)
     - Global styles dictionary (pretext-pdf: TypeScript helpers)
     - Deeper nesting (pretext-pdf: 1-level lists, flat table cells)
   ## What pretext-pdf Has That pdfmake Doesn't
     - Knuth-Plass line breaking (professional typesetting)
     - RTL/BiDi text (proper Arabic/Hebrew support)
     - Encryption (password + permissions)
     - Bookmarks & TOC (auto-generated)
     - Interactive forms (text/checkbox/radio/dropdown)
     - Digital signatures (PKCS#7)
     - Document assembly (merge/assemble)
     - Annotations & sticky notes
     - Callout boxes
     - Footnotes
     - Image floats
     - Hyphenation (Liang's algorithm, multi-language)
     - SVG native support
     - Full TypeScript with strict mode
   ## Performance Benchmark
     - Render time: 100-element, 1000-element, 5000-element docs
     - PDF file size comparison (same content)
     - Memory usage (peak RSS)
   ## When to Use Which
   ## Migration Quick-Start
   ```

2. **1C-2: Generate comparison screenshots**
   - Create identical documents in both libraries:
     - A4 page with heading, 2 paragraphs (one justified), a 5-row table, a list
   - Screenshot the PDF output side-by-side
   - Highlight: line-breaking quality (rivers vs. even spacing)
   - Save to `docs/screenshots/comparison-*.png`

3. **1C-3: Run performance benchmarks**
   - Script: `benchmarks/vs-pdfmake.ts`
   - Measure: render time (avg of 10 runs), peak memory, output PDF size
   - Documents: 100-element, 1000-element, 5000-element (same structure)
   - Output: markdown table for article

4. **1C-4: Write and review article**
   - File: `docs/articles/pretext-pdf-vs-pdfmake-2026.md`
   - Tone: honest, balanced — acknowledge pdfmake's browser support advantage
   - Target: 2000–3000 words
   - Cross-link to migration guide and live demo

5. **1C-5: Prepare for publishing**
   - Format for DEV.to (frontmatter: title, tags, canonical_url)
   - Prepare "Show HN" post title and text (separate from article)
   - Do NOT publish yet — wait until demo is live

**Gate:** Article draft complete with screenshots and benchmarks. Reviewed for accuracy.

---

### Phase 1D: Migration Guide from pdfmake
**Goal:** Step-by-step guide for developers switching from pdfmake to pretext-pdf.

#### Steps:

1. **1D-1: Create the migration guide**
   - File: `docs/MIGRATION_FROM_PDFMAKE.md` (replace existing draft if any)
   - Sections:
     ```
     # Migrating from pdfmake to pretext-pdf
     
     ## Quick Reference Table
     (pdfmake concept → pretext-pdf equivalent, 30+ rows)
     
     ## Step 1: Replace Boilerplate
     (pdfMake.createPdf → render())
     
     ## Step 2: Add `type` to Every Element
     ({ text: '...' } → { type: 'paragraph', text: '...' })
     
     ## Step 3: Convert Property Names
     (alignment → align, margin → spaceBefore/spaceAfter, bold → fontWeight: 700)
     
     ## Step 4: Convert Tables
     (widths[] + body[][] → columns[] + rows[].cells[])
     
     ## Step 5: Convert Rich Text
     ({ text: [...], bold: true } → { type: 'rich-paragraph', spans: [...] })
     
     ## Step 6: Convert Headers/Footers
     (callback function → token syntax {{pageNumber}})
     
     ## Step 7: Convert Fonts
     (VFS registration → fonts[] array with file paths)
     
     ## Step 8: Replace pdfmake-Only Features
     (QR → external lib, Canvas → SVG, styles dict → TS helpers)
     
     ## Step 9: Adopt pretext-pdf-Only Features
     (encryption, bookmarks, TOC, hyphenation, forms, signatures)
     
     ## Common Gotchas
     - No `'*'` width — use `'1*'`
     - No color names — hex only (`'#ff0000'` not `'red'`)
     - `fontFamily` required on code blocks
     - Lists nest 1 level max
     - No `pageOrientation` — use custom `pageSize: [842, 595]`
     
     ## Full Before/After Example
     (complete invoice in pdfmake → same invoice in pretext-pdf)
     ```

2. **1D-2: Write before/after code examples**
   - Invoice example in pdfmake (50 lines)
   - Same invoice in pretext-pdf (40 lines)
   - Side-by-side diff highlighting
   - Include output PDF comparison

3. **1D-3: Link from README**
   - Add to README under new "Coming from pdfmake?" section
   - Link: `See the [Migration Guide](docs/MIGRATION_FROM_PDFMAKE.md)`

**Gate:** Guide covers all 30+ pdfmake features. Before/after examples render identically. Linked from README.

---

## WEEK 2 — Technical Gaps & v1.0 Readiness

### Phase 2A: Fix Multi-Column Text Alignment
**Goal:** Text alignment (left/center/right/justify) works correctly in multi-column layouts.

**Root cause:** `render-blocks.ts` lines 83–96 (renderTextBlock) and lines 872–928 (renderRichParagraph) skip `resolveX()` when rendering columnar lines. They use raw `colX` position without applying alignment calculation.

#### Steps:

1. **2A-1: Write failing tests first**
   - File: `test/phase-2-performance.test.ts` (extend existing)
   - Test: 2-column paragraph with `align: 'center'` — assert PDF renders without error
   - Test: 3-column paragraph with `align: 'right'` — assert PDF renders without error
   - Test: 2-column rich-paragraph with `align: 'justify'` — assert renders

2. **2A-2: Fix renderTextBlock multi-column alignment**
   - File: `src/render-blocks.ts`
   - Location: lines 83–96 (multi-column branch)
   - Fix: Apply `resolveX()` using `columnWidth` (not full content width) as the available space
   - Pattern: `const x = resolveX(element.align, colX, columnWidth, lineWidth)`

3. **2A-3: Fix renderRichParagraph multi-column alignment**
   - File: `src/render-blocks.ts`
   - Location: lines 872–928 (multi-column branch)
   - Same fix pattern as 2A-2

4. **2A-4: Run tests and visual verify**
   - Run: `npm run test:unit`
   - Create: quick example with 2-col centered + 3-col right-aligned
   - Open PDF and verify alignment visually

**Gate:** New alignment tests pass. Visual verification shows centered/right text in columns.

---

### Phase 2B: Font Subsetting Cleanup
**Goal:** Confirm subsetting works end-to-end. Remove dead dependency. Fix form-field gap.

#### Steps:

1. **2B-1: Verify current subsetting behavior**
   - Run: `npm run test:phases` — confirm phase-9c tests pass
   - Create: minimal invoice with Inter 400 only
   - Measure: output PDF size (should be <65KB with subsetting)
   - Compare: same doc with `{ subset: false }` to confirm size difference

2. **2B-2: Remove dead `subset-font` dependency**
   - File: `package.json`
   - Remove: `"subset-font": "^2.5.0"` from `dependencies`
   - Reason: subsetting uses pdf-lib's native `embedFont({ subset: true })`, not this package
   - Run: `npm install` to regenerate lock file
   - Run: `npm test` to confirm nothing breaks

3. **2B-3: Fix form-field label text collection**
   - File: `src/fonts.ts`, function `collectTextByFont()` (around line 303)
   - Gap: form-field `label`, `placeholder`, `defaultValue` text not collected
   - Fix: Add case for `el.type === 'form-field'`:
     ```typescript
     case 'form-field':
       if (el.label) addText(defaultKey, el.label)
       if (el.placeholder) addText(defaultKey, el.placeholder)
       if (typeof el.defaultValue === 'string') addText(defaultKey, el.defaultValue)
       break
     ```
   - Write test: form-field with non-ASCII label renders correctly with subsetting

4. **2B-4: Document subsetting behavior**
   - Add note to README under "Fonts" section:
     > Font subsetting is automatic for TTF fonts. Only glyphs used in the document are embedded, reducing PDF size by 40–60%. WOFF2 fonts are embedded without subsetting due to upstream limitations.

**Gate:** Phase 9C tests pass. Dead dep removed. Form-field labels collected. Invoice PDF <65KB.

---

### Phase 2C: RTL Table Cell Alignment Fix
**Goal:** Arabic/Hebrew text in table cells auto-aligns right (matching paragraph behavior).

**Root cause:** `render-blocks.ts` line 403 calls `resolveX(cell.align, ...)` but unlike paragraph rendering (line 52), it doesn't fall back to `'right'` when the cell's `isRTL` flag is set.

#### Steps:

1. **2C-1: Write failing test**
   - File: `test/phase-7f-rtl.test.ts` (extend)
   - Test: Table with Arabic text cells, no explicit `align` — assert renders
   - Test: Mixed table — Arabic header row + English data rows — assert renders

2. **2C-2: Fix alignment fallback**
   - File: `src/render-blocks.ts`
   - Location: line ~403 (table cell text rendering)
   - Current: `resolveX(cell.align, textAreaX, textAreaWidth, lineWidth)`
   - Fix: `resolveX(cell.align ?? (cellIsRTL ? 'right' : 'left'), textAreaX, textAreaWidth, lineWidth)`
   - Need to thread `isRTL` flag from measurement through to render

3. **2C-3: Verify related RTL tests still pass**
   - Run: `npm run test:phases` — all phase-7f RTL tests
   - Run: `npm run example:rtl` — visual check

**Gate:** New RTL table test passes. Existing RTL tests unchanged. Arabic text right-aligns in table cells.

---

### Phase 2D: Syntax Highlighting for Code Blocks
**Goal:** Code blocks support language-aware colored tokens (via `shiki` or `highlight.js`).

**Design decision:** Use `rich-paragraph` internally to render colored tokens. The code block element gets a new optional `language` field. When set, text is tokenized and rendered as colored spans. When unset, behavior is unchanged (plain monospace).

#### Steps:

1. **2D-1: Choose highlighter library**
   - Option A: `shiki` — WASM-based, accurate, 400+ languages, VS Code grammar. ~2MB on disk.
   - Option B: `highlight.js` — JS-only, lighter (~800KB), 190 languages.
   - **Recommendation:** `highlight.js` — lighter, no WASM dependency, sufficient for PDF code blocks.
   - Add: `highlight.js` as optional peer dependency (not required)

2. **2D-2: Extend CodeBlockElement type**
   - File: `src/types.ts`
   - Add to `CodeBlockElement`:
     ```typescript
     /** Programming language for syntax highlighting. Requires highlight.js peer dep. */
     language?: string
     /** Custom theme colors. Defaults to GitHub-light-inspired palette. */
     highlightTheme?: {
       keyword?: string    // default: '#cf222e'
       string?: string     // default: '#0a3069'
       comment?: string    // default: '#6e7781'
       number?: string     // default: '#0550ae'
       function?: string   // default: '#8250df'
       punctuation?: string // default: '#24292f'
     }
     ```

3. **2D-3: Implement tokenization in measure-blocks.ts**
   - When `language` is set, dynamically import `highlight.js`
   - Tokenize text into `{text, className}[]` spans
   - Map className → color using theme
   - Convert to `RichFragment[]` for measurement (reuse rich-paragraph pipeline)
   - When `language` is NOT set or highlight.js not installed, fall back to plain text

4. **2D-4: Implement rendering in render-blocks.ts**
   - Modify `renderCodeBlock()`:
     - If tokenized → use `renderRichParagraph` internally (colored spans on bg)
     - If plain → existing behavior (unchanged)
   - Preserve: background box, padding, line numbering (if added)

5. **2D-5: Write tests**
   - Test: code block with `language: 'javascript'` and highlight.js installed → renders
   - Test: code block with `language: 'javascript'` without highlight.js → graceful fallback to plain
   - Test: code block without `language` → unchanged behavior
   - Test: custom `highlightTheme` overrides default colors

6. **2D-6: Add example**
   - File: `examples/syntax-highlight.ts`
   - Show: JavaScript, Python, TypeScript code blocks side by side
   - Output: `examples/output/syntax-highlight.pdf`

**Gate:** Syntax highlighted code renders with colors. Missing highlight.js falls back gracefully. 4 tests pass.

---

### Phase 2E: Templates Collection
**Goal:** Ship 5+ production-ready templates that users can copy and customize.

#### Templates to create:

1. **2E-1: GST Invoice (India)** — Already exists at `examples/gst-invoice-india.ts`. Clean up and move to `templates/`

2. **2E-2: International Invoice (USD/EUR/GBP)**
   - No GST/HSN fields
   - Simple: company → client → items → total
   - Professional styling matching GST template

3. **2E-3: One-Page Resume/CV**
   - Name/contact header (centered)
   - Sections: Summary, Experience (company + dates + bullets), Education, Skills (2-col table)
   - Clean typography — demonstrate heading levels + lists + horizontal rules

4. **2E-4: Multi-Section Report**
   - Cover page (title, subtitle, author, date)
   - Auto-generated TOC
   - 3 chapters with paragraphs, tables, callout boxes
   - Headers/footers with chapter name + page number

5. **2E-5: NDA / Legal Agreement**
   - Numbered clauses (ordered list)
   - Signature placeholders at bottom
   - Watermark: "DRAFT"
   - Encryption: prevent copying

6. **2E-6: Meeting Minutes**
   - Date, attendees, agenda items
   - Action items table (who, what, deadline)
   - Callout for key decisions

#### Structure:
```
templates/
├── README.md              # Gallery with thumbnail links
├── invoice-gst.ts         # GST Invoice (India)
├── invoice-intl.ts        # International Invoice
├── resume.ts              # One-Page Resume
├── report.ts              # Multi-Section Report
├── nda.ts                 # Legal Agreement
└── meeting-minutes.ts     # Meeting Minutes
```

Each template:
- Self-contained (single file, no external deps beyond pretext-pdf)
- Outputs to `templates/output/<name>.pdf`
- Has a `// Usage:` comment at top with `npx tsx templates/<name>.ts`

**Gate:** All 6 templates render valid PDFs. README gallery links to output files.

---

### Phase 2F: Stress Tests & Performance Benchmarks
**Goal:** Verify pretext-pdf handles large documents. Establish baseline performance numbers.

#### Steps:

1. **2F-1: Large document stress tests**
   - File: `test/stress.test.ts`
   - Test: 10,000 paragraphs → renders without error, completes in < 30s
   - Test: 1,000-row table → renders without error
   - Test: 100 images (placeholder PNGs) → renders with graceful failures
   - Test: 500 headings → TOC generation works, bookmarks generated
   - Test: Document with all element types simultaneously

2. **2F-2: Performance benchmark script**
   - File: `benchmarks/render-perf.ts`
   - Measure for 1-page, 10-page, 50-page, 100-page documents:
     - Render time (avg of 5 runs, excluding first cold run)
     - Peak memory (via `process.memoryUsage()`)
     - Output PDF file size
   - Output: markdown table to stdout + `benchmarks/results.md`

3. **2F-3: Add benchmark numbers to README**
   - New section: "## Performance"
   - Table: pages | time | memory | size
   - Note: "Benchmarked on Node 22, M-series Mac / 8-core VPS"

**Gate:** All stress tests pass. Benchmark results documented. No crashes or hangs on large docs.

---

### Phase 2G: Path to v1.0
**Goal:** Define what v1.0 means. Set the bar. Ship when ready.

#### v1.0 Criteria Checklist:

- [ ] All `as any` casts eliminated or documented as intentional (pdf-lib interop)
- [ ] No `TODO` / `FIXME` / `HACK` comments in src/
- [ ] All 37 error codes tested (at least one test per error code)
- [ ] README documents every public API method and option
- [ ] CHANGELOG covers every version from 0.1.0 to 1.0.0
- [ ] Performance benchmarks published
- [ ] Templates collection (5+ templates)
- [ ] Migration guide from pdfmake complete
- [ ] StackBlitz demo live
- [ ] Comparison article published
- [ ] `@chenglou/pretext` on latest stable version
- [ ] Font subsetting verified and documented
- [ ] Multi-column rendering works with alignment
- [ ] RTL table alignment fixed
- [ ] Syntax highlighting available (optional)
- [ ] CI: test + publish + deploy all green
- [ ] npm: package description, keywords, repository, homepage all set
- [ ] License: MIT confirmed in package.json + LICENSE file
- [ ] No known crash paths on valid input

#### Version bump:
- Week 1 completion → tag **v0.6.0** (pretext upgrade + docs)
- Week 2 completion → tag **v0.7.0** (technical fixes + templates)
- v1.0 criteria all met → tag **v1.0.0** (stability declaration)

#### What v1.0 means:
- API is **locked**. No breaking changes without major version bump.
- All documented features are **tested and working**.
- Error messages are **clear and actionable**.
- Performance is **benchmarked and published**.
- Migration path from pdfmake is **documented**.

---

## Dependency Map

```
Phase 1A (pretext upgrade)
  └─→ Phase 1B (demo needs latest version)
  └─→ Phase 1C (benchmarks need latest version)
  └─→ Phase 1D (migration guide references current API)

Phase 1B (demo) ──→ Phase 1C (article links to demo)
Phase 1C (article) ──→ Show HN post (after article + demo live)
Phase 1D (migration) ──→ Phase 1C (article links to guide)

Phase 2A (multi-column fix) — independent
Phase 2B (font subsetting) — independent
Phase 2C (RTL table fix) — independent
Phase 2D (syntax highlight) — independent
Phase 2E (templates) — depends on 2A–2D being stable
Phase 2F (stress tests) — independent
Phase 2G (v1.0 gate) — depends on all above
```

## Execution Order (Optimized)

### Week 1
| Day | Phase | Deliverable |
|-----|-------|-------------|
| Mon | 1A | @chenglou/pretext upgraded to 0.0.5, CI green |
| Mon–Tue | 1D | Migration guide complete |
| Tue–Wed | 1B | StackBlitz demo live |
| Wed–Fri | 1C | Comparison article drafted with screenshots + benchmarks |

### Week 2
| Day | Phase | Deliverable |
|-----|-------|-------------|
| Mon | 2A | Multi-column alignment fixed |
| Mon | 2B | Font subsetting cleaned up, dead dep removed |
| Tue | 2C | RTL table alignment fixed |
| Tue–Wed | 2D | Syntax highlighting implemented |
| Wed–Thu | 2E | 6 templates created |
| Thu | 2F | Stress tests + benchmarks |
| Fri | 2G | v1.0 checklist reviewed, v0.7.0 tagged |

---

## Success Metrics (End of Week 2)

- [ ] `@chenglou/pretext@0.0.5` — upgraded and tested
- [ ] StackBlitz demo — live, 4 tabs working
- [ ] Comparison article — drafted, 2000+ words, screenshots
- [ ] Migration guide — 30+ feature mappings, before/after examples
- [ ] Multi-column alignment — fixed, tested
- [ ] Font subsetting — verified, dead dep removed
- [ ] RTL table alignment — fixed, tested
- [ ] Syntax highlighting — implemented, optional dep
- [ ] 6 templates — all render valid PDFs
- [ ] Stress tests — 10K elements, 1K-row table, 100 images
- [ ] Performance benchmarks — published in README
- [ ] v0.7.0 tagged — all above included
- [ ] v1.0 checklist — reviewed, gaps identified, ETA set
