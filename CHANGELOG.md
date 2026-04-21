# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to pretext-pdf are documented here.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

---

## [0.9.1] — 2026-04-21

Bug-fix + hardening release. Ships the callout + rich-text rendering fixes from PR #2 together with PR #3's producer-validator contract around measured blocks.

### Fixed

- **Rich-paragraph: leading-space tokens stripped after hard break** ([src/rich-text.ts](src/rich-text.ts)). A pre-overflow guard (`isLeadingSpace: currentX === 0 && token.text.trim() === ''`) fired whenever `currentX` was zero — both at block start *and* after a `\n` hard break reset the cursor. Continuation spans beginning with whitespace (e.g. `'  ·  text'`) had their first token silently dropped, causing separator glyphs and indented text to appear mis-positioned. Guard removed; the overflow-wrap skip path that correctly skips trailing spaces after soft wraps is unaffected.
- **Callout: `spaceAfter` double-applied by paginator** ([src/measure-blocks.ts](src/measure-blocks.ts)). `callout` block measurement included `el.spaceAfter ?? 12` inside `totalHeight` *and* returned the same value as `block.spaceAfter`. `paginate.ts` added `block.spaceAfter` on top of `block.height`, counting it twice and pushing callout content ~12 pt below its intended position. Fixed by removing `spaceAfter` from the `totalHeight` formula; the value is still returned in `block.spaceAfter` for the paginator.
- **Callout with title: background rect clips title row when split across pages** ([src/paginate.ts](src/paginate.ts)). `splitBlock` did not subtract `calloutData.titleHeight` from `availableForLines` for the first chunk, allowing `floor((titleH + lh) / lh)` extra lines to be placed, leaving no room for the title row. `getCurrentY` also omitted `titleHeight` from `blockBottom`, producing incorrect Y tracking after a split callout. Both fixed: `titleH` is now subtracted from available space on the first chunk only, and added to `blockBottom` when computing the cursor position after the first chunk renders.

### Added / hardened

- **Producer-validator contract for measured blocks** ([src/paginate.ts](src/paginate.ts)). `validateMeasuredBlocks()` runs at `paginate()` entry in O(n) and throws `PretextPdfError('PAGINATION_FAILED')` if a callout `MeasuredBlock` is missing `calloutData` or any of `titleHeight` / `paddingV` / `paddingH` is non-finite — same for blockquote padding/border fields. Surfaces producer bugs directly instead of as downstream NaN arithmetic or `PAGE_LIMIT_EXCEEDED`.
- **Narrowed internal types** `MeasuredCalloutBlock` / `MeasuredBlockquoteBlock` (intersection types in [src/types.ts](src/types.ts)) consumed by `calloutTitleHeight` + `verticalPadding` helpers in `paginate.ts`. No defensive runtime checks downstream.
- **Extracted `CalloutData` interface** from the previously-inline shape on `MeasuredBlock.calloutData`. Measurer constructs it as a typed literal, so TypeScript enforces the full contract at the producer site.
- **Zero-width non-whitespace tokens preserved**: the rich-text post-soft-wrap guard only skips tokens where `text.trim() === ''`. ZWJ (U+200D), combining marks, and other zero-width non-whitespace characters pass through so emoji / CJK shaping stays intact — pinned by a regression test.
- **Extracted `LINK_COLOR_DEFAULT`** constant in `src/rich-text.ts`.

### Tests

- `test/rich-text.test.ts` 20 → 23 (+3): block-start leading whitespace preserved; leading whitespace after hard break preserved; ZWJ preservation.
- `test/phase-8d-callout.test.ts` 12 → 19 (+7): callout `spaceAfter` double-count regression, titled split line count, untitled split, continuation chunk `yFromTop === 0`, mid-page split entry, validator rejection on missing `calloutData`, validator rejection on partial `calloutData` (non-finite fields), validator rejection on partial blockquote padding, non-callout-document early-return.
- Full suite: 624 tests, 100% pass.

### Chore / docs

- Removed `brain/learnings/*.md`, `docs/PLAN-v0.6-v1.0.md`, `test/paginate.test.ts.archive` — internal dev artifacts not for the public repo.
- Stripped `Phase N:` nomenclature from `src/` comments (pure rename — no logic delta).
- Added `demo/stackblitz/.stackblitzrc`, `docs/articles/pretext-pdf-vs-pdfmake-2026.md` (draft).
- Added `examples/visual-pr2-bug1-separator.ts` + `examples/visual-pr2-bug3-callout-split.ts` plus 4 reference PNGs under `docs/visuals/pr2/` for bug-reproduction demonstrations.
- README test badge corrected `650+ → 600+` (verified: 624 tests total).

---

