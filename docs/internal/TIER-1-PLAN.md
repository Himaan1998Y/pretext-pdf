# Tier 1 — Structural Debt Resolution

**Effort Window:** ~2–3 weeks (M = ½–2 days per item, S = ≤½ day)  
**Objective:** Eliminate compounding pain points before features multiply them.

---

## Why Tier 1 Matters

Tier 0 fixed *bugs*. Tier 1 fixes *structure*. A bug is a point fix; structural debt compounds — every new contributor hits it, every refactor reintroduces the same friction.

This tier's items are all **true blockers** for the next phase:

- **Split types** ← Required before adding new element types (plugin architecture, Tier 3)
- **Extract pipeline** ← Required before testing internals independently or parallelizing render stages
- **MCP dedup** ← Required before bundling MCP server in containers (version skew risk)
- **Visual CI** ← Required before allowing layout PRs without manual diff review (scales to N contributors)

---

## Item-by-Item Breakdown

### 1. Split `types.ts` (M) — HIGH PRIORITY

**Status:** Planned  
**Blocker for:** Plugin architecture, new element types, clean documentation

**Current problem:**
- 1,347 lines mixing 41 public schema types + 9 internal pipeline types
- When internals refactor (e.g., rename `RenderedPage` → `LayoutPage`), public types file must touch
- Exported to npm; drift risk if external code relies on `import { RenderedPage }` thinking it's stable

**Solution:**
```
src/
├── types.ts (keep as re-export barrel, doc-only)
├── types-public.ts (41 schema types exported to npm, stable)
└── types-internal.ts (MeasuredBlock, RenderedPage, etc., never exported)
```

**Breaking changes:** None — `types.ts` remains the public import.

**Files affected:**
- `src/types.ts` → split + re-export barrel
- `src/types-public.ts` ← new
- `src/types-internal.ts` ← new
- ~8 internal imports updated to use `types-internal.js`
- `package.json` `exports` updated (if needed)

**Verification:**
- `npm run typecheck` passes
- `npm test` passes (all 463+ tests)
- External imports of `import { PdfDocument } from 'pretext-pdf'` still work
- *New*: `import { RenderedPage } from 'pretext-pdf'` should fail (private)

**Effort estimate:** M (½–1 day)

---

### 2. Extract Pipeline from `index.ts` (M) — HIGH PRIORITY

**Status:** Planned  
**Blocker for:** Testing render stages independently, parallelizing, streaming

**Current problem:**
- 537-line entry point (`index.ts`) mixes public API with render orchestration
- Two-pass footnote logic, two-pass TOC logic, pagination interleaved with asset loading
- Contributors can't reason about pipeline as one testable unit
- Hard to profile which stage is slow

**Solution:**
```
src/
├── index.ts (public API: render, merge, assemble only)
├── pipeline.ts (new: RenderPipeline orchestration)
│   ├── stage1_validate(doc) → void
│   ├── stage2_load_fonts_images(doc) → { fontMap, imageMap }
│   ├── stage3_measure(doc, ...) → MeasuredBlock[]
│   ├── stage4_paginate(...) → PaginatedDocument
│   └── stage5_render(...) → Uint8Array
├── pipeline-toc.ts (new: buildTocEntryBlocks, two-pass logic)
└── pipeline-footnotes.ts (new: buildFootnoteNumbering, two-pass logic)
```

**Breaking changes:** None — `render()` signature unchanged.

**Files affected:**
- `src/index.ts` ← refactored, smaller, clearer
- `src/pipeline.ts` ← new, exported for testing
- `src/pipeline-toc.ts` ← new
- `src/pipeline-footnotes.ts` ← new

**Verification:**
- `npm run typecheck` passes
- `npm test` passes (all 463+ tests)
- Existing `render()` behavior unchanged
- *New*: Can import and test `pipeline.ts` stages independently

**Effort estimate:** M (1–2 days, longest in Tier 1)

---

### 3. MCP: Deduplicate `qrcode` + `marked` (M) — MEDIUM PRIORITY

