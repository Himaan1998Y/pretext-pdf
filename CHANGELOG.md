# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to pretext-pdf are documented here.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

---

## [1.2.1] — 2026-05-16

### Fixed

- **`PretextPdfError` now preserves root cause via `err.cause`** — `ASSEMBLY_FAILED` errors
  thrown by `merge()` and `assemble()` now carry the original pdf-lib error as `err.cause`,
  making root-cause debugging possible without losing the upstream message.

- **`form.updateFieldAppearances()` failure is now logged** — Previously silently swallowed
  (`catch { /* non-fatal */ }`). Now emits a structured warning via the document logger or
  `console.warn`. Behaviour is unchanged (non-fatal); the warning aids debugging.

- **Owner-only encryption now warns explicitly** — When `doc.encryption` is set without
  `userPassword`, a `console.warn` is emitted explaining that the PDF will open without a
  password. Owner-only encryption remains valid (it restricts editing/printing, not opening).

- **`assemble([{}])` now throws `VALIDATION_ERROR`** — Regression from v1.2.0 discriminated
  union changes: passing a part with neither `doc` nor `pdf` previously crashed with a
  `TypeError` (no `.code` property). Now throws a proper `VALIDATION_ERROR` with a clear
  message before attempting to render.

- **`watermark: {}` now throws `VALIDATION_ERROR`** — Regression from v1.2.0: the
  `WatermarkSpec` discriminated union enforced text/image presence at compile-time but the
  runtime validation was missing. A watermark object with neither `text` nor `image` now
  correctly throws at validate time.

- **`svg: ''` (empty string) now throws `VALIDATION_ERROR`** — Empty SVG strings passed
  the validation stage and surfaced as `SVG_LOAD_FAILED` during render. Now caught at
  validate time with a clear `VALIDATION_ERROR`.

### Changed

- **`PretextPdfError` constructor accepts optional `ErrorOptions`** — Third argument
  `options?: ErrorOptions` (i.e. `{ cause?: unknown }`) is now accepted and passed to the
  native `Error` constructor. Fully backwards-compatible — all existing call sites unchanged.

- **bidi-js missing-peer warning routes through document logger** — When a `logger` is
  passed to `render()`, bidi-js peer-dependency warnings are now routed through
  `logger.warn` instead of always using `console.warn`. New low-level export:
  `setBidiWarnFn(fn)` (prefer the `logger` render option in application code).

---

## [1.2.0] — 2026-05-16

Post-audit hardening release. Type system tightened, concurrency-safe validation,
@internal type leaks closed, RTL/asset failures surface as structured errors,
SSRF defense upgraded to undici-pinned IP. No source-level API removals from the
package entry point — see migration notes below for `@internal` types that were
already not exported from `src/index.ts`.

### Added

- **Discriminated unions on four public types** (`src/types-public.ts`, audit Phase B) —
  `WatermarkSpec`, `AssemblyPart`, `SvgElement`, and `ImageElement` (float variants)
  now use TypeScript discriminated unions instead of flat optional structs. The
  compiler now prevents invalid combinations (e.g., a watermark with both `text`
  and `image`, or an SVG element with neither `svg` nor `src`) that previously
  could only be caught at runtime. Existing valid usages continue to compile.

- **`pdf-lib` type augmentation** (`src/vendor/pdf-lib-augment.d.ts`, audit Phase D) —
  Documents the load-bearing `as any` casts against pdf-lib internals
  (`PDFArray.push`, `PDFFont.embedder`) and removes the one genuinely-avoidable
  cast in `measure.ts`.

- **DNS rebinding defense via undici Agent IP pinning** (`src/assets.ts`, audit B6) —
  `assertSafeUrl` was upgraded to `resolveAndValidateUrl` which returns the
  resolved IP, and `fetchWithTimeout` now uses an undici `Agent` whose
  `connect.lookup` callback always returns the pre-validated IP. Closes the
  TOCTOU window where DNS could rebind between validation and connect.
  Extended private-range coverage: 0.0.0.0/8, 192.0.0/24, 198.18/15, IPv6
  multicast, and IPv4-mapped IPv6 normalization. +14 SSRF tests (25 total).

- **Per-call cycle-detection state** (`src/validate.ts`, audit Perf-1) — Moved
  `seenInRecursion` WeakSet from module scope into `validate()` and threaded
  through `withCycleGuard`. Makes validation reentrant and concurrency-safe
  (no shared mutable state across parallel `validate()` calls). +1 regression
  test.

- **Structured error codes on RTL + asset failures** (`src/errors.ts`,
  `src/measure-text.ts`, `src/assets.ts`, audit silent-failure pass) —
  - `RTL_REORDER_FAILED` — surfaces when `bidi-js` is installed but throws.
    Previously fell through with `isRTL:true` on logical-order text =
    visually broken Arabic/Hebrew renders. Missing `bidi-js` still degrades
    gracefully (warn + LTR render) since it is an optional peer dep.
  - `CHART_LOAD_FAILED` — embedded in warn logs from QR/barcode/chart loaders
    so failures are debuggable from log scraping alone.
  - `FONT_ENCODE_FAIL` — replaces the prior bare `catch` in `src/fonts.ts`
    that silently swallowed font subset failures (audit B2).

### Changed

