import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../src/index.js'

describe('logger routing — RenderOptions.logger', () => {
  test('logger.warn receives image-load-failed warnings instead of console.warn', async () => {
    const warnings: string[] = []
    const logger = { warn: (msg: string, ..._args: unknown[]) => { warnings.push(msg) } }

    // Capture console.warn to ensure it is NOT called for routed warnings
    const consoleWarnings: string[] = []
    const originalConsoleWarn = console.warn
    console.warn = (msg: string) => { consoleWarnings.push(msg) }

    try {
      // http:// URL is blocked by assertSafeUrl (SSRF prevention) and produces
      // an "Image load skipped" warning — the canonical advisory warning path.
      await render(
        {
          content: [
            { type: 'paragraph', text: 'Test' },
            { type: 'image', src: 'http://example.com/blocked.png' },
          ],
        },
        { logger }
      )
    } finally {
      console.warn = originalConsoleWarn
    }

    assert.ok(
      warnings.some(w => w.includes('[pretext-pdf]') && w.includes('Image load skipped')),
      `Expected logger.warn to receive a routed [pretext-pdf] image-load warning. Got: ${JSON.stringify(warnings)}`
    )
    assert.ok(
      !consoleWarnings.some(w => w.includes('Image load skipped')),
      `Expected console.warn to NOT receive routed warnings when logger is provided. Got: ${JSON.stringify(consoleWarnings)}`
    )
  })

  test('default behavior (no logger) routes warnings to console.warn', async () => {
    const consoleWarnings: string[] = []
    const originalConsoleWarn = console.warn
    console.warn = (msg: string) => { consoleWarnings.push(msg) }

    try {
      await render({
        content: [
          { type: 'paragraph', text: 'Test' },
          { type: 'image', src: 'http://example.com/blocked.png' },
        ],
      })
    } finally {
      console.warn = originalConsoleWarn
    }

    assert.ok(
      consoleWarnings.some(w => typeof w === 'string' && w.includes('[pretext-pdf]')),
      `Expected console.warn to receive [pretext-pdf] warnings when no logger is provided. Got: ${JSON.stringify(consoleWarnings)}`
    )
  })
})