**Status:** Planned  
**Blocker for:** Shipping MCP in containers without version drift

**Current problem:**
- `pretext-pdf` bundles `marked` (markdown → AST) and `qrcode` (QR encoding)
- `pretext-pdf-mcp` wrapper bundles them again
- If core upgrades `marked@19`, wrapper still has `marked@18`, causing divergence
- Bundled twice in user's `node_modules`, wasting space

**Solution A (recommended): Core owns, MCP imports**
```json
// pretext-pdf package.json
{
  "exports": {
    ".": "...",
    "./markdown": "./dist/markdown.js",  // expose marked-powered entry
    "./qr": "./dist/qr.js"               // new: expose QR utility
  }
}

// pretext-pdf-mcp package.json
{
  "dependencies": {
    "pretext-pdf": "^0.9.3"  // gets marked + qrcode transitively
  }
}
```

**Solution B (alternative): Peer dependencies**
- Make `marked` + `qrcode` peer deps in core
- Core: `"peerDependencies": { "marked": "^18", "qrcode": "^1.5" }`
- MCP: `"dependencies": { "marked": "^18", "qrcode": "^1.5" }`

**Recommendation:** Solution A (core owns) — simpler, no peer-dep migration pain.

**Files affected:**
- `src/markdown.ts` ← check exports
- `src/qr-code.ts` ← check exports
- New `src/qr.ts` or expose via index (if Solution A)
- `package.json` updates (exports field)
- `pretext-pdf-mcp` removes `marked` + `qrcode` from deps

**Verification:**
- `npm run typecheck` passes
- `npm test` passes (all 463+ tests)
- MCP tests pass (all 24 tests)
- `npm ls` shows single `marked` + `qrcode` in tree

**Effort estimate:** M (½–1 day)

---

### 4. MCP: Auto-generate `list_element_types` (S) — LOW PRIORITY

**Status:** Planned  
**Blocker for:** Preventing silent schema drift in MCP

**Current problem:**
- `pretext-pdf-mcp/src/tools/list-elements.ts` has a static array of element types
- When core adds a new element (e.g., `audio-clip`), MCP's list silently becomes outdated
- LLM using MCP doesn't know the new type exists

**Solution:**
```typescript
// pretext-pdf/src/index.ts (new export)
export const ELEMENT_TYPES = [
  'paragraph', 'heading', 'spacer', 'table', 'image', 'svg',
  'qr-code', 'barcode', 'chart', 'list', 'hr', 'page-break',
  'code', 'rich-paragraph', 'blockquote', 'toc', 'toc-entry',
  'comment', 'form-field', 'callout', 'footnote-def', 'float-group'
] as const

// pretext-pdf-mcp/src/tools/list-elements.ts
import { ELEMENT_TYPES } from 'pretext-pdf'

export const listElementTypesDescription = `Available element types: ${ELEMENT_TYPES.join(', ')}`
```

**Breaking changes:** None.

**Files affected:**
- `src/index.ts` ← add `ELEMENT_TYPES` export
- `pretext-pdf-mcp/src/tools/list-elements.ts` ← import from core

**Verification:**
- `npm run typecheck` passes
- `npm test` passes (all 463+ tests)
- MCP tests pass (all 24 tests)
- When core adds a new element type to schema, MCP's list auto-updates

**Effort estimate:** S (≤½ day)

---

### 5. Visual Regression CI (S) — MEDIUM PRIORITY

**Status:** Planned  
**Blocker for:** Safe layout-touching PRs without manual review

**Current problem:**
- Visual regression testing is opt-in: `npm run test:visual`
- Layout-touching refactors (e.g., margin changes) can silently break PDF output
- CI doesn't catch visual regressions
- Only manual diff review catches layout bugs

**Solution:**
```yaml
# .github/workflows/ci.yml
- name: Visual regression (non-blocking)
  run: npm run test:visual
  continue-on-error: true  # doesn't fail CI, but generates report
```

**Report format:** Generate HTML diff report, upload as GitHub Actions artifact, link in PR comment.

