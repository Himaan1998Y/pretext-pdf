import { installNodePolyfill } from './dist/node-polyfill.js'
installNodePolyfill()
import('./dist/measure-blocks.js').then(async ({ measureBlock }) => {
  const block = await measureBlock(
    {
      type: 'rich-paragraph',
      fontSize: 11,
      spans: [
        { text: 'Founder & CEO', fontWeight: 700 },
        { text: '\n  ·  Antigravity Systems Pvt. Ltd.', color: '#333333' },
        { text: '  ·  2022 – Present', color: '#888888' },
      ],
    },
    480,
    { defaultFont: 'Inter', fonts: [] },
  )
  const rl = block.richLines
  console.log(`richLines count = ${rl.length}`)
  for (let i = 0; i < rl.length; i++) {
    console.log(`LINE ${i}:`)
    for (const f of rl[i].fragments) {
      console.log(`  x=${f.x.toFixed(2)}  text=${JSON.stringify(f.text)}`)
    }
  }
})
