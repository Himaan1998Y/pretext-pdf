# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to pretext-pdf are documented here.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

---

## [1.7.1] — 2026-05-27

Security hardening for SVG sanitizer + schema accuracy fix for signing fields.

### Security

- **SVG `<style>` block: strip `@import` rules** — `sanitizeSvg` now removes `@import` directives before any CSS can be used to trigger an outbound network request from the rasterizer. Previously only `expression()` was stripped from inline `<style>` blocks; `@import url('https://attacker.example/track.css')` would survive sanitization.

- **SVG `<style>` block: strip `url(javascript:|vbscript:|data:)` values** — Removes URL function calls using JS/vbscript/data schemes from style content, closing an injection path that bypasses the existing `<a href>` and `<image href>` filters (those only target *attribute values*, not *CSS property values*).

- **SVG `<style>` block: strip `url(https?://...)` values (defense-in-depth)** — SVGs embedded in PDFs have no legitimate reason to hot-link external stylesheets or background images. Removes all HTTP/HTTPS `url()` references from style blocks so the rasterizer cannot be coerced into outbound connections via crafted input.

### Fixed

- **`schema.ts` missing signing fields** — `signature` schema block was missing `p12`, `passphrase`, and `contactInfo` that were added to `SignatureSpec` in v1.7.0. JSON schema consumers (e.g. editors, the MCP generate_pdf tool) now see all valid signing inputs. The TypeScript type was always correct; this was a schema-only gap.

### Changed

- **`schema.ts` signature description** updated from "Visual signature placeholder drawn on a specified page" to reflect that providing `p12` enables PKCS#7 cryptographic signing; without `p12` a visual-only placeholder box is drawn.

---

## [1.7.0] — 2026-05-25

Signing path repaired. **No public API changes.** The cryptographic signing pipeline has been architecturally broken end-to-end since v1.3.6 — calling `render({ signature: { p12, passphrase } })` would fail with `SIGNATURE_FAILED: PDF signing failed: No ByteRangeStrings found within PDF buffer`. v1.7.0 fixes it with a surgical change inside `applySignature`.

### Fixed (critical)

- **Signing path was architecturally broken since v1.3.6**. Root cause: `applySignature` loaded the placeholder doc via `@cantoo/pdf-lib`'s `PDFDocument.load`, then handed it to `@signpdf/placeholder-pdf-lib.pdflibAddPlaceholder`, which internally builds `/ByteRange` using **upstream** `pdf-lib`'s `PDFArray`/`PDFNumber`/`PDFName` classes (it imports them directly from `"pdf-lib"`). Cantoo's serializer doesn't recognize upstream's class instances and emitted a malformed `/ByteRange` dict; `@signpdf/utils.findByteRange` then aborted parsing with `No ByteRangeStrings found within PDF buffer`. Fix: load the doc via **upstream `pdf-lib`** for the placeholder hop only. Encryption stays on `@cantoo/pdf-lib` in `applyEncryption` — the two paths are mutually exclusive via the existing `SIGNATURE_CERT_AND_ENCRYPTION` guard, so we never need both pdf-libs active simultaneously. The previously KNOWN-BROKEN `test/signatures-crypto.test.ts → P12 signature verifies cryptographically (real CMS verify)` is now unskipped and green.

### Added

- **AcroForm regression assertion** inside `test/signatures-crypto.test.ts`. Any valid signed PDF must carry `/AcroForm`, `/Fields [...]`, `/SigFlags 3`, and a `/Type /Sig` object — these four properties are asserted on the signed bytes so a future regression that loses AcroForm structure surfaces immediately.
- **Signature path snapshot tripwire** (`test/signatures-snapshot.test.ts` + `test/data/signatures-snapshot.json`). Captures the categorical structural shape of a signed PDF (presence of `/ByteRange`, `/AcroForm`, `/SigFlags` value, etc.) rather than byte offsets (which are document- and randomness-dependent). Wired into `test:phases`. Regenerate with `UPDATE_SNAPSHOT=1`.

### Changed

- **`pdf-lib` declared as an explicit optional peer dependency** (`^1.17.1`). It was previously only present transitively via `@signpdf/placeholder-pdf-lib`'s `dependencies`. Now it's a documented peer with `peerDependenciesMeta.pdf-lib.optional: true`, mirroring the existing `@signpdf/*` pattern. Users with `@signpdf/*` already installed need no action — npm satisfies the new peer from the existing transitive install.
- **`SIGNATURE_DEP_MISSING` error message** now lists `pdf-lib` alongside the three `@signpdf/*` packages and drops the "currently non-functional due to fork incompatibility" disclaimer that was added in v1.3.6.

### Migration