## [0.9.0] — 2026-04-20

Three additive enhancements that broaden the package's surface without growing its mandatory dependency footprint.

### Added

- **CLI binary** — `pretext-pdf` is now a `bin` entry. `pretext-pdf doc.json out.pdf`, `cat doc.json | pretext-pdf > out.pdf`, `echo '{...}' | pretext-pdf -o out.pdf`. Supports stdin/stdout and file arguments. `--markdown` flag converts Markdown input to PDF in one step (requires the `marked` peer dep). See [src/cli.ts](src/cli.ts).
- **`pretext-pdf/compat` entry point** — `fromPdfmake(pdfmakeDoc)` translates pdfmake document descriptors into `PdfDocument` so existing pdfmake codebases can switch with a one-line change at the entry point. Covers strings, `text` nodes (with `style`/`bold`/`italics`/`color`/`fontSize`/`alignment`/`font`), `ul`/`ol`, `table` (with `widths` + `headerRows`), `image`, `qr`, `pageBreak` (`before`/`after`), `stack`, `pageSize`/`pageOrientation`/`pageMargins`, `defaultStyle`/`styles`, `info` → metadata, and string-form `header`/`footer`. Default style-name → heading mapping is configurable via `headingMap` option.
- **Markdown: GFM tables** ([src/markdown.ts](src/markdown.ts)) — `markdownToContent()` now recognises GFM tables and translates them to `TableElement`, including column alignment from `:---:` / `---:` markers. Ragged rows are padded with empty cells.
- **Markdown: GFM task lists** — `- [x] done` and `- [ ] todo` render with ☑ / ☐ Unicode markers prepended to the item text.

### Tests

- New `test/v0.9.0-features.test.ts` (21 tests): markdown table + task list, full CLI exec coverage (stdin, file, `--markdown`, error paths), and pdfmake compat (strings, headings, rich-paragraphs, lists, tables, images, QR, `pageBreak`, `stack`, `pageSize`/`pageMargins`, end-to-end render of a translated document).

### Notes

- Zero new mandatory dependencies. The CLI uses only Node built-ins. The compat shim is pure TypeScript. Markdown additions ride on the existing optional `marked` peer.
- `dist/cli.js` is wired through `package.json#bin.pretext-pdf` — `npm install -g pretext-pdf` makes the CLI globally available; `npx pretext-pdf` works without install.

---

## [0.8.3] — 2026-04-20

### Security

- **SSRF — IPv4-mapped IPv6 bypass** ([src/assets.ts](src/assets.ts) `assertSafeUrl`). Pre-0.8.3 the private-IP guard checked the parsed hostname against dotted-decimal regexes only. WHATWG `URL` normalizes `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]` (hex IPv4-in-IPv6), so attacker-supplied URLs of the form `https://[::ffff:127.0.0.1]/admin` slipped past every `^127\.`/`^10\.`/etc. check and reached localhost or RFC 1918 ranges. Patched by detecting both the dotted (`::ffff:127.0.0.1`) and hex-compressed (`::ffff:7f00:1`) IPv4-mapped forms and decoding the embedded IPv4 before regex matching. Also explicitly blocks the IPv6 unspecified address `::`.
- **SSRF — redirect-following bypass** ([src/assets.ts](src/assets.ts) `fetchWithTimeout`). The previous implementation used the default `redirect: 'follow'`, so a public URL could `302` to `http://127.0.0.1:8080/internal` and the library would happily fetch the private target despite the upfront `assertSafeUrl` check on the *initial* URL. Patched to use `redirect: 'manual'` and re-validate every `Location` hop with `assertSafeUrl`, capped at 3 redirects. Browser opaqueredirect responses are rejected with a clear error.

### Fixed

- **`createGstInvoice` amount-in-words double space for sub-rupee totals** ([src/templates.ts](src/templates.ts)). An invoice whose total was less than ₹1 (e.g. ₹0.50) produced `"Rupees  and Fifty Paise Only"` (two spaces after "Rupees") because the rupee-words branch resolved to an empty string. Now uses an explicit `"Zero"` when there are no rupees: `"Rupees Zero and Fifty Paise Only"`.
- **Markdown deeper-than-2-level lists silently dropped** ([src/markdown.ts](src/markdown.ts) `convertListItem`). Pre-0.8.3 the converter only created text-only leaves for nested lists, so `- A\n  - B\n    - C` lost C entirely. Now recursive — preserves arbitrary nesting depth in the resulting `ListItem` tree.
- **Markdown list items with paragraph-typed content** ([src/markdown.ts](src/markdown.ts)). When list items were separated by blank lines, marked emits `paragraph` tokens (not `text` tokens) for the item content. The converter only handled `text`, silently dropping the item text. Now also handles `paragraph` tokens.

