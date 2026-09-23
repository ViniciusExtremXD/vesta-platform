/**
 * Founder portrait master (spec §5.10).
 *
 *   node scripts/gen-portrait.mjs
 *
 * Reads  src/assets/vinicius-magno.jpg       (the confirmed colour original)
 * Writes src/assets/vinicius-magno-mono.jpg  (4:5 grayscale master, 1200×1500)
 *
 * The master is what the site ships: Builder.astro hands it to astro:assets
 * <Picture>, which derives the AVIF/WebP 560w and 1120w files at build time.
 * Run this again only if the original photo changes; the output is committed.
 *
 * Treatment, in order. Deliberately photographic: global darkroom moves only,
 * no masks, no retouching, nothing generative.
 *   1. Crop to 4:5 around the head and upper body: full height of the
 *      source, centred on the body's line so both elbows stay in frame and
 *      the eyes sit near the upper third (the page shows it at 50% 30%).
 *   2. Channel mix to monochrome from green and blue only. The original is a
 *      warm wood wall behind warm skin; a luminance conversion renders both
 *      as the same grey. Skin carries more green and blue than the orange
 *      wall, so this mix (a "cyan filter" in darkroom terms) drops the wall
 *      about a stop below the face without any masking. Green dominates
 *      because it is the cleanest channel of a phone sensor.
 *   3. Levels from the image's own histogram: the 0.4th percentile becomes
 *      the black point and the 99.7th becomes near-white, so blacks are deep
 *      and the face highlights open up without clipping.
 *   4. A gentle S-curve (smoothstep blend) for contrast, then a midtone
 *      density so the shirt and the wall sit low and the page's near-black
 *      surface meets the photo without a grey rim.
 *   5. Burning in, as on an enlarger: a soft elliptical falloff that leaves
 *      the face and chest untouched and takes the edges down by up to 70%,
 *      plus a burn along the top edge, where the wall catches the most light.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src/assets/vinicius-magno.jpg');
const OUT = path.join(root, 'src/assets/vinicius-magno-mono.jpg');

/* ---- tuning ------------------------------------------------------------- */
const RATIO = 4 / 5;
/** horizontal centre of the crop, as a fraction of the source width */
const FOCUS_X = 0.427;
/** channel weights R, G, B (sum = 1) */
const MIX = [0, 0.6, 0.4];
/** levels: percentiles that become black and near-white, and that white */
const BLACK_PCT = 0.004;
const WHITE_PCT = 0.997;
const WHITE_OUT = 238;
/** S-curve strength: 0 = linear, 1 = full smoothstep */
const CURVE = 0.35;
/** midtone density: out = in ^ DENSITY on 0..1 (1 = off) */
const DENSITY = 1.2;
/** elliptical falloff: centre (fractions of the crop), radii, clear core, strength */
const FALLOFF_CX = 0.52;
const FALLOFF_CY = 0.32;
const FALLOFF_RX = 0.52;
const FALLOFF_RY = 0.95;
const FALLOFF_CORE = 0.16;
const FALLOFF = 0.7;
/** top-edge burn: strength at the very top, and the depth it fades over */
const TOP_BURN = 0.5;
const TOP_DEPTH = 0.22;

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* ---- 1. crop ------------------------------------------------------------ */
const meta = await sharp(SRC).metadata();
if (!meta.width || !meta.height) throw new Error(`cannot read ${SRC}`);

let cropH = meta.height;
let cropW = Math.round(cropH * RATIO);
if (cropW > meta.width) {
  cropW = meta.width;
  cropH = Math.round(cropW / RATIO);
}
const left = Math.max(0, Math.min(meta.width - cropW, Math.round(meta.width * FOCUS_X - cropW / 2)));
const top = 0;

/* ---- 2. channel mix to one channel ------------------------------------- */
const { data, info } = await sharp(SRC)
  .rotate() // honour EXIF orientation, if any
  .extract({ left, top, width: cropW, height: cropH })
  .removeAlpha()
  .recomb([MIX, MIX, MIX])
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });

/* ---- 3. levels from the histogram -------------------------------------- */
const hist = new Uint32Array(256);
for (const v of data) hist[v]++;
const percentile = (q) => {
  const target = q * data.length;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
};
const black = percentile(BLACK_PCT);
const white = Math.max(black + 1, percentile(WHITE_PCT));

/* ---- 4. tone curve as a LUT --------------------------------------------- */
const lut = new Float32Array(256);
for (let v = 0; v < 256; v++) {
  let t = Math.max(0, Math.min(1, (v - black) / (white - black)));
  t += (t * t * (3 - 2 * t) - t) * CURVE;
  lut[v] = Math.pow(t, DENSITY) * WHITE_OUT;
}

/* ---- 5. burning in, applied with the LUT in one pass -------------------- */
const { width: w, height: h } = info;
const out = Buffer.alloc(w * h);
for (let y = 0; y < h; y++) {
  const topBurn = 1 - TOP_BURN * (1 - smoothstep(0, TOP_DEPTH, y / h));
  const dy = (y / h - FALLOFF_CY) / FALLOFF_RY;
  for (let x = 0; x < w; x++) {
    const d = Math.hypot((x / w - FALLOFF_CX) / FALLOFF_RX, dy);
    const i = y * w + x;
    const v = lut[data[i]] * topBurn * (1 - FALLOFF * smoothstep(FALLOFF_CORE, 1, d));
    out[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
}

/* ---- write the master --------------------------------------------------- */
await sharp(out, { raw: { width: w, height: h, channels: 1 } })
  .toColourspace('b-w')
  .jpeg({ quality: 92, mozjpeg: true, progressive: true })
  .toFile(OUT);

const written = await sharp(OUT).metadata();
console.log(
  `portrait: ${path.relative(root, OUT)} ${written.width}×${written.height} ` +
    `(crop ${cropW}×${cropH} at x=${left} from ${meta.width}×${meta.height}; levels ${black}–${white})`
);
