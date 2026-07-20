# pretext-pdf — Roadmap

**Last updated:** 2026-07-20 · **Current version:** 2.1.1

This is a **living document**. See [Update discipline](#update-discipline) at the bottom for how and when this file is touched.

---

## Now

**Publishing v2.1.1** — dependency security fix (`undici` HIGH-severity CVEs) plus a repair of the release pipeline itself. This release surfaced that CI had been silently broken for at least two months (every run back through 2026-05-30 failed), across three independent gates, which is why 2.0.x/2.1.0 all went out via manual `npm publish` instead of the tagged CI pipeline. All three are now fixed and verified green in an actual GitHub Actions run:

1. README badges had drifted from `package.json`/test reality (`runtime-deps` count, `tests` count format).
2. `etc/pretext-pdf.api.md` (the committed API-surface snapshot) hadn't been regenerated since roughly v1.0.0 — missing exports, stale `@beta`/`@public` tags, missing `readonly` modifiers.
3. `examples/phase8-forms.ts` used an invalid form-field option value (`'10+'`), failing the CI example-smoke step since whenever option-value validation was tightened.

The `v2.1.1` tag is pushed and both test-matrix jobs (Node 20.x, 22.x) pass in full. The `publish` job itself is blocked on an expired `NPM_TOKEN` GitHub secret (last rotated 2026-04-13) — rotation is in progress.

---

## Next

Ordered backlog. No dates — tiers only. Effort tags: **S** (≤½ day) · **M** (½–2 days) · **L** (> 2 days).

### Tier 1 — Must, this month

| Item | Why | Effort |
| --- | --- | --- |
| **Document the actual release process** (`CONTRIBUTING.md` or a new `docs/RELEASING.md`) | Nobody has been following the tag-triggered pipeline for at least two months — releases went out via manual local `npm publish`, which is how the CI breaks in "Now" went unnoticed. Needs: version bump → CHANGELOG entry → commit → tag → push → verify all 3 CI jobs before considering it shipped. | S |
| **Rotate `NPM_TOKEN` before every expiry, not after** | This release was blocked by a token that silently expired ~1 month before anyone tried to publish through CI. Add a calendar reminder or, better, use a token type/expiry that outlives the release cadence. | S |
| **Re-scope the upstream `pretext` tracking decision** | The old Tier 2 item ("rebase PR #81 or close") assumed a small, trackable delta. The fork is now 410 commits behind `upstream/main` and 295 commits ahead — effectively fully diverged. The real question is whether tracking upstream is still worth the overhead at all, not whether to rebase one PR. | M |
| **`CONTRIBUTING.md`: "how to add a new element type" walkthrough** | Still missing (carried over from the pre-2026-05 roadmap — verified not done). Lowers time-to-first-PR for external contributors. `src/validate/elements/README.md` already documents the validator-signature contract; this item is about a full add-a-type walkthrough spanning schema, validate, measure, render. | M |

### Tier 2 — Should, this quarter

| Item | Why | Effort |
| --- | --- | --- |
| **Local pre-tag verification script** bundling `npm run build && npm run api:check && npm run verify:badges:full && npm audit --audit-level=high && npm test && npm run example:watermark ... (all examples)` | Every gate that broke CI this session (badges, api:check, examples) is independently cheap to check locally in under 2 minutes. A single `npm run verify:release` would have caught all three before they ever reached a tag push. | S |
| **Fresh ADR if v3 breaking-change work resumes** | The abandoned `v3.0.0-rc.1` tag ("readonly array fields, breaking") was deleted this session — it was never published, and wasn't an ancestor of `master`. If v3 planning resumes (the callout `content`→`text` rename is already deprecated toward v3 per the 2.1.0 CHANGELOG), start it from a new ADR in `docs/adr/`, not by reviving the old branch. | S |
| **Test the example scripts as part of any local pre-release check**, not just in CI | `examples/phase8-forms.ts` had been broken for who knows how long because the only place it ran was a CI pipeline nobody was watching. Folding these into a local `verify:release` script (see row above) fixes this permanently. | (covered above) |

### Tier 3 — post-1.0

Questions, not committed items.

- **Browser-first CI job** — currently Node-first; browser path lives through esm.sh + runtime font registration, untested in CI.
- **Stable vs. experimental API surface** — tag internal exports so downstream knows what's safe to import.
- **Deprecation policy** — the callout `content`→`text` rename (deprecated in v2.1.0, targeted for v3.0) is the first real test case. Use it to write the actual policy instead of deciding ad hoc.
- **`test:visual` in CI** — already wired in as a *blocking* step for the Node 20.x matrix job (stricter than the originally-scoped "non-blocking diff report"). Verified passing in the 2026-07-20 CI run. Revisit only if it starts producing false-positive failures across environments.

---

## Under consideration

Ideas not yet committed. **Presence here does not imply they will ship.**

- **Renovate auto-merge for runtime patch bumps** (currently runtime bumps are PR-only). Would need dual CI + visual regression passing first — and CI needs to stay green for this to mean anything.
- **GitHub Marketplace listing** for the MCP server (distinct from Smithery) — tracked in the separate `pretext-pdf-mcp` repo.
- **Cloud API hosted at `api.pretext-pdf.com`** — render-as-a-service for users who don't want to `npm install`. Real business question, not just a technical one.
- **Variable font support at the `pretext-pdf` API level** (currently indirect via `@fontsource-variable/inter`).
- **PDF/A and PDF/UA output modes** for archival and accessibility. `DocumentMetadata.accessibility`/`.semantic` (reserved since v1.8.0, wired to the Info dict since v2.0.0) are early groundwork.
- **A `pretext-pdf-react` declarative React wrapper** — explored in April and deprioritized; the JSON schema is already LLM-friendly and `esm.sh` covers browser consumers.

---

## Shipped

The authoritative record is [CHANGELOG.md](../CHANGELOG.md). This section is a **milestones-only** index — it deliberately does not duplicate per-version detail. 39 releases shipped between 1.0.6 and 2.1.1; only thematic milestones are listed below, not every patch.

| Milestone | Version | Date | Theme |
| --- | --- | --- | --- |
| Dependency security fix + CI pipeline repair | 2.1.1 | 2026-07-20 | `undici` HIGH-CVE bump; fixed 3 independently-broken CI gates (badges, api-surface snapshot, example smoke test) that had silently blocked releases since ~2026-05-30 |
| DX release: auto-coercion + better errors | 2.1.0 | 2026-06-01 | List/font/table auto-coercion for common mistakes, structure-hint error messages, callout `content`→`text` deprecation path |
| Vendor engine refresh | 2.0.14 | 2026-05-30 | `@chenglou/pretext` bumped to v0.0.7-patched.1 (upstream v0.0.7 + 11 fork patches) |
| Post-release security + architecture hardening | 2.0.1–2.0.13 | 2026-05-28–29 | PDF-injection fixes (correct `PDFHexString` encoding), annotation-array safety, symlink-escape + SSRF closes, `schema.ts` (907L) split into 6 files, dead-export removal |
| v2.0 stable — form-field discriminated union | 2.0.0 | 2026-05-28 | **Breaking:** `FormFieldElement` split into 5 per-variant types; `spaceAbove`/`spaceBelow` and `warningCount` removed; new `./signing` export |
| Error categorization + plugin API graduation | 1.9.0 | 2026-05-28 | `ErrorCategory`/`PretextPdfError.category`, typed plugin generics, `MAX_PDF_BYTES` 100MB guard, `Plugin*` types promoted `@beta`→`@public` |
| Type narrowing + shared leaf modules | 1.8.0 | 2026-05-28 | `ColumnDef.width` literal-type narrowing, `url-utils.ts`/`font-key.ts` extraction |
| Internal hardening pass | 1.7.2 | 2026-05-28 | Silent-failure→observable-warning fixes, exhaustiveness guards on element-type switches |
| SVG `<style>`-block sanitizer hardening | 1.7.1 | 2026-05-27 | Strips `@import` and `url(javascript:/vbscript:/data:/https?:)` from embedded CSS |
| Signing pipeline repaired | 1.7.0 | 2026-05-25 | Fixed `@cantoo/pdf-lib` × `@signpdf/*` fork incompatibility that had left PKCS#7 signing architecturally broken since v1.3.6 |
| `assets.ts` split + SVG sanitizer hardening | 1.6.0 | 2026-05-25 | 961-line monolith → 10 focused files; `<foreignObject>` stripping, `<a>`-href scheme filtering |
| SSRF IPv4-bypass fix (CVE-class) | 1.5.2 | 2026-05-25 | Alternative IPv4 notations (decimal/hex/octal/short-form) bypassed the private-IP guard, reaching RFC 1918 ranges and cloud metadata endpoints |
| Multi-agent audit hotfix batch | 1.5.1 | 2026-05-24 | Watermark URL scheme validation, `metadata.keywords[]` validation gap closed, silent dynamic-import failures now logged |
| `validate.ts`/`measure-blocks.ts` split (cont'd) | 1.5.0 | 2026-05-24 | Doc-level validator extraction with 68-fixture bit-exact snapshot tripwire |
| God-file split sprint | 1.4.0–1.4.1 | 2026-05-23 | `validate.ts` (1834L), `measure-blocks.ts` (1600L), `render-blocks.ts` (1277L), `types-public.ts` (1200L) each split into ~10 focused files; zero public API change |
| Vendor integrity check + signing marked broken | 1.3.6 | 2026-05-23 | Boot-time `assertVendorIntegrity()`; documented that signing had been non-functional since this version until the v1.7.0 fix |
| Perf validated + docs catch-up | 1.3.2–1.3.5 | 2026-05-17–22 | DNS-dedup, parallel rasterization, word-width FIFO cache — ~1.66x geomean speedup confirmed by re-benchmark |
| Security + concurrency-safe validation | 1.2.0–1.2.2 | 2026-05-16–17 | Type-system tightening, per-call `WeakSet` cycle detection for concurrent `validate()`/`render()` |
| Pretext engine vendored directly | 1.1.0–1.1.3 | 2026-05-07–15 | `@chenglou/pretext` vendored into `src/vendor/pretext/` instead of an external dependency |
| Coverage + API contract integrity | 1.0.7–1.0.9 | 2026-05-05–06 | `RenderOptions.logger` actually wired up; CLI/pdfmake-compat coverage gaps closed |
| Audit fixes + GTM polish | 1.0.6 | 2026-05-04 | Validator correctness, export hygiene, schema gaps, README accuracy |
| Schema completion + warningCount | 1.0.5 | 2026-05-04 | Full schema coverage across all 9 remaining element types |
| Schema hardening | 1.0.4 | 2026-05-04 | `$schema` URI fix, `hr`/`float-group`/`chart` schema gaps |
| JSON Schema export | 1.0.3 | 2026-05-03 | `pretext-pdf/schema` entry point for tooling and Smithery |
| validateDocument API + italic fonts | 1.0.2 | 2026-05-03 | Non-throwing validation, structured ValidationResult, Inter italic |
| Strict mode bug fixes | 1.0.1 | 2026-05-02 | Levenshtein early-exit fix, path-prefix corrections |
| Plugin extension API + stable release | 1.0.0 | 2026-05-02 | Plugin API, all v1.0 gates closed, zero breaking changes from 0.9.x |
| Strict validation + Tier 0 remediation | 0.9.3 | 2026-04-23 | Opt-in strict mode with Levenshtein typo detection, compile-time drift guards, error accumulation, public validate() export |
| Engine refresh + repo-hygiene automation | 0.9.2 | 2026-04-22 | `@chenglou/pretext@0.0.6` bump, badge-verify CI, release-on-tag automation, renovate watchdog, rewritten ROADMAP |
| Rendering-bug hardening + producer-validator contract | 0.9.1 | 2026-04-21 | Callout title split fix, rich-text leading-space preservation, narrowed internal types |
| Feature completeness pass | 0.9.0 | 2026-04-20 | CLI binary, pdfmake compat shim, GFM tables + task lists in markdown |
| Security hardening | 0.8.3 | 2026-04-20 | SSRF guard on image URLs, markdown nesting fix, amount-in-words fix |
| Rich-paragraph whitespace fix | 0.8.2 | 2026-04-20 | Sentinel-char measurement technique, adjacent-word overlap regression |
| Browser support | 0.8.1 | 2026-04-20 | Clean import in browsers, esm.sh demo works end-to-end |
| Content ecosystem | 0.8.0 | 2026-04-19 | QR codes, barcodes, Vega charts, Markdown entry, GST India templates |
| Annotations + forms + signatures | 0.7.x | 2026-04-17 | PKCS#7 signing, form fields, PDF annotations, float-group enhancements |
| Internationalization | 0.5.3 | 2026-04-16 | RTL (Arabic, Hebrew), CJK, hyphenation |
| Image error control | 0.5.2 | 2026-04-13 | `onImageLoadError` callback — skip or throw on image load failures |
| Documents core | 0.4.0 | 2026-04-08 | Tables, lists, images, SVG, TOC, bookmarks, hyperlinks, encryption |
| Foundation | 0.1.0 | 2026-04-07 | Paragraphs, headings, page-sizes, declarative JSON schema, pretext engine binding |

---

## Update discipline

This document gets out-of-sync loudly, not silently. The rules:

1. **Starting a "Now" item:** move it from "Next" to "Now" in the same PR. PR template has a checkbox.
2. **Finishing a "Now" item:** remove it from "Now" in the same PR. The CHANGELOG is the record of what shipped — do not duplicate here.
3. **Every release:** bump `Last updated` and `Current version` at the top. Add a row to "Shipped" only for milestone releases, not every patch.
4. **Tier labels:** Tier 1 = this month · Tier 2 = this quarter · Tier 3 = post-1.0. Items drift tiers as priorities change — update in the PR that re-scopes them.
5. **"Under consideration" items must name the open question they answer.** If the question is resolved, they either promote to a Tier or get deleted.
6. **No dates in "Next".** Dates invite rot. Effort tags (S/M/L) and tier ordering are the commitment.
7. **No "Phase N" language.** Features are the unit. Phases were an internal project-management artifact and have no place in forward-looking docs.
8. **Contingencies belong in ADRs** (`docs/adr/`), not here. This file is the plan, not the backup plan.
9. **This file describes intent; it does not verify CI health.** This rewrite happened because this file said "Active work: None" while CI had actually been failing for two months. If you're touching this file, also confirm `npm run api:check`, `npm run verify:badges:full`, and `npm audit --audit-level=high` pass locally — don't trust the last "Now" entry to reflect reality.

---

## History

**2026-07-20** · Full rewrite reconciling this document (frozen at v1.0.6 since 2026-05-04) against the actual repo state at v2.1.1 — 39 releases had shipped in between without a single roadmap update. Verified each stale Tier 1/2/3 item against current source rather than assuming: pipeline extraction (done, `src/pipeline.ts` exists), tarball trim (moot, `docs/` was never in the `files` allowlist), `measure.ts:180` any-cast (moot, refactored away entirely), compatibility matrix (done, in README), `phase-*.test.ts` rename (done), `docs/adr/` seeding (done, 5 ADRs exist). Added milestone rows for 1.0.7 through 2.1.1. Surfaced three independently-broken CI gates (README badges, API-surface snapshot, example smoke test) that had been failing silently since at least 2026-05-30 — all three fixed and verified in an actual CI run as part of the v2.1.1 release. New Tier 1 items reflect that discovery: document the real release process, rotate `NPM_TOKEN` proactively, and re-scope the stale "upstream PR #81" item now that the fork has diverged 410 commits behind / 295 ahead.

**2026-05-04** · Updated to reflect v1.0.6 stable state. Removed shipped Tier 1/2/3 items (`types-public.ts` split, `validate_document` MCP tool, plugin API, v1.0 criteria, Phase 0 worktree decision). Added v1.0.0–1.0.6 milestone rows to Shipped table. Updated "Tier 3" label from "v1.0 and beyond" to "post-1.0".

**2026-04-22** · Rewrote this document. The previous version mixed completed phases, in-progress phases, contingencies, and forward planning — four sections with four different decay rates. It rotted because reconciling them on every release was nontrivial, so it didn't happen. Reference: this replacement was scoped as a Tier 0 "truth-in-docs" item alongside the `pretext-pdf@0.9.2` release. The prior content was deleted rather than archived because none of it was an authoritative record of anything the CHANGELOG didn't already cover better.

**2026-04-08** · Original ROADMAP.md authored as a "master remediation and growth plan" with 6 phases (0–5) from `pdf-lib → @cantoo/pdf-lib` migration through Cloud API monetization. Phases 0–5 all shipped by 2026-04-21; Phase 6 (Cloud API) was deferred to "Under consideration" during this rewrite.
