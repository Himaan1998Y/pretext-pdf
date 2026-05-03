# pretext-pdf — Roadmap

**Last updated:** 2026-05-04 · **Current version:** 1.0.6

This is a **living document**. See [Update discipline](#update-discipline) at the bottom for how and when this file is touched.

---

## Now

Active work: None. Repo at stable v1.0.6 — all GTM polish applied, 6 audit bugs fixed, 691 tests passing.

---

## Next

Ordered backlog. No dates — tiers only. Effort tags: **S** (≤½ day) · **M** (½–2 days) · **L** (> 2 days).

### Tier 1 — Must, this month

Structural debt that pays compounding interest once fixed.

| Item | Why | Effort |
| --- | --- | --- |
| **Extract pipeline from `index.ts`** into new `src/pipeline.ts` | `index.ts` is 537 lines of two-pass TOC/footnote orchestration masquerading as the public entry. Contributors can't reason about the pipeline as one unit. | M |
| **MCP: deduplicate `qrcode` + `marked` with core** | Both are bundled in the MCP wrapper AND used by core (via `qr-code` element and `/markdown` entry). Drift risk, version skew. | M |
| **MCP: auto-generate `list_element_types` from core schema** | Currently a static string in `src/tools/list-elements.ts` that silently drifts when core adds elements. | S |
| **`test:visual` in CI** as non-blocking diff report | Visual regression is currently opt-in only. One layout-touching refactor can silently break rendering. | S |
| **MCP protocol-level integration test** | All tests call handler functions directly. JSON-RPC dispatcher wiring is untested. | S |
| **`generate_report` validation test suite** | Currently 4 happy-path tests, 0 validation tests. | S |
| **Trim tarball** — exclude `docs/screenshots/` from npm pack | 1.3 MB → ~0.6 MB. Fonts legitimate; screenshots aren't. | S |
| **Document `src/measure.ts:180` `(block as any).element = el` cast** | Only concerning `any` in the codebase without an inline justification. | S |

### Tier 2 — Should, this quarter

| Item | Why | Effort |
| --- | --- | --- |
| Compatibility matrix in README (Node / Browser / Deno / Bun / serverless / SSR) | Answers the maintainer FAQ once. | S |
| Rename `phase-*.test.ts` → feature-based names (`encryption.test.ts`, `toc.test.ts`, …) | "Phase" names leak internal project-management history. | M |
| Upstream PR #81 decision — rebase onto `upstream/main` or close gracefully | Currently 19 commits behind upstream; will bit-rot. | S |
| `CONTRIBUTING.md` walkthrough: "how to add a new element type" | Lowers time-to-first-PR for external contributors. | M |
| Document release process (CONTRIBUTING section or `scripts/release.sh`) | Currently tribal knowledge. | S |
| Seed `docs/adr/` with 3–5 load-bearing decisions | Why `@cantoo/pdf-lib` fork · why `pretext` engine · why JSON-first schema · why peer-deps for optional elements · why ESM-only. | M |

### Tier 3 — post-1.0

Questions, not committed items.

- **Browser-first CI job** — currently Node-first; browser path lives through esm.sh + runtime font registration, untested in CI.
- **Stable vs. experimental API surface** — tag internal exports so downstream knows what's safe to import.
- **Deprecation policy** — what do we remove at v2.0? `createPdf` builder if it never finds adoption? pdfmake compat shim?

---

## Under consideration

Ideas not yet committed. **Presence here does not imply they will ship.**

- **Renovate auto-merge for runtime patch bumps** (currently runtime bumps are PR-only). Would need dual CI + visual regression passing first.
- **GitHub Marketplace listing** for the MCP server (distinct from Smithery).
- **Cloud API hosted at `api.pretext-pdf.com`** — render-as-a-service for users who don't want to `npm install`. Real business question, not just a technical one.
- **Variable font support at the `pretext-pdf` API level** (currently indirect via `@fontsource-variable/inter`).
- **PDF/A and PDF/UA output modes** for archival and accessibility.
- **A `pretext-pdf-react` declarative React wrapper** — explored in April and deprioritized; the JSON schema is already LLM-friendly and `esm.sh` covers browser consumers.

---

## Shipped

The authoritative record is [CHANGELOG.md](../CHANGELOG.md). This section is a **milestones-only** index — it deliberately does not duplicate per-version detail.

| Milestone | Version | Date | Theme |
| --- | --- | --- | --- |
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

---

## History

**2026-05-04** · Updated to reflect v1.0.6 stable state. Removed shipped Tier 1/2/3 items (`types-public.ts` split, `validate_document` MCP tool, plugin API, v1.0 criteria, Phase 0 worktree decision). Added v1.0.0–1.0.6 milestone rows to Shipped table. Updated "Tier 3" label from "v1.0 and beyond" to "post-1.0".

**2026-04-22** · Rewrote this document. The previous version mixed completed phases, in-progress phases, contingencies, and forward planning — four sections with four different decay rates. It rotted because reconciling them on every release was nontrivial, so it didn't happen. Reference: this replacement was scoped as a Tier 0 "truth-in-docs" item alongside the `pretext-pdf@0.9.2` release. The prior content was deleted rather than archived because none of it was an authoritative record of anything the CHANGELOG didn't already cover better.

**2026-04-08** · Original ROADMAP.md authored as a "master remediation and growth plan" with 6 phases (0–5) from `pdf-lib → @cantoo/pdf-lib` migration through Cloud API monetization. Phases 0–5 all shipped by 2026-04-21; Phase 6 (Cloud API) was deferred to "Under consideration" during this rewrite.
