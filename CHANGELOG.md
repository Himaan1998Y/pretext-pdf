# Changelog

All notable changes to pretext-pdf are documented here.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased]

### Planned (Phase 9+)

- Phase 9A: Digital signatures (cryptographic PKCS#7 via `@signpdf/signpdf`)
- Phase 9B: Image floats (text flowing alongside images — requires paginator rewrite)
- Phase 9C: Font subsetting pre-computation (explicit glyph hints for icon fonts)

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