None. Same `signature: { p12, passphrase, reason, contactInfo, signerName, location, page, invisible }` config. Same error codes (`SIGNATURE_DEP_MISSING`, `SIGNATURE_P12_LOAD_FAILED`, `SIGNATURE_FAILED`, `SIGNATURE_CERT_AND_ENCRYPTION`). One error message string changed: `SIGNATURE_DEP_MISSING` now mentions `pdf-lib` and no longer carries the "non-functional" disclaimer.

### Verification

- All 456 tests pass (was 454 pass + 1 skipped pre-fix; now 455 pass after unskip + 1 new snapshot test = 456 total).
- Encryption-after-signing path still rejected with `SIGNATURE_CERT_AND_ENCRYPTION` (regression-tested).
- All 7 v1.6.0 verification gates (G1–G7) still pass.

---

## [1.6.0] — 2026-05-25

Internal restructuring + SVG sanitizer hardening. **No public API changes.** The previously-monolithic `src/assets.ts` (961 lines pre-sprint) has been split into 10 focused files under `src/assets/`. A 14-line back-compat shim at `src/assets.ts` re-exports the barrel so every existing consumer (internal modules, public API, and direct test imports via `dist/assets.js`) keeps working unchanged.

### Security

- **SVG sanitizer hardening** — `sanitizeSvg` now strips three additional payload classes that survived the previous regex chain:
  - **`<foreignObject>` blocks** — the only XML-in-SVG construct that can host arbitrary HTML/XML namespaces. Both self-closing and paired forms are removed wholesale; sibling SVG primitives (`<rect/>`, `<path/>`, etc.) are preserved.
  - **`javascript:` / `vbscript:` / `data:` hrefs on `<a>` elements** — previously only `<image>`/`<use>` hrefs were filtered. Only the dangerous href attribute is dropped, so the `<a>` element's text children still render.
  - **CSS `expression(...)` calls inside `<style>` blocks** — legacy IE XSS vector. Only the `expression(...)` call site is excised; the surrounding stylesheet remains parseable.

  Coverage: new `test/svg-sanitizer.test.ts` (10 cases) plus expanded MA-4 / MA-5 fixtures in `test/data/assets-split-tripwire.json` (30 fixtures total).

### Changed

- **`src/assets.ts` split into 10 files** under `src/assets/` (see Internal). No public API change — the file at `src/assets.ts` is now a 14-line re-export shim that aggregates the new barrel `src/assets/index.ts`. Consumers importing from `dist/assets.js` continue to resolve every previously-public symbol (`loadImages`, `assertPathAllowed`, `sanitizeSvg`, `assertSafeUrl`, `resolveAndValidateUrl`, `normalizeIpv4Hostname`, `fetchWithTimeout`, `redactPath`, `VECTOR_RASTER_CONCURRENCY`, plus the `ResolvedSafeUrl` type) at the same module path.
- **`PretextPdfError` constructor signature snapshot refreshed** — `etc/pretext-pdf.api.md` now reflects the `options?: ErrorOptions` parameter that was added in v1.2.1 but never re-snapshotted. No code change — the parameter has been live for several releases. The snapshot was stale; this release reconciles it.

### Internal

- **New `src/assets/` directory layout:**
  ```
  src/assets/
  ├── index.ts                    # internal barrel
  ├── util/
  │   └── redact-path.ts          # commit 4
  ├── security/
  │   ├── path-allowlist.ts       # commit 5
  │   ├── ipv4-normalize.ts       # commit 6
  │   ├── url-validation.ts       # commit 7
  │   └── fetch.ts                # commit 8 (undici Agent stays lazy)
  ├── svg/
  │   ├── sanitize.ts             # commit 9 (+ SVG_MAX_BYTES)
  │   ├── dimensions.ts           # commit 10
  │   ├── resolve-content.ts      # commit 10
  │   └── rasterize.ts            # commit 11 (@napi-rs/canvas dynamic)
  ├── generators/
  │   ├── qr.ts                   # commit 12 (qrcode dynamic)
  │   ├── barcode.ts              # commit 12 (bwip-js dynamic)
  │   └── chart.ts                # commit 12 (vega/vega-lite dynamic)
  └── loaders/
      ├── images.ts               # commit 13
      ├── vectors.ts              # commit 14
      ├── watermark.ts            # commit 15
      └── orchestrator.ts         # commit 15 (top-level loadImages)
  ```
  All optional peer-dependency dynamic imports (`@napi-rs/canvas`, `qrcode`, `bwip-js`, `vega`, `vega-lite`, `undici`) are preserved as lazy loads — cold-start cost is unchanged.
