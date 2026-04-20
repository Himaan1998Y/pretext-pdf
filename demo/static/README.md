# Static GH Pages demo

A fully client-side editor + preview for `pretext-pdf`. No server, no Chromium, no rate limits. JSON in, real PDF out — rendered in the browser.

**Live URL (once deployed):** https://himaan1998y.github.io/pretext-pdf/

---

## How it works

- `index.html` is fully self-contained — no build step.
- `pretext-pdf` is loaded at runtime from [esm.sh](https://esm.sh/) (`https://esm.sh/pretext-pdf@0.8.3`). 0.8.1 fixed module-init crashes in browsers; 0.8.2 fixed rich-paragraph whitespace collapse; 0.8.3 hardens SSRF (IPv4-mapped IPv6 + redirect bypass) and fixes a few content bugs. Older versions will not work in browsers.
- Inter Regular + Bold are fetched from `./fonts/` (same-origin) and injected into every render via `doc.fonts`. This bypasses the library's Node-only bundled-font loader.
- The render call runs in the user's browser via the library's existing browser code path (the polyfill in `src/node-polyfill.ts` is skipped when `window` is defined).

## Local preview

```bash
# From repo root
npx serve demo/static
# Then visit http://localhost:3000
# Note: fonts/ files won't be present locally because the GH Pages workflow
# copies them in at deploy time. For local testing, copy them manually:
mkdir -p demo/static/fonts
cp fonts/Inter-Regular.ttf fonts/Inter-Bold.ttf demo/static/fonts/
```

The copied `demo/static/fonts/` directory is gitignored — see [`.gitignore`](../../.gitignore).

## One-time GitHub Pages setup

The deploy workflow is at [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) and triggers on pushes to `master` that touch `demo/static/**`, `fonts/**`, or the workflow file itself.

Before the first deploy works, enable Pages in repo settings:

1. Go to `https://github.com/Himaan1998Y/pretext-pdf/settings/pages`
2. Under **Build and deployment → Source**, select **GitHub Actions** (not "Deploy from a branch")
3. Save. The next push that triggers the workflow will deploy.

After the first deploy, the live URL appears under **Settings → Pages** and on the workflow run summary.

## What's bundled at deploy time

The workflow assembles `_site/` like this:

```
_site/
├── index.html              ← from demo/static/
├── README.md               ← from demo/static/ (you can ignore this)
├── fonts/
│   ├── Inter-Regular.ttf   ← copied from /fonts/ at the repo root
│   └── Inter-Bold.ttf
└── .nojekyll               ← created in the workflow, prevents Jekyll preprocessing
```

## Limitations

- **First-load network:** ~1 MB total (esm.sh modules + 2 Inter TTFs). Subsequent loads hit browser cache.
- **No SVG / chart / QR / barcode elements** in the demo presets. Those work in the library but require the `@napi-rs/canvas` polyfill, which isn't loaded in the browser bundle. If you want to demo them, switch to the OffscreenCanvas-based browser path or pre-render server-side.
- **No file uploads.** Custom fonts can be added by editing `index.html` to fetch additional TTFs and include them in `doc.fonts`.

## Why not the StackBlitz / VPS demo?

The original demo at `demo/stackblitz/` is a Node HTTP server with rate limits, concurrency control, and server-side rendering — designed for the OVH VPS deploy at [`.github/workflows/deploy-demo.yml`](../../.github/workflows/deploy-demo.yml). That one stays in place; this static demo is the GH-Pages-friendly companion that demonstrates the library's browser path with zero server cost.