**Breaking changes:** None — non-blocking, doesn't fail CI.

**Files affected:**
- `.github/workflows/ci.yml` ← add visual regression step
- `scripts/visual-regression-report.js` ← new (optional, nicer report)

**Verification:**
- CI passes with visual regression job present
- PR gets a comment linking visual diffs when layout changes
- Can manually review diffs before merge

**Effort estimate:** S (≤½ day)

---

### 6. MCP JSON-RPC Integration Test (S) — LOW PRIORITY

**Status:** Planned  
**Blocker for:** Catching dispatcher wiring bugs

**Current problem:**
- All 24 MCP tests call handler functions directly (unit tests)
- JSON-RPC dispatcher wiring untested (could silently break request routing)
- Real clients use JSON-RPC protocol; unit tests don't exercise that path

**Solution:**
```typescript
// test/json-rpc-integration.test.ts (new)
import { spawn } from 'node:child_process'

test('JSON-RPC request → response round-trip', async () => {
  const mcp = spawn('node', ['dist/index.js'])
  
  // Send: {"jsonrpc":"2.0","id":1,"method":"tools/list"}
  // Expect: {"jsonrpc":"2.0","id":1,"result":{...}}
  
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }))
  
  const response = await readJsonRpcResponse(mcp.stdout)
  assert(response.result.tools.length > 0)
})
```

**Breaking changes:** None — adds new test only.

**Files affected:**
- `test/json-rpc-integration.test.ts` ← new
- `test/helpers/json-rpc-client.ts` ← new (helper for round-trips)

**Verification:**
- `npm test` includes new JSON-RPC integration test
- Test passes with live dispatcher

**Effort estimate:** S (≤½ day)

---

### 7. `generate_report` Validation Test Suite (S) — LOW PRIORITY

**Status:** Planned  
**Blocker for:** Ensuring MCP reports can't emit invalid documents

**Current problem:**
- `generate_report` has 4 happy-path tests, 0 validation tests
- Invalid section data could be accepted and passed to `render()`
- MCP should validate before rendering

**Solution:**
```typescript
// test/generate-report.validation.test.ts (new)
test('rejects section with missing title', async () => {
  const result = await generateReport({
    title: 'My Report',
    sections: [{ content: [] }]  // missing title
  })
  assert(result.isError === true)
  assert(result.error.includes('title'))
})

test('rejects section with more than 50 content items', async () => {
  const result = await generateReport({
    title: 'My Report',
    sections: [{
      title: 'Big Section',
      content: Array(51).fill({ type: 'paragraph', text: 'x' })
    }]
  })
  assert(result.isError === true)
})
```

**Breaking changes:** None — adds tests only.

**Files affected:**
- `test/generate-report.validation.test.ts` ← new

**Verification:**
- `npm test` includes new validation tests
- All tests pass

**Effort estimate:** S (≤½ day)

---

### 8. Trim Tarball — Exclude Screenshots (S) — LOW PRIORITY

**Status:** Planned  
**Blocker for:** Reducing npm package download size

**Current problem:**
- `pretext-pdf-0.9.3.tgz` is 1.3 MB
- 720 KB are screenshot PNGs in `docs/screenshots/`
- These aren't needed at runtime; only in repo for docs

**Solution:**
```json
{
  "files": [
    "dist/",
    "fonts/",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ]
}
```

**Breaking changes:** None — docs aren't in npm anyway.

**Files affected:**
- `package.json` ← update `files` array (remove `docs/screenshots/`)

**Verification:**
- `npm pack --dry-run` shows no PNG files
- `npm test` passes
- Published package is ~0.6 MB instead of 1.3 MB

**Effort estimate:** S (≤½ day)

---

### 9. Measure.ts Cast Justification (S) — LOW PRIORITY

**Status:** Planned  
**Blocker for:** Code clarity, reducing "mysterious any" usage

**Current problem:**
- Line ~180 in `src/measure.ts`: `(block as any).element = el`
- Only concerning `any` cast without inline justification
- Why is the cast needed?