- **`@internal` types removed from the `types.ts` barrel** (audit H8 / type-design HIGH) —
  `RichLine`, `RichFragment`, and `TocEntryElement` were tagged `@internal`
  but re-exported through `src/types.ts`. They have been removed from that
  barrel and canonicalized in `src/types-internal.ts`. `TocEntryElement` is
  no longer a member of the public `ContentElement` union (it was always
  pipeline-synthesized, never user-constructed). Internal imports updated
  in `rich-text.ts`, `measure.ts`, `render-extras.ts`, `allowed-props.ts`,
  `validate.ts`, `measure-blocks.ts`, `fonts.ts`. **Migration note:** these
  types were never exported from `src/index.ts` (the package entry point),
  so consumers using the supported import path (`import { ... } from
  'pretext-pdf'`) are unaffected. Deep imports (`'pretext-pdf/src/types'`)
  are unsupported and never were stable.

- **`api-extractor` enforcement escalated to `error`** (`api-extractor.json`) —
  `ae-forgotten-export` log level changed from `warning` to `error` so CI
  fails on future `@internal` type leaks. `etc/pretext-pdf.api.md` baseline
  regenerated.

- **`assertUnknownProps` parameter tightened** (`src/validate.ts`) —
  `obj: any` → `obj: unknown` with an explicit type guard at the boundary.
  Removes one of the few remaining `any` exposures at a security-sensitive
  validation entrypoint.

### Fixed

- **Concurrent validation false positives** (`src/validate.ts`) — Two
  simultaneous `validateDocument(doc)` calls on the same object reference
  could produce a false "cyclic reference detected" error because the
  WeakSet was at module scope. Per-call WeakSet fix closes this and any
  future re-entrant validator scenarios.

- **Stale `tests-743` badge** (`README.md`) — Replaced with the durable
  `tests-passing` (current unit count is 319).

- **Dead `case 'toc-entry'` branch** (`src/fonts.ts:collectTextByFont`) —
  After `TocEntryElement` left the public `ContentElement` union, the
  branch became unreachable.

### Migration notes (v1.1.x → v1.2.0)

If you only import from `'pretext-pdf'`: **no source changes needed.**

If you do unsupported deep imports of internal types
(`'pretext-pdf/src/types'`):
- `RichLine`, `RichFragment`, `TocEntryElement` — import from
  `'pretext-pdf/src/types-internal'` instead, with the understanding that
  these are not part of the stable public API and may change in any release.

If you construct `WatermarkSpec` / `AssemblyPart` / `SvgElement` / `ImageElement`
literals: you may need to delete fields you weren't using anyway. TypeScript
will flag any literals that previously satisfied the loose type but violated
the actual invariants.

---

## [1.1.3] — 2026-05-15

### Added

- **Cycle detection + depth cap on TableElement walk** (`src/validate.ts`, Sprint 3 / M2) —
  The rows/cells iteration is now wrapped in `withCycleGuard`, matching the
  protection already in place for `ListItem.items`, `FloatGroup.content`, and
  `RichParagraph.spans`. A self-referential row or cell shape now produces a
  structured `VALIDATION_ERROR` instead of an unbounded walk.

- **Root-level depth guard for `document.content` entries** (`src/validate.ts`, Sprint 3 / M1) —
  Each top-level element call into `validateElement` now runs an explicit
  `assertDepthOk(depth, prefix)` so the `MAX_VALIDATION_DEPTH = 32` cap fires
  even for plugin-typed elements that do not open their own `withCycleGuard`
  scope. Internal recursive walks (`list`, `float-group`, `rich-paragraph`,
  `table`) continue to enforce the cap via `withCycleGuard`.

- **Round-trip tests for the pdfmake compatibility shim** (`test/compat.test.ts`, Sprint 3 / M3) —
  Four new tests covering pdfmake → pretext → render integration, style
  propagation, sanity rendering of native pretext docs, and large-table
  preservation (5 columns × 10 rows).

- **`## Validation` section in `README.md`** (Sprint 3 / M4) — Explicit guidance
  to call `validateDocument()` before `render()` on untrusted input, with the
  concrete failure modes (stack overflow on cyclic input, prototype pollution
  via `__proto__`, runtime 500s on malformed shapes) the validator prevents.

### Fixed

- **Type safety in validateDocument** (`src/validate.ts`) — Replaced unchecked `as PdfDocument` cast with `isValidPdfDocumentLike()` type guard. Returns proper error when input is not a plain object.

- **Prototype pollution in mergeStyles** (`src/compat.ts`) — `Object.assign(merged, s)` allowed user-supplied pdfmake JSON to pollute the prototype chain. Replaced with `copySafeStyleProperties()` that whitelists only known safe style keys (fontSize, bold, italics, color, alignment, font).

- **Path traversal in digital signatures** (`src/post-process.ts`) — P12 certificate path bypassed the `allowedFileDirs` security check. Now validates path via `assertPathAllowed()` before reading, preventing directory traversal attacks via signature feature.

- **Fragile errorCount regex in validateDocument** (`src/validate.ts`) — Original regex could match anywhere in error message. Refined to header-only pattern (`^Strict validation failed`) to extract true error count even when >20 errors are returned (capped array but accurate count in message).

- **Fake test coverage** (`test/validate-document.test.ts`) — Removed describe block with `assert.ok(true, 'TODO')` placeholder. Replaced with documentation explaining why the non-PretextPdfError code path is manually audited.

- **Missing LICENSE for vendored code** (`src/vendor/pretext/LICENSE`) — Added MIT license file with attribution to upstream pretext library and this fork, satisfying legal compliance for vendored dependencies.

### Documentation

- **`Logger` interface guidance** (`src/types-public.ts`, audit L2) — Expanded
  JSDoc on the `Logger` interface and the `logger?` field on `RenderOptions`
  to call out that passing a no-op (`{ warn: () => {} }`) silences **every**
  advisory warning — fine in tests, dangerous in production. Documents the
  default (`console.warn`) and recommends pino/winston for production
  routing. No code change.

