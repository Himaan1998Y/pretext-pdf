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
npm run test:phases        # Phase-specific feature tests
npm run test:phase-7       # All Phase 7 feature tests
npm run test:phase-8       # All Phase 8 feature tests

# Run all examples
npm run example            # Invoice example
npm run example:watermark  # Phase 7B: Watermarks
npm run example:bookmarks  # Phase 7A: Bookmarks & outline
npm run example:toc        # Phase 7D: Table of contents
npm run example:rtl        # Phase 7F: RTL text (Arabic/Hebrew)
npm run example:encryption # Phase 7G: Password protection
npm run example:forms      # Phase 8B: Interactive forms
npm run example:callout    # Phase 8D: Callout boxes
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
├── index.ts           # Main API: render(), createPdf(), assemble()
├── types.ts           # All TypeScript interfaces
├── errors.ts          # Error codes and PretextPdfError class
├── validate.ts        # Schema validation for all element types
├── measure.ts         # Text measurement & sizing logic
├── paginate.ts        # Page break logic & flow control
├── render.ts          # PDF rendering: fonts, text, tables, images
├── fonts.ts           # Font loading, embedding, subsetting
├── rich-text.ts       # Rich paragraph parsing & layout
├── assets.ts          # Bundled asset paths (fonts, icons)
├── node-polyfill.ts   # Node.js compatibility shims
└── builder.ts         # Fluent builder API (createPdf fluency)
```

## Feature Phases

Each phase adds new capabilities. Current status:

| Phase | Feature | Status |
|-------|---------|--------|
| 1-4 | Core rendering | ✅ Complete |
| 5 | Rich text / Builder | ✅ Complete |
| 6 | Advanced features | ✅ Complete |
| 7A-7G | Bookmarks, watermarks, encryption, TOC, RTL | ✅ Complete |
| 8A | Comments/Annotations | ✅ Complete |
| 8B | Interactive forms (text/checkbox/radio/dropdown/button) | ✅ Complete |
| 8C | Document assembly | ✅ Complete |
| 8D | Callout boxes (info/warning/tip/note) | ✅ Complete |
| 8E | Signature placeholder | ✅ Complete |
| 8F | Document metadata (language, producer) | ✅ Complete |
| 8G | Hyperlinks | ✅ Complete |
| 8H | Inline formatting (super/subscript, letterSpacing, smallCaps) | ✅ Complete |

## Reporting Bugs

Include:
1. Node.js version (`node -v`)
2. pretext-pdf version (from package.json)
3. Minimal reproduction code (TypeScript or JavaScript)
4. Expected vs actual output
5. PDF screenshot if visual issue

Example:
```
**Environment:** Node.js 20.10, pretext-pdf 0.1.0

**Code:**
```typescript
const pdf = await render({
  pageSize: 'A4',
  content: [{ type: 'paragraph', text: 'hello' }]
})
```

**Expected:** PDF renders with proper kerning
**Actual:** Text appears with loose spacing
```

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
