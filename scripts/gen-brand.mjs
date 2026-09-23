/**
 * Brand assets from the owner's logo artwork (white/violet on black).
 *
 *   node scripts/gen-brand.mjs <path-to-logo-on-black>
 *
 * Colour-to-alpha: every pixel's alpha is its brightest channel, and the
 * colour is un-premultiplied, so the violet glow and the speckled orbit keep
 * their soft edges on any dark background. Writes a trimmed lockup, the
 * symbol alone, favicons and the apple-touch icon.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/gen-brand.mjs <logo-on-black.png|webp>');
  process.exit(1);
}

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const out = Buffer.alloc(W * H * 4);
for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const m = Math.max(r, g, b);
  const a = m < 14 ? 0 : m; // flatten compression noise in the black
  out[j + 3] = a;
  if (a) {
    out[j] = Math.min(255, Math.round((r * 255) / a));
    out[j + 1] = Math.min(255, Math.round((g * 255) / a));
    out[j + 2] = Math.min(255, Math.round((b * 255) / a));
  }
}
const rgba = sharp(out, { raw: { width: W, height: H, channels: 4 } });

await mkdir('src/assets/brand', { recursive: true });
await mkdir('public', { recursive: true });

// full lockup, trimmed to the artwork
const lockup = await rgba.clone().png().toBuffer();
await sharp(lockup).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toFile('src/assets/brand/vesta-logo.png');

// the symbol: everything left of the wordmark
const trimmed = await sharp(lockup).trim({ threshold: 1 }).png().toBuffer();
const tm = await sharp(trimmed).metadata();
// the wordmark starts where the first column of the "V" of VESTA begins; the
// symbol occupies roughly the left 36% of the trimmed lockup
const symW = Math.round(tm.width * 0.365);
const mark = await sharp(trimmed).extract({ left: 0, top: 0, width: symW, height: tm.height }).trim({ threshold: 1 }).png().toBuffer();
await sharp(mark).png({ compressionLevel: 9 }).toFile('src/assets/brand/vesta-mark.png');

// favicons: the symbol on the site's void, centred with a little air
const icon = async (size, file, pad = 0.12) => {
  const inner = Math.round(size * (1 - pad * 2));
  const m = await sharp(mark).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#08070d' } })
    .composite([{ input: m, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(file);
};
await icon(48, 'public/favicon-48.png', 0.06);
await icon(180, 'public/apple-touch-icon.png', 0.14);
await icon(512, 'public/icon-512.png', 0.14);

const lm = await sharp('src/assets/brand/vesta-logo.png').metadata();
const mm = await sharp('src/assets/brand/vesta-mark.png').metadata();
console.log(`lockup ${lm.width}×${lm.height} · mark ${mm.width}×${mm.height}`);
