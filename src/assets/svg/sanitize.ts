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

/** Maximum SVG string length (5 MB) — prevents ReDoS on oversized inputs. */
export const SVG_MAX_BYTES = 5 * 1024 * 1024

export function sanitizeSvg(svg: string): string {
  // Skip regex passes on oversized strings — canvas will reject them anyway
  if (svg.length > SVG_MAX_BYTES) return svg
  // Remove self-closing <script/> then paired <script>...</script> blocks
  let s = svg.replace(/<script\b[^>]*\/>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  // Remove event handler attributes (onload, onclick, onerror, etc.)
  s = s.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // Remove <image> and <use> hrefs pointing to unsafe schemes
  s = s.replace(
    /(<(?:image|use)\b[^>]*?)\s+(?:xlink:)?href\s*=\s*["'](?:file|data|javascript):[^"']*["']/gi,
    '$1'
  )
  // v1.6.0: strip <foreignObject> entirely — it's an HTML escape hatch and
  // the only XML-in-SVG construct that can host arbitrary tags.
  s = s.replace(/<foreignObject\b[^>]*\/>/gi, '')
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
  // v1.6.0: strip dangerous hrefs from <a> (xlink:href or plain href).
  // Drop only the attribute, not the whole <a>, so the surrounding text content
  // (children of <a>) still renders.
  s = s.replace(
    /\s+(?:xlink:)?href\s*=\s*["'](?:javascript|vbscript|data):[^"']*["']/gi,
    ''
  )
  // v1.6.0: strip CSS expression(...) inside <style> blocks. Replace just the
  // expression call with an empty string so the surrounding stylesheet stays
  // parseable.
  s = s.replace(/expression\s*\([^)]*\)/gi, '')
  // v1.7.1: strip @import rules — SVGs embedded in PDFs have no business
  // importing external stylesheets; also an outbound network-leak vector.
  s = s.replace(/@import\s+[^;{}]*/gi, '')
  // v1.7.1: strip url(javascript:|vbscript:|data:) values — JS-execution and
  // data-leak vectors that can appear inside <style> blocks.
  s = s.replace(/url\s*\(\s*["']?(?:javascript|vbscript|data):[^)"']*["']?\s*\)/gi, '')
  // v1.7.1: strip url(http(s)://...) values — defense-in-depth; SVGs in PDFs
  // should not hot-link external stylesheet resources at render time.
  s = s.replace(/url\s*\(\s*["']?https?:\/\/[^)"']*["']?\s*\)/gi, '')
  return s
}