- **7 verification gates (G1–G7) added** to catch regressions during the split:
  - **G1** Snapshot tripwire (`test/assets-split-tripwire.test.ts`) — 30 fixtures covering sanitizer output, URL normalization, path allowlist, and error code surface
  - **G2** DNS lookup dedup (`test/assets-dns-dedup.test.ts`)
  - **G3** SSRF blocking (`test/security-ssrf.test.ts`, expanded)
  - **G4** Parallel-render concurrency (`test/assets-concurrency.test.ts`) — 10× concurrent `render()` calls must produce bit-identical PDFs
  - **G5** ErrorCode stability (`test/assets-errorcode-stability.test.ts`)
  - **G6** api-extractor diff against `etc/pretext-pdf.api.md`
  - **G7** Cold-start perf (`test/assets-perf-coldstart.test.ts`, baseline at `test/data/perf-coldstart-baseline.json`) — 100 sequential renders within 2.5× the v1.5.2 baseline
- **G7 measurement on the final shim**: 12,224ms / 100 renders (vs 21,205ms baseline = -42%, i.e. the split happens to be *faster*, well under the upper bound).

---

## [1.5.2] — 2026-05-25

Security hotfix. **No public API changes.** **Upgrade recommended for any deployment that accepts user-controlled image / SVG URLs.**

### Security

- **CVE-class SSRF bypass via IPv4 alternative notations** — `isPrivateAddress` in `src/assets.ts` applied dotted-decimal regexes (`/^127\./`, `/^10\./`, …) against `URL#hostname`. The WHATWG URL parser does NOT normalize non-dotted IPv4 forms, so an attacker could reach private services by encoding the target in any inet_aton-compatible form:
  - Pure decimal: `https://2130706433/x` → 127.0.0.1
  - Pure hex: `https://0x7f000001/x` → 127.0.0.1
  - Octal octet: `https://0177.0.0.1/x` → 127.0.0.1
  - Hex octet: `https://0x7f.0.0.1/x` → 127.0.0.1
  - Short form: `https://127.1/x` → 127.0.0.1

  Without normalization, `parsed.hostname` is e.g. `"2130706433"`, the private-range regex chain misses it, the `isIpv4Literal` (4-dot) check misses it, and the URL falls through to DNS — which on Linux's `getaddrinfo` resolves to 127.0.0.1 and bypasses the SSRF guard. Same vector reaches RFC 1918 ranges (10/8, 192.168/16, 172.16/12), link-local (169.254.169.254 — AWS IMDS), and CGNAT.

  **Fix:** new internal helper `normalizeIpv4Hostname()` implements inet_aton-style parsing (decimal/octal/hex per part, short-form packing for 1/2/3-part inputs, strict 32-bit range guard). `resolveAndValidateUrl` normalizes before the private-IP check AND before DNS, then treats the normalized form as an IP literal so undici never re-resolves a non-dotted private encoding. `isPrivateAddress` also normalizes its input as defense-in-depth on the post-DNS path. Public alternative encodings (e.g. `134744072` == 8.8.8.8) continue to resolve and fetch normally.

  **Test coverage:** new `test/security-ipv4-bypass.test.ts` adds 24 cases — every blocked encoding above, public regression cases, plus direct unit tests for `normalizeIpv4Hostname` (round-trips, range guards, malformed-octal rejection, public-IP allowlist). Wired into the `test:phases` stage; phases stage grows from 417 to 441 tests.

### Fixed

- **`measure-blocks/float-group.ts` — fontSize fallback intent clarified** — v1.5.1 M5a removed a dead `baseFontSize = doc.defaultFontSize ?? 12` plus per-block `fontSize = block.fontSize || baseFontSize` local that was never read (the item assignment used `block.fontSize` directly). Audit of upstream measure helpers (measure-paragraph, measure-heading, …) confirms `block.fontSize` is always populated with a positive value for real content, so the fallback would never have fired in practice. Added a leading comment so future contributors don't reintroduce the fallback in the mistaken belief that `block.fontSize === 0` is a real case. No behavior change.

---

## [1.5.1] — 2026-05-24

Hotfix batch closing 9 audit findings from the 6-agent v1.5.0 review. **No public API changes** — guarded by `test/public-api-surface.test.ts`. **No behavior changes other than the documented fixes**. Snapshot baseline expanded from 68 to 73 fixtures (5 new: 2 metadata.keywords + 3 watermark.image).

### Security

- **Watermark image URL scheme validation (H1)** — `doc.watermark.image` now passes through the same `validateUrl` pre-flight check used by `validateImage`. Unsafe schemes (`javascript:`, `data:`, `vbscript:`, `blob:`, `about:`, `file:`) are rejected at validate-time so CLI lint and MCP validate tools catch them before render. Relative file paths fall through unchanged. The shared URL-shape helper `looksLikeUrl` was moved from `validate/elements/media.ts` to `validate/helpers.ts`.

### Fixed

