# validate/elements

Per-element validators dispatched from `src/validate/index.ts`. Each file groups
validators by concern, not by element-count. Keeping these grouped (rather than
one-file-per-element) avoids fragmenting tiny helpers and makes the dispatcher
easier to scan.

## File layout

| File | Element types |
|------|---------------|
| `text.ts` | `paragraph`, `heading`, `rich-paragraph`, `blockquote`, `callout`, `code` |
| `table.ts` | `table` |
| `list.ts` | `list` |
| `media.ts` | `image`, `svg`, `qr-code`, `barcode`, `chart` |
| `structural-simple.ts` | `spacer`, `hr`, `toc`, `toc-entry`, `comment` |
| `forms-floats.ts` | `form-field`, `footnote-def`, `float-group` |

`page-break` has no fields to validate and is handled inline in the dispatcher.

## Adding a new element type

1. Pick the file whose concern fits (or create a new one if the new type starts
   a genuinely new category — don't reach for a new file lightly).
2. Add a validator function with the standard signature (see below).
3. Register the validator in the `switch` in `src/validate/index.ts`.
4. Add the property allow-list to `ALLOWED_PROPS` in `src/allowed-props.ts`
   (used by strict mode to catch unknown props).
5. Add the type literal to `ELEMENT_TYPES` in `src/element-types.ts` so the
   "unknown element type" error message and drift-guard tests stay accurate.
6. If the new element interacts with rendering pipelines (measure, paint,
   bookmarks, footnotes, etc.) update the relevant drift-guards as well.

## Validator signature contract

All per-element validators follow the same shape:

```ts
function validateX(
  el: Extract<ContentElement, { type: 'x' }>,
  prefix: string,
  ctx: ValidationContext,
): void
```

- `el` is the element narrowed to its discriminant.
- `prefix` is the human-readable path the dispatcher computed (e.g.
  `content[3]`), pre-formatted so error messages can be built with a single
  template literal.
- `ctx` carries the per-call validation state (`errors`, `strict`,
  `loadedFamilies`, `seen`, `options`). See `helpers.ts` for the type.

A few validators (`validateTable`, `validateList`, `validateRichParagraph`,
`validateFloatGroup`) also take `depth` between `prefix` and `ctx` because they
recurse — the dispatcher passes the current depth down so `assertDepthOk` and
`withCycleGuard` can enforce limits.

### `_ctx` policy

Validators that don't currently consume `ctx` must still accept it and prefix
the parameter with `_` (e.g. `_ctx: ValidationContext`). This keeps every
validator callable through the same dispatcher signature and signals to
TypeScript + ESLint that the parameter is intentionally unused. Don't drop the
parameter: future strict-mode checks, cross-element wiring, or telemetry hooks
may need it, and re-adding it later is a noisier change than leaving it in
place.

## When to use `withCycleGuard`

Use `withCycleGuard` **only** when a validator recurses into nested
`ContentElement`s. Today that's `validateList`, `validateFloatGroup`, and the
table/rich-paragraph paths. The pattern:

```ts
withCycleGuard(ctx.seen, el, depth + 1, prefix, () => {
  // walk nested children here
})
```

The outer dispatcher in `validate/index.ts` does **not** wrap calls with a cycle
guard — that's the recursing validator's job. The v1.4.1 (M1) fix removed an
outer no-op guard that ran its body and `finally`-deleted the element from
`seen` before the inner guard could add it, which meant cycles slipped past.
Keeping the guard inside the recursing validator is the load-bearing invariant.