### Tests

- New `test/v0.8.3-ssrf.test.ts` covers 11 IPv4-mapped IPv6 bypass cases, IPv6 unspecified/loopback regressions, and HTTP rejection.
- Extended `test/phase-10c-markdown.test.ts` with regressions for 3-level nesting and paragraph-typed list items.
- Extended `test/phase-10d-templates.test.ts` with the sub-rupee amount-in-words case.

---

## [0.8.2] — 2026-04-20

### Fixed

- **Rich-paragraph whitespace collapse** — multi-span `rich-paragraph` content rendered with adjacent words overlapping (e.g. `"Founder & CEO" + "  —  Antigravity Systems"` displayed as `"Founder& CEO—AntigravitySystems"`). Root cause: pretext's `layoutWithLines` follows CSS-like behavior and excludes trailing whitespace from line widths, so tokens like `"Hello "` or `"  "` measured to width 0 and downstream fragments overlapped the previous one. `measureTokenWidth` in [src/rich-text.ts](src/rich-text.ts) now uses a sentinel-character technique (append non-whitespace `\u2588`, measure combined string, subtract sentinel width) to recover the true rendered width whenever a token has trailing whitespace. Sentinel width is cached per font config.
- The fast path (no trailing whitespace) is unchanged — single pretext call. Slow path adds two pretext calls per affected token, with one cached.

### Tests

- Added 3 regression tests in `test/rich-text.test.ts` under `whitespace preservation (v0.8.2 fix)` covering trailing whitespace inside spans, whitespace-only separator spans, and the exact `"Founder & CEO" → "Antigravity Systems"` resume-preset scenario.

---

## [0.8.1] — 2026-04-20

### Fixed

- **Browser support** — `pretext-pdf` now imports cleanly in browsers. Module-init in `src/fonts.ts` previously called `fileURLToPath(import.meta.url)` and `createRequire(import.meta.url)` eagerly, which threw `"The URL must be of scheme file"` whenever the module was loaded from a non-`file://` URL (esm.sh, jsdelivr, Vite dev server). Both calls are now gated on a runtime `IS_NODE` check, and the bundled-Inter `BUNDLED_INTER_PATHS` arrays are constructed only in Node.
- **Browser font-loading errors** — `loadFontBytes` now throws clear `FONT_LOAD_FAILED` messages when bundled Inter or string font paths are requested in a browser, pointing the consumer at the correct workaround (supply `Uint8Array` bytes via `doc.fonts`).

### Notes for browser users

- Always supply Inter (or your default font) explicitly via `doc.fonts: [{ family: 'Inter', weight: 400, src: <Uint8Array> }, { family: 'Inter', weight: 700, src: <Uint8Array> }]`. The library cannot read local font files in the browser.
- SVG / chart / qr-code / barcode elements still depend on `@napi-rs/canvas` at runtime; in the browser, the native `OffscreenCanvas` is used instead and the polyfill is skipped automatically.

---

## [0.8.0] — 2026-04-19

### Added

- **`qr-code` element** — generate QR codes as inline PDF content using the `qrcode` optional peer dependency. Supports `data`, `size`, `errorCorrectionLevel` (L/M/Q/H), `foreground`/`background` hex colours, `margin`, `align`, `spaceBefore`/`spaceAfter`. Fully serverless — pure JS, no canvas required.
- **`barcode` element** — generate 100+ barcode symbologies (EAN-13, Code128, PDF417, QR, DataMatrix, etc.) via the `bwip-js` optional peer dependency. Supports `symbology`, `data`, `width`, `height`, `includeText`, `align`, `spaceBefore`/`spaceAfter`. Pure JS, Lambda/Edge safe.
- **`chart` element** — embed Vega-Lite charts as vector SVG using `vega` + `vega-lite` optional peer deps. Accepts any Vega-Lite `spec`, `width`, `height`, `caption`, `align`. Rendered with `renderer: 'none'` — zero canvas/puppeteer dependency.
- **`pretext-pdf/markdown` entry point** — `markdownToContent(md, options?)` converts a Markdown string to `ContentElement[]`. Requires optional `marked` peer dep. Supports headings, bold/italic/links (→ rich-paragraph), lists (2 levels), blockquotes, code blocks, and HR.
- **`pretext-pdf/templates` entry point** — three typed template functions with zero extra dependencies: `createInvoice(data)` (generic invoice with currency, tax, discount, QR payment), `createGstInvoice(data)` (GST-compliant Indian tax invoice with IGST/CGST+SGST, UPI QR, bank details, amount in words), `createReport(data)` (structured business report with optional TOC).
- **New error codes** — `QR_DEP_MISSING`, `QR_GENERATE_FAILED`, `BARCODE_DEP_MISSING`, `BARCODE_GENERATE_FAILED`, `BARCODE_SYMBOLOGY_INVALID`, `CHART_DEP_MISSING`, `CHART_SPEC_INVALID`, `CHART_RENDER_FAILED`, `MARKDOWN_DEP_MISSING`.

