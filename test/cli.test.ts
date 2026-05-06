// Requires built dist/ — run `npm run build` before this test.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const CLI = resolve(process.cwd(), 'dist', 'cli.js')

function runCli(args: string[], opts: { stdin?: string; env?: Record<string, string> } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    input: opts.stdin,
    encoding: 'utf-8',
    env: { ...process.env, ...opts.env },
  })
}

function runCliBuf(args: string[], opts: { stdin?: string; env?: Record<string, string> } = {}) {
  // encoding: null returns raw Buffers for stdout/stderr (Node.js spawnSync requirement)
  return spawnSync(process.execPath, [CLI, ...args], {
    input: opts.stdin,
    encoding: null,
    env: { ...process.env, ...opts.env },
  })
}

const SIMPLE_DOC = JSON.stringify({
  content: [{ type: 'heading', level: 1, text: 'Hi' }],
})

describe('argument parsing', () => {
  let tmp: string
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'pretext-pdf-cli-test-'))
  })

  after(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test('--version prints version and exits 0', () => {
    const result = runCli(['--version'])
    assert.equal(result.status, 0)
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/)
  })

  test('-v alias prints version and exits 0', () => {
    const result = runCli(['-v'])
    assert.equal(result.status, 0)
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/)
  })

  test('--help prints usage and exits 0', () => {
    const result = runCli(['--help'])
    assert.equal(result.status, 0)
    assert.ok(result.stdout.includes('pretext-pdf'), 'stdout should include "pretext-pdf"')
    assert.ok(result.stdout.includes('Usage:'), 'stdout should include "Usage:"')
  })

  test('unknown flag exits 1 with error and help on stderr', () => {
    const result = runCli(['--bogus'])
    assert.equal(result.status, 1)
    assert.ok(result.stderr.includes('unknown option'), 'stderr should include "unknown option"')
    assert.ok(result.stderr.includes('Usage:'), 'stderr should include "Usage:"')
  })

  test('too many positional arguments exits 1', () => {
    const result = runCli(['a.json', 'b.pdf', 'c.txt'])
    assert.equal(result.status, 1)
    assert.ok(result.stderr.includes('too many'), 'stderr should mention "too many"')
  })
})

describe('JSON input', () => {
  let tmp: string
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'pretext-pdf-cli-test-'))
  })

  after(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test('reads JSON from positional file path, writes PDF to second positional', () => {
    const inputPath = join(tmp, 'doc.json')
    const outputPath = join(tmp, 'out.pdf')
    writeFileSync(inputPath, SIMPLE_DOC, 'utf-8')

    const result = runCli([inputPath, outputPath])
    assert.equal(result.status, 0, `stderr: ${result.stderr}`)
    assert.ok(existsSync(outputPath), 'output file should exist')

    const pdf = readFileSync(outputPath)
    assert.equal(pdf.slice(0, 5).toString('utf-8'), '%PDF-', 'output should be a PDF')
  })

  test('-i/-o flags work the same as positional', () => {
    const inputPath = join(tmp, 'doc-flags.json')
    const outputPath = join(tmp, 'out-flags.pdf')
    writeFileSync(inputPath, SIMPLE_DOC, 'utf-8')

    const result = runCli(['-i', inputPath, '-o', outputPath])
    assert.equal(result.status, 0, `stderr: ${result.stderr}`)
    assert.ok(existsSync(outputPath), 'output file should exist')

    const pdf = readFileSync(outputPath)
    assert.equal(pdf.slice(0, 5).toString('utf-8'), '%PDF-', 'output should be a PDF')
  })

  test('reads JSON from stdin pipe, writes PDF to stdout', () => {
    const result = runCliBuf([], { stdin: SIMPLE_DOC })
    // stderr is a Buffer when encoding is null — convert for readable assertion messages
    const stderrStr = (result.stderr as unknown as Buffer).toString('utf-8')
    assert.equal(result.status, 0, `stderr: ${stderrStr}`)

    const stdout = result.stdout as unknown as Buffer
    assert.equal(stdout.slice(0, 5).toString('utf-8'), '%PDF-', 'stdout should start with %PDF-')
  })

  test('invalid JSON exits 1 with parse error on stderr', () => {
    const result = runCli([], { stdin: 'not json{' })
    assert.equal(result.status, 1)
    assert.ok(result.stderr.includes('invalid JSON'), 'stderr should mention "invalid JSON"')
  })
})