- **pdfmake `defaultStyle` / `styles` mapping** (`src/compat.ts`, audit L3) —
  Added JSDoc to `PdfmakeStyle` enumerating the supported subset
  (`font`, `fontSize`, `bold`, `italics`, `color`, `alignment`) and the
  silently-dropped pdfmake properties (`lineHeight`, `marginX/Y`,
  `decoration`, `background`, `characterSpacing`, `noWrap`, etc.) that
  consumers migrating from pdfmake commonly trip over. `fromPdfmake()`
  now documents how `defaultStyle.font` / `.fontSize` route to
  document-level `defaultFont` / `defaultFontSize` and how all other
  `defaultStyle` properties cascade through `mergeStyles()`.

### Changed

- **Benchmark floor override** (`test/benchmark-baseline.test.ts`, audit L4) —
  The per-corpus regression guard now honors a `PRETEXT_BENCHMARK_FLOOR_MS`
  environment variable. Set it to a positive integer to raise the 5000ms
  default floor on slow CI runners; set it to `skip` / `0` / `false` / `off`
  to bypass the timing assertion entirely. The structural assertions (corpus
  IDs match baseline, stages present) still run.

### Notes — Phase A / B / D history

The cycle-detection and depth-cap machinery (`withCycleGuard`,
`MAX_VALIDATION_DEPTH`, the per-container guards on `list`, `float-group`,
`rich-paragraph`) and the discriminated-union refactor of `ContentElement`
plus the typed `pdf-lib` augmentation were landed during in-flight audit
sprints between `[1.0.x]` and `[1.1.0]` that were not individually tagged.
Sprint 3 (this release) backfills those gaps with the M1/M2 root + table
guards, plus explicit tests and documentation.

---

## [1.1.2] — 2026-05-08

### Fixed

- **Silent font-subset failure** (`src/fonts.ts`) — Bare `catch {}` on `pdfFont.encodeText()`
  silently swallowed glyph-encoding errors, producing wrong characters with no signal.
  Now logs a `console.warn` so callers know which font key failed.

- **Explicit RTL direction silently flipping to LTR** (`src/measure-text.ts`) — When
  `dir:'rtl'` was set and `bidi-js` threw during reordering, the fallback incorrectly
  returned `isRTL: false`, causing Arabic/Hebrew paragraphs to align and wrap as LTR.
  The fallback now preserves `isRTL: true` so the layout engine honours the explicit
  direction even without bidi reordering.

- **SSRF DNS rebinding window** (`src/assets.ts`) — `assertSafeUrl()` was synchronous.
  An attacker with TTL=0 DNS could pass the hostname check then rebind to `169.254.x.x`
  between the check and the actual `fetch()` call. The function is now async and
  pre-resolves hostnames via `dns.lookup()` before the private-range check, closing
  the TOCTOU window. Falls back gracefully when DNS is unavailable (fetch will also
  fail in that case). All call sites updated to `await assertSafeUrl()`.

- **Concurrent PDFDocument mutation race** (`src/pipeline.ts`) — `loadFonts` and
  `loadImages` were run with `Promise.all()` over the same `PDFDocument` instance.
  Both mutate the cross-reference table, causing intermittent xref corruption under
  load. Now sequenced: `loadFonts` completes before `loadImages` begins.

- **Test suite cascade: 692 tests silently dropped on benchmark failure** (`package.json`,
  `scripts/test-all.mjs`) — The `&&`-chained `npm test` command aborted all downstream
  stages when `test:contract` failed. Replaced with a Node.js runner that executes all
  4 stages and collects failures. Benchmark is now in a separate `test:benchmark` script
  (not in `test:contract`) with `FLOOR_MS` raised to 5s to absorb dev-hardware variance.

---

## [1.1.1] — 2026-05-08

### Fixed

- **`validateDocument` fallback parser: path extraction** — `parseValidationErrorsStructured`
  now correctly falls back to `path: "document"` for single-throw errors whose message
  contains a sentence (e.g. `"margins.left must be a non-negative finite number. Got: -1"`).
  Previously the heuristic accepted any text-before-colon that started with a letter,
  producing a corrupted path like `"margins.left must be a non-negative finite number. Got"`.
  Fix: reject candidates that contain `". "` (period + space), which only appears in
  prose sentences, never in path expressions like `content[0] (paragraph) spans[0].href`.

- **README `runtime%20deps` badge** — Updated from `8` to `7` to reflect the removal
  of `@chenglou/pretext` from `dependencies` in v1.1.0.

- **`SECURITY.md` personal email removed** — Replaced `akashchikara1998@gmail.com`
  with the GitHub private vulnerability reporting URL.

### Changed

- **CI matrix: Node 18.x removed** — Node 18 reached End of Life in April 2025.
  The CI matrix now targets Node 20.x and 22.x only. The `engines.node` field in
  `package.json` is updated to `>=20.0.0`. The Node 18 matrix slot was causing
  flaky benchmark failures (EOL runners are slower) that killed the `&&` test chain
  and caused the badge verifier to see a truncated test count.

---

## [1.1.0] — 2026-05-07

Vendor `@chenglou/pretext` source directly into the package, eliminating the
GitHub URL dependency and all associated install risks (mutable tags, npm audit
gaps, network-only install, no SRI).

### Changed

- **`@chenglou/pretext` is now vendored** — The upstream text-layout engine
  (`src/vendor/pretext/`) is compiled as part of pretext-pdf itself. Consumers
  no longer need to install `@chenglou/pretext`; the GitHub URL dependency has
  been removed from `package.json`. The vendored snapshot is pinned to
  `v0.0.6-patched.2` (commit `658edfec`) with 9 upstream PRs cherry-picked on
  top of the `v0.0.6` release. See `UPSTREAM.md` for the full patch inventory
  and upgrade procedure.

