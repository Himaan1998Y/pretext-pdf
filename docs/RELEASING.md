# Releasing pretext-pdf

CI has an automated, tag-triggered publish pipeline (`.github/workflows/ci.yml`). For most of this project's history it wasn't actually used — releases went out via manual local `npm publish`, which is how three independent CI breaks (README badges, the API-surface snapshot, an example script) went unnoticed for two months (fixed in `v2.1.1`). Follow this checklist so that doesn't happen again.

## Before you start

Confirm `NPM_TOKEN` isn't close to expiring: `gh secret list -R Himaan1998Y/pretext-pdf` shows when it was last set. Granular npm tokens commonly expire in ~90 days. If it's close, rotate it now (see "Rotating NPM_TOKEN" below) — a release blocked on this mid-flight is exactly what happened for `v2.1.1`.

## 1. Local pre-flight (all of this must pass before you tag anything)

```bash
npm run build                          # tsc — must be clean
npm run api:check                      # fails if public API surface drifted from etc/pretext-pdf.api.md
npm run verify:badges:full             # fails if README's runtime-deps/tests counts drifted from reality
npm audit --audit-level=high           # the exact gate CI enforces — must exit 0
npm test                               # contract + unit + e2e + phases + benchmark (~1 min)
npm run test:visual                    # not part of `npm test` (baselines are machine-specific) — run separately
```

Then smoke-test every example script — CI runs these too, and they're the kind of thing that silently rots (see `v2.1.1`'s `examples/phase8-forms.ts` bug):

```bash
npm run example:watermark && npm run example:bookmarks && npm run example:toc && npm run example:rtl && npm run example:encryption
npm run example:hyperlinks && npm run example:annotations && npm run example:assembly && npm run example:inline && npm run example:forms && npm run example:callout
```

If `api:check` reports a surface change, run `npm run api:extract` to regenerate `etc/pretext-pdf.api.md` and re-run `api:check` to confirm it's clean before proceeding.

## 2. Version bump and changelog

- Bump `version` in `package.json` — semver: patch for bug fixes, minor for additive/backward-compatible changes (including vendored-engine upgrades that add behavior, per `v2.2.0`), major for breaking changes.
- Add a new `## [X.Y.Z] — YYYY-MM-DD` entry at the top of `CHANGELOG.md`, above the previous entry. Follow the existing sections (`### Added` / `### Changed` / `### Fixed` / `### Security` / `### Testing`) — whichever apply.
- If the release changes anything in `docs/ROADMAP.md`'s "Next" backlog (closes an item, opens a new one, or the vendored engine's provenance changed — see `UPSTREAM.md`), update it in the same commit. Bump the `Last updated`/`Current version` header and add a milestone row to "Shipped" (only for releases with a real theme, not every patch — see the file's own "Update discipline" section).

## 3. Commit, tag, push

```bash
git add <changed files>                # never `git add -A` — review what's staged
git commit -m "..."                    # conventional commit style (feat:/fix:/docs:/etc.)
git tag vX.Y.Z
git push origin master
git push origin vX.Y.Z                 # this is what triggers CI's publish job
```

## 4. Verify the actual CI run — don't assume it worked

```bash
gh run list -R Himaan1998Y/pretext-pdf --limit 3
gh run view <run-id> -R Himaan1998Y/pretext-pdf --json status,conclusion,jobs
```

All of `test (20.x)`, `test (22.x)`, `ci-ok`, `publish`, and `release` must show `success`. If `publish` fails with `npm error 404 Not Found - PUT .../pretext-pdf` after provenance signs successfully, that's an expired/invalid `NPM_TOKEN` (see below), not a transient error — rotate the token and re-run: `gh run rerun <run-id> -R Himaan1998Y/pretext-pdf --failed`.

Finally, confirm it's actually live:

```bash
npm view pretext-pdf dist-tags --json   # "latest" should now be your new version
```

**A release isn't done until this step passes.** A green `master` push and a pushed tag are necessary but not sufficient — only a `publish: success` + a matching `npm view` output confirm it shipped.

## Rotating `NPM_TOKEN`

1. [npmjs.com](https://www.npmjs.com) → profile icon → **Access Tokens** → **Generate New Token** → **Granular Access Token**.
2. Permissions: **Read and write**. Packages: scope it to `pretext-pdf` specifically, not the whole account. Expiration: the longest option available.
3. Copy the token immediately (`npm_...` — shown once).
4. `github.com/Himaan1998Y/pretext-pdf` → **Settings** → **Secrets and variables** → **Actions** → `NPM_TOKEN` → **Update secret** → paste → save.

## If vendor-engine work is involved (`src/vendor/pretext/`)

See `UPSTREAM.md` for the fork's provenance and cherry-pick table, and the "Vendor upgrades on this engine are high-risk" note in project memory. In short: don't trust `git rebase`'s automatic conflict resolution on this codebase without independently re-verifying (diff function-name inventories between old and new, re-read the changed logic), and get an independent review (fresh subagent, or another person) before tagging — self-review alone has missed real issues here before.