- **`metadata.keywords[]` element validation (H3)** — Previously, `for (const field of [...'keywords'...])` was paired with `typeof val === 'string'`, which silently no-op'd for the `string[]`-shaped `keywords` field. Each keyword entry is now validated for control-character injection and the 1000-character length cap via `validateMetadataString(kw, \`keywords[\${i}]\`)`.
- **highlight.js dynamic-import error logging (H4)** — Previously, `catch { /* not installed */ }` silently swallowed every failure including real module-load errors. The catch now logs a warning unless the error code is `ERR_MODULE_NOT_FOUND`/`MODULE_NOT_FOUND` (the only legitimate "optional dep absent" signal).
- **`hljs.highlight()` runtime exception logging (M2)** — Same silent-fallback issue as H4 but for tokenization failures. Now logs a warning naming the language before falling back to plain text.
- **Font-variant registration logging (M3)** — `installNodePolyfill` now tracks per-variant success and warns when an individual Inter weight (400 or 700) fails to register, instead of only warning when *both* failed. Text metrics for the missing variant may be inaccurate; operators see this in logs.

### Changed

- **Removed redundant `as import('...').X` casts in `validate/elements/forms-floats.ts` (M1)** — `validateFormField`, `validateFootnoteDef`, and `validateFloatGroup` already accept `Extract<ContentElement, { type: 'X' }>`-typed `el`. The inner `const ff = el as FormFieldElement` casts were no-ops; removed.
- **Removed unreachable `toc-entry` validator (M4)** — The pre-switch throw at `validate/index.ts:260` already rejects `toc-entry` before dispatch. The `case 'toc-entry':` arm (guarded with `@ts-expect-error`) and the `validateTocEntry` function in `validate/elements/structural-simple.ts` were unreachable dead code. Drift-guard test updated with `VALIDATE_DISPATCHER_EXCLUDES` (mirrors the existing `MEASURE_DISPATCHER_EXCLUDES` pattern) to keep the orchestrator scan honest.
- **tsconfig: `noUnusedParameters` + `noUnusedLocals` enabled (M5a)** — Catches dead destructured locals and unused imports at build time. Cascade: 51 errors → 0. 30 of those were per-type `type _X = Exact<...>` drift guards in `allowed-props.ts` (load-bearing scaffolding) — consolidated into a single exported tuple `_AllowedPropsDriftGuard` that TypeScript counts as used. The remaining 20 were genuine unused-locals / unused-imports cleanup across measure, render, rich-text, and assets modules.
- **tsconfig: `verbatimModuleSyntax` enabled (M5b)** — Enforces `import type` discipline. Cascade was only 6 errors, all `HyphenatorOpts` runtime imports that needed splitting into `import type`. Well under the 30-line cascade-defer threshold.

---

## [1.5.0] — 2026-05-24

Architecture sprint completing the v1.4.0 god-file split debt. Six items shipped, single minor release. **No public API changes** — guarded by `test/public-api-surface.test.ts`. **No behavioral changes** — Item A's security-critical extraction guarded by new `test/validate-document-snapshot.test.ts` (68 fixtures, bit-exact preservation verified).

### Changed (internal structure — non-breaking)

- **`src/validate/index.ts` (594L) → orchestrator (322L) + `src/validate/document.ts` (324L)** —
  Extracted 11 doc-level check categories (pageSize, margins, fonts, header/footer, defaultParagraphStyle, sections, watermark, encryption, signature, bookmarks, hyphenation, metadata) into a new `validateDocumentLevel(doc, ctx)` function. Single function with labeled `// ── name ──` blocks. **Security-critical**: snapshot tripwire test (68 fixtures across all 11 categories) verified bit-exact error preservation through the move.
- **`src/measure-blocks/index.ts` (337L) → dispatcher (243L) + `src/measure-blocks/simple-blocks.ts` (151L)** —
  Extracted 7 simple measurement arms (spacer, page-break, comment, form-field, hr, toc, footnote-def). Throw-guards for image/svg/qr-code/barcode/chart stay in dispatcher (security invariants tied to routing).
- **`src/validate/elements/structural.ts` (239L grab-bag) → `structural-simple.ts` (120L) + `forms-floats.ts` (128L)** —
  Split light element validators (spacer, hr, toc, toc-entry, comment) from heavy ones (form-field, footnote-def, float-group). Cleaner separation of concerns.

### Added

- **`src/validate/elements/README.md`** — Placement guide + validator signature contract + `_ctx` policy documentation + `withCycleGuard` usage guidance. Onboarding aid for adding new element types.
- **`test/validate-document-snapshot.test.ts`** + `test/data/validate-document-snapshot.json` — Bit-exact error preservation tripwire for `validateDocumentLevel`. 68 fixtures across pageSize, margins, fonts, header/footer, defaultParagraphStyle, sections, watermark, encryption, signature, bookmarks, hyphenation, metadata, content guards, and valid-doc sanity cases.

### Fixed

- **`dist/` no longer tracked in git** (168 files removed) — was already in `.gitignore` but tracked from prior history.

### Notes