### Added

- **`UPSTREAM.md`** — Authoritative attribution and upgrade guide for the
  vendored `@chenglou/pretext` source. Documents provenance, the 9 cherry-picked
  upstream PRs (#3, #29, #105, #119, #132, #138, #140, #161, #165), which
  commits are excluded from vendoring (fork infra), and the procedure for
  updating when upstream publishes a new release.

### Removed

- **`@chenglou/pretext` dependency** — Removed from `dependencies`. The library
  source is now bundled inside the package at `dist/vendor/pretext/`. No runtime
  behavior change; the same patched code is used.

---

## [1.0.9] — 2026-05-06

Test coverage Phase 2: filling blind spots in the CLI, the pdfmake compat shim, and
the performance regression guard. Adds c8 coverage tooling for measurability.

### Added

- **`test/cli.test.ts`** (+13 tests) — End-to-end coverage for the `pretext-pdf` CLI binary,
  spawning `dist/cli.js` as a subprocess. Covers argument parsing (`--version`, `--help`,
  `-i/-o/--markdown/--code-font`, positional fallback, unknown flags), JSON and Markdown
  input modes, stdin/stdout piping, and exit codes 0/1/2.

- **`test/compat.test.ts`** (+34 tests) — Coverage for the pdfmake → pretext-pdf
  translation shim (`fromPdfmake`). Covers page setup (pageSize string and object,
  pageMargins scalar/2-tuple/4-tuple, orientation), styles (defaultStyle, named styles,
  headingMap override), all content node types (string, `text`, `ul`/`ol` with nesting,
  `table` with header rows, `image`, `qr`, `pageBreak`, `stack`), header/footer string
  forms, integration render, and unsupported nodes (`columns`, `canvas`).

- **c8 coverage tooling** — `npm run coverage` (text + lcov reporters) and
  `npm run coverage:check` (75/65/75 thresholds, non-blocking in CI initially).
  Configuration in `.c8rc.json` excludes type-only files and CLI from instrumentation.
  Coverage step added to CI as `continue-on-error: true` while baseline thresholds
  are calibrated.

### Fixed

- **`test/benchmark-baseline.test.ts`: regression guard now actually guards** —
  Replaced the prior "TODO: enable when baseline is calibrated" stub (which collected
  timings but asserted nothing) with a real 3x-baseline-with-500ms-floor budget per
  corpus. Missing corpora in the baseline JSON now `assert.fail()` instead of silently
  defaulting to a zero budget that would mask any regression.

- **CONTRIBUTING.md: removed stale "(676 tests)" annotation** — Test count drift bait;
  the README badge already auto-verifies via `verify:badges`.

### Changed

- **Test runner now builds first** — Added `pretest:unit: npm run build` so contributors
  running `npm run test:unit` always get a fresh dist; the new CLI tests spawn the
  compiled binary and would otherwise fail with a confusing module-not-found error.

---

## [1.0.8] — 2026-05-06

Public API contract integrity: the `RenderOptions.logger` option now actually does what
its JSDoc has always promised, and `@napi-rs/canvas` no longer auto-installs.

### Fixed

- **`RenderOptions.logger` now routes warnings from asset loading and rendering** —
  Previously only validation warnings respected the `logger` option. Now all advisory
  warnings from `loadImages` (image load, image embed, QR/barcode/chart skipped, plugin
  loadAsset failed, watermark image skipped — 7 call sites) and `renderDocument` (form
  field render failure) flow through `logger.warn` when one is provided. Bidi-js fallback
  warnings from RTL reordering remain on `console.warn`; the JSDoc on `RenderOptions.logger`
  has been updated to document the actual scope honestly.

- **Missing `[pretext-pdf]` log prefix on bidi-js error path** — One `console.warn` in
  `measure-text.ts` was logging without the canonical `[pretext-pdf]` prefix, making it
  hard to identify the library as the source in consumer logs. Now consistent.

### Changed

- **`@napi-rs/canvas` removed from `optionalDependencies`** — Was double-listed in both
  `peerDependencies` (with `optional: true`) and `optionalDependencies`. The latter caused
  npm to attempt installing the native canvas binary on every install, including in
  edge/serverless environments where the platform may not be supported and the dep is
  not needed. Now only listed under `peerDependencies` — install it explicitly when you
  need SVG/QR/barcode/chart rasterization in Node.

### Documentation

- **README — security callout for `allowedFileDirs`** — Added a prominent callout in the
  Quick Start section. The default behavior allows `image.src` and `svg.src` to read any
  absolute file path, which is a path-traversal vector when document JSON originates from
  user input or an LLM. The callout now appears immediately after the first `render()`
  example.

---

## [1.0.7] — 2026-05-05

Picks up pretext fork v0.0.6-patched.2: 8 additional upstream PRs (11 total).

### Fixed

- **German low opening quote `„` no longer breaks at line-start on hyphenation path** —
  `KINSOKU_START_FORBIDDEN` in `src/measure-text.ts` now includes U+201E (`„`), matching
  pretext PR #165 which fixed the non-hyphenation path. Previously `„` could appear
  at the start of a wrapped line when hyphenation was active.

- **Currency symbols stay glued to adjacent numbers** — Upstream PR #105 (cherry-picked in
  `v0.0.6-patched.2`) prevents `$`, `€`, `£`, `₹` etc. from line-breaking away from
  the number they annotate.

