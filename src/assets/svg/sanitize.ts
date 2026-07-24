/**
 * SVG sanitizer — extracted from src/assets.ts in v1.6.0 commit 9/16.
 *
 * Strips dangerous content from SVG before rasterization:
 * - <script> blocks
 * - on* event handler attributes
 * - <image>/<use> with file://, data:, or javascript: hrefs (local-file and injection vectors)
 * - <foreignObject> (HTML escape hatch into the SVG content model)
 * - <a> elements whose xlink:href / href use javascript:, vbscript:, or data:
 * - CSS expression(...) inside <style> blocks (legacy IE XSS vector)
 * - CSS @import rules inside <style> blocks (outbound network leak)
 * - CSS url(javascript:|vbscript:|data:) values inside <style> (JS execution)
 * - CSS url(http(s)://...) values inside <style> (defense-in-depth: SVGs
 *   in PDFs have no business hot-linking external stylesheets/assets)
 *
 * v1.6.0 Phase 0a (commit 3/16) added <foreignObject>, dangerous <a> hrefs,
 * and CSS expression(). v1.7.1 added @import and url() neutralization in
 * <style> blocks.
 *
 * IMPORTANT: this symbol is also re-exported from `src/assets.ts` so the
 * `dist/assets.js` consumers (test/svg-sanitizer.test.ts, the snapshot
 * tripwire) keep working unchanged.
 */

import { PretextPdfError } from '../../errors.js'

/** Maximum SVG string length (5 MB) — prevents ReDoS on oversized inputs. */
export const SVG_MAX_BYTES = 5 * 1024 * 1024

/** Maximum number of XML elements (open tags) — heuristic DoS guard for deeply nested SVGs. */
export const MAX_SVG_ELEMENTS = 5000

/**
 * Normalize a URL-ish value before checking it against a dangerous scheme.
 * Two independent evasions this closes (both confirmed working against the
 * pre-fix sanitizer):
 * - Whitespace injected INSIDE the scheme name (`java\tscript:`, `java\nscript:`,
 *   ` javascript:`) defeats a literal `javascript:` match while WHATWG URL
 *   parsing (and every browser) strips ASCII tab/newline/CR from anywhere in
 *   a URL string before scheme detection — replicate that stripping here.
 * - Numeric HTML character references (`&#106;avascript:`, `&#x6a;avascript:`)
 *   defeat a literal match while any real HTML/XML consumer decodes them
 *   before use — decode them here for the same reason.
 * Only used to DECIDE whether to strip; the original unmodified text is what
 * actually gets removed or kept, so this never alters surviving output.
 */
