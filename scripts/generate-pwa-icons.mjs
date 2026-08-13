import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const svgPath = path.join(root, 'public', 'icons', 'app-icon.svg')
const outDir = path.join(root, 'public', 'icons')
const svg = fs.readFileSync(svgPath)

async function writePng(size, filename) {
  const out = path.join(outDir, filename)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log('wrote', filename)
}

await fs.promises.mkdir(outDir, { recursive: true })
await writePng(192, 'icon-192.png')
await writePng(512, 'icon-512.png')
await writePng(180, 'apple-touch-icon.png')
await sharp(svg).resize(512, 512).png().toFile(path.join(outDir, 'icon-512-maskable.png'))
console.log('PWA icons ready')
