import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SOURCE = resolve('public/icon.png');
const OUT = resolve('public');

await mkdir(OUT, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'icon-32.png', size: 32, maskable: false },
];

for (const { name, size, maskable } of targets) {
  let pipeline = sharp(SOURCE);
  if (maskable) {
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    pipeline = pipeline
      .resize(inner, inner)
      .extend({
        top: pad,
        bottom: size - inner - pad,
        left: pad,
        right: size - inner - pad,
        background: { r: 0x1e, g: 0x29, b: 0x3b, alpha: 1 },
      });
  } else {
    pipeline = pipeline.resize(size, size);
  }
  await pipeline.png({ compressionLevel: 9 }).toFile(resolve(OUT, name));
  console.log(`generated ${name}`);
}

console.log('done');