- 12 commits across 6 items, each independently revertable via the 3-commit-per-split pattern (stage → route → delete) proven in v1.4.0.
- Test suite: 416 pass / 1 skip / 0 fail throughout the sprint, plus the new snapshot tripwire test (passes against generated baseline).
- Public API surface unchanged: 15 runtime exports × 6 entry points.
- `_ctx` policy decision: keep underscore-prefixed param for validators that don't currently consume context. Documented in `validate/elements/README.md` — stable signature lets future strict-mode or context-aware checks be added without changing call sites.
- `loadedFamilies` initialization order: populated after `validateDocumentLevel` returns. Audit confirmed no order dependency — `document.ts` never reads `loadedFamilies`, only `validateFontSpec` for shape validation.
- Path-traversal pre-flight in `validateImage` deferred to v2.0 — runtime SSRF + `allowedFileDirs` guards already provide defense-in-depth.

---

## [1.4.1] — 2026-05-23

Cleanup batch addressing audit findings surfaced by the v1.4.0 god-file split. Five MEDIUM-severity items, all internal — no public API changes, no behavioral changes for callers using documented schemas. Test suite unchanged: 416 pass / 1 skip / 0 fail.

### Fixed

- **M1 — Dead outer `withCycleGuard` removed from `validateElement` dispatcher (`src/validate/index.ts`).** The dispatcher wrapped `list` and `float-group` cases in an outer `withCycleGuard` with an empty body, then the inner element validators (`validateList` in `elements/list.ts`, `validateFloatGroup` in `elements/structural.ts`) immediately opened their own guard on the same element. The outer guard ran a no-op body and `finally`-deleted the element from `seen` BEFORE the inner guard added it — dead code communicating false intent. The inner validators own the guard. Import of `withCycleGuard` also dropped from `index.ts` since it is no longer used there.
- **M2 — `measure-blocks/float-group.ts ↔ measure-blocks/index.ts` runtime cycle broken (Option C: dependency injection).** `float-group.ts` previously imported `measureBlock` from `./index.js`, while `index.ts` re-exported `measureFloatGroup` from `./float-group.js` — a real ESM cycle that hoisting tolerated but which violated module-boundary discipline. Resolved by promoting `measureBlock` to an explicit parameter of `measureFloatGroup` (new exported `MeasureBlockFn` type). The sole caller (the orchestrator in `measure.ts`) already has `measureBlock` in scope, so the change is non-invasive. Option C was chosen over Option A (inlining the dispatch — too much duplication) and Option B (extracting `dispatch.ts` — restructured more than needed for a one-edge cycle).

### Changed

- **M3 — Concurrent validate test annotated with sync-vs-async semantics (`test/validate-concurrent.test.ts`).** Added a comment block above the parallel-validate `describe` clarifying that `validateDocument` is synchronous, so `Promise.all` over it cannot exercise real concurrent execution. The test now explicitly documents what it does prove (shape stability across N invocations) versus what it does not (concurrent isolation — guaranteed structurally by the per-call `WeakSet` opened at the top of `validate()` in `src/validate/index.ts`). The async render-path tests later in the same file DO exercise real concurrency because `render()` crosses `await` boundaries.
- **M4 — Benchmark harness upgraded (`scripts/run-bench-snapshot.mjs`).** Default measured runs raised from 3 to 10. New `--runs N` CLI flag for callers to override (CI: 5, dev: 3, full: 10). Output now reports `median`, `p90`, and `min` in addition to `avg`. Variance on cold-tsx invocations can hit ±70%, which made any <10% regression gate meaningless at N=3.

### Added

- **M5 — URL scheme check in `validateImage` (`src/validate/elements/media.ts`).** When `el.src` is a string that looks like a URL (matches `data:`, `javascript:`, `vbscript:`, `blob:`, `about:`, `file:`, or any `scheme://` form), the validator now routes through `validateUrl` from `validate/helpers.ts`. Matches the runtime SSRF guard's posture in `src/compat.ts` so validate-only callers (CLI lint, MCP `validate_document` tool) catch unsafe schemes pre-flight instead of letting them through to the asset-loader guard. http/https/ftp/mailto/anchor links still pass.

---

## [1.4.0] — 2026-05-23

Architecture sprint: four god-files split into thin orchestrators + cohesive sub-modules. **No public API changes** — guarded by `test/public-api-surface.test.ts` (15 runtime exports across 6 entry points, snapshot tripwire). 12 granular commits, each independently revertable.

### Changed (internal structure — non-breaking)

- **`src/validate.ts` (1834L) → `src/validate/` (9 files, ~250L each)** —
  `validate/index.ts` orchestrator + `helpers.ts`, `fonts.ts`, `errors.ts`, and per-element validators under `elements/`. Introduced explicit `ValidationContext` ({ errors, strict, loadedFamilies, seen, options }) threaded into every element validator instead of relying on closure-captured locals. Per-call `WeakSet` for cycle detection — concurrent isolation verified by `test/validate-concurrent.test.ts`.
