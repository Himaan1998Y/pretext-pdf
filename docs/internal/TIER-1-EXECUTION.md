# Tier 1 — Detailed Execution Plan & Tracking

**Start Date:** 2026-04-23  
**Status:** 🔄 IN PROGRESS  
**Total Items:** 10  
**Completed:** 0/10  
**Time Tracking:** Active

---

## Execution Overview

| # | Item | Effort | Status | Start | End | Notes |
|----|------|--------|--------|-------|-----|-------|
| 1 | Split `types.ts` | M (1–2d) | 🔳 TODO | — | — | Unblocks plugin arch |
| 2 | Extract pipeline | M (1–2d) | 🔳 TODO | — | — | Unblocks stage testing |
| 3 | MCP deduplication | M (½–1d) | 🔳 TODO | — | — | Version safety |
| 4 | Auto-generate MCP element list | S (½d) | 🔳 TODO | — | — | Schema drift prevention |
| 5 | Trim tarball | S (½d) | 🔳 TODO | — | — | Package size reduction |
| 6 | Measure.ts documentation | S (½d) | 🔳 TODO | — | — | Code clarity |
| 7 | Visual regression CI | S (½d) | 🔳 TODO | — | — | Layout PR scale |
| 8 | MCP JSON-RPC integration test | S (½d) | 🔳 TODO | — | — | Dispatcher validation |
| 9 | Phase 0 worktree archival | S (½d) | 🔳 TODO | — | — | Repo cleanliness |
| 10 | `generate_report` validation tests | S (½d) | 🔳 TODO | — | — | MCP robustness |

---

## Item 1: Split `types.ts` (M — 1–2 days)

**Objective:** Separate 41 public schema types from 9 internal pipeline types  
**Blocker for:** Plugin architecture, new element types  
**Tools/Agents:** code-architect (design), code-reviewer (verification)

### Sub-Steps

#### 1.1 Analyze current `types.ts` structure
- [ ] Read full `src/types.ts`
- [ ] Identify all 41 public schema types (PdfDocument, ContentElement, etc.)
- [ ] Identify all 9 internal types (MeasuredBlock, RenderedPage, PaginatedDocument, etc.)
- [ ] Map cross-dependencies (which types import which)
- [ ] Identify circular dependency risks
- **Verify:** Document dependency graph, list all types with categories

#### 1.2 Design split architecture
- [ ] Create `types-public.ts` structure (41 types)
- [ ] Create `types-internal.ts` structure (9 types)
- [ ] Identify which internal types depend on public types
- [ ] Plan re-export barrel in `types.ts`
- [ ] Design `package.json` exports field changes (if any)
- **Verify:** Dependency graph shows no cycles, design doc complete

#### 1.3 Implement split
- [ ] Create `src/types-public.ts` with 41 public types
- [ ] Create `src/types-internal.ts` with 9 internal types
- [ ] Create re-export barrel in `src/types.ts`
- [ ] Update ~8 internal files to import from `types-internal.js`
- [ ] Update `package.json` exports if needed
- **Verify:** No missing imports, all files compile

#### 1.4 Verify split integrity
- [ ] Run `npm run typecheck` — must pass with 0 errors
- [ ] Run `npm test` — must pass with 463+ tests
- [ ] Verify public exports still work: `import { PdfDocument } from 'pretext-pdf'` ✅
- [ ] Verify private isolation: `import { RenderedPage } from 'pretext-pdf'` ❌ (should fail)
- [ ] Check no circular imports
- **Verify:** All checks pass, no regressions

#### 1.5 Document & commit
- [ ] Add TSDoc comments explaining public vs. internal split
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 2: Extract Pipeline from `index.ts` (M — 1–2 days)

**Objective:** Move render orchestration (537 lines) into separate `pipeline.ts` unit  
**Blocker for:** Independent stage testing, profiling, parallelization  
**Tools/Agents:** code-architect (design), code-simplifier (refactor)

### Sub-Steps

#### 2.1 Analyze current orchestration
- [ ] Read full `src/index.ts`
- [ ] Identify all render stages (validate, load fonts/images, measure, paginate, render)
- [ ] Identify two-pass logic (TOC, footnotes)
- [ ] Map dependencies between stages
- [ ] Identify state passed between stages
- **Verify:** Stage diagram complete, all logic accounted for

#### 2.2 Design pipeline extraction
- [ ] Design `pipeline.ts` with 5 stages as functions
- [ ] Design `pipeline-toc.ts` for TOC two-pass logic
- [ ] Design `pipeline-footnotes.ts` for footnote numbering
- [ ] Plan refactored `index.ts` (calls `pipeline.ts`)
- [ ] Identify types needed in each stage
- **Verify:** Design doc complete, no gaps

