/**
 * Erzeugt die PNG-Icons der PWA aus derselben Geometrie wie public/icons/icon.svg.
 *
 * Warum eigener Rasterizer statt sharp/resvg: Die Marke ist bewusst so einfach,
 * dass zwei Kreise und ein Stiel genügen — dafür eine 30-MB-Abhängigkeit mit
 * nativen Binaries einzuziehen wäre unverhältnismäßig. Das Skript läuft mit
 * Bordmitteln und ist reproduzierbar.
 *
 * Aufruf:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'icons')

const PAPER = [0xfb, 0xf8, 0xf4]
const ALUBALI = [0x7a, 0x1f, 0x2b]
const ALUBALI_DEEP = [0x5e, 0x16, 0x20]
const GOLD = [0xc6, 0xa6, 0x67]

const SS = 4 // Supersampling für weiche Kanten

function mix(base, color, alpha) {
  return [
    Math.round(base[0] * (1 - alpha) + color[0] * alpha),
    Math.round(base[1] * (1 - alpha) + color[1] * alpha),
    Math.round(base[2] * (1 - alpha) + color[2] * alpha),
  ]
}

/** Abstand Punkt → Strecke, für den Stiel. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const tRaw = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq
  const t = Math.max(0, Math.min(1, tRaw))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function renderIcon(size, { maskable }) {
  // Bei maskable liegt das Motiv im sicheren Innenbereich (80 %).
  const inset = maskable ? size * 0.1 : 0
  const s = (value) => inset + (value / 512) * (size - inset * 2)
  const pixels = Buffer.alloc(size * size * 3)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS

          // Voller Papierhintergrund — iOS und Android maskieren die Ecken selbst.
          let color = PAPER

          // Stiele
          const stemA = distanceToSegment(px, py, s(256), s(118), s(160), s(254))
          const stemB = distanceToSegment(px, py, s(256), s(118), s(348), s(240))
          if (Math.min(stemA, stemB) < s(6.5) - s(0)) {
            color = GOLD
          }

          // Früchte
          if (Math.hypot(px - s(348), py - s(288)) < s(66)) color = ALUBALI_DEEP
          if (Math.hypot(px - s(160), py - s(300)) < s(66)) color = ALUBALI

          r += color[0]
          g += color[1]
          b += color[2]
        }
      }

      const samples = SS * SS
      const offset = (y * size + x) * 3
      pixels[offset] = Math.round(r / samples)
      pixels[offset + 1] = Math.round(g / samples)
      pixels[offset + 2] = Math.round(b / samples)
    }
  }

  return pixels
}

// --- Minimaler PNG-Encoder (RGB, keine Palette, Filter 0) -------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(pixels, size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0
    pixels.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 2 // Farbtyp: Truecolor
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

for (const target of targets) {
  const pixels = renderIcon(target.size, { maskable: target.maskable })
  writeFileSync(join(OUT, target.file), encodePng(pixels, target.size))
  console.log(`✓ ${target.file} (${target.size}×${target.size})`)
}