- **Trailing collapsible-space reconstruction fixed** — Upstream PR #29 fix (extended in
  v0.0.6-patched.2): a word followed by a space that exactly fills `maxWidth` no longer
  drops the space from line boundary cursors, preventing Arabic/mixed-script text from
  losing inter-word spaces during reconstruction.

### Changed

- **`@chenglou/pretext` dependency** — Bumped from `v0.0.6-patched` to `v0.0.6-patched.2`
  (GitHub fork, 11 upstream PRs total). Adds: CJK overflow prevention (PR #132),
  fit-advance cache fix (PR #161), rich inline stats unification (PR #138),
  chunk layout side table O(1) lookup (PR #140), bidi surrogate handling (PR #3),
  skip no-op merge passes (PR #119), currency stickiness (PR #105),
  German quote fix (PR #165), and trailing-space reconstruction (PR #29).

---

## [1.0.6] — 2026-05-04

Audit bug fixes: validator correctness, internal export hygiene, schema gaps, README accuracy.

### Fixed

- **lineHeight upper-bound cap removed** — `validate()` no longer rejects `lineHeight > 20`. The
  field is in points (pt), not a multiplier; 36pt is valid for a large heading. The `> 20` cap in
  `paragraph`, `heading`, and `defaultParagraphStyle` validators has been removed. The lower-bound
  check (lineHeight >= fontSize) is preserved.

- **form-field error messages use `${prefix}` format** — Error messages from the `form-field` case
  now follow the `content[N] (form-field): ...` format used by all other element types, instead of
  the old `[N] form-field.` prefix.

- **`assertUnknownProps` hint punctuation fixed** — The "unknown property" message previously
  produced `unknown property. did you mean "color"` (period before hint). Fixed to
  `unknown property; did you mean "color"` — no period, semicolon separator.

- **British "colour" → "color" in JSDoc** — Two `QrCodeElement` field comments
  (`foreground`, `background`) and the `ValidationError.path` JSDoc example corrected.

- **`TocEntryElement`, `RichLine`, `RichFragment` removed from public exports** — These types are
  marked `@internal` in `types-public.ts` and should not be part of the npm API surface. Removed
  from `src/index.ts`.

- **Signature error includes original cause** — `SIGNATURE_FAILED` now preserves the underlying
  error message: `PDF signing failed: <original message>` instead of a static string.

- **Header-only table now valid** — `validate()` previously rejected tables where all rows are
  headers (`headerRowCount === rows.length`). Changed `>=` to `>`: tables where every row is a
  header are valid (useful for column-label-only tables).

- **Dead sub-condition removed in `float-group` floatWidth guard** — `fg.floatWidth <= 0` was a
  dead branch (any value `<= 0` is already `< 30`). Removed to clarify intent.

- **`warningCount` JSDoc updated** — Documents that the validator currently only emits errors, so
  `warningCount` is always 0 (reserved for future use).

- **`validateDocument` no longer re-throws unexpected errors** — Non-`PretextPdfError` exceptions
  (e.g. circular JSON, unexpected runtime errors) are now caught and returned as a structured
  `ValidationResult` instead of propagating. `validateDocument` now always returns, never throws.

### Changed (Schema additions — `pretext-pdf/schema`)

- `qrCodeSchema`: added `margin` field.
- `imageSchema`: added `floatFontSize`, `floatFontFamily`, `floatColor` fields.
- `codeSchema`: added `dir` and `highlightTheme` fields.
- `tableSchema`: added `dir`, `headerRows`, and cell-level `dir`, `fontFamily`, `fontSize`,
  `tabularNumbers` fields.

### Docs

- README: `highlight.js` added to optional peer dependencies table.
- README: `validate_document` added to MCP server tool list.

---

## [1.0.5] — 2026-05-04

Schema coverage completion, `ValidationResult.warningCount`, and README API docs.

### Added

- **`ValidationResult.warningCount`** — `validateDocument()` now returns `warningCount` alongside
  `errorCount`. Computed by filtering `errors[]` by `severity === 'warning'`. MCP consumers no
  longer need to derive it client-side.

- **JSON Schema: remaining field coverage** — `src/schema.ts` now covers all previously missing
  fields across 9 element types:
  - `inlineSpanSchema`: `dir`
  - `paragraphSchema`: `columns`, `columnGap`, `tabularNumbers`, `hyphenate`
  - `headingSchema`: `tabularNumbers`, `hyphenate`
  - `blockquoteSchema`: `lineHeight`, `padding`, `paddingH`, `paddingV`, `underline`, `strikethrough`
  - `calloutSchema`: `titleColor`, `fontWeight`, `lineHeight`, `padding`, `paddingH`, `paddingV`
  - `listSchema`: `lineHeight`, `markerWidth`, `itemSpaceAfter`, `nestedNumberingStyle`; nested
    items now carry `dir` and have a typed inner schema
  - `tocSchema`: `titleFontSize`, `levelIndent`, `leader`, `entrySpacing`
  - `formFieldSchema`: `borderColor`, `backgroundColor`, `keepTogether`, `defaultSelected`
  - `richParagraphSchema`: `columns`, `columnGap`, `tabularNumbers`

- **README: `validateDocument` and `pretext-pdf/schema` documented** — both entry points now have
  `### API reference` sections with code examples.

---

## [1.0.4] — 2026-05-04

Schema export hardening: post-release audit fixes addressing coverage gaps and a
malformed dialect URI.

### Fixed

- **`pretext-pdf/schema`: `$schema` dialect URI corrected** — was
  `https://json-schema.org/draft/2020-12` (not a registered URI), now
  `https://json-schema.org/draft/2020-12/schema`. Strict JSON Schema validators
  (AJV, Smithery, VS Code) will now correctly identify the dialect.
- **`pretext-pdf/schema`: `hr` element spacing fields** — `spaceAbove` and
  `spaceBelow` (the primary documented fields, default 12) were missing.
  `spaceBefore` and `spaceAfter` are now correctly marked as aliases.
- **`pretext-pdf/schema`: `float-group` and `chart` element types** — both
  first-class public element types were missing from the `content.items.anyOf`
  list. Schema-driven tooling will now know they exist.

### Added (schema coverage)

- `pdfDocumentSchema.sections` — page-range header/footer overrides
- `headingSchema.annotation` — annotation field (was already on paragraph)
- `tableSchema.cellPaddingH` / `cellPaddingV` — primary table density controls
- `imageSchema.floatWidth` / `floatGap` / `floatSpans` — column-layout controls
  for floated images

---

## [1.0.3] — 2026-05-03

Enhancements: JSON Schema export, simplified marked peer dep range, and internal API polish.

### Added

- **`pretext-pdf/schema` entry point** — exports `pdfDocumentSchema`, a machine-readable JSON Schema
  object describing the full `PdfDocument` type. Covers all 22 element types and 18 top-level
  document properties. Intended for editor tooling, MCP clients, and Smithery UI form generation.

  ```typescript
  import { pdfDocumentSchema } from 'pretext-pdf/schema'
  ```

### Changed

- **`marked` peer dependency simplified** — `^9.0.0 || ^10.0.0 || ... || ^18.0.0` condensed to
  `>=9.0.0`. Semantically identical, cleaner npm output.

- **`validateDocument` logger option** — `options.logger` now passed to the underlying `validate()`
  call via conditional spread, respecting `exactOptionalPropertyTypes: true` constraints.

### Fixed

- **`fonts.ts` unsafe cast removed** — `(spec as { style?: string }).style` replaced with direct
  property access on the widened parameter type.

---

## [1.0.2] — 2026-05-03

### Added

- `validateDocument(doc, options?)` — non-throwing validation API that returns a structured `ValidationResult` with typed `ValidationError[]` instead of throwing. Each error includes `path`, `message`, `code`, `severity`, and `suggestion` fields.
- `ValidationError` and `ValidationResult` exported from the public API surface.
- `Logger` interface and `logger?: Logger` in `RenderOptions` — route diagnostic warnings through a custom logger instead of `console.warn`.
- Inter italic font support (Inter-400-italic, Inter-700-italic) via bundled `@fontsource/inter` — italic markdown and `fontStyle: 'italic'` now work without manual font setup.

---

## [1.0.1] — 2026-05-02

Patch: strict mode correctness fixes. No API changes.

### Fixed

- **`levenshteinDist` early-exit bug** — per-cell `if (curr[j]! > 2) return 999` inside
  the inner DP loop fired on intermediate cells, causing d=1 pairs like `hrefs→href` and
  `spaceafter→spaceAfter` to incorrectly return 999 instead of 1. Fix: removed the per-cell
  guard; final check only (`prev[n]! > 2 ? 999 : prev[n]!`).
- **Seven path-prefix annotations** — strict-mode error paths had `(type)` suffixes
  (e.g. `doc(table).rows[0]`) that no other validator used and that tests didn't expect.
  All seven removed so paths are plain dot-notation.
- **`encryption` block not strict-checked** — unknown props inside `doc.encryption`
  were silently accepted in strict mode. Now validated against `ALLOWED_PROPS_SUB['encryption']`.
- **Root path was `'document'` not `'doc'`** — top-level `assertUnknownProps` was called
  with `'document'` as the path prefix, producing paths like `document.content[0]` instead
  of `doc.content[0]`. Corrected to `'doc'`.
- **Suggestion format mismatched** — `Did you mean 'x'?` → `did you mean "x"` (lowercase,
  double-quotes) to match the format tests asserted.
- **`formatErrors` missing header** — multi-error output now begins with
  `Strict validation failed (N issues):\n` so callers can detect strict vs. regular errors.

### Tests

- Added `test/validate-strict.test.ts` (35 tests) to `test:unit` script — these tests were
  written but not wired into CI in v1.0.0.

---

## [1.0.0] — 2026-05-02

First stable release. Completes the plugin extension API, closes all v1.0 gate requirements,
and ships a fully verified public surface with zero breaking changes from 0.9.x.

### Added

- **Plugin extension API** — Register custom element types via `RenderOptions.plugins`.
  Each `PluginDefinition` participates in all four pipeline stages: `validate`, `loadAsset`,
  `measure`, and `render`. Plugins are fully typed and tree-shaken from documents
  that don't use them. See README § Custom element types (plugins) and
  `examples/plugin-custom-element.ts` for a runnable example.
- **`PluginDefinition`, `PluginMeasureContext`, `PluginMeasureResult`, `PluginRenderContext`**
  exported from `pretext-pdf` public surface (previously internal).
- **`PdfBuilder` and `PdfBuilderOptions`** exported from `pretext-pdf` (enables type-safe
  builder construction in downstream code without re-declaring the interface).
- **`TocEntryElement`** exported from `pretext-pdf` public surface (was in the `ContentElement`
  union but not individually importable).
- **`plugins` option on `createPdf()`** — `PdfBuilderOptions.plugins` threads plugins through
  the builder's `build()` call automatically.
- **`Intl.Segmenter` pre-flight guard** in `render()` — throws `RENDER_FAILED` with a clear
  message on Node.js < 16 or runtimes without full-ICU data, instead of silently producing
  incorrect line breaks.
- **`PluginRenderContext.pageWidth/pageHeight/margins`** — render hooks now receive full page
  geometry for layout calculations (page-relative positioning, bleed boxes, etc.).
- **`render` context Y-coordinate docs** — expanded JSDoc with multi-line text example showing
  how to position text baselines relative to `context.y`.
- **Benchmark corpora manifest** and **smoke staging** tests wired into `npm test`
  (previously orphaned).
- **`test/table-determinism.test.ts`** — asserts that table pagination produces identical
  layout traces across repeated invocations of `prepareLayoutState`.
- **`test/validate-strict.test.ts`** (35 tests) — comprehensive contract for `strict: true`
  validation covering all element types, nested structures, Levenshtein suggestions, error
  message format, doc-level and sub-structure prop checks. Total test count: 676.
- `examples/plugin-custom-element.ts` — runnable plugin example (`npm run example:plugin`).

### Fixed

- **`SIGNATURE_CERT_AND_ENCRYPTION` error code** — was declared in the `ErrorCode` union
  but never thrown; validate.ts now uses it correctly when a document specifies both
  signatures and encryption (previously threw a generic `VALIDATION_ERROR`).
- **Build break under `exactOptionalPropertyTypes: true`** — `PdfBuilder.build()` no longer
  passes `{ plugins: undefined }` to `runPipeline` when no plugins are configured.
- **Plugin `validate` hook empty-string normalization** — `plugin.validate()` returning `''`
  now correctly accepts the element (was previously treated as a rejection message).
- **`toc` element reaching render default arm** — `render.ts` now has an explicit
  `case 'toc': return` guard before the default arm; TOC elements are pre-processed
  during pagination and should never reach the renderer.
- **`RichLine` and `RichFragment`** demoted from `@public` to `@internal`; these are
  implementation details of the rich-text pipeline, not intended for external use.
- **Sentinel value documentation** — `MeasuredBlock` comment now explicitly states that
  `lines: []`, `fontSize: 0`, `lineHeight: 0`, `fontKey: ''` applies to spacers, tables,
  images, hr, *and plugin blocks* — not a bug but a documented convention.

### Internal

- `src/plugin-registry.ts` (new): Pure orchestration helpers for the four plugin injection
  points (`findPlugin`, `runPluginValidate`, `runPluginLoadAsset`, `runPluginMeasure`,
  `runPluginRender`).
- `src/plugin-types.ts` (new): `PluginDefinition` interface and context/result types.
- `src/layout-state.ts`: `prepareLayoutState` now accepts `options?: RenderOptions` and
  threads plugins to `stageValidate`, `stageLoadAssets`, and `stageMeasure`.
- `docs/V1.0-RUNBOOK.md`: Full release runbook with first-principles audit, anti-hallucination
  protocol, verified-facts table, and phase-by-phase plan.

---

## [0.9.4] — 2026-05-02

> **Note:** This release was never published to npm as a standalone tag. All changes listed
> here shipped as part of [1.0.0] on the same date.

Architecture hardening + API surface snapshot. No public API changes; internal
restructuring to eliminate circular dependencies and add drift guards before v1.0 freeze.

### Added

- **API surface snapshot** (`etc/pretext-pdf.api.md`) checked into source control as
  the v1.0 baseline. The `api:check` CI step will fail on unintentional public-API drift.
- **`src/layout-state.ts`** — `prepareLayoutState()` and `summarizeLayoutState()` extracted
  from the pipeline for testability; `layout-contract` and `hard-text-contract` tests
  wired into `test:unit`.
- **`src/benchmarks/corpora.ts`** — benchmark corpus manifest (`getBenchmarkCorpora()`)
  restored from git history; `benchmark-baseline.test.ts` wired into `test:contract`.
- **Drift guards** (`test/drift-guards.test.ts`) — asserts that `ELEMENT_TYPES`,
  `ALLOWED_PROPS`, `validate.ts` cases, and `render.ts` cases all agree at test time.
  Catches any future element-type addition that isn't plumbed through all four places.
- **`render.ts` default arm** — unknown element types now throw immediately instead of
  silently producing a blank block.

### Refactored

- **Circular dependency broken**: `src/post-process.ts` extracted so `builder.ts` and
  `index.ts` no longer form a cycle through each other.
- **`ELEMENT_TYPES` extracted** to `src/element-types.ts` as single source of truth;
  re-exported from `index.ts`, imported by `validate.ts` — eliminates the previous
  per-file string-literal duplication.

### Fixed

- `post-process.ts`: drop raw signing library error message from `SIGNATURE_FAILED`
  to avoid leaking certificate or passphrase details in error output.
- `layout-state.ts`: polyfill install wrapped in try/catch; throws `CANVAS_UNAVAILABLE`
  on failure instead of an untyped exception.

---

## [0.9.3] — 2026-04-23

Strict validation release. Opt-in property validation to catch unknown properties on elements and sub-structures via typo detection and precise JSONPath error reporting.

### Added

- **Strict validation mode**: Pass `{ strict: true }` to `render(doc, options)` to reject unknown properties. Non-strict mode (default) remains permissive for backwards compatibility.
- **`render()` options parameter**: Updated signature to `render(doc: PdfDocument, options?: RenderOptions)` where `RenderOptions = { strict?: boolean }`.
- **`validate()` public export**: `validate()` is now exported from `pretext-pdf` for standalone validation and testing.
- **Validation error details**:
  - Unknown properties reported with Levenshtein edit-distance suggestions (distance ≤2) for typo correction.
  - Errors include JSONPath-like paths (`content[3].table.rows[0].cells[1].align`) for precise location reporting.
  - Error accumulation: all violations collected before throwing a single VALIDATION_ERROR with formatted multi-line message.
  - First 20 errors shown; overflow indicator present.
- **Compile-time drift guards**: `src/allowed-props.ts` uses `Exact<T, Keys>` TypeScript type assertions to catch property definition drift at type-check time. If element types change, `tsc --noEmit` will error if allowed-props lists don't match.
- **Property allowlists**:
  - `ALLOWED_PROPS`: 22 element types (paragraph, heading, table, image, code, list, etc.)
  - `ALLOWED_PROPS_SUB`: 8 sub-structures (document, metadata, table-row, table-cell, list-item, inline-span, column-def, annotation)

### Internal

- `src/allowed-props.ts` (new): Central configuration for allowed properties with compile-time assertions.
- `src/validate.ts` (enhanced): Added `levenshteinDist()`, `closestMatch()`, `assertUnknownProps()`, and `formatErrors()` helpers; threading strict flag through `validateElement()` for nested structure validation (tables, lists, rich-paragraphs, float-groups, annotations).

---

## [0.9.2] — 2026-04-22

Maintenance release. Engine refresh + repo-hygiene automation. No runtime behavior changes beyond the `@chenglou/pretext` bump.

### Changed

- **Bumped `@chenglou/pretext` to 0.0.6** (from 0.0.5). Brings two upstream improvements: (a) CJK text followed by opening-bracket annotations now wraps like browsers instead of leaving the opening bracket on the previous line (upstream PR #148), (b) native numeric `letterSpacing` support on `prepare()` and `prepareWithSegments()` (upstream PRs #108/#156). Our manual letterSpacing compensation in `src/measure-blocks.ts` and `src/rich-text.ts` continues to work unchanged — delegating to pretext's native path is tracked as Tier 1 follow-up in `docs/ROADMAP.md`. All 624 tests green, all 5 visual regression baselines green.

### Fixed

- **README badges matched to reality**: `runtime-deps-7` → `runtime-deps-8` (there are 8 direct `dependencies`, not 7), `tests-600+` → `tests-624` (the full `npm test` chain runs 624 tests across 5 subsuites). Drift guarded by a new CI step; see below.

### Added

- `scripts/verify-badges.js` + CI step — compares README shields.io badge values against `package.json` dep count and `npm test` total. Fails CI on drift. Fast path via `SKIP_TEST_RUN=1` for pre-commit use.
- `release` job in `ci.yml` — on `v*` tag push, auto-extracts the matching `## [X.Y.Z]` section from this file and creates the GitHub release (requires publish to succeed first). Closes the "tag exists but no release page" gap that affected v0.9.1. (Note: originally shipped as `.github/workflows/release-on-tag.yml`; merged into `ci.yml` for dependency ordering in Tier 0.5.)
- `renovate.json` — watches dependencies, auto-merges devDependency bumps that pass CI, opens PRs (without auto-merge) for runtime, peer, and `@chenglou/pretext` engine bumps. Closes the gap that left us one release behind upstream.

### Removed

- `test/smoke-staging.test.ts` — exercised a non-existent `{ type: 'paragraph', footnote: {...} }` shape that the permissive validator silently accepted. False coverage. A strict validator rollout (rejecting unknown element properties) is the root fix and is tracked as a Tier 1 item in the rewritten `docs/ROADMAP.md`.
- `src/brain/` — inert auto-logger artifact (34 blank-body entries, no active writer). Never published to npm.

### Docs

- `docs/ROADMAP.md` — complete rewrite as a living document (Now / Next / Under consideration / Shipped / History + Update discipline). The previous "master remediation plan" with phase-numbered sections was dropped: phases 0–5 all shipped by v0.9.1, and the document had rotted to the point of contradicting `package.json` on dependency pinning and `CHANGELOG.md` on what was live. History section preserves the prior plan's origin date and scope for reference.

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

## [0.7.2] — 2026-04-20

Phase 11 cross-cutting enhancements. Retroactively attributed to 0.7.2; these features were
originally left as `[Unreleased]` and published out of chronological order after 0.7.1.

### Added

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

### Fixed

- `resolveTokens()` used `.replace()` (replaces first occurrence only) — changed to `.replaceAll()` for all four tokens.
- Table span grid: continuation-row cursor was advancing by 1 instead of `colspan` when skipping a spanned column — now advances by full span width.
- Font family names now validated for safe characters (`/^[a-zA-Z0-9 _-]+$/`) in `requireFamily()` — rejects null bytes and control characters.
- Annotation `color` and `author` fields now validated in `validateElement()` for both `paragraph` and `heading` annotations.
- `buildOutlineTree` memoizes `parentIdxOf()` into a pre-computed array — eliminates O(n²) scan for documents with large heading counts.
- Table grid-line renderer pre-computes active boundary set — eliminates O(rows × cols) inner loop for large tables.
- `addLinkAnnotation()` re-validates URL scheme at render time (defense-in-depth; `validate.ts` is the primary gate).

---

## [0.7.1] — 2026-04-19

### Changed

- **Upstream pretext pinned to `f2014338487a`** — picks up unreleased CJK opening-bracket annotation fix, Hangul jamo line-walker alignment fix, and two internal line-object churn reductions. No public API changes.

### Fixed

- **List nesting depth enforced at validation** — `ListItem.items` (2nd-level items) now correctly rejects any further `.items` property, matching the documented 2-level maximum. Previously the validation silently passed 3-level data which could cause undefined render behaviour.
- **3 phase-11 list tests corrected** — test data incorrectly contained 3-level nesting while named "2-level"; data trimmed to match documented contract.

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
