# Contributing to pretext-pdf

## Development Setup

```bash
git clone https://github.com/Himaan1998Y/pretext-pdf
cd pretext-pdf
npm install
npm run build
npm test
```

## Running Tests

```bash
npm test              # Run all test suites
npm run build         # TypeScript compilation
npm run test:unit     # Unit tests only
npm run test:e2e      # E2E tests only
npm run test:contract # Contract tests only
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes and add tests
4. Run `npm run build && npm test` — all tests must pass
5. Commit using conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
6. Open a pull request

## Code Style

- TypeScript with strict mode enabled
- ESM modules only (`"type": "module"` — no CommonJS)
- All public API additions require test coverage
- No new runtime dependencies without discussion (keep the footprint lean)

## Reporting Bugs

Open a [GitHub issue](https://github.com/Himaan1998Y/pretext-pdf/issues) with:
- Node.js version (`node --version`)
- Package version
- Minimal reproducing example
- Expected vs actual behavior
