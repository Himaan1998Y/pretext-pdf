/**
 * SVG sanitizer behavior — v1.6.0 Phase 0a + v1.7.1 CSS vector hardening.
 *
 * The full snapshot tripwire (assets-split-tripwire.test.ts) covers
 * <script>, <foreignObject>, and javascript:-href stripping via the MA-4 /
 * MA-5 fixtures. This file adds the explicit CSS expression(...) assertion
 * and a couple of regression probes that the tripwire's "stripped: true/
 * false" booleans don't expose at field-level granularity.
 *
 * v1.7.1 additions: @import stripping, url(javascript:|vbscript:|data:) and
 * url(https?://) stripping inside <style> blocks.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const { sanitizeSvg } = await import('../dist/assets.js') as { sanitizeSvg: (s: string) => string }

describe('SVG sanitizer — v1.6.0 hardening', () => {
  test('strips <foreignObject> with HTML child', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">XSS</div></foreignObject><rect/></svg>'
    const out = sanitizeSvg(input)
    assert.ok(!/<foreignObject/i.test(out), `foreignObject not stripped: ${out}`)
    assert.ok(!/<div/i.test(out), `nested <div> survived foreignObject strip: ${out}`)
    assert.ok(/<rect\/>/i.test(out), 'sibling <rect/> must be preserved')
  })

  test('strips self-closing <foreignObject/>', () => {
    const out = sanitizeSvg('<svg><foreignObject/></svg>')
    assert.ok(!/<foreignObject/i.test(out))
  })

  test('strips javascript: href on <a>', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>'
    const out = sanitizeSvg(input)
    assert.ok(!/javascript:/i.test(out), `javascript: href survived: ${out}`)
    assert.ok(/<a\b[^>]*>/i.test(out), 'the <a> tag itself should remain (only the dangerous attribute is stripped)')
    assert.ok(/<text>click<\/text>/i.test(out), 'inner content must be preserved')
  })

  test('strips vbscript: and data: href on <a>', () => {
    for (const scheme of ['vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>']) {
      const out = sanitizeSvg(`<svg><a href="${scheme}">x</a></svg>`)
      assert.ok(!new RegExp(scheme.split(':')[0]! + ':', 'i').test(out), `${scheme} not stripped: ${out}`)
    }
  })

  test('strips CSS expression(...) inside <style>', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { width: expression(alert(1)); fill: red; }</style><rect/></svg>'
    const out = sanitizeSvg(input)
    assert.ok(!/expression\s*\(/i.test(out), `CSS expression(...) survived: ${out}`)
    assert.ok(/fill: red/.test(out), 'benign style declarations must be preserved')
  })

  test('preserves safe SVG content unchanged', () => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>'
    assert.equal(sanitizeSvg(safe), safe)
  })

  test('still strips <script> blocks (regression guard for earlier sanitizer)', () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><rect/></svg>')
    assert.ok(!/<script/i.test(out))
    assert.ok(/<rect/i.test(out))
  })

  test('still strips on* event handlers (regression guard)', () => {
    const out = sanitizeSvg('<svg><rect onclick="alert(1)" onload="bad()"/></svg>')
    assert.ok(!/onclick/i.test(out))
    assert.ok(!/onload/i.test(out))
  })
})

describe('SVG sanitizer — v1.7.1 CSS vector hardening', () => {
  test('strips @import inside <style> blocks', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("https://attacker.example/track.css"); rect { fill: red; }</style><rect/></svg>'
    const out = sanitizeSvg(input)
    assert.ok(!/@import/i.test(out), `@import survived: ${out}`)
    assert.ok(/fill: red/.test(out), 'benign style declarations after @import must be preserved')
  })

  test('strips @import with bare string (no url wrapper)', () => {
    const out = sanitizeSvg('<svg><style>@import "https://evil.example/a.css"; circle { fill: blue; }</style></svg>')
    assert.ok(!/@import/i.test(out), `bare @import survived: ${out}`)
    assert.ok(/fill: blue/.test(out), 'trailing style rule must survive')
  })

  test('strips url(javascript:...) CSS values', () => {
    const input = '<svg><style>rect { background: url(javascript:alert(1)); fill: green; }</style></svg>'
    const out = sanitizeSvg(input)
    assert.ok(!/javascript:/i.test(out), `url(javascript:) in CSS survived: ${out}`)
    assert.ok(/fill: green/.test(out), 'other style props must be preserved')
  })

  test('strips url(vbscript:...) and url(data:...) CSS values', () => {
    for (const scheme of ['vbscript:msgbox(1)', 'data:text/css,body{}']) {
      const out = sanitizeSvg(`<svg><style>a { background: url(${scheme}); }</style></svg>`)
      assert.ok(!new RegExp(scheme.split(':')[0]! + ':', 'i').test(out), `url(${scheme}) in CSS survived: ${out}`)
    }
  })

  test('strips url(https://...) CSS values (defense-in-depth)', () => {
    const input = '<svg><style>@font-face { src: url(https://fonts.googleapis.com/css?family=Roboto); } rect { fill: red; }</style></svg>'
    const out = sanitizeSvg(input)
    assert.ok(!/https?:\/\//i.test(out), `url(https://) in CSS survived: ${out}`)
  })

  test('does NOT strip url() from SVG attributes (only CSS context)', () => {
    // Safe path: a fill attribute using a gradient reference should not be touched.
    // Our regexes are global, not style-block-scoped, but this fixture confirms
    // that bare SVG attribute values (no <style>) are unaffected.
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0%" stop-color="red"/></linearGradient></defs><rect fill="url(#g)"/></svg>'
    const out = sanitizeSvg(input)
    assert.ok(/fill="url\(#g\)"/.test(out), 'local gradient references must be preserved')
  })
})