**Solution:**
Add inline comment explaining the cast:
```typescript
// MeasuredBlock's type says element is always defined (readonly element),
// but during measurement we set it after block construction for circular
// dependency avoidance (avoid importing Block definition just for type info).
(block as any).element = el
```

**Breaking changes:** None — comment only.

**Files affected:**
- `src/measure.ts` ← add 2-line comment

**Verification:**
- `npm run typecheck` passes
- Code review can understand the cast

**Effort estimate:** S (≤½ day)

---

### 10. Phase 0 Worktree Decision (S) — LOW PRIORITY

**Status:** Planned  
**Blocker for:** Repo cleanliness, removing confusion

**Current problem:**
- `.worktrees/phase0-upstream-enhancement/` contains 5 test files + benchmark data
- Phase 0 shipped months ago; worktree is now a "hidden side branch"
- Creates confusion: is this branch active?

**Solution:**
Cherry-pick the 5 valuable test files + benchmark-corpora to `test/`, delete worktree:
```bash
# Copy valuable files from worktree to test/
cp .worktrees/phase0-upstream-enhancement/test/*.test.ts test/phase0/
cp .worktrees/phase0-upstream-enhancement/benchmarks/benchmark-baseline.json test/data/

# Delete worktree
git worktree prune
rm -rf .worktrees/phase0-upstream-enhancement
```

**Breaking changes:** None — archiving only.

**Files affected:**
- `test/phase0/` ← new (cherry-picked tests)
- `.worktrees/phase0-upstream-enhancement/` ← deleted

**Verification:**
- Worktree gone, files preserved
- Tests still pass
- Benchmark data available for future performance analysis

**Effort estimate:** S (≤½ day)

---

## Implementation Sequence

**Recommended order** (dependencies + value):

1. **Split `types.ts`** (Day 1–2) — Unblocks plugin architecture, clears architectural confusion
2. **Extract pipeline from `index.ts`** (Day 2–4) — Unblocks independent stage testing, profiling
3. **MCP deduplication** (Day 4–5) — Prevents version drift, reduces bundle size
4. **Auto-generate MCP element list** (Day 5) — Lightweight, unblocks dynamic schema reflection
5. **Trim tarball** (Day 5) — Quick win, reduces npm package size
6. **Measure.ts documentation** (Day 5) — Code clarity
7. **Visual regression CI** (Day 5–6) — Scales layout PR reviews
8. **MCP JSON-RPC integration test** (Day 6) — Strengthens dispatcher testing
9. **Phase 0 worktree archival** (Day 6) — Repo cleanliness
10. **`generate_report` validation tests** (Day 6) — MCP robustness

**Parallel tracks** (independent, can happen simultaneously):
- Items 4, 5, 6, 9 can run in parallel with items 1–3

**Total estimate:** 2–3 weeks (M items = 1–2 days each, S items = ≤½ day each)

---

## Tier 1 Success Criteria

✅ All items shipped and in `main`  
✅ 500+ tests pass (current 463 + ~40 new from validation tests)  
✅ TypeScript compile-time checks still pass  
✅ No breaking changes  
✅ ROADMAP updated with Tier 2 entrance criteria  
✅ Tier 2 planning document written

---

## What Tier 1 Unlocks

Once Tier 1 is complete:

- **Plugin architecture** (Tier 3) becomes feasible — clean public/internal split enables third-party element types
- **Streaming / parallel render** becomes possible — pipeline stages are independent units
- **Container deployment** is safer — MCP bundle has no version skew
- **Layout PR reviews scale** — visual CI prevents silent breakage
- **Code is healthier** — structural debt is gone, contributors can reason about subsystems independently

---

## Tracking

- **Epic:** Tier 1 — Structural Debt (create in project tracking if using GitHub Projects)
- **Issues:** Create one issue per item (10 issues total)
- **PRs:** Each item gets its own PR with clear scope
- **Milestone:** `v1.0-readiness` (items completed by end of May)

---

**Next:** Tier 1 kickoff. Create tracking issues, start with `Split types.ts`.