- **`src/measure-blocks.ts` (1600L) → `src/measure-blocks/` (10 files)** —
  `measure-blocks/index.ts` dispatcher + `text-blocks.ts`, `list.ts`, `image.ts`, `float-group.ts`, `highlight.ts`, `helpers.ts`, plus `table/{measure,spans,columns}.ts`. Added explicit case arms for `qr-code`, `barcode`, `chart` (previously fell through to "Unknown element type"). `_hljsCache` intentionally remains module-scoped in `highlight.ts` — idempotent process-wide cache, not concurrent-isolated state.
- **`src/render-blocks.ts` (1277L) → `src/render-blocks/` (13 files)** —
  Per-render-function modules. Each independent (no shared state). Dropped four unused imports from the original (`PDFFont`, `PDFName`, `renderTocEntry`, `renderFormField` — never referenced).
- **`src/types-public.ts` (1200L) → `src/types-public/` (8 files)** —
  Split by domain: `document.ts`, `elements-{text,block,media}.ts`, `union.ts`, `validation.ts`, `render-options.ts`. Type-only intra-package cycles are erased at runtime (verified by clean tsc build).

### Added

- **`test/drift-guards.test.ts` — measure-blocks dispatcher case-arm guard.** New invariant mirrors the existing validate + render guards: every `ELEMENT_TYPES` entry must have an explicit `case` arm in `src/measure-blocks/index.ts` (except internal `toc-entry`). Catches future additions to `ELEMENT_TYPES` that forget to handle measurement.

### Fixed

- **Dead imports removed:** `validate` was imported but never used in `src/builder.ts` after the split. Removed.
- **Unused locals/params:** `lineHeight` in `float-group.ts` and `table/measure.ts` (computed but never read); `doc` param in `measureCallout` and `measureCode` (preserved as `_doc` for signature compatibility, signals intentional non-use).

### Notes

- Public API surface tripwire: 15 runtime exports across 6 entry points, all unchanged.
- Benchmark gate: 5/7 corpora within 5% of v1.3.4; two corpora (`rich-text-mixed-spans` +12.9%, `table-stress` +7.2%) breach but match documented run-to-run variance (5-10% noise on dev machine). Cold-start module-load unchanged. CI re-snapshot recommended to disambiguate variance from regression.
- Known follow-up: ESM-fragile circular import in `measure-blocks/float-group.ts` ↔ `measure-blocks/index.ts` (load-safe today because `measureBlock` is async-runtime only; revisit if top-level `await` is ever added).
- Known follow-up: type-only intra-cycles in `types-public/` (no runtime risk — erased at compile time).

---

## [1.3.6] — 2026-05-23

Architecture-sprint scaffolding release: vendor integrity check, concurrent isolation tests, signing import correctness, public API tripwire.

### Added