---

## [0.7.1] — 2026-04-19

### Changed

- **Upstream pretext pinned to `f2014338487a`** — picks up unreleased CJK opening-bracket annotation fix, Hangul jamo line-walker alignment fix, and two internal line-object churn reductions. No public API changes.

### Fixed

- **List nesting depth enforced at validation** — `ListItem.items` (2nd-level items) now correctly rejects any further `.items` property, matching the documented 2-level maximum. Previously the validation silently passed 3-level data which could cause undefined render behaviour.
- **3 phase-11 list tests corrected** — test data incorrectly contained 3-level nesting while named "2-level"; data trimmed to match documented contract.

---

## [Unreleased]

### Added (Phase 11 — Cross-cutting Enhancements)

- **`floatSpans` on image elements** — rich-text alternative to plain `floatText`. Accepts `InlineSpan[]` for mixed bold/italic/color/link captions beside float images. Mutually exclusive with `floatText` (validated).
- **2-level list nesting** — `ListItem.items` now supports one further level of nesting (depth 0 → 1 → 2). Unordered marker: `▪`. Ordered: inherits parent counter or restarts via `nestedNumberingStyle: 'restart'`.
- **Table `rowspan`** — `TableCell.rowspan` spans a cell across multiple rows. Works alongside `colspan`. Origin cell draws background over full span height; continuation rows automatically receive placeholder cells.
- **`onFormFieldError` callback** — `doc.onFormFieldError: (name, err) => 'skip' | 'throw'` mirrors `onImageLoadError`. Controls render behaviour when a form field fails.
- **`createFootnoteSet(defs)`** — helper exported from `pretext-pdf` that generates footnote definition/reference pairs with globally unique IDs. Returns `Array<{ id, def }>`.
- **`renderDate` field** — `doc.renderDate: Date | string` overrides the PDF creation date. Useful for reproducible builds and testing.
- **`{{date}}` and `{{author}}` tokens** in header/footer text — join existing `{{pageNumber}}` / `{{totalPages}}`. `{{date}}` resolves from `renderDate`; `{{author}}` resolves from `doc.metadata.author`.
- **`tabularNumbers`** on `rich-paragraph` — digits rendered at uniform slot width (widest digit in font), so columns of numbers align without OpenType TNUM feature.
- **`smallCaps` + `letterSpacing` per span** — `InlineSpan.smallCaps` and `InlineSpan.letterSpacing` now respected in `rich-paragraph` rendering.
- **Per-span `fontSize`** — `InlineSpan.fontSize` overrides the element-level font size for that span. Enables mixed-size text in a single paragraph.

### Fixed (Phase 11)

- `resolveTokens()` used `.replace()` (replaces first occurrence only) — changed to `.replaceAll()` for all four tokens.
- Table span grid: continuation-row cursor was advancing by 1 instead of `colspan` when skipping a spanned column — now advances by full span width.
- Font family names now validated for safe characters (`/^[a-zA-Z0-9 _-]+$/`) in `requireFamily()` — rejects null bytes and control characters.
- Annotation `color` and `author` fields now validated in `validateElement()` for both `paragraph` and `heading` annotations.
- `buildOutlineTree` memoizes `parentIdxOf()` into a pre-computed array — eliminates O(n²) scan for documents with large heading counts.
- Table grid-line renderer pre-computes active boundary set — eliminates O(rows × cols) inner loop for large tables.
- `addLinkAnnotation()` re-validates URL scheme at render time (defense-in-depth; `validate.ts` is the primary gate).

### Planned (Phase 9+)

