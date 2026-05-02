# Test file naming convention

All test files in this directory use **feature-based names**, not project-history names.

## Rules

1. **Name by the feature under test**, not by the sprint, phase, or version when it was written.
   - `toc.test.ts` — tests the Table of Contents element
   - `encryption.test.ts` — tests PDF encryption
   - ~~`phase-7g.test.ts`~~ — banned: leaks internal project history

2. **Use lowercase kebab-case** matching the element type or feature domain.
   - `qr-barcode.test.ts`, `float-groups.test.ts`, `inline-formatting.test.ts`

3. **Be specific when multiple files cover the same domain.**
   - `signatures-validation.test.ts` — validation rules for the signature spec
   - `signatures-visual.test.ts` — visual signature box rendering
   - `signatures-crypto.test.ts` — P12 file loading and PKCS#7 signing

4. **Security regressions** use the `security-` prefix.
   - `security-ssrf.test.ts`

5. **After adding a new test file, add it to `test:phases` in `package.json`.**
   The main `npm test` pipeline does not glob — it runs an explicit list.
   Forgetting this step means your tests never run in CI.

## Current file → feature mapping (reference)

| File | Tests |
|------|-------|
| `annotations.test.ts` | PDF annotations / comment elements |
| `assembly.test.ts` | merge() and assemble() APIs |
| `bookmarks.test.ts` | PDF bookmarks / outlines |
| `builder.test.ts` | createPdf() builder API |
| `callout.test.ts` | callout box element |
| `charts.test.ts` | Vega-Lite chart element |
| `cross-cutting.test.ts` | Mixed: typography extras, header tokens, footnote util, form callbacks |
| `e2e.test.ts` | End-to-end render smoke tests |
| `encryption.test.ts` | PDF encryption (userPassword, ownerPassword, permissions) |
| `float-groups.test.ts` | float-group layout element |
| `font-subsetting.test.ts` | Font subsetting behaviour |
| `footnotes.test.ts` | Footnote elements and numbering |
| `forms.test.ts` | Interactive form fields |
| `hyperlinks.test.ts` | External URLs and internal anchor links |
| `hyphenation.test.ts` | Automatic hyphenation |
| `image-floats.test.ts` | Image float layout |
| `inline-formatting.test.ts` | Inline bold/italic/underline/strikethrough |
| `integration.test.ts` | Multi-feature combinations (TOC + bookmarks, footnotes + TOC) |
| `markdown-entry.test.ts` | Markdown → PDF conversion entry path |
| `markdown-gfm.test.ts` | GFM-specific rendering (tables, task lists) |
| `metadata.test.ts` | PDF document metadata fields |
| `performance.test.ts` | Render-time performance and correctness benchmarks |
| `pretext-api-contract.test.ts` | Public API contract (stable exports) |
| `qr-barcode.test.ts` | QR code and barcode elements |
| `rich-text-pipeline.test.ts` | Rich-paragraph rendering pipeline |
| `rich-text.test.ts` | Rich-text element rendering |
| `rtl.test.ts` | Right-to-left text (Arabic, Hebrew) |
| `security-ssrf.test.ts` | SSRF security regression |
| `signatures-crypto.test.ts` | P12 loading, invisible signatures, PKCS#7 errors |
| `signatures-validation.test.ts` | Validation rules for the signature spec |
| `signatures-visual.test.ts` | Visual signature box rendering and positioning |
| `stress.test.ts` | Large-document stress tests |
| `svg.test.ts` | SVG element embedding |
| `templates.test.ts` | Invoice / report / NDA template smoke tests |
| `toc.test.ts` | Table of Contents element and two-pass rendering |
| `validate.test.ts` | Core validate() function |
| `validate-strict.test.ts` | Strict-mode validation (unknown property detection) |
| `watermarks.test.ts` | PDF watermarks |