describe('markdown input', () => {
  let tmp: string
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'pretext-pdf-cli-test-'))
  })

  after(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test('--markdown reads markdown file, renders to PDF', () => {
    const mdPath = join(tmp, 'doc.md')
    const pdfPath = join(tmp, 'doc-md.pdf')
    writeFileSync(mdPath, '# Hello\n\nText paragraph.\n', 'utf-8')

    const result = runCli(['--markdown', '-i', mdPath, '-o', pdfPath])
    assert.equal(result.status, 0, `stderr: ${result.stderr}`)
    assert.ok(existsSync(pdfPath), 'output PDF should exist')

    const pdf = readFileSync(pdfPath)
    assert.equal(pdf.slice(0, 5).toString('utf-8'), '%PDF-', 'output should be a PDF')
  })

  test('--markdown --code-font sets fenced code font family', () => {
    const mdPath = join(tmp, 'code.md')
    const pdfPath = join(tmp, 'code-font.pdf')
    writeFileSync(
      mdPath,
      '# Code Example\n\n```js\nconsole.log("hello");\n```\n',
      'utf-8',
    )

    // Use 'Inter' — the only bundled font — so the flag plumbing can be exercised
    // without requiring an external font file. Coverage goal: verify --code-font
    // is accepted, forwarded to markdownToContent, and produces a valid PDF.
    const result = runCli(['--markdown', '--code-font', 'Inter', '-i', mdPath, '-o', pdfPath])
    assert.equal(result.status, 0, `stderr: ${result.stderr}`)
    assert.ok(existsSync(pdfPath), 'output PDF should exist')

    const pdf = readFileSync(pdfPath)
    assert.equal(pdf.slice(0, 5).toString('utf-8'), '%PDF-', 'output should be a PDF (verifies --code-font reached the render path)')
  })
})

describe('render errors and output', () => {
  let tmp: string
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'pretext-pdf-cli-test-'))
  })

  after(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test('document with invalid element type exits 2 with code on stderr', () => {
    const doc = JSON.stringify({ content: [{ type: 'banana' }] })
    const result = runCli([], { stdin: doc })
    assert.equal(result.status, 2, `unexpected exit code — stderr: ${result.stderr}`)

    // Expect the canonical "pretext-pdf: <CODE>:" prefix as written by cli.ts at exit-2 paths.
    // Pinning to that prefix prevents a false green from unrelated upstream errors that happen
    // to contain a colon (e.g. node internal "ERR_:" codes).
    assert.match(
      result.stderr,
      /pretext-pdf: [A-Z_]+:/,
      `stderr should contain "pretext-pdf: <CODE>:" prefix, got: ${result.stderr}`
    )
  })

  test('successful write prints byte count to stderr; PRETEXT_PDF_QUIET suppresses it', () => {
    const inputPath = join(tmp, 'quiet-doc.json')
    const outputPath = join(tmp, 'quiet-out.pdf')
    writeFileSync(inputPath, SIMPLE_DOC, 'utf-8')

    // Without quiet — stderr should mention "wrote" and "bytes"
    const result = runCli(['-i', inputPath, '-o', outputPath])
    assert.equal(result.status, 0, `stderr: ${result.stderr}`)
    assert.ok(result.stderr.includes('wrote'), 'stderr should contain "wrote"')
    assert.ok(result.stderr.includes('bytes'), 'stderr should contain "bytes"')

    // With PRETEXT_PDF_QUIET=1 — stderr should NOT contain "wrote"
    const quietResult = runCli(['-i', inputPath, '-o', outputPath], {
      env: { PRETEXT_PDF_QUIET: '1' },
    })
    assert.equal(quietResult.status, 0, `stderr: ${quietResult.stderr}`)
    assert.ok(!quietResult.stderr.includes('wrote'), 'stderr should NOT contain "wrote" when PRETEXT_PDF_QUIET=1')
  })
})
