import { Agent, fetch as undiciFetch } from 'undici'
import { PretextPdfError } from '../../errors.js'
import { resolveAndValidateUrl } from './url-validation.js'

/**
 * Hardened remote fetch primitives for image / SVG loading.
 *
 * Extracted from `src/assets.ts` in v1.6.0 commit 8/16 — the architect-flagged
 * highest-risk commit of the split. Key invariants preserved here:
 *
 *   1. NO module-level side effects. In particular, `createPinnedAgent`
 *      must remain lazy — every call constructs a fresh undici Agent that
 *      lives only for the duration of one HTTP request. There is NO module-
 *      level `new Agent({...})` allocation. This preserves the G7 cold-start
 *      perf baseline (the previous home in `src/assets.ts` had the same
 *      lazy behavior).
 *   2. The undici imports are top-level bindings only; no Agent is
 *      constructed at module evaluation time.
 *   3. `fetchWithTimeout` re-validates every redirect hop. Public targets
 *      that 302 to private addresses are rejected at the next hop.
 *   4. `Agent.close()` is fire-and-forget inside `finally` so callers never
 *      block on shutdown.
 *
 * `src/assets.ts` re-exports `fetchWithTimeout` so existing consumers
 * (notably `test/security-ssrf.test.ts` and `test/assets-dns-dedup.test.ts`
 * which import via `'../src/assets.js'` / `'../dist/assets.js'`) keep working.
 * `createPinnedAgent` is intentionally NOT re-exported — it is a private
 * implementation detail of the fetch primitive.
 */

/**
 * Build an undici Agent whose every TCP connection is pinned to the supplied
 * pre-validated IP. Closes the DNS-rebinding TOCTOU window: even if DNS is
 * re-resolved by the runtime mid-flight, the socket targets the IP we already
 * confirmed is public.
 *
 * Caller MUST `close()` the agent after the fetch completes.
 *
 * LAZY: called only inside `fetchWithTimeout`, never at module load.
 */
function createPinnedAgent(ip: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      // Undici accepts a Node `dns.lookup`-compatible function here.
      // We unconditionally return the pre-validated IP so a malicious DNS
      // server cannot rebind to a private address between validation and
      // connect.
      lookup: (
        _hostname: string,
        _options: unknown,
        cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ): void => {
        cb(null, ip, family)
      },
    },
  })
}

/**
 * Fetch with a hard 10-second timeout AND a manual redirect chain that
 * re-validates each hop against `resolveAndValidateUrl`. Without manual
 * redirect handling, a public URL could 302 to `http://127.0.0.1:8080/internal`
 * and bypass the upfront check — the connection would still be made to
 * the private target.
 *
 * Each hop creates a fresh undici Agent that pins the socket to the IP
 * that just passed validation. This defeats DNS-rebinding TOCTOU attacks
 * where an attacker controls a TTL=0 DNS record and swaps the answer
 * between our `dns.lookup()` and the actual TCP connect.
 */
export async function fetchWithTimeout(
  url: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string,
): Promise<Response> {
  const MAX_REDIRECTS = 3
  let currentUrl = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url: parsed, ip, family } = await resolveAndValidateUrl(currentUrl, errorCode, label)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    // Only create a pinned dispatcher when we have a resolved IP. For
    // IP-literal hosts or DNS-unavailable cases we let undici handle
    // resolution itself (a DNS failure there is already safe).
    const pinnedAgent = ip && family ? createPinnedAgent(ip, family) : null

    let res: Response
    try {
      const fetchOpts: Parameters<typeof undiciFetch>[1] = {
        signal: controller.signal,
        redirect: 'manual',
      }
      if (pinnedAgent) {
        // `dispatcher` is an undici-specific extension; cast keeps fetch
        // typings happy without leaking undici types into the public API.
        ;(fetchOpts as unknown as { dispatcher: Agent }).dispatcher = pinnedAgent
      }
      res = (await undiciFetch(parsed.toString(), fetchOpts)) as unknown as Response
    } finally {
      clearTimeout(timer)
      if (pinnedAgent) {
        // Don't block the caller on agent shutdown; swallow close errors.
        void pinnedAgent.close().catch(() => undefined)
      }
    }

    // Undici fetch does not produce `opaqueredirect`, but keep parity with
    // the browser-fetch contract: if we somehow get one, refuse.
    if (res.type === 'opaqueredirect') {
      throw new PretextPdfError(errorCode, `${label}: cannot follow opaque redirect. Pre-resolve the URL.`)
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location')
      if (!loc) throw new PretextPdfError(errorCode, `${label}: redirect (${res.status}) with no Location header`)
      currentUrl = new URL(loc, parsed).toString()
      continue
    }
    return res
  }
  throw new PretextPdfError(errorCode, `${label}: too many redirects (max ${MAX_REDIRECTS})`)
}

/**
 * Read a fetch Response body with a hard byte cap — protects against a
 * remote server (malicious or just huge) exhausting memory during image/SVG
 * loading. Two layers, since either alone is insufficient:
 *
 *   1. `Content-Length` is checked up front and rejected immediately if it
 *      already exceeds the cap, without reading any body bytes.
 *   2. The body is read via a streaming reader that aborts (and cancels the
 *      underlying stream) the moment actual bytes exceed the cap — this is
 *      the layer that matters, since `Content-Length` is caller-supplied and
 *      can be absent or simply wrong (chunked transfer-encoding, a
 *      misconfigured origin, or a deliberately-lying server).
 */
export async function readBodyWithLimit(
  res: Response,
  maxBytes: number,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string,
): Promise<Uint8Array> {
  const declared = res.headers.get('content-length')
  if (declared && Number(declared) > maxBytes) {
    throw new PretextPdfError(errorCode, `${label}: declared size ${declared} bytes exceeds the ${maxBytes}-byte limit`)
  }

  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > maxBytes) {
      throw new PretextPdfError(errorCode, `${label}: response is ${buf.byteLength} bytes, exceeding the ${maxBytes}-byte limit`)
    }
    return buf
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new PretextPdfError(errorCode, `${label}: response exceeded the ${maxBytes}-byte limit while streaming (no Content-Length was declared, or it understated the actual size)`)
      }
      chunks.push(value)
    }
  } catch (err) {
    if (err instanceof PretextPdfError) throw err
    throw new PretextPdfError(errorCode, `${label}: failed to read response body: ${err instanceof Error ? err.message : String(err)}`)
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
