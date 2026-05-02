# Contributing to pretext-pdf

Thanks for your interest in pretext-pdf! We welcome contributions of all kinds: bug reports, feature requests, documentation, and code.

## Development Setup

### Prerequisites
- Node.js 18.x, 20.x, or 22.x
- pnpm (preferred) or npm

### Install & Build

```bash
# Clone the repository
git clone https://github.com/Himaan1998Y/pretext-pdf.git
cd pretext-pdf

# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Run all tests
npm test
```

### Development Commands

```bash
# Type check (no emit)
npm run typecheck

# Run specific test suite
npm run test:unit          # Unit tests only (fast)
npm run test:validate      # Validation & builder tests
npm run test:e2e           # End-to-end tests
npm run test:phases        # All feature tests (bookmarks, toc, forms, etc.)
npm run test:phase-7       # bookmarks, watermarks, toc, svg, rtl, encryption
npm run test:phase-8       # annotations, forms, assembly, callout, hyperlinks

# Run all examples
npm run example            # Invoice example
npm run example:watermark  # Watermarks
npm run example:bookmarks  # Bookmarks & outline
npm run example:toc        # Table of contents
npm run example:rtl        # RTL text (Arabic/Hebrew)
npm run example:encryption # Password protection
npm run example:forms      # Interactive forms
npm run example:callout    # Callout boxes
```

## Workflow

### Before Writing Code

1. **Search existing issues** — Check [GitHub Issues](https://github.com/Himaan1998Y/pretext-pdf/issues) to avoid duplicates
2. **Open an issue** for discussion on non-trivial features
3. **Check CHANGELOG.md** to understand recent changes and avoid conflicts

### TDD Approach (Required)

We follow Test-Driven Development strictly:

1. **Write failing test first** (RED)
   ```bash
   npm test -- --grep "your test name"  # Should fail
   ```

2. **Implement minimal code to pass** (GREEN)
   ```bash
   npm test -- --grep "your test name"  # Should pass
   ```

3. **Refactor** (IMPROVE)
   - Keep functions <50 lines
   - Keep files <800 lines
   - Extract utilities when duplicated

4. **Verify coverage** (80%+ required)
   ```bash
   npm test  # Check coverage in output
   ```

### Code Quality Checklist

Before committing:

- [ ] **Immutability**: No mutation of input objects (create new copies)
- [ ] **Error handling**: Comprehensive, no silent failures
- [ ] **Type safety**: Use strict TypeScript, no `any`
- [ ] **Readability**: Clear variable names, <50 line functions
- [ ] **No hardcoding**: Use constants or config
- [ ] **No console.log**: Only in examples, not library code
- [ ] **Tests pass**: `npm test` → all green
- [ ] **Coverage**: 80%+ on new code
- [ ] **Build succeeds**: `npm run build` → 0 errors

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Examples:
```
feat: Add hyperlink support to paragraphs
fix: Handle RTL text baseline correction
test: Add edge cases for CJK line breaking
docs: Update API reference for Phase 8G
```

### Pull Request Process

1. **Fork** the repository
2. **Branch** from `main`: `git checkout -b feat/your-feature`
3. **Develop** following TDD approach
4. **Test** thoroughly: `npm test` must pass on Node 18, 20, 22
5. **Type check**: `npm run typecheck` must have 0 errors
6. **Build**: `npm run build` must succeed
7. **Commit** with clear messages
8. **Push** to your fork
9. **Open PR** with:
   - Clear title (same as your commit message)
   - Description of what/why/how
   - Reference any related issues (#123)
   - Test plan: list what you tested

## Architecture Overview

```
src/
├── index.ts           # Public API: render(), merge(), assemble(), ELEMENT_TYPES
├── types-public.ts    # All public schema types (ContentElement union + 41 interfaces)
├── types-internal.ts  # Internal pipeline types (MeasuredBlock, PageGeometry, etc.)
├── types.ts           # Barrel re-export of types-public.ts (backward compat)
├── pipeline.ts        # 5-stage orchestrator: validate→init→assets→measure→render
├── pipeline-toc.ts    # Two-pass TOC generation
├── pipeline-footnotes.ts # Two-pass footnote numbering + pagination
├── errors.ts          # PretextPdfError class and error codes
├── validate.ts        # Schema validation for all element types
├── measure-blocks.ts  # Per-element height/line measurement (the main switch)
├── measure.ts         # measureAllBlocks orchestration + image sizing
├── render.ts          # PDF rendering dispatch (per-element switch → render-*.ts)
├── fonts.ts           # Font loading, embedding, subsetting
├── assets.ts          # Bundled asset paths (fonts, icons)
├── node-polyfill.ts   # @napi-rs/canvas OffscreenCanvas shim for Node.js
└── builder.ts         # Fluent createPdf() builder API
```

## How to add a new element type

Adding an element type touches **6 files in order**. Using a hypothetical `badge` element as the example.

### Step 1 — Define the type in `src/types-public.ts`

Add the interface and include it in the `ContentElement` union:

```typescript
// In the ContentElement union (around line 335):
| BadgeElement

// New interface at the bottom of the file:
export interface BadgeElement {
  type: 'badge'
  text: string
  color?: string       // hex background color
  spaceAfter?: number
}
```

### Step 2 — Add validation in `src/validate.ts`

Find the `switch (el.type)` block and add a case. Also add `'badge'` to the known-types error message at the bottom of the switch.

```typescript
case 'badge': {
  if (!el.text || typeof el.text !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (badge): 'text' is required`)
  }
  if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (badge): 'color' must be a 6-digit hex string`)
  }
  break
}
```