#### 2.3 Implement pipeline extraction
- [ ] Create `src/pipeline.ts` with 5 stage functions
- [ ] Create `src/pipeline-toc.ts` with TOC logic
- [ ] Create `src/pipeline-footnotes.ts` with footnote logic
- [ ] Refactor `src/index.ts` to call pipeline functions
- [ ] Test each stage independently (manually first)
- **Verify:** Code compiles, logic preserved

#### 2.4 Verify behavior preservation
- [ ] Run `npm run typecheck` — must pass
- [ ] Run `npm test` — must pass with 463+ tests
- [ ] Compare render output: old vs. new (byte-identical or close)
- [ ] Check no performance regressions
- [ ] Verify error paths unchanged
- **Verify:** All tests pass, no behavioral changes

#### 2.5 Test stage independence
- [ ] Create test: can import and call `validateStage()` directly
- [ ] Create test: can import and call `loadAssetsStage()` directly
- [ ] Create test: can import and call `measureStage()` directly
- [ ] Create test: can chain stages manually with mocked data
- **Verify:** All stage tests pass

#### 2.6 Document & commit
- [ ] Add architecture diagram to code comments
- [ ] Add stage interface documentation
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 3: MCP Deduplication (`qrcode` + `marked`) (M — ½–1 day)

**Objective:** Consolidate `qrcode` + `marked` in core, expose to MCP  
**Blocker for:** Version safety, reduced bundle size  
**Tools/Agents:** code-architect (design), typescript-reviewer (exports)

### Sub-Steps

#### 3.1 Analyze current duplication
- [ ] Check `pretext-pdf` dependencies: where are `qrcode` + `marked`?
- [ ] Check `pretext-pdf-mcp` dependencies: duplicates?
- [ ] Check bundle sizes: impact of duplication
- [ ] Verify version mismatches (if any)
- **Verify:** Duplication confirmed, impact measured

#### 3.2 Design consolidation
- [ ] Plan Solution A: core owns, MCP imports transitively
- [ ] Design `package.json` exports in core (if needed)
- [ ] Check if `qrcode` + `marked` already used by core
- [ ] Plan removal from MCP dependencies
- **Verify:** Design doc complete, no version conflicts

#### 3.3 Implement consolidation
- [ ] Update `pretext-pdf` `package.json` exports (if adding `./qr` or `./markdown`)
- [ ] Remove `qrcode` from `pretext-pdf-mcp` dependencies
- [ ] Remove `marked` from `pretext-pdf-mcp` dependencies
- [ ] Update MCP imports to get them from core (transitive or explicit)
- [ ] Run `npm install` in MCP repo
- **Verify:** No missing imports, dependencies resolved

#### 3.4 Verify consolidation
- [ ] Run `npm run typecheck` in core — must pass
- [ ] Run `npm test` in core — must pass (463+ tests)
- [ ] Run `npm test` in MCP — must pass (24 tests)
- [ ] Run `npm ls` — verify single copy of `qrcode` + `marked` in tree
- [ ] Check npm tarball size: core + MCP together
- **Verify:** All tests pass, duplication eliminated

#### 3.5 Document & commit
- [ ] Create commit message (core)
- [ ] Create commit message (MCP)
- [ ] Update ROADMAP
- **Verify:** Both commits pushed, CI green

---

## Item 4: Auto-generate MCP Element List (S — ½ day)

**Objective:** Auto-sync `list_element_types` from core schema  
**Blocker for:** Schema drift prevention  
**Tools/Agents:** code-simplifier (refactor)

### Sub-Steps

#### 4.1 Analyze current element list
- [ ] Read `pretext-pdf-mcp/src/tools/list-elements.ts`
- [ ] Check current element type list
- [ ] Identify how it's used (in `list_element_types` tool)
- [ ] Check for drifts (missing types)
- **Verify:** Current list catalogued, drifts (if any) noted

#### 4.2 Design auto-generation
- [ ] Add `ELEMENT_TYPES` export to `pretext-pdf/src/index.ts`
- [ ] Plan MCP import: `import { ELEMENT_TYPES } from 'pretext-pdf'`
- [ ] Design tool description to use auto-generated list
- **Verify:** Design doc complete

#### 4.3 Implement auto-generation
- [ ] Add `ELEMENT_TYPES` const to `pretext-pdf/src/index.ts`
- [ ] Export `ELEMENT_TYPES` from index
- [ ] Update MCP to import from core
- [ ] Update tool description to use imported list
- **Verify:** Code compiles

