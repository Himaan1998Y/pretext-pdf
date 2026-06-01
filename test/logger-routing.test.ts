import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { render, validate } from '../src/index.js'

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

describe('callout deprecation warning routing — validation time', () => {
  test('logger.warn receives callout content→text deprecation warning', () => {
    const warnings: string[] = []
    const logger = { warn: (msg: string, ..._args: unknown[]) => { warnings.push(msg) } }

    const doc = {
      content: [
        {
          type: 'callout' as const,
          content: 'This uses the deprecated "content" field',
        },
      ],
    }

    validate(doc, { logger })

    assert.ok(
      warnings.some(w => w.includes('DEPRECATION') && w.includes('content') && w.includes('text') && w.includes('v3.0')),
      `Expected deprecation warning about content→text migration. Got: ${JSON.stringify(warnings)}`
    )
  })

  test('callout with both content and text fields does NOT trigger warning', () => {
    const warnings: string[] = []
    const logger = { warn: (msg: string, ..._args: unknown[]) => { warnings.push(msg) } }

    const doc = {
      content: [
        {
          type: 'callout' as const,
          content: 'Old field',
          text: 'New field (v3.0 compatible)',
        },
      ],
    }

    validate(doc, { logger })

    // Warning should NOT fire when both fields are present
    assert.ok(
      !warnings.some(w => w.includes('DEPRECATION')),
      `Should not warn when text field is also present. Got: ${JSON.stringify(warnings)}`
    )
  })

  test('callout with content field validates successfully in v2.1 despite deprecation', () => {
    const doc = {
      content: [
        {
          type: 'callout' as const,
          content: 'Still accepted in v2.1',
        },
      ],
    }

    // Should NOT throw even with deprecation warning
    assert.doesNotThrow(() => {
      validate(doc)
    })
  })
})