Then update the fallthrough error message (search for `unknown element type`):

```typescript
// Add 'badge' to the valid-types list in the error string
throw new PretextPdfError('VALIDATION_ERROR', `... 'badge'`)
```

### Step 3 — Add measurement in `src/measure-blocks.ts`

Find the `switch (element.type)` block in `measureBlock()` and add a case. Return a `MeasuredBlock` with the correct `height`.

```typescript
case 'badge': {
  const fontSize = 10
  const lineHeight = fontSize * 1.4
  return {
    element,
    height: lineHeight + (element.spaceAfter ?? 8),
    lines: [],
    fontSize,
    lineHeight,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 8,
    spaceBefore: 0,
  }
}
```

### Step 4 — Add rendering in `src/render.ts`

Find the `switch (block.element.type)` dispatch and add a case:

```typescript
case 'badge':
  renderBadge(pdfPage, pagedBlock, geo, fontMap)
  return
```

Then implement `renderBadge` (either inline or in a new `render-badge.ts` file and import it).

### Step 5 — Register in `src/index.ts`

Add `'badge'` to the `ELEMENT_TYPES` array. This is what the MCP drift guard watches.

```typescript
export const ELEMENT_TYPES = [
  'paragraph', 'heading', ...
  'badge',   // ← add here
] as const
```

### Step 6 — Document in the MCP server

Open `pretext-pdf-mcp/src/tools/list-elements.ts` and add a `## badge` section to `ELEMENTS_REFERENCE`. Until you do this, the MCP server will print a startup warning:

```text
[list-elements] WARNING: ELEMENTS_REFERENCE missing docs for: badge
```

```markdown
## badge
Renders a small labelled badge. Key props: `text` (required), `color` (#hex background), `spaceAfter`.
Example: `{ type: "badge", text: "NEW", color: "#22C55E" }`
```

### Checklist

- [ ] `types-public.ts` — interface defined, added to `ContentElement` union
- [ ] `validate.ts` — case added, known-types error message updated
- [ ] `measure-blocks.ts` — case added with correct height
- [ ] `render.ts` — case added, render function implemented
- [ ] `index.ts` — `'badge'` in `ELEMENT_TYPES` array
- [ ] MCP `list-elements.ts` — `## badge` section in `ELEMENTS_REFERENCE`
- [ ] Test file added to `test/` following the naming convention in `test/NAMING.md`
- [ ] Test file added to `test:phases` in `package.json`

## Release process

Releases are **tag-triggered**. Pushing a `v*` tag causes CI to publish to npm and create a GitHub release automatically. There is no manual publish step.

### Steps

1. **Update `CHANGELOG.md`** — add a section at the top:

   ```markdown
   ## [0.9.4] - 2026-05-01
   ### Added
   - ...
   ### Fixed
   - ...
   ```

   The CI release job extracts this section verbatim as the GitHub release notes.

2. **Verify the tarball** before bumping:

   ```bash
   npm pack --dry-run
   ```

   Check that `dist/`, `fonts/`, `README.md`, `LICENSE`, and `CHANGELOG.md` are present and that the tarball is under 1 MB. If screenshots or unbuilt source appear, check the `files` array in `package.json`.

3. **Bump the version**:

   ```bash
   npm version patch   # 0.9.3 → 0.9.4
   # or
   npm version minor   # 0.9.3 → 0.10.0
   ```

   This edits `package.json`, creates a commit (`chore: 0.9.4`), and creates a `v0.9.4` git tag.

4. **Push the commit and the tag**:

   ```bash
   git push && git push --tags
   ```

5. **CI takes over** — the `publish` job runs `npm publish` and the `release` job creates the GitHub release. Watch the Actions tab. No manual intervention needed.

### What CI does on a tag push

| Job | Trigger | What it does |
| --- | ------- | ------------ |
| `test` | every push | typecheck → build → badges → all tests → examples |
| `publish` | `v*` tag only | `npm ci` → `npm run build` → `npm publish` |
| `release` | after publish | extracts CHANGELOG section → `gh release create` |

### Checklist before releasing

- [ ] `npm test` passes locally on the branch being released
- [ ] `CHANGELOG.md` has a section for the new version
- [ ] `npm pack --dry-run` tarball looks correct (size, files)
- [ ] No unresolved high-severity `npm audit` findings

## Reporting Bugs

Include:

1. Node.js version (`node -v`)
2. pretext-pdf version (from package.json)
3. Minimal reproduction code (TypeScript or JavaScript)
4. Expected vs actual output
5. PDF screenshot if visual issue

**Example bug report:**

**Environment:** Node.js 20.10, pretext-pdf 0.9.3

**Code:**

```typescript
const pdf = await render({
  pageSize: 'A4',
  content: [{ type: 'paragraph', text: 'hello' }]
})
```

**Expected:** PDF renders with proper kerning

**Actual:** Text appears with loose spacing

## Documentation

- `README.md` — User-facing overview, quick start, features
- `CHANGELOG.md` — Version history, breaking changes, all features
- `examples/*.ts` — Working examples for each Phase
- `test/**` — Tests double as documentation of behavior
- Code comments only for non-obvious logic

## Questions?

- **GitHub Issues** — Bug reports, feature requests, discussions
- **GitHub Discussions** (if enabled) — Questions, ideas, brainstorming
- **README** — Quick start and common questions

---

**Happy contributing!** 🎉