- **Boot-time vendor integrity check (#12)** — `src/version-check.ts` exports `assertVendorIntegrity()`, called once at the start of every `render()`. Verifies the vendored pretext version (`src/vendor/pretext/VERSION.ts`) is in the compatible range. Warns (does not throw) on drift. Inline semver matcher avoids adding a `semver` dependency.
- **Concurrent validate/render isolation tests (#25)** — `test/validate-concurrent.test.ts` exercises 8 parallel `validate()` calls plus 4 parallel `render()` calls across different fonts AND different scripts (en/he/ar/th). Byte-identical fingerprints between parallel and sequential runs prove `vendor/pretext/measurement.ts` and `vendor/pretext/analysis.ts` shared state holds up under concurrent use.
- **Public API surface tripwire** — `test/public-api-surface.test.ts` snapshots all 15 runtime exports across 6 entry points. Will guard against accidental API drift during the upcoming v1.4.0 god-file splits.
- **P12/CMS crypto verification test (#26)** — `test/signatures-crypto.test.ts` adds a real `crypto.createVerify('RSA-SHA256')` round-trip with positive + negative cases. **Currently `t.skip`'d** — see KNOWN ISSUES below.
- **`pretextPdf.mcpCompat`** field in `package.json` — declares `>=1.4.0 <2.0.0` compatibility range for the pretext-pdf-mcp consumer. MCP-side check ships separately.

### Fixed

- **`signpdf` v3 API + import correctness** — `src/post-process.ts` was destructuring `pdflibAddPlaceholder` from `@signpdf/signpdf` where it does not exist; the symbol lives in `@signpdf/placeholder-pdf-lib`. Also updated to the v3 API (`new P12Signer(buffer, { passphrase })` instead of `signer.sign(buffer, { passphrase })`). Added `@signpdf/placeholder-pdf-lib` and `@signpdf/signer-p12` to `peerDependencies` + `peerDependenciesMeta.optional` (mirroring `@signpdf/signpdf`).
- **`SIGNATURE_DEP_MISSING` error message** — now identifies exactly which `@signpdf/*` packages are missing and tells the user which to install, instead of always listing all three.

### KNOWN ISSUES (deferred to follow-up sprint)

- **Signing path is architecturally non-functional** — even with correct imports, `@cantoo/pdf-lib`'s serializer is fork-incompatible with `@signpdf/placeholder-pdf-lib`. The placeholder ByteRange dict is emitted in a shape that `@signpdf/utils.findByteRange` cannot parse. End-to-end signing has never worked. The crypto verify test (#26) is correctly written and ready to run once signing is repaired. Three fix paths exist: `@signpdf/placeholder-plain` swap (breaks AcroForm), porting placeholder-pdf-lib onto cantoo primitives, or a merge-bytes approach. None are in v1.3.6 scope. The `SIGNATURE_DEP_MISSING` message now pre-warns callers.

## [1.3.5] — 2026-05-22

### Fixed

- **`toc-entry` drift-guard regression** —
  `test/drift-guards.test.ts` was failing because `src/validate.ts` had no
  `case 'toc-entry':` arm. `toc-entry` elements are produced internally by
  the TOC two-pass processor, but the drift guard correctly insists every
  registered `ElementType` has a validator case. Added a defensive validator
  for `text`, `pageNumber`, `level`, `levelIndent`, and `leader` so
  user-authored `toc-entry` payloads (rare but possible) fail loud instead
  of slipping through.

### Removed

- **`test/pretext-api-contract.test.ts`** —
  Reframed in v1.3.3 as a local export-shape guard for the vendored pretext
  layout module, but the test was tautological: it could only fail if
  someone hand-edited `src/vendor/pretext/*.ts` to remove an export, in
  which case TypeScript would already fail the build. Deleted along with
  its entry in the `test:contract` npm script. Drift guards in
  `test/drift-guards.test.ts` cover the real risk (registry vs. switch
  arms going out of sync).

### Performance

- **v1.3.2+ benchmark numbers captured** —
  Re-ran the seven core corpora against `benchmarks/benchmark-baseline.json`
  (recorded 2026-04-10 at v1.3.0). Results documented in
  `benchmarks/v1.3.2-results.md`: ~1.66x geometric-mean speedup across
  corpora, with the largest wins on text-heavy workloads (table-stress
  -52%, punctuation-heavy -51%, rtl-layout -43%). Confirms the DNS dedup,
  parallel raster, and word-width cache work landed in v1.3.2 was real
  rather than aspirational.

### Docs

- **README version table extended** —
  Added 1.1.x (vendor switch), 1.2.x (security + benchmarks), and
  1.3.0–1.3.4 (perf + drift guards) rows so the version table no longer
  stops at 1.0.6.

### Tooling

- **`scripts/run-bench-snapshot.mjs`** —
  Small one-shot runner that prints avg/min render time per corpus across
  three measured runs (after a warmup). Used to capture the v1.3.5
  benchmark results above; useful for ad-hoc perf checks without touching
  the regression-guarded `test/benchmark-baseline.test.ts`.

---

## [1.3.4] — 2026-05-17

### Fixed

- **DNS dedup test now imports from source** —
  `test/assets-dns-dedup.test.ts` previously imported `fetchWithTimeout` /
  `assertSafeUrl` from `../dist/assets.js`, which would silently pass against
  a stale build (false confidence). Switched to `../src/assets.js` so the
  test always runs against the current source tree under tsx.

### Added

- **FIFO eviction boundary test for word-width cache** —
  `test/measure-text-cache.test.ts` now asserts that when the cache is
  pre-filled to `WORD_WIDTH_CACHE_MAX` and a new `measureWord` call is made,
  `cache.size` stays at the cap, the oldest insertion (`syn0`) is evicted,
  and a re-accessed entry (`syn1`) survives — proving FIFO semantics, not LRU.

### Changed

- **Constant tunability scope documented** — `VECTOR_RASTER_CONCURRENCY` and
  `WORD_WIDTH_CACHE_MAX` are exported as read-only constants for observability
  and test introspection. Consumers wanting different values must fork;
  runtime tunability (env vars or options) is a future enhancement and not
  planned for the v1.x line.

---

## [1.3.3] — 2026-05-17

### Fixed

- **Parallel rasterization concurrency cap** — `loadVectorAssets` now runs at
  most 4 SVG/QR/barcode/chart rasterization tasks concurrently (was unbounded).
  Prevents file-descriptor / worker exhaustion on documents with many vector
  assets. New exported constant: `VECTOR_RASTER_CONCURRENCY`.
- **Word-width cache memory bound** — `measureWord` now FIFO-evicts at 50,000
  entries to bound memory for long-running processes that reuse a single
  `wordWidthCache`. New exported constant: `WORD_WIDTH_CACHE_MAX`.

### Changed

- **Pretext API contract test reframed** — `test/pretext-api-contract.test.ts`
  header clarified: this is a local export-shape guard for the vendored
  pretext layout module, not an upstream version canary. Pretext has been
  vendored at `src/vendor/pretext/` since v1.1.0.
- **CHANGELOG clarification on v1.3.2 parallel rasterization** — see updated
  v1.3.2 entry below; the speedup is real for I/O-bound fan-out, but CPU
  rasterization still serializes on the V8 main thread.

### Documented (not changed)

- **Word-width cache scope (H1)** — the cache is currently consulted on the
  hyphenation path (`measureTextWithHyphenation`) only. The non-hyphenation
  branch of `measureText` delegates directly to pretext's `layoutWithLines`
  to preserve CJK character-level breaking, RTL/bidi, Thai segmentation,
  kerning, and justify semantics that word-by-word summing would diverge
  from. Documents that do not configure a hyphenator will not see
  cross-paragraph cache reuse; this is intentional for correctness.

---

## [1.3.2] — 2026-05-17

### Performance

- Removed double DNS resolution in image/SVG fetch (one lookup per remote asset, not two)
- Parallel SVG/QR/barcode generation+rasterization (sequential embed retained for pdf-lib safety)
  - Sub-note (added in v1.3.3): the parallelism is real for the I/O-bound fan-out
    (remote SVG fetches overlap). CPU rasterization (sharp/svg2pdfkit) still
    contends on the V8 main thread, so wall-clock improvement is dominated by
    remote-asset latency, not raster throughput.
- Document-level word-width measurement cache (cross-paragraph dedup of common-word measurements)
  - Sub-note (added in v1.3.3): the cache is consulted on the hyphenation code
    path only. See v1.3.3 "Documented (not changed)" for the rationale.

---

## [1.3.1] — 2026-05-17

### Fixed

- Internal test fixtures updated to set `allowedFileDirs` (resolved with `path.resolve` for Windows drive-letter compatibility) after the v1.2.2 deny-by-default flip — no library behavior change. Affected: `signatures-crypto`, `signatures-validation`, `svg`, `image-floats` test files.
- `markdown-gfm` compat test updated to use an `https:` image src; `data:` URLs are blocked by the scheme guard added in v1.3.0, so the pre-existing fixture no longer round-tripped — test-only change.

---

## [1.3.0] — 2026-05-17

### ⚠️ BREAKING (retroactive note covering v1.2.2)

- **`assertPathAllowed` is now deny-by-default.** Documents using `file://` image sources without an explicit `allowedFileDirs` configuration will throw `PATH_TRAVERSAL`. This was shipped in v1.2.2 as a security fix but is technically a breaking change — consumers on `^1.2.0` who upgrade past v1.2.1 must either set `allowedFileDirs` or migrate away from `file://` sources. v1.3.0 is the recommended upgrade target with full semver signal.

### Fixed

- **Scheme guard whitespace bypass** in `compat.ts` — leading whitespace in image src (e.g. `" file:///etc/passwd"`) no longer bypasses scheme stripping.
- **Extended scheme blocklist** in `compat.ts` — added `vbscript:`, `blob:`, `about:` alongside existing `file://`, `data:`, `javascript:`.

### Tests

- Added redirect-chain SSRF test using a local mock HTTP server.
- Pinned CLI exit-code assertion to detect regressions.

---

## [1.2.2] — 2026-05-17

### Security

- **`assertPathAllowed` is now deny-by-default** — Previously, when `doc.allowedFileDirs` was
  undefined or empty, local file:// paths were silently allowed. Now the function throws
  `PATH_TRAVERSAL` unless `allowedFileDirs` is explicitly configured with at least one directory.
  This closes an unintended open-access footgun for server-side deployments.

- **`compat.ts` — dangerous image schemes stripped in `fromPdfmake`** — `file://`, `data:`, and
  `javascript:` image `src` values are now silently dropped during pdfmake→pretext-pdf translation
  rather than forwarded verbatim. This prevents the compat shim from acting as an indirect
  bypass for the scheme-level SSRF guards in `assets.ts`.

- **`compat.ts` — `allowedFileDirs` forwarded from `PdfmakeDocument`** — The `PdfmakeDocument`
  interface now accepts `allowedFileDirs?: string[]`, which is forwarded into the resulting
  `PdfDocument`. Callers who previously passed file paths via the compat shim can now
  allowlist their directories explicitly.

- **CLI validates before rendering** — `pretext-pdf` now calls `validateDocument()` before
  invoking `render()`. Invalid documents produce a `VALIDATION_ERROR` message on stderr and
  exit with code 1, avoiding wasted work during the render phase.

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