- Phase 9A: Digital signatures (cryptographic PKCS#7 via `@signpdf/signpdf`)
- Phase 9B: Image floats (text flowing alongside images — requires paginator rewrite)
- Phase 9C: Font subsetting pre-computation (explicit glyph hints for icon fonts)

---

## [0.7.0] — 2026-04-17

### Added

- **6 production templates** (`templates/`) — GST invoice, international invoice, resume, multi-section report, NDA, and meeting minutes. Each is a self-contained `.ts` file outputting a valid PDF. Smoke-tested in Phase 2F Block D.
- **StackBlitz live demo** (`demo/stackblitz/`) — 4-tab UI (Invoice, Report, Resume, Custom) backed by a Node.js render server. Edit JSON and generate PDFs instantly, no install required. Accessible at the StackBlitz link in the README.
- **`## Performance` section in README** — measured render times and PDF sizes for 1-page, 10-page, and mixed-element documents. Font subsetting behaviour documented.
- **Stress tests and benchmarks** (`test/phase-2f-stress.test.ts`) — 32 tests across 4 blocks: large document stress (400-element, 200-row table), edge case stress (CJK, RTL, empty arrays, extreme sizes), timing benchmarks (1-page < 500 ms, 10-page < 5,000 ms), and template smoke tests.
- **Error code coverage** — new tests for `COLUMN_WIDTH_TOO_NARROW`, `IMAGE_LOAD_FAILED`, `SVG_LOAD_FAILED`, and `ASSEMBLY_FAILED`. 16 of 19 error codes now have direct test coverage.

### Changed

- **`as any` audit** — eliminated 10 casts in `validate.ts` by introducing a typed `FormFieldElement` local binding. The remaining 8 instances (pdf-lib interop, dynamic import, internal back-references) are now documented with one-line comments explaining the constraint.
- **Comparison article** (`docs/articles/pretext-pdf-vs-pdfmake-2026.md`) — 2,200-word draft covering feature matrix, typography quality, API design, performance, and migration quick-start. Marked `published: false` pending live demo.
- **Migration guide** (`docs/MIGRATION_FROM_PDFMAKE.md`) — 30+ pdfmake → pretext-pdf mappings, complete before/after invoice example, and a quick-start checklist. Linked from README.

### Fixed

- **Phase 2F test types** — `fontWeight: 700 as 700` cast in pre-constructed rows array; removed non-existent `creationDate` from `DocumentMetadata`; replaced `allowCopying: false` with correct `encryption: { permissions: { copying: false } }`.
- **StackBlitz integration** — added `.stackblitzrc` so WebContainer auto-runs `npm start` and opens the browser preview on port 3000.

---

## [0.5.3] — 2026-04-16

### Changed

- **Upgraded `@chenglou/pretext` from 0.0.3 to 0.0.5** — picks up improved text analysis accuracy (~35% larger analysis module), better measurement precision, extracted bidi-data module for cleaner tree-shaking, and new `rich-inline` export (not yet used by pretext-pdf). No breaking changes — `prepareWithSegments()` and `layoutWithLines()` APIs are unchanged. All 223 tests pass, 3 example PDFs visually verified (RTL, TOC, hyperlinks).

---

## [0.5.2] — 2026-04-13

### Added

- **`onImageLoadError` callback on `PdfDocument`** — gives callers control over image load failures. Return `'skip'` to silently omit the image (preserves existing default behavior). Return `'throw'` to abort rendering with the original error. Previously, all image failures were silently downgraded to `console.warn` with no way to detect them programmatically.

  ```typescript
  await render({
    content: [...],
    onImageLoadError: (src, error) => {
      myLogger.warn('Image skipped', { src, error })
      return 'skip'   // or 'throw' to abort
    }
  })
  ```

---

## [0.4.0] — 2026-04-08

### Breaking Changes

- **Migrated from `pdf-lib` to `@cantoo/pdf-lib`** — `@cantoo/pdf-lib` is now a direct `dependency` (always installed). Previously it was an optional peer dependency required only for encryption. This removes the `ENCRYPTION_NOT_AVAILABLE` error code and the separate `npm install @cantoo/pdf-lib` installation step. Encryption now works out of the box.
- **`ENCRYPTION_NOT_AVAILABLE` error code removed** — encryption is now always available. Update any `switch` statements that handled this code.

### Why this change

`pdf-lib` (the original) has not received a meaningful commit since November 2021. `@cantoo/pdf-lib` is the actively maintained fork (v2.6.5, 107+ releases, MIT license). pretext-pdf was already using `@cantoo/pdf-lib` for encryption — this commit makes it the single source of truth for all PDF operations.

### Added

- `test/pretext-api-contract.test.ts` — canary test that asserts `@chenglou/pretext` exports the exact functions pretext-pdf depends on. Breaks loudly if pretext changes its API.
- `docs/ROADMAP.md` — public multi-phase development plan

### Changed

- `@chenglou/pretext` version pinned to exact `0.0.3` (no caret) — prevents surprise breaking changes from upstream auto-updates
- `test:contract` script added — runs the pretext API contract test before the full test suite
- All internal comments updated from `pdf-lib` to `@cantoo/pdf-lib`

---

## [0.3.1] — 2026-04-08

### Fixed

- **Critical: Font resolution when installed as npm package** — `@fontsource/inter` is now resolved via `createRequire(import.meta.url)` instead of a hardcoded relative path. Previously, `path.join(__dirname, '..', 'node_modules', '@fontsource', 'inter', ...)` failed when npm hoisted the dependency to the consumer's top-level `node_modules`, causing `FONT_LOAD_FAILED` on every install. Now resolves correctly regardless of npm hoisting behavior.

---

## [0.3.0] — 2026-04-08

### Added (Phase 8B — Interactive Forms)

- New `form-field` element type — creates interactive AcroForm fields in PDFs
- `fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'button'`
- `label` renders above the field as static text
- Text fields: `defaultValue`, `multiline`, `placeholder`, `maxLength`
- Checkboxes: `checked` initial state
- Radio groups and dropdowns: `options` array, `defaultSelected`
- `doc.flattenForms: true` — bakes all fields into static content
- Custom `borderColor`, `backgroundColor`, `width`, `height`, `fontSize` per field
- New error codes: `FORM_FIELD_NAME_DUPLICATE` (duplicate `name` across fields), `FORM_FLATTEN_FAILED`
- Post-render `form.updateFieldAppearances()` ensures proper display in all PDF readers
- 10 comprehensive tests covering all form field types

### Added (Phase 8E — Signature Placeholder)

- `doc.signature` — visual signature box drawn on a specified page
- Fields: `signerName`, `reason`, `location`, `x`, `y`, `width`, `height`, `page`, `borderColor`, `fontSize`
- Draws signature line, date line, and optional text inside a bordered rectangle
- `page` is 0-indexed, defaults to last page, clamps gracefully if out of range
- 6 comprehensive tests

### Added (Phase 8D — Callout Boxes)

- New `callout` element type — styled highlight box with optional title
- Preset styles: `style: 'info'` (blue), `'warning'` (amber), `'tip'` (green), `'note'` (gray)
- Optional `title` rendered bold above content with left border accent
- Fully customizable: `backgroundColor`, `borderColor`, `color`, `titleColor`, `padding`
- Paginates correctly across pages (reuses blockquote pagination logic)
- 8 comprehensive tests

### Added (Phase 8F — Document Metadata Extensions)

- `doc.metadata.language` — sets PDF `/Lang` catalog entry (BCP47 tag e.g. `'en-US'`, `'hi'`)
- `doc.metadata.producer` — sets PDF producer field (e.g. `'MyApp v2.1'`)
- Both fields validate as non-empty strings
- 5 comprehensive tests

---

## [0.2.0] — 2026-04-08

### Added (Phase 8H — Inline Formatting)

- `verticalAlign: 'superscript' | 'subscript'` on `InlineSpan` in rich-paragraphs
- Superscript renders at 65% font size, baseline shifted up by 40% of font size
- Subscript renders at 65% font size, baseline shifted down by 20% of font size
- `letterSpacing?: number` on `ParagraphElement`, `HeadingElement`, `RichParagraphElement` — extra pt between characters
- `smallCaps?: boolean` on those same three element types — simulated via uppercase + 80% fontSize
- Character-by-character rendering for letterSpacing (pdf-lib has no native spacing param)
- 8 comprehensive tests covering all inline formatting functionality

### Added (Phase 8A — Annotations/Comments)

- New `comment` element type — sticky note annotation at position in document
- `annotation?: AnnotationSpec` on `ParagraphElement` and `HeadingElement` — attach note to element
- Supports: `contents`, `author`, `color` (hex), `open` (popup default state)
- Uses PDF `Subtype: 'Text'` annotation (sticky note icon in PDF viewers)
- 8 comprehensive tests covering all annotation functionality

### Added (Phase 8C — Document Assembly)

- New `merge(pdfs: Uint8Array[])` exported function — combine pre-rendered PDFs
- New `assemble(parts: AssemblyPart[])` exported function — mix rendered docs + existing PDFs
- `AssemblyPart` interface: `{ doc?: PdfDocument, pdf?: Uint8Array }`
- New error codes: `ASSEMBLY_EMPTY`, `ASSEMBLY_FAILED`
- 8 comprehensive tests covering all assembly functionality

### Fixed

- **CI case-sensitivity bug**: `test/phase-7-integration.test.ts` used `'en-US'` (uppercase) for hyphenation language. On Linux CI (case-sensitive filesystem) this failed with `UNSUPPORTED_LANGUAGE`. Changed to `'en-us'` to match package name `hyphenation.en-us`.

---

## [0.1.1] — 2026-04-08

### Added

- **Phase 8G: Hyperlinks** — Complete link annotation support:
  - `paragraph.url` for external URI links on paragraphs
  - `heading.url` for external URI links on headings
  - `heading.anchor` for named PDF destinations (internal cross-references)
  - `InlineSpan.href` for external and internal `#anchorId` links in rich-paragraphs
  - `mailto:` scheme support for email links
  - GoTo annotations for internal anchor references
  - 9 comprehensive tests covering all hyperlink functionality

### Fixed

- **Memory leak in test suite**: Removed module-level `_hypherCache` in `src/measure.ts` that accumulated ~188KB per language across 255+ test runs. Changed from cached Hypher instances to fresh instances per call (negligible performance impact, massive memory savings).
- **Node.js version compatibility**: Replaced `--experimental-strip-types` with `tsx` runner to support Node.js 18.x, 20.x, and 22.x in CI
- **Broken CI examples**: Removed references to non-existent Phase 8 example scripts from GitHub Actions workflow
- **README examples mismatch**: Updated Examples section to only list 5 existing Phase 7 examples (watermark, bookmarks, toc, rtl, encryption)
- **Test suite OOM issues**: Split large test files (paginate.test.ts) into paginate-basic.test.ts to work around Node.js `--experimental-strip-types` heap exhaustion bug on files >17KB

### Changed

- `test:unit` now runs only `test/paginate-basic.test.ts` (fast, no canvas overhead)
- Reorganized test scripts: `test:unit`, `test:validate`, `test:e2e`, `test:phases` for better memory management
- Moved internal planning documentation to archive (preserved, not published)
- `devDependencies`: Added `@napi-rs/canvas` explicitly (was missing, causing CI failures)

### Added

- `CONTRIBUTING.md`: Development setup, TDD workflow, PR process guide
- `CHENG_LOU_EMAIL_DRAFT.md`: Template for requesting endorsement from pretext creator
- `examples/comparison-pdfmake.ts`: pdfmake version of invoice for typography comparison

---

## [0.1.0] — 2026-04-07

### Added (Phase 7G — Encryption)

- `doc.encryption` configuration for password-protecting PDFs
- User password and owner password support
- Granular permission restrictions: printing, copying, modifying, annotating
- Lazy-loads `@cantoo/pdf-lib` (optional peer dependency) — zero cost when not used
- Error code: `ENCRYPTION_NOT_AVAILABLE` when encryption is requested but dependency not installed

### Added (Phase 7F — RTL Text Support)

- Right-to-left text support for Arabic, Hebrew, and other RTL languages
- Unicode bidirectional text algorithm via `bidi-js`
- `dir` attribute on text elements: `'ltr'` | `'rtl'` | `'auto'` for per-element control
- RTL text works with headings, paragraphs, lists, tables, and all text elements
- Automatic detection of mixed LTR/RTL content

### Added (Phase 7E — SVG Support)

- `{ type: 'svg', svg: '<...' }` element for embedding SVG graphics
- SVG rasterization via `@napi-rs/canvas`
- ViewBox auto-sizing: automatic height calculation from viewBox aspect ratio
- Explicit sizing: `width` and `height` parameters for precise control
- Alignment options: `align: 'left' | 'center' | 'right'`
- Multi-page support: SVGs paginate correctly across page breaks
- Error code: `SVG_RENDER_FAILED` for SVG rasterization errors

### Added (Phase 7D — Table of Contents)

- `{ type: 'toc' }` element for automatic TOC generation
- Two-pass rendering pipeline ensures accurate page numbers
- Configurable: `title`, `showTitle`, `minLevel`/`maxLevel`, dot leaders, level indentation
- Auto-indexed from heading structure (H1, H2, H3, etc.)
- Supports custom formatting via `fontSize`, `color`, `spaceAfter` parameters

### Added (Phase 7C — Hyphenation)

- Automatic word hyphenation for better justified text layout
- `doc.hyphenation: { language: 'en-US' }` for document-level config
- Liang's algorithm via `hypher` package for accurate break points
- Configurable: `minWordLength`, `leftMin`, `rightMin`, per-element `hyphenate: false` opt-out
- Language support: includes `hyphenation.en-us` (additional languages via npm packages)
- Error code: `UNSUPPORTED_LANGUAGE` when language not available

### Added (Phase 7B — Watermarks)

- `doc.watermark` for text or image watermarks on every page
- Text watermarks: `text`, `fontSize`, `fontWeight`, `color`, `opacity`, `rotation`
- Image watermarks: `image` (Uint8Array), `opacity`, `rotation`, `color` (tint)
- Watermarks render behind content (lower z-index)
- Rotation bounds: -360 ≤ rotation ≤ 360 degrees
- Validation: must provide either text or image, never both required

### Added (Phase 7A — Bookmarks / PDF Outline)

- PDF sidebar bookmarks auto-generated from heading structure
- Enabled by default: `bookmarks: true` or `bookmarks: { minLevel: 1, maxLevel: 3 }`
- Level filtering: include/exclude heading levels from outline
- Per-heading opt-out: `bookmark: false` on heading elements
- Keyboard navigation: Cmd/Ctrl+Opt/Alt+O in PDF readers to toggle bookmark sidebar

### Added (Phase 6 — Advanced Features)

- Header and footer support with {{pageNumber}} and {{totalPages}} tokens
- Text decoration: strikethrough, underline
- Text alignment: left, center, right, justify
- Line height control: custom line-height multipliers
- Column layout with multi-column content flow
- Tables with colspan/rowspan support

### Added (Phase 5 — Rich Text / Builder API)

- Fluent builder API for programmatic document construction
- Rich text element with nested formatting (bold, italic, links)
- Inline code and code blocks with syntax highlighting
- Block quotes with custom styling
- Horizontal rules (hr element)
- Numbered and bulleted lists with nesting

### Added (Phases 1–4 — Core Engine)

- Core PDF generation via `pdf-lib`
- Element types: paragraph, heading, table, image, list, code, blockquote
- Font support: Inter bundled, custom TTF embedding
- Document metadata: title, author, subject, keywords, created date
- Page sizing: A4, A3, A5, Letter, Legal, or custom dimensions
- Margins: top, bottom, left, right per page
- Multi-page pagination with orphan/widow control
- Image formats: PNG, JPG, WebP
- Table features: custom column widths, cell padding, borders, header styling
- Colors: hex color codes throughout (text, backgrounds, borders)

---

## Features by Phase

| Phase | Feature | Status | Tests | Version |
|-------|---------|--------|-------|---------|
| 7A | Bookmarks / PDF Outline | ✅ Complete | 8 | 0.1.0 |
| 7B | Watermarks | ✅ Complete | 8 | 0.1.0 |
| 7C | Hyphenation | ✅ Complete | 10 | 0.1.0 |
| 7D | Table of Contents | ✅ Complete | 10 | 0.1.0 |
| 7E | SVG Support | ✅ Complete | 8 | 0.1.0 |
| 7F | RTL Text Support | ✅ Complete | 12 | 0.1.0 |
| 7G | Encryption | ✅ Complete | 7 | 0.1.0 |
| Integration | Feature Combinations | ✅ Complete | 6 | 0.1.0 |
| 6 | Advanced Features | ✅ Complete | — | 0.1.0 |
| 5 | Rich Text / Builder API | ✅ Complete | — | 0.1.0 |
| 1–4 | Core Engine | ✅ Complete | — | 0.1.0 |

---

## How to Use Examples

All Phase 7 features have working examples in the `examples/` directory. Run them with:

```bash
npm run example:watermark    # Phase 7B — Watermarks
npm run example:bookmarks    # Phase 7A — Bookmarks
npm run example:toc          # Phase 7D — Table of Contents
npm run example:rtl          # Phase 7F — RTL Text Support
npm run example:encryption   # Phase 7G — Encryption
```

PDF output is written to `output/phase7-*.pdf`.

---

## Test Coverage

All phases include comprehensive test coverage:

```bash
npm test                  # Run all 75+ tests
npm run test:unit        # Unit tests only
npm run test:e2e         # End-to-end tests
npm run test:visual      # Visual regression tests
```

---

## Dependencies

### Required

- `@chenglou/pretext` — Pretext text layout engine
- `pdf-lib` — PDF document manipulation
- `@fontsource/inter` — Font: Inter (bundled)
- `bidi-js` — Bidirectional text algorithm (Phase 7F)
- `hypher` — Hyphenation algorithm (Phase 7C)
- `hyphenation.en-us` — English hyphenation patterns (Phase 7C)

### Optional (Peer)

- `@napi-rs/canvas` — SVG rasterization (Phase 7E)
- `@cantoo/pdf-lib` — PDF encryption (Phase 7G)

---

## Architecture

pretext-pdf uses a modular, layered architecture:

```
render(doc) → validate → layout → paginate → render-pages → PDF bytes
```

Each phase adds features orthogonally:
- Phase 1–4: Core engine, pagination, typography
- Phase 5: Rich text and builder patterns
- Phase 6: Advanced layout and formatting
- Phase 7: Security, internationalization, accessibility

---

## Future Roadmap

Potential Phase 8+ features (not yet implemented):
- Hyperlinks and anchors
- Justified text alignment
- Enhanced text decorations
- Font subsetting for file size reduction
- Browser compatibility improvements
- Performance optimizations

---

## Contributing

pretext-pdf is actively maintained. To report issues, request features, or contribute:

1. Check existing issues on the project repo
2. Write failing tests first (TDD)
3. Submit pull requests with test coverage ≥80%

---

## License

Check LICENSE file in repository root.