#### 4.4 Verify auto-generation
- [ ] Run `npm run typecheck` in core — must pass
- [ ] Run `npm test` in core — must pass (463+ tests)
- [ ] Run `npm test` in MCP — must pass (24 tests)
- [ ] Manually verify: add a new element to core schema, confirm MCP list auto-updates (dry-run)
- **Verify:** All tests pass, auto-sync working

#### 4.5 Document & commit
- [ ] Create commit message (core)
- [ ] Create commit message (MCP)
- [ ] Update ROADMAP
- **Verify:** Both commits pushed, CI green

---

## Item 5: Trim Tarball (S — ½ day)

**Objective:** Remove screenshots from npm package (1.3MB → 0.6MB)  
**Blocker for:** Smaller downloads  
**Tools/Agents:** none (simple config change)

### Sub-Steps

#### 5.1 Analyze current tarball
- [ ] Run `npm pack --dry-run`
- [ ] Identify large files (docs/screenshots/*.png)
- [ ] Calculate size reduction
- **Verify:** Screenshots identified, savings calculated

#### 5.2 Update `package.json` files field
- [ ] Read `pretext-pdf/package.json`
- [ ] Update `files` array: remove `docs/screenshots/`
- [ ] Keep: `dist/`, `fonts/`, `README.md`, `LICENSE`, `CHANGELOG.md`
- **Verify:** File array updated

#### 5.3 Verify trimming
- [ ] Run `npm pack --dry-run`
- [ ] Confirm no PNG files in package
- [ ] Confirm size reduction (~1.3MB → ~0.6MB)
- [ ] Run `npm test` — must pass (463+ tests)
- **Verify:** Tarball trimmed, tests still pass

#### 5.4 Document & commit
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 6: Measure.ts Documentation (S — ½ day)

**Objective:** Explain only `any` cast in codebase (line ~180)  
**Blocker for:** Code clarity  
**Tools/Agents:** none (comment only)

### Sub-Steps

#### 6.1 Locate the cast
- [ ] Read `src/measure.ts` around line 180
- [ ] Find `(block as any).element = el` cast
- [ ] Understand why cast is needed (readonly field + post-construction assignment)
- **Verify:** Cast located, reason understood

#### 6.2 Add documentation
- [ ] Add 2–3 line comment explaining:
  - Why `element` is readonly in type
  - Why we assign it post-construction (circular dependency avoidance)
  - Why cast is safe/necessary
- **Verify:** Comment clear and complete

#### 6.3 Verify documentation
- [ ] Run `npm run typecheck` — must pass
- [ ] Code review comment for clarity
- **Verify:** Comment approved

#### 6.4 Document & commit
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 7: Visual Regression CI (S — ½ day)

**Objective:** Add non-blocking visual regression to CI  
**Blocker for:** Layout PR scale  
**Tools/Agents:** code-architect (CI design), e2e-runner (visual testing)

### Sub-Steps

#### 7.1 Design visual regression job
- [ ] Plan CI step: run `npm run test:visual` (non-blocking)
- [ ] Design artifact upload (if visual diffs exist)
- [ ] Design PR comment with link to diffs
- [ ] Check if `test:visual` script exists
- **Verify:** CI design complete

#### 7.2 Implement CI job
- [ ] Add step to `.github/workflows/ci.yml`
- [ ] Set `continue-on-error: true` (non-blocking)
- [ ] Add artifact upload (screenshots/diffs)
- [ ] Test locally: does step work?
- **Verify:** CI yaml valid

#### 7.3 Test CI integration
- [ ] Push branch with CI changes
- [ ] Wait for CI to run
- [ ] Confirm visual regression step appears (non-blocking)
- [ ] Confirm no build failures
- **Verify:** CI runs without blocking main flow

#### 7.4 Verify visual regression
- [ ] Run `npm run test:visual` locally
- [ ] Confirm diffs generated
- [ ] Confirm PR comment generation (if applicable)
- **Verify:** All steps working

#### 7.5 Document & commit
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 8: MCP JSON-RPC Integration Test (S — ½ day)

**Objective:** Test JSON-RPC dispatcher wiring end-to-end  
**Blocker for:** Dispatcher validation  
**Tools/Agents:** e2e-runner (test implementation)

### Sub-Steps

#### 8.1 Design integration test
- [ ] Plan test: spawn MCP process, send JSON-RPC request, verify response
- [ ] Identify test framework (node:test)
- [ ] Design helper: `json-rpc-client.ts`
- **Verify:** Test design complete

#### 8.2 Implement integration test
- [ ] Create `test/json-rpc-integration.test.ts`
- [ ] Create `test/helpers/json-rpc-client.ts`
- [ ] Test: `tools/list` request → response
- [ ] Test: `generate_pdf` request → response
- [ ] Test: invalid request → error response
- **Verify:** Tests compile

#### 8.3 Run integration tests
- [ ] Run `npm test` (includes new test)
- [ ] Confirm JSON-RPC tests pass
- [ ] Confirm no regressions in other tests (463+ total)
- **Verify:** All tests pass

#### 8.4 Document & commit
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 9: Phase 0 Worktree Archival (S — ½ day)

**Objective:** Cherry-pick valuable files from phase0 worktree, delete worktree  
**Blocker for:** Repo cleanliness  
**Tools/Agents:** none (git operations)

### Sub-Steps

#### 9.1 Analyze phase0 worktree
- [ ] List contents of `.worktrees/phase0-upstream-enhancement/`
- [ ] Identify 5 valuable test files
- [ ] Identify benchmark-corpora data
- [ ] Identify files to discard
- **Verify:** Valuable files catalogued

#### 9.2 Cherry-pick valuable files
- [ ] Create `test/phase0/` directory
- [ ] Copy 5 test files from worktree
- [ ] Copy `benchmark-baseline.json` to `test/data/`
- [ ] Verify files copied correctly
- **Verify:** Files in place

#### 9.3 Clean up worktree
- [ ] Delete `.worktrees/phase0-upstream-enhancement/`
- [ ] Run `git worktree prune`
- [ ] Verify worktree gone from `git worktree list`
- **Verify:** Worktree removed

#### 9.4 Verify preservation
- [ ] Run `npm test` (includes archived test files)
- [ ] Confirm tests still pass
- [ ] Confirm benchmark data accessible
- **Verify:** Files preserved, tests pass

#### 9.5 Document & commit
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Item 10: `generate_report` Validation Tests (S — ½ day)

**Objective:** Add validation tests for `generate_report` tool (0 → 8+ tests)  
**Blocker for:** MCP robustness  
**Tools/Agents:** tdd-guide (test design)

### Sub-Steps

#### 10.1 Analyze current tests
- [ ] Read `pretext-pdf-mcp/test/generate-report.test.ts`
- [ ] Identify 4 happy-path tests
- [ ] Identify gaps (no error cases)
- **Verify:** Gaps documented

#### 10.2 Design validation tests
- [ ] Plan test: missing title → error
- [ ] Plan test: missing sections → error
- [ ] Plan test: section with >50 items → error
- [ ] Plan test: invalid content element → error
- [ ] Plan test: section content item validation
- **Verify:** Test cases designed

#### 10.3 Implement validation tests
- [ ] Create `test/generate-report.validation.test.ts`
- [ ] Implement missing title test
- [ ] Implement missing sections test
- [ ] Implement >50 items test
- [ ] Implement invalid element test
- [ ] Implement section content validation test
- **Verify:** Tests compile

#### 10.4 Run validation tests
- [ ] Run `npm test` in MCP (includes new tests)
- [ ] Confirm all validation tests pass
- [ ] Confirm no regressions (24+ tests total)
- **Verify:** All tests pass

#### 10.5 Document & commit
- [ ] Create commit message
- [ ] Update ROADMAP
- **Verify:** Commit pushed, CI green

---

## Time Tracking

**Overall Progress:**
- Items completed: 0/10
- Estimated time remaining: ~10–12 days
- Start date: 2026-04-23

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| Planning & refinement | 1h | — | ⏳ In progress |
| Items 1–3 (M, sequential) | 2–4d | — | 🔳 TODO |
| Items 4–10 (S, parallel) | 3d | — | 🔳 TODO |
| Testing & integration | 1d | — | 🔳 TODO |
| **Total** | **~10–12d** | — | — |

---

## Success Criteria

✅ All 10 items completed  
✅ 500+ tests passing (463 + ~40 new from tests)  
✅ Zero breaking changes  
✅ CI all green  
✅ ROADMAP updated  
✅ Tier 2 planning started

---

## Tier 1 Execution Log

**2026-04-23 — Planning & Refinement Complete**
- ✅ Created detailed execution plan with sub-steps
- ✅ Identified tools/agents for each item
- ✅ Created verification checklists
- ✅ Established time tracking
- **Ready for:** Item 1 (Split types.ts) kickoff

---

## Notes & Blockers

- None yet (execution starting now)

---

**Next step:** Begin Item 1 — Split `types.ts`
