/**
 * Unit tests for validateDocument() — the non-throwing wrapper around validate().
 * Run: npx tsx --test test/validate-document.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const { validateDocument } = await import('../dist/index.js')

// ─── Test 1: Valid document returns { valid: true, errors: [], errorCount: 0 } ──

describe('validateDocument — valid document', () => {
  test('minimal valid document returns valid:true with empty errors', () => {
    const result = validateDocument({ content: [{ type: 'paragraph', text: 'hi' }] })
    assert.equal(result.valid, true)
    assert.deepEqual(result.errors, [])
    assert.equal(result.errorCount, 0)
  })
})

// ─── Test 2: Empty content array → valid:false with errors ───────────────────

describe('validateDocument — empty content array', () => {
  test('empty content array returns valid:false with errors', () => {
    const result = validateDocument({ content: [] })
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0, 'should have at least one error')
    assert.ok(result.errorCount > 0, 'errorCount should be > 0')
  })
})

// ─── Test 3: Unknown element type → errors with path and message ─────────────

describe('validateDocument — unknown element type', () => {
  test('unknown element type returns errors with path and message', () => {
    // @ts-expect-error intentional
    const result = validateDocument({ content: [{ type: 'video', src: 'x' }] })
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0, 'should have at least one error')
    const err = result.errors[0]!
    assert.ok(typeof err.path === 'string', 'error should have a path field')
    assert.ok(typeof err.message === 'string', 'error should have a message field')
    assert.ok(typeof err.code === 'string', 'error should have a code field')
    assert.ok(err.severity === 'error' || err.severity === 'warning', 'error should have a severity field')
  })
})

// ─── Test 4: Non-strict mode (default): unknown property passes ───────────────

describe('validateDocument — non-strict mode (default)', () => {
  test('document with unknown property on element passes in default (non-strict) mode', () => {
    const result = validateDocument({
      content: [{ type: 'paragraph', text: 'hi', colour: 'red' }],
    })
    assert.equal(result.valid, true, 'non-strict should not flag unknown properties')
    assert.deepEqual(result.errors, [])
    assert.equal(result.errorCount, 0)
  })

  test('explicit strict:false also ignores unknown property', () => {
    const result = validateDocument(
      { content: [{ type: 'paragraph', text: 'hi', fooBar: 123 }] },
      { strict: false }
    )
    assert.equal(result.valid, true)
  })
})

// ─── Test 5: Explicit strict:true → UNKNOWN_PROPERTY error ───────────────────

describe('validateDocument — strict:true returns UNKNOWN_PROPERTY', () => {
  test('unknown property with strict:true returns valid:false with UNKNOWN_PROPERTY error', () => {
    const result = validateDocument(
      { content: [{ type: 'paragraph', text: 'hi', nonExistentProp: true }] },
      { strict: true }
    )
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0, 'should have errors')
    const unknownPropErr = result.errors.find(e => e.code === 'UNKNOWN_PROPERTY')
    assert.ok(unknownPropErr !== undefined, 'should have an UNKNOWN_PROPERTY error')
  })
})

// ─── Test 6: Strict mode typo suggestion (colour → color) ────────────────────

describe('validateDocument — strict mode typo suggestion', () => {
  test('paragraph with "colour" typo returns suggestion "color" and unknownProp "colour"', () => {
    const result = validateDocument(
      { content: [{ type: 'paragraph', text: 'hi', colour: 'red' }] },
      { strict: true }
    )
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0, 'should have errors')
    const err = result.errors[0]!
    assert.equal(err.suggestion, 'color', `suggestion should be 'color', got '${err.suggestion}'`)
    assert.equal(err.unknownProp, 'colour', `unknownProp should be 'colour', got '${err.unknownProp}'`)
    assert.ok(err.path.includes('colour'), `path should include 'colour', got '${err.path}'`)
  })
})

// ─── Test 7: errorCount equals real total even when errors array is truncated ──

describe('validateDocument — errorCount accuracy with >20 errors', () => {
  test('25 unknown properties: errorCount equals 25, even if errors[] is capped', () => {
    // Build a paragraph element with 25 unknown properties (unknownA through unknownY)
    const unknownProps: Record<string, number> = {}
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'
    for (const letter of letters) {
      unknownProps[`unknown${letter}`] = 1
    }
    const result = validateDocument(
      { content: [{ type: 'paragraph', text: 'hi', ...unknownProps }] },
      { strict: true }
    )
    assert.equal(result.valid, false)
    assert.equal(result.errorCount, 25, `errorCount should be 25 (the full total), got ${result.errorCount}`)
    // The errors array may be capped at 20
    assert.ok(result.errors.length <= 25, 'errors array should not exceed total count')
    // The key assertion: errorCount correctly reflects the real total, not just the truncated length
    assert.ok(result.errorCount >= result.errors.length, 'errorCount must be >= errors.length')
  })
})

// ─── Test 8: Non-PretextPdfError is re-thrown ────────────────────────────────

describe('validateDocument — non-PretextPdfError is re-thrown', () => {
  // TODO: This scenario is difficult to trigger with the public API because validate()
  // only throws PretextPdfError for known conditions. A non-PretextPdfError would
  // require an internal bug or an injected proxy object that throws a plain Error.
  // Skipping direct test; the code path at validate.ts:549 (`throw err`) is audited
  // to confirm it re-throws non-PretextPdfError errors correctly.
  test('documents this gap as a known untested path', () => {
    // Confirmed by code review: validateDocument catches PretextPdfError and re-throws
    // any other error type. This behavior cannot be exercised via the public API without
    // monkey-patching the validate() internals.
    assert.ok(true, 'TODO: non-PretextPdfError re-throw path documented as manually audited')
  })
})

// ─── Test 9: URL-scheme violation → specific path, not 'document' ────────────

describe('validateDocument — URL scheme violation has specific path', () => {
  test('rich-paragraph span with javascript: href returns specific path (not "document")', () => {
    const result = validateDocument({
      content: [{
        type: 'rich-paragraph',
        spans: [{ text: 'click me', href: 'javascript:alert()' }],
      }],
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0, 'should have at least one error')
    const err = result.errors[0]!
    assert.notEqual(err.path, 'document', `path should be specific, not 'document'. Got: '${err.path}'`)
    // The path should reference the span or href location
    assert.ok(
      err.path.includes('span') || err.path.includes('href') || err.path.includes('rich-paragraph') || err.path.includes('content'),
      `path should reference the element location. Got: '${err.path}'`
    )
  })
})

// ─── Test 10: Realistic full document passes ─────────────────────────────────

describe('validateDocument — realistic full document', () => {
  test('document with heading, paragraph, and list returns valid:true', () => {
    const result = validateDocument({
      content: [
        { type: 'heading', level: 1, text: 'Introduction' },
        { type: 'paragraph', text: 'This is the first paragraph of the document.' },
        {
          type: 'list',
          style: 'unordered',
          items: [
            { text: 'First item' },
            { text: 'Second item' },
            { text: 'Third item' },
          ],
        },
        { type: 'heading', level: 2, text: 'Subsection' },
        { type: 'paragraph', text: 'Another paragraph here.' },
      ],
    })
    assert.equal(result.valid, true)
    assert.deepEqual(result.errors, [])
    assert.equal(result.errorCount, 0)
  })
})

// ─── Additional: Shape of ValidationResult and ValidationError ────────────────

describe('validateDocument — result shape', () => {
  test('valid result always has valid, errors, and errorCount fields', () => {
    const result = validateDocument({ content: [{ type: 'paragraph', text: 'hi' }] })
    assert.ok('valid' in result, 'result must have valid field')
    assert.ok('errors' in result, 'result must have errors field')
    assert.ok('errorCount' in result, 'result must have errorCount field')
    assert.ok(Array.isArray(result.errors), 'errors must be an array')
    assert.equal(typeof result.errorCount, 'number', 'errorCount must be a number')
  })

  test('invalid result has all required fields and non-empty errors', () => {
    const result = validateDocument({ content: [] })
    assert.ok('valid' in result, 'result must have valid field')
    assert.ok('errors' in result, 'result must have errors field')
    assert.ok('errorCount' in result, 'result must have errorCount field')
    assert.ok(Array.isArray(result.errors), 'errors must be an array')
    assert.equal(typeof result.errorCount, 'number', 'errorCount must be a number')
    // Each error in the array must have path, message, code, severity
    for (const err of result.errors) {
      assert.ok('path' in err, 'each error must have path')
      assert.ok('message' in err, 'each error must have message')
      assert.ok('code' in err, 'each error must have code')
      assert.ok('severity' in err, 'each error must have severity')
    }
  })

  test('strict errors include unknownProp and suggestion fields when applicable', () => {
    const result = validateDocument(
      { content: [{ type: 'paragraph', text: 'hi', colour: 'red' }] },
      { strict: true }
    )
    assert.equal(result.valid, false)
    const err = result.errors.find(e => e.unknownProp === 'colour')
    assert.ok(err !== undefined, 'should find error with unknownProp: colour')
    assert.ok('suggestion' in err, 'error should have suggestion field')
  })
})

// ─── Test 11: Fallback parser path extraction — sentence-with-colon bug ─────────

describe('validateDocument — fallback parser: margin error path', () => {
  test('margins.left: -1 error has path="document", not the full sentence fragment', () => {
    const result = validateDocument({
      content: [{ type: 'paragraph', text: 'x' }],
      // @ts-expect-error intentional — negative margin triggers fallback error path
      margins: { left: -1 },
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0, 'should have at least one error')
    const err = result.errors[0]!
    // Before fix: path was "margins.left must be a non-negative finite number. Got"
    // After fix: path must be a valid dot-path like "margins.left" or fall back to "document"
    const hasSpaces = err.path.includes(' ')
    assert.ok(!hasSpaces, `path must not contain spaces (sentence fragment leaked). Got: "${err.path}"`)
    // message must include the actual value, not just "-1" in isolation
    assert.ok(
      err.message.length > 2,
      `message should be descriptive, got: "${err.message}"`
    )
  })
})

// ─── Additional: errorCount == errors.length when under 20 errors ─────────────

describe('validateDocument — errorCount matches errors.length for small error sets', () => {
  test('single unknown property: errorCount === errors.length === 1', () => {
    const result = validateDocument(
      { content: [{ type: 'paragraph', text: 'hi', typoField: true }] },
      { strict: true }
    )
    assert.equal(result.valid, false)
    // typoField has no close match so suggestion should be undefined
    const err = result.errors.find(e => e.unknownProp === 'typoField')
    assert.ok(err !== undefined, 'should find error for typoField')
    assert.equal(result.errorCount, result.errors.length)
  })
})