function normalizeUrlLikeValue(raw: string): string {
  let v = raw.replace(/[\t\n\r]/g, '')
  v = v.replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  v = v.replace(/&#(\d+);/g, (_m, dec: string) => String.fromCharCode(parseInt(dec, 10)))
  return v
}

const DANGEROUS_URL_SCHEME_RE = /^\s*(?:javascript|vbscript|data):/i
const EXTERNAL_URL_SCHEME_RE = /^\s*https?:/i

export function sanitizeSvg(svg: string): string {
  // Guard oversized inputs — regex passes on 5 MB+ strings create ReDoS risk.
  // Throw rather than pass through: an oversized SVG must never reach the
  // rasterizer with unstripped script/event content intact.
  if (svg.length > SVG_MAX_BYTES) {
    throw new PretextPdfError('SVG_LOAD_FAILED', `SVG exceeds maximum size of ${SVG_MAX_BYTES} bytes (got ${svg.length})`)
  }
  // Heuristic element count guard — deeply nested SVGs can exhaust rasterizer
  // memory. Count open tags as a cheap proxy. Throw rather than return raw:
  // passing unsanitized content downstream is worse than rejecting the input.
  const elementCount = (svg.match(/<[a-zA-Z]/g) ?? []).length
  if (elementCount > MAX_SVG_ELEMENTS) {
    throw new PretextPdfError('SVG_LOAD_FAILED', `SVG exceeds maximum element count of ${MAX_SVG_ELEMENTS} (got ${elementCount})`)
  }
  let s = svg
  // Remove self-closing <script/> then paired <script>...</script> blocks.
  // Looped to a fixpoint: a "decoy" split tag like `<scr<script>X</script>ipt>`
  // strips only the inner decoy pair on a single pass, which RECONSTRUCTS a
  // live `<script>...</script>` from the leftover fragments (`<scr` + `ipt>`).
  // A single pass is provably insufficient — this must repeat until no
  // `<script` tag remains, mirroring the fixpoint already used below for
  // `expression(...)`.
  let prevScript: string
  do {
    prevScript = s
    s = s.replace(/<script\b[^>]*\/>/gi, '')
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  } while (s !== prevScript)
  // Remove event handler attributes (onload, onclick, onerror, etc.)
  // Use [\w\r\n\t ]+ for the name portion so that whitespace injected INSIDE the
  // attribute name (e.g. on\nload=, on\tclick=) is also stripped. The original
  // \w+ stopped at non-word chars, leaving split names unmatched. The \s* before
  // = stays to catch normal spacing between the name and the assignment operator.
  s = s.replace(/\bon[\w\r\n\t ]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // Strip any non-local href from <image> and <use>.
  // Only fragment refs (#id) are safe in an embedded SVG — they point to elements
  // within the same SVG document. Any external URL (https://, http://, //,
  // file://, data:, javascript:, relative paths to disk files) would cause the
  // SVG rasterizer to make an outbound network or filesystem request at render
  // time — an SSRF-class vector. Deny everything that doesn't start with '#'.
  s = s.replace(
    /(<(?:image|use)\b[^>]*?)\s+(?:xlink:)?href\s*=\s*["'](?!#)[^"']*["']/gi,
    '$1'
  )
  // v1.6.0: strip <foreignObject> entirely — it's an HTML escape hatch and
  // the only XML-in-SVG construct that can host arbitrary tags. Same
  // decoy-split reconstruction risk as <script> — looped to a fixpoint.
  let prevForeign: string
  do {
    prevForeign = s
    s = s.replace(/<foreignObject\b[^>]*\/>/gi, '')
    s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
  } while (s !== prevForeign)
  // v1.6.0: strip dangerous hrefs from <a> (xlink:href or plain href).
  // Drop only the attribute, not the whole <a>, so the surrounding text content
  // (children of <a>) still renders. Normalizes the captured value (strips
  // injected whitespace, decodes numeric entities) before the scheme check so
  // `java\tscript:`/`&#106;avascript:`-style evasions are still caught.
  s = s.replace(
    /\s+(?:xlink:)?href\s*=\s*(["'])([^"']*)\1/gi,
    (match: string, _quote: string, value: string) =>
      DANGEROUS_URL_SCHEME_RE.test(normalizeUrlLikeValue(value)) ? '' : match
  )
  // v1.6.0: strip CSS expression(...) inside <style> blocks.
  // Multi-pass to handle nested parens. Each pass strips expression() calls
  // whose arguments contain at most one level of paren nesting — e.g.
  // expression(alert(1)) and expression(eval(x)) are handled in one pass.
  // Deeper nesting (e.g. expression(f(g(x)))) unwinds over multiple passes:
  // the innermost expression()-shaped call is consumed first, then the outer.
  // Pattern: (?:[^()]*|\([^()]*\))* matches argument content with one level
  // of inner parens — e.g. "alert(1)" = [^()]* + \([^()]*\) + [^()]*.
  let prev: string
  do {
    prev = s
    s = s.replace(/expression\s*\((?:[^()]*|\([^()]*\))*\)/gi, '')
  } while (s !== prev)
  // v1.7.1: strip @import rules — SVGs embedded in PDFs have no business
  // importing external stylesheets; also an outbound network-leak vector.
  s = s.replace(/@import\s+[^;{}]*/gi, '')
  // v1.7.1: strip url(javascript:|vbscript:|data:) and url(http(s)://...)
  // values — JS-execution/data-leak vectors and (defense-in-depth) external
  // hotlinking, both inside <style> blocks. Consolidated into one pass that
  // normalizes the captured value (strips injected whitespace, decodes
  // numeric entities) before checking the scheme, same evasion class as the
  // <a href> guard above.
  s = s.replace(/url\s*\(\s*([^)]*?)\s*\)/gi, (match: string, rawValue: string) => {
    const unquoted = rawValue.replace(/^["']|["']$/g, '')
    const normalized = normalizeUrlLikeValue(unquoted)
    return DANGEROUS_URL_SCHEME_RE.test(normalized) || EXTERNAL_URL_SCHEME_RE.test(normalized) ? '' : match
  })
  return s
}
