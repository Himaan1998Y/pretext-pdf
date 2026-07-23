# Upstream Vendor Attribution — @chenglou/pretext

`src/vendor/pretext/` contains a **vendored snapshot** of the MIT-licensed
[@chenglou/pretext](https://github.com/chenglou/pretext) library, patched with
fixes cherry-picked from upstream PRs that had not yet been included in a
published npm release.

---

## Provenance

| Field             | Value |
|-------------------|-------|
| Upstream repo     | https://github.com/chenglou/pretext |
| Fork repo         | https://github.com/Himaan1998Y/pretext |
| Upstream base tag | `v0.0.8` (commit `a79a6a5`) |
| Vendored tag      | `v0.0.8-patched.1` (commit `e758ec5`) |
| License           | MIT — "Copyright (c) 2026 Pretext contributors" |
| Vendored files    | `src/vendor/pretext/*.ts` (9 source files, see below) |

---

## Vendored Source Files

```
src/vendor/pretext/
  analysis.ts         — text analysis helpers
  bidi.ts             — bidirectional text (Unicode Bidi Algorithm)
  generated/
    bidi-data.ts      — auto-generated bidi category tables
  layout.ts           — main layout engine (layoutNextLine, etc.)
  line-break.ts       — Unicode line-break algorithm
  line-text.ts        — plain-text line helpers
  measurement.ts      — canvas-free text measurement
  rich-inline.ts      — rich inline (spans, letter-spacing, etc.)
  text-modules.d.ts   — ambient type declarations
```

Test files (`layout.test.ts`, `test-data.ts`) are **not** vendored.

---

## Cherry-Picked Upstream Fixes

7 upstream PRs are cherry-picked on top of `v0.0.8`. Each fix addresses a
correctness or performance bug in the upstream code that was not yet published
to npm at the time of vendoring.

| PR    | Commit(s) in fork  | Description |
|-------|--------------------|-------------|
| #132  | `039b208`          | Prevent rich-inline CJK fragments from overflowing `maxWidth` |
| #161  | `bfc10c8`          | Cache breakable fit-advances per mode (perf fix) |
| #138  | `2c771b2`          | Unify `stepRichInlineLine`/`Stats`, remove `containsCJKText` wrapper |
| #140  | `4571c64`          | O(1) chunk layout side table (stream-friendly) |
| #3    | `6b40bb4`, `58dd9ff` | Fix bidi surrogate handling, ctx.font caching, emoji, soft-hyphen type soundness |
| #165  | `86fd5b3`          | Fix German low opening quote (`„`, U+201E) breaking at line-start |
| #29   | `bd76aad`, `658edfe` | Include trailing collapsible space in line boundary for reconstruction |

**Retired this upgrade:**

- PR #119 ("skip no-op merge passes in analysis pipeline") — upstream's own
  `v0.0.8` work generalized the same code path (`mergeAsciiPunctuationChains`
  → `mergeNoSpaceWordChains`), handling CJK/emoji/unicode punctuation in
  addition to plain ASCII chains, making our narrower patch redundant.
- PR #105 ("currency symbols stick to adjacent numbers", `4c8c249`/`fc71581`)
  — upstream's own `v0.0.8` `isLineBreakNumericAffix`/UAX #14 PR/PO-class
  handling (`src/vendor/pretext/analysis.ts`) is a strict superset: it covers
  `$`, `£`, `¥`, `€`, `%`, `°`, etc. via proper Unicode numeric-affix
  classification, not just a currency-symbol regex.

Both are the scenario the Upgrade Procedure below anticipates.

**New in `v0.0.8` base (not a cherry-pick — ships with upstream):** long
unbreakable runs (URLs, hyphenated compounds) that must be force-broken now
prefer breaking right after a dash/hyphen character instead of at an
arbitrary grapheme, matching real browser wrap behavior. See
`getBreakablePreferredBreaks`/`isPreferredBreakGrapheme` in `layout.ts`.

### Commits NOT vendored (fork infrastructure only)

The following commits exist on the fork but contain **no source code changes**
and are not included in the vendor snapshot:

| Commit   | Reason excluded |
|----------|-----------------|
| `f1a3c75` | Pre-built dist committed for GitHub URL install — not needed when vendoring src |
| `c99eb55` | Fork tracking docs (upstream-sync status) |
| `552ea45` | Upstream sync automation CI workflow |
| `f96c09e` | Fix sync-upstream CI workflow |
| `8b8b71e` | Tracking status docs update |
| `9b61450` | `sideEffects: false` in package.json — not applicable to vendored src |
| `e8e04d3` | Remove comments in layout.ts — cosmetic |
| `d92d43b` | Add test coverage for public APIs — test-only |

---

## Upgrade Procedure

When upstream publishes a new npm release that includes these 9 PRs:

1. Update `src/vendor/pretext/` from the new upstream tag.
2. Verify each PR from the table above is included upstream.
3. Remove any now-redundant patches from this table.
4. Update `version` and `commit` fields at the top of this file.
5. Run `npm run test:phases` to verify no regressions.

If upstream never publishes these fixes, re-evaluate vendoring vs publishing
a scoped fork to npm (e.g. `@himaan693/pretext`).

---

## License

The original source is distributed under the MIT License:

> MIT License
>
> Copyright (c) 2026 Pretext contributors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.

Full license text: [chenglou/pretext — LICENSE](https://github.com/chenglou/pretext/blob/main/LICENSE)
