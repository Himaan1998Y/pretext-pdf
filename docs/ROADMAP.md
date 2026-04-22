# pretext-pdf — Roadmap

**Last updated:** 2026-04-22 · **Current version:** 0.9.1 (0.9.2 in flight)

This is a **living document**. See [Update discipline](#update-discipline) at the bottom for how and when this file is touched.

---

## Now

Active work. Each item should have a tracking PR or issue.

- **Tier 0 cleanup release — `pretext-pdf@0.9.2`** — Engine bump to `@chenglou/pretext@0.0.6` (free CJK bracket wrap fix + native letterSpacing), repo hygiene (dead folders, false-positive test deleted, badges correct), and release-process automation (renovate + release-on-tag). *Why:* truth-in-docs + prevent this class of drift recurring.
- **MCP sync release — `pretext-pdf-mcp@1.2.0`** — Bump pinned `pretext-pdf` from `^0.8.0` → `^0.9.2`, remove redundant `version` field from `smithery.yaml`. *Why:* Smithery users were getting 2-version-old bugs.

---

## Next

Ordered backlog. No dates — tiers only. Effort tags: **S** (≤½ day) · **M** (½–2 days) · **L** (> 2 days).

### Tier 1 — Must, this month

Structural debt that pays compounding interest once fixed.

| Item | Why | Effort |
|---|---|---|
| **Strict validator** — `validate.ts` must reject unknown properties on every element type | Closes the false-positive test class permanently. A paragraph with `{footnote: {...}}` currently passes validation silently, which is how `smoke-staging.test.ts` "passed" for months on a non-existent API. | M |
| **Split `types.ts`** into `types-public.ts` (41 schema types) + `types-internal.ts` (pipeline types `MeasuredBlock`, `RenderedPage`, etc.) | 1,347-line file mixes two audiences with different change rates. Public schema should not churn when internals refactor. | M |
| **Extract pipeline from `index.ts`** into new `src/pipeline.ts` | `index.ts` is 537 lines of two-pass TOC/footnote orchestration masquerading as the public entry. Contributors can't reason about the pipeline as one unit. | M |
| **MCP: deduplicate `qrcode` + `marked` with core** | Both are bundled in the MCP wrapper AND used by core (via `qr-code` element and `/markdown` entry). Drift risk, version skew. | M |
| **MCP: auto-generate `list_element_types` from core schema** | Currently a static string in `src/tools/list-elements.ts` that silently drifts when core adds elements. | S |
| **`test:visual` in CI** as non-blocking diff report | Visual regression is currently opt-in only. One layout-touching refactor can silently break rendering. | S |
| **MCP protocol-level integration test** | All tests call handler functions directly. JSON-RPC dispatcher wiring is untested. | S |
| **`generate_report` validation test suite** | Currently 4 happy-path tests, 0 validation tests. | S |
| **Trim tarball** — exclude `docs/screenshots/` from npm pack | 1.3 MB → ~0.6 MB. Fonts legitimate; screenshots aren't. | S |
| **Phase 0 worktree decision** — cherry-pick the 5 valuable test files + benchmark-corpora, abandon the rest | Reclaims genuine engine-hardening work; stops the "hidden side-branch" signal. | S |
| **Document `src/measure.ts:180` `(block as any).element = el` cast** | Only concerning `any` in the codebase without an inline justification. | S |

### Tier 2 — Should, this quarter

| Item | Why | Effort |
|---|---|---|
| Compatibility matrix in README (Node / Browser / Deno / Bun / serverless / SSR) | Answers the maintainer FAQ once. | S |
| Rename `phase-*.test.ts` → feature-based names (`encryption.test.ts`, `toc.test.ts`, …) | "Phase" names leak internal project-management history. | M |
| Add `validate_document` MCP tool | LLMs currently must full-render just to check validity — expensive round-trip. | S |
| Unify MCP HTTP + stdio validation paths | They've diverged; one validation layer. | S |
| Constant-driven currency list in MCP `generate_invoice` | INR/USD/EUR/GBP duplicated in 2 places in the wrapper. | S |
| Upstream PR #81 decision — rebase onto `upstream/main` or close gracefully | Currently 19 commits behind upstream; will bit-rot. | S |
| `CONTRIBUTING.md` walkthrough: "how to add a new element type" | Lowers time-to-first-PR for external contributors. | M |
| Document release process (CONTRIBUTING section or `scripts/release.sh`) | Currently tribal knowledge. | S |
| Seed `docs/adr/` with 3–5 load-bearing decisions | Why `@cantoo/pdf-lib` fork · why `pretext` engine · why JSON-first schema · why peer-deps for optional elements · why ESM-only. | M |

### Tier 3 — v1.0 and beyond

Questions, not committed items.

- **Plugin architecture for element types** — can third parties ship `pretext-pdf-plugin-mermaid` and register a new element type?
- **Deprecation policy** — what do we remove at v1.0? `createPdf` builder if it never finds adoption? pdfmake compat shim?
- **v1.0 release criteria** — what would "1.0" actually mean vs. "0.9"? Stable schema · documented plugin API · browser CI · compatibility matrix all green?
- **Browser-first CI job** — currently Node-first; browser path lives through esm.sh + runtime font registration, untested in CI.
- **Stable vs. experimental API surface** — tag internal exports so downstream knows what's safe to import.

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
|---|---|---|---|
| Rendering-bug hardening + producer-validator contract | 0.9.1 | 2026-04-21 | Callout title split fix, rich-text leading-space preservation, narrowed internal types |
| Feature completeness pass | 0.9.0 | 2026-04-20 | Measurement precision, validator tightening |
| Security hardening | 0.8.3 | 2026-04-20 | SSRF guard on image URLs, markdown nesting cap, amount-in-words fix |
| Browser support | 0.8.1 | 2026-04-20 | Clean import in browsers, esm.sh demo works end-to-end |
| Content ecosystem | 0.8.0 | 2026-04-19 | QR codes, barcodes, Vega charts, Markdown entry, GST India templates |
| Annotations + forms + signatures | 0.7.x | 2026-04-17 | PKCS#7 signing, form fields, PDF annotations |
| Internationalization | 0.5.3 | 2026-04-16 | RTL (Arabic, Hebrew), CJK, hyphenation |
| Documents core | 0.4.0 | 2026-04-08 | Tables, lists, images, SVG, TOC, bookmarks, hyperlinks, encryption |
| Foundation | 0.1.0 | 2026-04-07 | Paragraphs, headings, page-sizes, declarative JSON schema, pretext engine binding |

---

## Update discipline

This document gets out-of-sync loudly, not silently. The rules:

1. **Starting a "Now" item:** move it from "Next" to "Now" in the same PR. PR template has a checkbox.
2. **Finishing a "Now" item:** remove it from "Now" in the same PR. The CHANGELOG is the record of what shipped — do not duplicate here.
3. **Every release:** bump `Last updated` and `Current version` at the top. Add a row to "Shipped" only for milestone releases, not every patch.
4. **Tier labels:** Tier 1 = this month · Tier 2 = this quarter · Tier 3 = v1.0+. Items drift tiers as priorities change — update in the PR that re-scopes them.
5. **"Under consideration" items must name the open question they answer.** If the question is resolved, they either promote to a Tier or get deleted.
6. **No dates in "Next".** Dates invite rot. Effort tags (S/M/L) and tier ordering are the commitment.
7. **No "Phase N" language.** Features are the unit. Phases were an internal project-management artifact and have no place in forward-looking docs.
8. **Contingencies belong in ADRs** (`docs/adr/`), not here. This file is the plan, not the backup plan.

---

## History

**2026-04-22** · Rewrote this document. The previous version mixed completed phases, in-progress phases, contingencies, and forward planning — four sections with four different decay rates. It rotted because reconciling them on every release was nontrivial, so it didn't happen. Reference: this replacement was scoped as a Tier 0 "truth-in-docs" item alongside the `pretext-pdf@0.9.2` release. The prior content was deleted rather than archived because none of it was an authoritative record of anything the CHANGELOG didn't already cover better.

**2026-04-08** · Original ROADMAP.md authored as a "master remediation and growth plan" with 6 phases (0–5) from `pdf-lib → @cantoo/pdf-lib` migration through Cloud API monetization. Phases 0–5 all shipped by 2026-04-21; Phase 6 (Cloud API) was deferred to "Under consideration" during this rewrite.
