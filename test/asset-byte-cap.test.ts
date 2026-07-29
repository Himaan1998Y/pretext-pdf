/**
 * Regression tests for the download-time byte cap on external image/SVG
 * fetches (readBodyWithLimit, src/assets/security/fetch.ts).
 *
 * Before this fix, loadImageBytes()/resolveSvgContent() read the full
 * response body via resp.arrayBuffer()/resp.text() with no size limit —
 * only a 10s timeout. A huge or malicious response would be buffered
 * entirely into memory regardless of size.
 *
 * These tests exercise readBodyWithLimit() directly against synthetic
 * Response objects (declared Content-Length, and a streamed body with NO
 * declared length) rather than a real network fetch — fetchWithTimeout()
 * rejects http:// outright and requires a real https:// target, so a local
 * test server can't be used to reach the streaming-read code path at all.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readBodyWithLimit } from '../dist/assets/security/fetch.js'
import { PretextPdfError } from '../dist/errors.js'

function responseWithDeclaredLength(bytes: number): Response {
  return new Response(new Uint8Array(bytes), { headers: { 'content-length': String(bytes) } })
}

/** A body streamed WITHOUT a Content-Length header — the case a lying/absent header can't protect against. */
function streamedResponse(totalBytes: number, chunkSize = 1024): Response {
  let sent = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close()
        return
      }
      const n = Math.min(chunkSize, totalBytes - sent)
      controller.enqueue(new Uint8Array(n))
      sent += n
    },
  })
  return new Response(stream)
}

/** Sends a few bytes (staying well under any byte cap) then goes silent forever — simulates a slow-drip stall, not a size violation. */
function stalledResponse(): Response {
  let enqueuedOnce = false
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!enqueuedOnce) {
        enqueuedOnce = true
        controller.enqueue(new Uint8Array(10))
        return
      }
      return new Promise<void>(() => {}) // never resolves — pull() just never returns again
    },
  })
  return new Response(stream)
}

describe('readBodyWithLimit — Content-Length rejection', () => {
  test('rejects immediately when Content-Length already exceeds the cap', async () => {
    const res = responseWithDeclaredLength(2000)
    await assert.rejects(
      () => readBodyWithLimit(res, 1000, 'IMAGE_LOAD_FAILED', 'Image "x"'),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'IMAGE_LOAD_FAILED')
        assert.match(err.message, /exceeds the 1000-byte limit/)
        return true
      }
    )
  })

  test('accepts a response whose declared and actual size are both under the cap', async () => {
    const res = responseWithDeclaredLength(500)
    const bytes = await readBodyWithLimit(res, 1000, 'IMAGE_LOAD_FAILED', 'Image "x"')
    assert.equal(bytes.byteLength, 500)
  })
})

describe('readBodyWithLimit — streaming abort with no (or understated) Content-Length', () => {
  test('aborts once actual streamed bytes exceed the cap, even with no Content-Length declared', async () => {
    const res = streamedResponse(10_000, 512)
    await assert.rejects(
      () => readBodyWithLimit(res, 1000, 'SVG_LOAD_FAILED', 'SVG'),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'SVG_LOAD_FAILED')
        assert.match(err.message, /exceeded the 1000-byte limit while streaming/)
        return true
      }
    )
  })

  test('a small streamed body under the cap is read correctly and completely', async () => {
    const res = streamedResponse(2500, 512)
    const bytes = await readBodyWithLimit(res, 10_000, 'SVG_LOAD_FAILED', 'SVG')
    assert.equal(bytes.byteLength, 2500)
  })

  test('never buffers more than the cap allows before rejecting (memory bound proof)', async () => {
    // A body far larger than any reasonable single asset — this must reject
    // quickly via the streaming path rather than exhausting memory trying to
    // buffer 200MB. If the cap were not enforced during streaming (only via
    // arrayBuffer()), this test would hang or OOM instead of resolving fast.
    const HUGE = 200 * 1024 * 1024
    const res = streamedResponse(HUGE, 64 * 1024)
    const start = Date.now()
    await assert.rejects(() => readBodyWithLimit(res, 1_000_000, 'IMAGE_LOAD_FAILED', 'Image "huge"'))
    assert.ok(Date.now() - start < 5000, 'must reject well before streaming the full 200MB body')
  })
})

describe('readBodyWithLimit — body-read timeout (independent of the byte cap)', () => {
  test('rejects a stalled body (some bytes, then silence) once the read timeout elapses, instead of hanging forever', async () => {
    const res = stalledResponse()
    const start = Date.now()
    await assert.rejects(
      // Explicit short timeout (200ms) instead of the real 10s default — this
      // is exactly why bodyTimeoutMs is a parameter, not a hardcoded constant.
      () => readBodyWithLimit(res, 1_000_000, 'IMAGE_LOAD_FAILED', 'Image "stalled"', 200),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'IMAGE_LOAD_FAILED')
        assert.match(err.message, /took longer than 200ms/)
        return true
      }
    )
    const elapsed = Date.now() - start
    assert.ok(elapsed >= 200 && elapsed < 2000, `should reject shortly after the 200ms timeout, took ${elapsed}ms`)
  })

  test('does not time out a body that finishes comfortably within the window', async () => {
    const res = streamedResponse(5000, 512)
    const bytes = await readBodyWithLimit(res, 10_000, 'IMAGE_LOAD_FAILED', 'Image "ok"', 5000)
    assert.equal(bytes.byteLength, 5000)
  })
})

describe('readBodyWithLimit — no readable body', () => {
  test('rejects a response with no body stream instead of falling back to an unbounded read', async () => {
    const res = new Response(null)
    await assert.rejects(
      () => readBodyWithLimit(res, 1000, 'IMAGE_LOAD_FAILED', 'Image "empty"'),
      /no readable body/
    )
  })
})
