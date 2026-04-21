import { installNodePolyfill } from './dist/node-polyfill.js'
installNodePolyfill()
const { measureBlock } = await import('./dist/measure-blocks.js')
const { paginate } = await import('./dist/paginate.js')

const block = await measureBlock({
  type: 'callout',
  title: 'Callout Title — Must NOT Be Clipped',
  style: 'info',
  content: Array.from({ length: 25 }, (_, i) => `Line ${i + 1}.`).join(' '),
}, 475, { defaultFont: 'Inter', fonts: [] })

const titleH = block.calloutData?.titleHeight ?? 0
const padV = block.calloutData?.paddingV ?? block.blockquotePaddingV ?? 10
const lh = block.lineHeight
console.log(`titleHeight=${titleH}  paddingV=${padV}  lineHeight=${lh}`)
console.log(`block.lines = ${block.lines.length}`)

// Tight page forces split: title + 2 lines on page 1
const pageContentHeight = padV + titleH + lh * 2 + padV + 1
const paginated = paginate([block], pageContentHeight, { minOrphanLines: 1, minWidowLines: 1 })

for (let p = 0; p < paginated.pages.length; p++) {
  console.log(`PAGE ${p}:`)
  for (const b of paginated.pages[p].blocks) {
    const lc = b.endLine - b.startLine
    console.log(`  yFromTop=${b.yFromTop.toFixed(2)}  startLine=${b.startLine}  endLine=${b.endLine}  linesPlaced=${lc}`)
  }
}
