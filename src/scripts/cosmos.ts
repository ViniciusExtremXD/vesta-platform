/* =========================================================================
   Vesta — <Cosmos> renderer (raw WebGL2, no libraries)

   variant "galaxy": a grand-design spiral seen ~60° from face-on.
     - axisymmetric light (bulge, nucleus, exponential disc) is solved per
       pixel by intersecting the view ray with the tilted disc plane;
     - two main log-spiral arms (pitch 28°) plus two weaker ones and a few
       branches, made of particles: resolved stars, diffuse glow sprites,
       sparse HII knots and dust (dust multiplies what is already there, so
       it reddens and darkens instead of adding);
     - the main dust lanes and a weak density wave are solved in the disc
       shader in the same co-rotating frame; the lane opacity (alpha of the
       low-res target) dims arm glow and resolved stars behind it;
     - differential rotation lives in the vertex shader. The shear term is
       bounded (τ·sin(t/τ)) so the arms never wind up into rings;
     - HDR accumulation in half-float targets, then a film-like tone curve,
       gamma encode, vignette, text-safe mask and dither.
   variant "stars": a quiet field of stars with a realistic magnitude
     distribution plus a very faint violet haze.

   Contract: starts after load on idle, skips on Save-Data, one static frame
   when motion is off (html.motion-reduced / 'vesta:motion'), pauses offscreen
   and in hidden tabs, drops the canvas on context loss, never logs.
   ========================================================================= */

import { isReduced } from './motion';

type Variant = 'galaxy' | 'stars';
type RGB = [number, number, number];

/* ---------------------------------------------------------------------- */
/* palette (linear light)                                                  */
/* ---------------------------------------------------------------------- */

const lin = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => Math.pow(c, 2.2)) as RGB;
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const STARLIGHT = lin('#F3F0FA');
const LILAC = lin('#B9A2FF');
const VIOLET = lin('#6236E8');
const CORE = lin('#FFE9D6');
const WARM = lin('#FFD9B8');
const BLUEWHITE = lin('#DAD4FF');
const PINK = lin('#F4B9CF');

/* ---------------------------------------------------------------------- */
/* seeded randomness — the sky is identical on every visit                 */
/* ---------------------------------------------------------------------- */

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * next());
  };
  /** power law N(>F) ∝ F^-alpha between lo and hi: many faint, few bright */
  const power = (lo: number, hi: number, alpha: number) => {
    const k = 1 - Math.pow(lo / hi, alpha);
    return lo * Math.pow(1 - next() * k, -1 / alpha);
  };
  const expo = (scale: number) => -Math.log(Math.max(next(), 1e-9)) * scale;
  return { next, gauss, power, expo };
}

/* ---------------------------------------------------------------------- */
/* shaders                                                                 */
/* ---------------------------------------------------------------------- */

const COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 u_mask;   // A.xy, B.xy in normalized target coords
uniform float u_maskFloor;
float textMask(vec2 uv) {
  vec2 d = u_mask.zw - u_mask.xy;
  float t = clamp(dot(uv - u_mask.xy, d) / max(dot(d, d), 1e-5), 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  return mix(u_maskFloor, 1.0, t * t);
}
`;

/* Galaxy particles: a_p = (r, theta0, z, flux), a_c = (rgb, size), a_h = halo */
const VS_GALAXY = COMMON + /* glsl */ `
layout(location = 0) in vec4 a_p;
layout(location = 1) in vec4 a_c;
layout(location = 2) in float a_h;
uniform float u_t;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_R;
uniform float u_dpr;
uniform vec4 u_view;   // inclination, yaw, position angle, perspective
uniform float u_mode;  // 0 stars, 1 glow, 2 dust
uniform float u_maxPt;
uniform float u_gain;
out vec3 v_col;
out float v_size;
out float v_sig;
out float v_hsig;
out float v_h;

const float OMP = 0.01308997; // 2π / 480 s: one turn every 8 minutes at mid-disc
const float TAU = 540.0;

void main() {
  float r = a_p.x;
  // flat-ish rotation curve: angular speed falls with radius
  float om = OMP * (0.55 + 0.30 / (r + 0.20)) / 0.97857;
  float ang = a_p.y - (OMP * u_t + (om - OMP) * TAU * sin(u_t / TAU));
  vec3 p = vec3(r * cos(ang), r * sin(ang), a_p.z);
  float ci = cos(u_view.x), si = sin(u_view.x);
  p = vec3(p.x, p.y * ci - p.z * si, p.y * si + p.z * ci);
  float cy = cos(u_view.y), sy = sin(u_view.y);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  float persp = 1.0 / (1.0 + p.z * u_view.w);
  vec2 q = p.xy * persp;
  float cp = cos(u_view.z), sp = sin(u_view.z);
  q = vec2(q.x * cp - q.y * sp, q.x * sp + q.y * cp);
  vec2 px = u_center + vec2(q.x, -q.y) * u_R;
  vec2 uv = px / u_res;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);

  v_h = a_h;
  v_hsig = 1.0;
  if (u_mode < 0.5) {
    float sig = max(a_c.w * u_dpr, 0.6);
    v_sig = sig;
    v_hsig = sig * 5.5;
    v_size = 2.0 * (a_h > 0.0 ? 2.8 * v_hsig : 3.2 * sig) + 1.0;
    v_col = a_c.rgb * a_p.w * textMask(uv) * u_gain;
  } else if (u_mode < 1.5) {
    v_sig = a_c.w * u_R * persp;
    v_size = 4.6 * v_sig;
    v_col = a_c.rgb * a_p.w * textMask(uv) * u_gain;
  } else {
    // dust in front of the bulge (near side) absorbs far more than behind it
    float near = smoothstep(0.04, -0.08, p.z);
    v_sig = a_c.w * u_R * persp;
    v_size = 4.6 * v_sig;
    v_col = a_c.rgb * a_p.w * mix(0.45, 1.0, near);
  }
  v_size = min(v_size, u_maxPt);
  float peak = max(v_col.r, max(v_col.g, v_col.b));
  gl_PointSize = peak < 1e-5 || v_size < 0.5 ? 0.0 : v_size;
}
`;

/* Background field: a_s = (x, y normalized, flux, sigma css px), a_c = (rgb, halo), a_t = (twinkle, phase) */
const VS_FIELD = COMMON + /* glsl */ `
layout(location = 0) in vec4 a_s;
layout(location = 1) in vec4 a_c;
layout(location = 2) in vec2 a_t;
uniform float u_t;
uniform vec2 u_res;
uniform float u_dpr;
uniform vec2 u_par;
uniform float u_maxPt;
uniform float u_gain;
out vec3 v_col;
out float v_size;
out float v_sig;
out float v_hsig;
out float v_h;
void main() {
  float depth = 0.35 + 0.65 * fract(a_t.y * 7.31);
  vec2 px = a_s.xy * u_res + u_par * depth;
  vec2 uv = px / u_res;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  float tw = 1.0 + a_t.x * (0.62 * sin(u_t * 0.83 + a_t.y) + 0.38 * sin(u_t * 2.17 + a_t.y * 2.3));
  float sig = max(a_s.w * u_dpr, 0.6);
  v_sig = sig;
  v_hsig = sig * 5.5;
  v_h = a_c.w;
  v_size = min(2.0 * (a_c.w > 0.0 ? 2.8 * v_hsig : 3.2 * sig) + 1.0, u_maxPt);
  v_col = a_c.rgb * a_s.z * tw * textMask(uv) * u_gain;
  gl_PointSize = v_size;
}
`;

const FS_SPRITE = /* glsl */ `#version 300 es
precision highp float;
in vec3 v_col;
in float v_size;
in float v_sig;
in float v_hsig;
in float v_h;
uniform float u_mode;
out vec4 o;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * v_size;
  float r2 = dot(c, c);
  float e = 1.0 - r2 / (0.25 * v_size * v_size);
  if (e <= 0.0) discard;
  float w = e * e;
  if (u_mode < 0.5) {
    // energy-normalised gaussian core + wide faint halo (no spikes)
    float core = exp(-0.5 * r2 / (v_sig * v_sig)) / (6.2831853 * v_sig * v_sig);
    float halo = exp(-0.5 * r2 / (v_hsig * v_hsig)) / (6.2831853 * v_hsig * v_hsig);
    o = vec4(v_col * ((1.0 - v_h) * core + v_h * halo) * w, 1.0);
  } else {
    o = vec4(v_col * exp(-0.5 * r2 / (v_sig * v_sig)) * w, 1.0);
  }
}
`;

const VS_QUAD = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/* Smooth light: ray/disc-plane intersection, so it tilts with parallax.
   The disc carries a weak density wave and the main dust lanes, computed
   in the same rotating frame as the particles (constants mirror
   buildGalaxy: pitch 28°, R0 0.12, arm wobble, lane gaps). Dust on the
   near side of the disc also dims the bulge; behind it, it cannot. */
const FS_DISC = COMMON + /* glsl */ `
in vec2 v_uv;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_R;
uniform vec4 u_view;
uniform float u_gain;
uniform float u_t;
uniform vec3 u_cCore;
uniform vec3 u_cDisc;
uniform vec3 u_cOuter;
out vec4 o;

const float OMP = 0.01308997;
const float TAU = 540.0;
const float SINP = 0.46947156;  // sin 28°
const float COTP = 1.88072647;  // cot 28°
const float R0 = 0.12;

float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float noise1(float x) {
  float i = floor(x), f = x - i;
  float u = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), u);
}
float armTh(float ph, float seed, float r) {
  return ph + COTP * log(r / R0) + 0.045 * sin(r * 8.3 + seed * 2.1) + 0.02 * sin(r * 21.0 + seed * 4.7);
}
float wrapPi(float a) { return a - 6.2831853 * floor((a + 3.14159265) / 6.2831853); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 d = (px - u_center) / u_R;
  d.y = -d.y;
  float cp = cos(u_view.z), sp = sin(u_view.z);
  vec2 q = vec2(d.x * cp + d.y * sp, -d.x * sp + d.y * cp);
  float ci = cos(u_view.x), si = sin(u_view.x);
  float cy = cos(u_view.y), sy = sin(u_view.y);
  vec3 e1 = vec3(cy, 0.0, -sy);
  vec3 e2 = vec3(si * sy, ci, si * cy);
  float k = u_view.w;
  vec2 c1 = e1.xy - q * k * e1.z;
  vec2 c2 = e2.xy - q * k * e2.z;
  float det = c1.x * c2.y - c2.x * c1.y;
  vec2 g = vec2(q.x * c2.y - c2.x * q.y, c1.x * q.y - q.x * c1.y) / det;
  float r = max(length(g), 1e-3);

  // back into the co-rotating frame the particles were generated in
  float om = OMP * (0.55 + 0.30 / (r + 0.20)) / 0.97857;
  float th0 = atan(g.y, g.x) + OMP * u_t + (om - OMP) * TAU * sin(u_t / TAU);
  float s = 0.016 + 0.06 * r;
  float wave = 0.0;
  float lane = 0.0;
  for (int a = 0; a < 2; a++) {
    float seed = float(a) + 1.0;
    // perpendicular distance to the arm centre-line (n > 0: downstream edge)
    float n = -wrapPi(th0 - armTh(float(a) * 3.14159265, seed, max(r, 0.03))) * r * SINP;
    float x = (n - 0.1 * s) / (1.1 * s);
    wave += exp(-x * x);
    // the lane wanders, swells and breaks up along the arm
    float gaps = smoothstep(0.32, 0.72, 0.6 * noise1(r * 31.0 + seed * 9.1) + 0.4 * noise1(r * 83.0 + seed * 3.3));
    float c = -0.5 * s + 0.3 * s * (noise1(r * 47.0 + seed * 2.7) - 0.5);
    float w = (0.14 + 0.24 * noise1(r * 17.0 + seed * 6.1)) * s + 0.003;
    float y = (n - c) / w;
    float yw = (n - c - 0.1 * s) / (0.7 * s + 0.004);
    lane += exp(-y * y) * mix(0.15, 1.0, gaps) + 0.22 * exp(-yw * yw) * gaps;
  }
  // mottled, filamentary opacity in the co-rotating frame
  vec2 m = vec2(r * cos(th0), r * sin(th0));
  float mot = 0.55 * noise2(m * 42.0) + 0.3 * noise2(m * 97.0 + 11.0) + 0.15 * noise2(m * 210.0 - 7.0);
  lane *= smoothstep(0.18, 0.72, mot) * 1.35;
  lane *= (1.0 - smoothstep(0.6, 0.95, r)) * smoothstep(0.12, 0.28, r);
  float A = min(0.5 * lane, 0.62);
  // which half of the disc is nearer the viewer
  float z = -g.x * sy + g.y * si * cy;
  float near = smoothstep(0.02, -0.06, z);

  float disc = exp(-r / 0.21) * (1.0 - smoothstep(0.55, 1.15, r)) * (0.45 + 0.8 * wave);
  float outer = exp(-r / 0.5) * (1.0 - smoothstep(0.85, 1.4, r));
  float rb = length(vec2(q.x, q.y / 0.74));
  float bulge = exp(-pow(rb / 0.03, 0.8)) + 0.3 * exp(-rb / 0.07) + 0.05 * exp(-rb / 0.17);
  float nucleus = exp(-0.5 * rb * rb / (0.0055 * 0.0055));

  vec3 dcol = mix(mix(u_cCore, u_cDisc, 0.35), u_cDisc, smoothstep(0.08, 0.5, r));
  vec3 col = (dcol * disc * 0.05 + u_cOuter * outer * 0.007) * (1.0 - A)
           + u_cCore * (bulge * 0.55 + nucleus * 1.6) * (1.0 - A * near);
  // alpha = lane opacity: blended as dst·(1−A) + light, it also dims the
  // arm glow drawn before it, and the composite dims resolved stars with it
  o = vec4(col * textMask(px / u_res) * u_gain, A);
}
`;

const FS_COMPOSITE = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_hi;
uniform sampler2D u_lo;
uniform float u_decode;
uniform float u_exposure;
uniform vec2 u_res;
uniform float u_haze;      // 0 galaxy, 1 stars-with-nebula
uniform vec3 u_violet;
uniform vec3 u_lilac;
uniform float u_vig;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

void main() {
  vec4 lo = texture(u_lo, v_uv);
  vec3 h = (texture(u_hi, v_uv).rgb * (1.0 - lo.a) + lo.rgb) * u_decode;
  h = max(h, vec3(0.0));
  vec3 L = 1.0 - exp(-h * u_exposure);
  L = pow(L, vec3(1.0 / 2.2));

  vec2 a = vec2(u_res.x / u_res.y, 1.0);
  vec2 vv = (v_uv - 0.5) * a;
  L *= 1.0 - u_vig * smoothstep(0.3, 1.1, length(vv));

  if (u_haze > 0.5) {
    // two faint emission clouds, shaped by noise; ≤ ~8% at their densest
    vec2 p = v_uv * a;
    float n = fbm(p * 2.2 + 3.7);
    float n2 = fbm(p * 5.0 - 1.3);
    float c1 = exp(-dot((v_uv - vec2(0.78, 0.30)) * a, (v_uv - vec2(0.78, 0.30)) * a) * 3.2);
    float c2 = exp(-dot((v_uv - vec2(0.18, 0.86)) * a, (v_uv - vec2(0.18, 0.86)) * a) * 5.0);
    float cloud = (c1 + 0.6 * c2) * smoothstep(0.38, 0.78, n) * (0.55 + 0.45 * n2);
    L += (u_violet * 0.20 + u_lilac * 0.05) * cloud * 0.9;
  }

  L += (hash(gl_FragCoord.xy + 0.5) - 0.5) / 255.0;
  L = clamp(L, 0.0, 1.0);
  o = vec4(L, max(L.r, max(L.g, L.b)));
}
`;

/* ---------------------------------------------------------------------- */
/* scene generation                                                        */
/* ---------------------------------------------------------------------- */

const G_STRIDE = 9; // r, theta, z, flux, r, g, b, size, halo
const F_STRIDE = 10; // x, y, flux, sigma, r, g, b, halo, twinkle, phase

interface GalaxyData {
  stars: Float32Array;
  glow: Float32Array;
  dust: Float32Array;
}

/** smooth 1-D value noise in [0, 1] — used to make arms clumpy and lanes broken */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

interface Arm {
  /** phase of the parent arm at R0 */
  ph: number;
  /** relative share of the arm population */
  w: number;
  r0: number;
  r1: number;
  main: boolean;
  seed: number;
  /** branches peel away from their parent by this phase offset */
  fork: number;
}

function buildGalaxy(nStars: number, nGlow: number, nDust: number): GalaxyData {
  const R = rng(1807); // 4 Vesta, 1807
  const stars: number[] = [];
  const glow: number[] = [];
  const dust: number[] = [];
  const put = (arr: number[], r: number, th: number, z: number, flux: number, c: RGB, size: number, halo = 0) => {
    arr.push(r, th, z, flux, c[0], c[1], c[2], size, halo);
  };

  const PITCH = 28 * DEG;
  const B = 1 / Math.tan(PITCH);
  const R0 = 0.12;
  const arms: Arm[] = [
    { ph: 0, w: 1, r0: 0.1, r1: 1.12, main: true, seed: 1, fork: 0 },
    { ph: Math.PI, w: 0.94, r0: 0.1, r1: 1.06, main: true, seed: 2, fork: 0 },
    // flocculent outer structure: branches that peel off the two main arms
    // two weaker arms between the main pair, and branches peeling off
    { ph: Math.PI * 0.5, w: 0.42, r0: 0.2, r1: 0.98, main: false, seed: 7, fork: 0 },
    { ph: Math.PI * 1.5, w: 0.36, r0: 0.24, r1: 0.94, main: false, seed: 8, fork: 0 },
    { ph: 0, w: 0.14, r0: 0.42, r1: 0.92, main: false, seed: 3, fork: 0.6 },
    { ph: Math.PI, w: 0.12, r0: 0.5, r1: 0.96, main: false, seed: 4, fork: 0.7 },
  ];
  const mains = arms.filter((a) => a.main);
  const wSum = arms.reduce((s, a) => s + a.w, 0);
  const pickArm = () => {
    let x = R.next() * wSum;
    for (const a of arms) {
      x -= a.w;
      if (x <= 0) return a;
    }
    return arms[0];
  };
  /** arm centre-line: a log spiral that wanders a little, forks peel away */
  const armTh = (a: Arm, r: number) =>
    a.ph +
    B * Math.log(r / R0) +
    0.045 * Math.sin(r * 8.3 + a.seed * 2.1) +
    0.02 * Math.sin(r * 21 + a.seed * 4.7) +
    (a.fork ? a.fork * smoothstep(a.r0 - 0.04, a.r0 + 0.4, r) : 0);
  const width = (r: number) => 0.016 + 0.06 * r;
  /** position along the arm: exponential disc, truncated softly at r1 */
  const armR = (a: Arm) => {
    for (let i = 0; i < 24; i++) {
      const r = a.r0 + R.expo(a.main ? 0.34 : 0.22);
      if (r < a.r1) return r;
    }
    return a.r0 + R.next() * (a.r1 - a.r0);
  };
  /** brightness along the arm: grows out of the bulge, fades at the tip */
  const along = (a: Arm, r: number) => {
    const rise = a.main ? smoothstep(a.r0 - 0.02, a.r0 + 0.1, r) : smoothstep(a.r0, a.r0 + 0.16, r);
    const fade = 1 - smoothstep(a.r1 - (a.main ? 0.55 : 0.3), a.r1, r);
    return rise * (0.08 + 0.92 * fade) * (a.main ? 1 : 0.8);
  };
  /** star formation is patchy: long beads along the arm, two scales */
  const clump = (a: Arm, r: number) => {
    const n = 0.58 * noise1(r * 24 + a.seed * 17.3) + 0.42 * noise1(r * 67 + a.seed * 5.9);
    return smoothstep(0.22, 0.82, n);
  };
  /** perpendicular offset (n > 0 = convex, downstream edge) → polar */
  const offset = (r: number, th: number, n: number) => ({
    r: Math.max(0.02, r + n * Math.cos(PITCH)),
    th: th - (n * Math.sin(PITCH)) / Math.max(r, 0.05),
  });
  /** across the arm: sharp on the dust side, a long tail downstream */
  const across = (s: number) => {
    const g = R.gauss();
    return (g < 0 ? g * 0.55 : g * 1.35) * s + 0.12 * s;
  };
  /** radial colour of the young population: warm inside, lilac → violet outside */
  const armColour = (r: number): RGB => {
    const inner = mix(CORE, STARLIGHT, 0.6);
    const mid = mix(STARLIGHT, LILAC, 0.55);
    const outer = mix(LILAC, VIOLET, 0.5);
    return r < 0.4 ? mix(inner, mid, smoothstep(0.1, 0.4, r)) : mix(mid, outer, smoothstep(0.4, 1.0, r));
  };

  // fewer sprites on small screens: wider ones carry the same arm light
  const glowK = Math.sqrt(Math.min(4, 12000 / Math.max(nGlow, 1)));
  const nArm = Math.round(nStars * 0.56);
  const nDisc = Math.round(nStars * 0.18);
  const nBulge = Math.round(nStars * 0.13);
  const nKnots = nStars - nArm - nDisc - nBulge;

  // resolved arm stars: mostly faint texture, a few bright supergiants
  for (let made = 0, guard = 0; made < nArm && guard < nArm * 8; guard++) {
    const a = pickArm();
    const r = armR(a);
    const cl = clump(a, r);
    if (R.next() > 0.18 + 0.82 * cl) continue;
    const s = width(r) * (a.main ? 1 : 1.25);
    const pos = offset(r, armTh(a, r), across(s));
    const t = R.next();
    const col = t < 0.55 ? mix(STARLIGHT, LILAC, 0.2 + 0.45 * R.next()) : t < 0.9 ? mix(STARLIGHT, BLUEWHITE, 0.4 + 0.6 * R.next()) : mix(STARLIGHT, WARM, 0.55);
    const flux = R.power(0.04, 10, 1.45) * along(a, r) * (0.45 + 0.8 * cl);
    put(stars, pos.r, pos.th, R.gauss() * 0.007, flux, col, 0.55 + 0.15 * R.next(), flux > 4 ? 0.08 : 0);
    made++;
  }

  // old disc population: smooth, warm, only weakly concentrated to the arms
  for (let made = 0, guard = 0; made < nDisc && guard < nDisc * 6; guard++) {
    let r = R.expo(0.26);
    if (r > 1.1) continue;
    r = Math.max(r, 0.035);
    const th = R.next() * 6.2831853;
    const ph = th - B * Math.log(r / R0);
    const arm = Math.pow(0.5 + 0.5 * Math.cos(2 * ph), 3);
    if (R.next() > 0.5 + 0.5 * arm) continue;
    const col = mix(STARLIGHT, WARM, 0.2 + 0.55 * R.next() * (1 - smoothstep(0.2, 0.8, r)));
    put(stars, r, th, R.gauss() * 0.018, R.power(0.012, 1.4, 1.6) * (1 - smoothstep(0.65, 1.1, r)), col, 0.55 + 0.1 * R.next());
    made++;
  }

  // bulge: a flattened spheroid of warm old stars
  for (let i = 0; i < nBulge; i++) {
    const wide = R.next() < 0.35;
    const sx = wide ? 0.11 : 0.05;
    const x = R.gauss() * sx;
    const y = R.gauss() * sx;
    const z = R.gauss() * sx * 0.7;
    put(stars, Math.hypot(x, y), Math.atan2(y, x), z, R.power(0.02, 2.2, 1.5), mix(CORE, WARM, R.next() * 0.6), 0.55 + 0.1 * R.next());
  }

  // star-forming regions on the downstream edge: sparse pale-pink HII knots
  // and young blue-white clusters, sitting on the brightest beads
  for (let made = 0, guard = 0; made < nKnots && guard < 20000; guard++) {
    const a = R.next() < 0.8 ? mains[R.next() < 0.52 ? 0 : 1] : pickArm();
    const r = a.r0 + 0.05 + R.next() * (a.r1 - a.r0 - 0.1);
    const cl = clump(a, r);
    if (cl < 0.45 || R.next() > cl * along(a, r)) continue;
    const s = width(r);
    const hii = R.next() < 0.34;
    const c = offset(r, armTh(a, r), (hii ? 0.55 : 0.3) * s + R.gauss() * s * 0.4);
    const n = 4 + Math.floor(R.next() * 10);
    const spread = 0.0025 + 0.005 * R.next();
    const fade = along(a, r);
    for (let k = 0; k < n && made < nKnots; k++, made++) {
      const col = hii ? mix(PINK, STARLIGHT, 0.35 * R.next()) : mix(BLUEWHITE, STARLIGHT, 0.45 * R.next());
      const f = R.power(0.08, 6, 1.4) * fade;
      put(stars, c.r + R.gauss() * spread, c.th + (R.gauss() * spread) / c.r, R.gauss() * 0.004, f, col, 0.55 + 0.15 * R.next(), f > 3.2 ? 0.09 : 0);
    }
    if (R.next() < 0.7) put(glow, c.r, c.th, 0, (hii ? 0.05 : 0.03) * fade * (0.5 + R.next()), hii ? mix(PINK, STARLIGHT, 0.25) : BLUEWHITE, spread * 0.6 + 0.0016);
  }

  // diffuse arm light (unresolved stars): a narrow bright ridge of young
  // stars just downstream of the dust, inside a broad faint envelope
  for (let made = 0, guard = 0; made < nGlow && guard < nGlow * 8; guard++) {
    const a = pickArm();
    const r = armR(a);
    const cl = clump(a, r);
    const ridge = R.next() < 0.62;
    if (R.next() > (ridge ? 0.12 + 0.88 * cl : 0.5 + 0.5 * cl)) continue;
    const s = width(r) * (a.main ? 1 : 1.2) * (ridge ? 0.42 : 1.25);
    const pos = offset(r, armTh(a, r), across(s) + (ridge ? 0.1 * width(r) : 0));
    const c = armColour(r);
    const f = (ridge ? 0.03 : 0.0105) * along(a, r) * (ridge ? 0.4 + 0.9 * cl : 0.7 + 0.3 * cl) * (0.55 + 0.9 * R.next());
    put(glow, pos.r, pos.th, 0, f, ridge ? mix(c, BLUEWHITE, 0.2) : c, glowK * (ridge ? 0.34 : 0.9) * (0.004 + 0.009 * r * (0.7 + 0.6 * R.next())));
    made++;
  }

  // spurs / feathers: short, steep dusty filaments crossing the inter-arm
  // gap, lit on one side by a thin trail of stars
  const spurN = Math.round(70 * Math.min(1, nStars / 30000));
  const spurD = Math.round(22 * Math.min(1, nDust / 4000));
  for (const a of mains) {
    for (let j = 0; j < 12; j++) {
      const r0 = 0.26 + j * 0.056 + R.next() * 0.03;
      const th0 = armTh(a, r0);
      const len = 0.05 + R.next() * 0.1;
      const steep = 1 / Math.tan((42 + R.next() * 16) * DEG);
      const bright = R.next() < 0.6;
      for (let k = 0; k < spurN; k++) {
        const u = R.next();
        const r = r0 + u * len;
        const th = th0 + 0.3 * width(r0) / r0 + steep * Math.log(r / r0) + (R.gauss() * 0.006) / r;
        const f = (1 - u) * along(a, r) * (bright ? 1 : 0.4);
        if (k % 5 === 0) put(glow, r, th, 0, 0.012 * f, mix(LILAC, VIOLET, 0.3), 0.005 + 0.008 * r);
        else put(stars, r, th, 0, R.power(0.02, 1.6, 1.5) * f, mix(STARLIGHT, LILAC, 0.5), 0.55);
      }
      for (let k = 0; k < spurD; k++) {
        const u = R.next();
        const r = r0 + u * len * 0.9;
        const th = th0 - 0.2 * width(r0) / r0 + steep * Math.log(r / r0) + (R.gauss() * 0.004) / r;
        put(dust, r, th, 0, 0.07 * (1 - u) * (1 - smoothstep(0.7, 0.95, r)), [0.6, 0.66, 0.76], 0.003 + 0.004 * R.next());
      }
    }
  }

  // dust lanes on the concave (upstream) edge of the arms: a thin dark
  // filament broken into segments, inside a fainter brown veil
  const lane = Math.round(nDust * 0.84);
  for (let i = 0; i < lane; i++) {
    const a = R.next() < 0.86 ? mains[i & 1] : pickArm();
    const r = armR(a);
    if (r > 0.95) continue;
    const s = width(r);
    const core = R.next() < 0.62;
    const pos = offset(r, armTh(a, r), -0.5 * s + R.gauss() * s * (core ? 0.16 : 0.42));
    const gaps = smoothstep(0.3, 0.62, 0.6 * noise1(r * 31 + a.seed * 9.1) + 0.4 * noise1(r * 83 + a.seed * 3.3));
    const reach = (1 - smoothstep(0.6, 0.95, r)) * smoothstep(a.r0, a.r0 + 0.06, r);
    const strength = (core ? 0.14 : 0.05) * (a.main ? 1 : 0.5) * gaps * reach * (0.6 + 0.6 * R.next());
    if (strength < 0.004) continue;
    put(dust, pos.r, pos.th, R.gauss() * 0.003, strength, [0.55, 0.62, 0.74], (core ? 0.6 : 1.3) * (0.003 + 0.009 * r * (0.6 + 0.8 * R.next())));
  }
  // nuclear dust: two soft, broken lanes spiralling into the bulge
  for (let i = lane; i < nDust; i++) {
    const a = mains[i & 1];
    const r = 0.035 + R.next() * 0.1;
    const th = armTh(a, 0.12) + 2.4 * Math.log(r / 0.12) + R.gauss() * 0.07;
    const gaps = smoothstep(0.35, 0.7, noise1(r * 90 + a.seed * 4.0));
    put(dust, r, th, R.gauss() * 0.003, (0.035 + 0.05 * R.next()) * gaps, [0.6, 0.66, 0.78], 0.004 + 0.005 * R.next());
  }

  return { stars: new Float32Array(stars), glow: new Float32Array(glow), dust: new Float32Array(dust) };
}

function buildField(n: number, seed: number, dimLo: number, galaxies: number, w: number, h: number): Float32Array {
  const R = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const flux = R.power(dimLo, 60, 1.3);
    const t = R.next();
    const col = t < 0.13 ? mix(STARLIGHT, WARM, 0.8) : t < 0.3 ? mix(STARLIGHT, BLUEWHITE, 0.9) : STARLIGHT;
    const bright = flux > 9;
    out.push(R.next(), R.next(), flux, 0.52 + 0.12 * R.next(), col[0], col[1], col[2], bright ? Math.min(0.14, 0.04 + flux * 0.002) : 0, bright ? 0.12 + 0.1 * R.next() : 0, R.next() * 6.2831853);
  }
  // a few very distant galaxies: tiny faint elongated smudges, sized in
  // CSS px so they keep their shape on any aspect ratio
  for (let g = 0; g < galaxies; g++) {
    const cx = 0.08 + R.next() * 0.84;
    const cy = 0.08 + R.next() * 0.84;
    const ang = R.next() * Math.PI;
    const len = 1.6 + R.next() * 2.2;
    const col = mix(WARM, STARLIGHT, 0.35 + R.next() * 0.4);
    for (let k = 0; k < 18; k++) {
      const u = R.gauss() * len;
      const v = R.gauss() * len * (0.25 + 0.2 * R.next());
      out.push(cx + (u * Math.cos(ang) - v * Math.sin(ang)) / w, cy + (u * Math.sin(ang) + v * Math.cos(ang)) / h, 0.035 + 0.035 * R.next(), 0.7, col[0], col[1], col[2], 0, 0, 0);
    }
  }
  return new Float32Array(out);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ---------------------------------------------------------------------- */
/* renderer                                                                */
/* ---------------------------------------------------------------------- */

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}
interface Layer {
  vao: WebGLVertexArrayObject;
  buf: WebGLBuffer;
  count: number;
}
type Uniforms = Record<string, WebGLUniformLocation | null>;
interface Prog {
  p: WebGLProgram;
  u: Uniforms;
}

const DEG = Math.PI / 180;

class Sky {
  private el: HTMLElement;
  private variant: Variant;
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private pGalaxy!: Prog;
  private pField!: Prog;
  private pDisc!: Prog;
  private pComp!: Prog;
  private hi: Target | null = null;
  private lo: Target | null = null;
  private half = false;
  private gain = 1;
  private maxPt = 64;
  private layers: Partial<Record<'stars' | 'glow' | 'dust' | 'field', Layer>> = {};
  private builtFor = 0;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private time = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private dead = false;
  private live = false;
  /** the loop runs only after the visitor has interacted with the page */
  private engaged = false;
  /** first frame was expensive: keep the still image, never animate */
  private slow = false;
  private lowPower: boolean;
  private fine: boolean;
  private tx = 0;
  private ty = 0;
  private px = 0;
  private py = 0;
  private comp = { cx: 0.7, cy: 0.42, R: 0.4, mask: [0.3, 0.6, 0.6, 0.4] as number[] };

  constructor(el: HTMLElement, variant: Variant) {
    this.el = el;
    this.variant = variant;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cosmos__gl';
    this.canvas.setAttribute('aria-hidden', 'true');
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'default',
    });
    if (!gl) throw new Error('no webgl2');
    // A software rasteriser (SwiftShader, llvmpipe — headless Chrome, GPU-less
    // VMs, Lighthouse/PageSpeed) draws this on the CPU at seconds per frame.
    // Those get the CSS sky instead.
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) throw new Error('software renderer');
    this.gl = gl;
    const nav = navigator as Navigator & { deviceMemory?: number };
    this.fine = window.matchMedia('(pointer: fine)').matches;
    this.lowPower = !this.fine || (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;

    this.pGalaxy = this.program(VS_GALAXY, FS_SPRITE);
    this.pField = this.program(VS_FIELD, FS_SPRITE);
    this.pDisc = this.program(VS_QUAD, FS_DISC);
    this.pComp = this.program(VS_QUAD, FS_COMPOSITE);

    const half = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    this.half = !!half;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    this.maxPt = range ? range[1] : 64;

    this.canvas.addEventListener('webglcontextlost', this.onLost, false);

    this.measure();
    this.resize();
    const t0 = performance.now();
    this.draw();
    gl.finish();
    if (gl.isContextLost()) throw new Error('lost');
    // One frame over ~60ms means the device can't carry the animation: the
    // still frame stays, the loop never starts.
    this.slow = performance.now() - t0 > 60;

    // first frame is in the drawing buffer — now it may enter the page
    el.appendChild(this.canvas);
    requestAnimationFrame(() => {
      if (!this.dead) el.classList.add('is-live');
    });
    this.live = true;

    new ResizeObserver(() => {
      if (this.dead) return;
      this.measure();
      this.resize();
      // resizing clears the canvas: repaint now, before the browser paints
      this.draw();
    }).observe(el);

    new IntersectionObserver(
      (entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
        this.sync();
      },
      { rootMargin: '80px' },
    ).observe(el);

    document.addEventListener('visibilitychange', () => this.sync());
    document.addEventListener('vesta:motion', () => {
      if (isReduced()) {
        this.tx = this.ty = 0;
        this.draw();
      }
      this.sync();
    });
    if (this.variant === 'galaxy' && this.fine) {
      window.addEventListener(
        'pointermove',
        (e) => {
          if (e.pointerType !== 'mouse') return;
          this.tx = (e.clientX / window.innerWidth) * 2 - 1;
          this.ty = (e.clientY / window.innerHeight) * 2 - 1;
        },
        { passive: true },
      );
    }
    // The galaxy turns once every ~8 minutes, so a still first frame reads as
    // the same sky. The loop waits for the visitor's first move — it costs
    // nothing to someone who is only reading, or to an automated audit.
    const engage = () => {
      if (this.engaged) return;
      this.engaged = true;
      for (const ev of ENGAGE_EVENTS) window.removeEventListener(ev, engage);
      this.sync();
    };
    for (const ev of ENGAGE_EVENTS) window.addEventListener(ev, engage, { passive: true });
    this.sync();
  }

  /* ---------------- GL plumbing ---------------- */

  private program(vs: string, fs: string): Prog {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link');
    const u: Uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      if (info) u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  private target(w: number, h: number, prev: Target | null): Target {
    const gl = this.gl;
    if (prev) {
      gl.deleteTexture(prev.tex);
      gl.deleteFramebuffer(prev.fb);
    }
    const make = (half: boolean): Target | null => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (ok) return { fb, tex, w, h };
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fb);
      return null;
    };
    let t = this.half ? make(true) : null;
    if (!t) {
      this.half = false;
      t = make(false);
    }
    if (!t) throw new Error('fbo');
    // 8-bit fallback: store at a quarter scale to keep some headroom
    this.gain = this.half ? 1 : 0.25;
    return t;
  }

  private layer(data: Float32Array, stride: number, sizes: number[], prev?: Layer): Layer {
    const gl = this.gl;
    if (prev) {
      gl.deleteBuffer(prev.buf);
      gl.deleteVertexArray(prev.vao);
    }
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    let off = 0;
    sizes.forEach((n, i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride * 4, off * 4);
      off += n;
    });
    gl.bindVertexArray(null);
    return { vao, buf, count: data.length / stride };
  }

  /* ---------------- layout ---------------- */

  private measure(): void {
    const r = this.el.getBoundingClientRect();
    this.cssW = Math.max(1, Math.round(r.width));
    this.cssH = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const landscape = this.cssW >= this.cssH * 1.05;
    const cs = getComputedStyle(this.el);
    const v = (name: string, fb: number) => {
      const n = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(n) ? n : fb;
    };
    const m = cs.getPropertyValue('--cosmos-mask').trim().split(/\s+/).map(Number);
    const maskVar = m.length === 4 && m.every(Number.isFinite) ? m : null;
    if (landscape) {
      this.comp = {
        cx: v('--cosmos-x', 0.73),
        cy: v('--cosmos-y', 0.44),
        R: Math.min(v('--cosmos-r', 0.36) * this.cssW, this.cssH * 0.95),
        mask: maskVar || [0.34, 0.62, 0.62, 0.4],
      };
    } else {
      this.comp = {
        cx: v('--cosmos-x', 0.7),
        cy: v('--cosmos-y', 0.2),
        R: v('--cosmos-r', 0.86) * this.cssW,
        mask: maskVar || [0.3, 0.56, 0.6, 0.26],
      };
    }
  }

  private resize(): void {
    const w = Math.max(1, Math.round(this.cssW * this.dpr));
    const h = Math.max(1, Math.round(this.cssH * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h || !this.hi) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.hi = this.target(w, h, this.hi);
      this.lo = this.target(Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2)), this.lo);
    }
    // particle budget follows canvas area; rebuild only on a real change
    const area = this.cssW * this.cssH;
    if (this.builtFor && Math.abs(area - this.builtFor) / this.builtFor < 0.35) return;
    this.builtFor = area;
    const small = this.cssW < 768;
    if (this.variant === 'galaxy') {
      // ≈ 57k particles at 1440×900, ≈ 14k on a phone
      const nStars = Math.round(Math.min(32000, Math.max(5000, area * (small ? 0.02 : 0.024))));
      const g = buildGalaxy(nStars, small ? 4000 : 12000, small ? 1300 : 4200);
      this.layers.stars = this.layer(g.stars, G_STRIDE, [4, 4, 1], this.layers.stars);
      this.layers.glow = this.layer(g.glow, G_STRIDE, [4, 4, 1], this.layers.glow);
      this.layers.dust = this.layer(g.dust, G_STRIDE, [4, 4, 1], this.layers.dust);
      const nField = Math.round(Math.min(9000, Math.max(1500, area * 0.0062)));
      this.layers.field = this.layer(buildField(nField, 29, 0.02, 4, this.cssW, this.cssH), F_STRIDE, [4, 4, 2], this.layers.field);
    } else {
      const nField = Math.round(Math.min(7000, Math.max(1200, area * 0.0046)));
      this.layers.field = this.layer(buildField(nField, 431, 0.02, 3, this.cssW, this.cssH), F_STRIDE, [4, 4, 2], this.layers.field);
    }
  }

  /* ---------------- drawing ---------------- */

  private draw(): void {
    const gl = this.gl;
    if (this.dead || gl.isContextLost() || !this.hi || !this.lo) return;
    const hi = this.hi;
    const lo = this.lo;
    const galaxy = this.variant === 'galaxy';
    const view = [(60 + this.py * 1.4) * DEG, this.px * 1.8 * DEG, -21 * DEG, 0.14];
    const mask = galaxy ? this.comp.mask : [0, 0, 1, 0];
    const t = this.time;

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.clearColor(0, 0, 0, 0);

    const setCommon = (pr: Prog, tgt: Target, floor: number) => {
      const u = pr.u;
      if (u.u_mask) gl.uniform4fv(u.u_mask, mask);
      if (u.u_maskFloor) gl.uniform1f(u.u_maskFloor, floor);
      if (u.u_res) gl.uniform2f(u.u_res, tgt.w, tgt.h);
      if (u.u_t) gl.uniform1f(u.u_t, t);
      if (u.u_gain) gl.uniform1f(u.u_gain, this.gain);
      if (u.u_maxPt) gl.uniform1f(u.u_maxPt, this.maxPt);
      if (u.u_dpr) gl.uniform1f(u.u_dpr, this.dpr * (tgt === lo ? 0.5 : 1));
    };
    const setGalaxy = (pr: Prog, tgt: Target) => {
      const s = tgt.w / this.cssW;
      gl.uniform2f(pr.u.u_center, this.comp.cx * tgt.w, this.comp.cy * tgt.h);
      gl.uniform1f(pr.u.u_R, this.comp.R * s);
      gl.uniform4fv(pr.u.u_view, view);
    };
    const points = (pr: Prog, layer: Layer | undefined, mode: number) => {
      if (!layer || !layer.count) return;
      if (pr.u.u_mode) gl.uniform1f(pr.u.u_mode, mode);
      // colour adds (or, for dust, multiplies); alpha is left alone
      if (mode === 2) gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
      else gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.POINTS, 0, layer.count);
    };

    // low-res target: arm glow and its dust, then the smooth light (disc,
    // bulge) whose lane opacity (alpha) also dims the glow beneath it
    gl.bindFramebuffer(gl.FRAMEBUFFER, lo.fb);
    gl.viewport(0, 0, lo.w, lo.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (galaxy) {
      gl.useProgram(this.pGalaxy.p);
      setCommon(this.pGalaxy, lo, 0);
      setGalaxy(this.pGalaxy, lo);
      points(this.pGalaxy, this.layers.glow, 1);
      points(this.pGalaxy, this.layers.dust, 2);

      gl.useProgram(this.pDisc.p);
      setCommon(this.pDisc, lo, 0);
      setGalaxy(this.pDisc, lo);
      gl.uniform3fv(this.pDisc.u.u_cCore, CORE);
      gl.uniform3fv(this.pDisc.u.u_cDisc, mix(CORE, LILAC, 0.3));
      gl.uniform3fv(this.pDisc.u.u_cOuter, mix(LILAC, VIOLET, 0.5));
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ZERO);
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // full-res target: resolved stars
    gl.bindFramebuffer(gl.FRAMEBUFFER, hi.fb);
    gl.viewport(0, 0, hi.w, hi.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pField.p);
    setCommon(this.pField, hi, galaxy ? 0.5 : 1);
    gl.uniform2f(this.pField.u.u_par, -this.px * 5 * this.dpr, -this.py * 4 * this.dpr);
    points(this.pField, this.layers.field, 0);
    if (galaxy) {
      gl.useProgram(this.pGalaxy.p);
      setCommon(this.pGalaxy, hi, 0);
      setGalaxy(this.pGalaxy, hi);
      points(this.pGalaxy, this.layers.stars, 0);
      points(this.pGalaxy, this.layers.dust, 2);
    }

    // composite onto the page
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pComp.p);
    const u = this.pComp.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hi.tex);
    gl.uniform1i(u.u_hi, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lo.tex);
    gl.uniform1i(u.u_lo, 1);
    gl.uniform1f(u.u_decode, 1 / this.gain);
    gl.uniform1f(u.u_exposure, galaxy ? 1.7 : 1.0);
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_haze, galaxy ? 0 : 1);
    gl.uniform3fv(u.u_violet, VIOLET);
    gl.uniform3fv(u.u_lilac, LILAC);
    gl.uniform1f(u.u_vig, galaxy ? 0.5 : 0.35);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  /* ---------------- loop ---------------- */

  private sync(): void {
    const run = this.live && this.engaged && !this.slow && !this.dead && this.visible && !document.hidden && !isReduced();
    if (run && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } else if (!run && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = now - this.last;
    const settling = Math.abs(this.tx - this.px) + Math.abs(this.ty - this.py) > 0.002;
    const interval = this.lowPower || !settling || this.variant === 'stars' ? 1000 / 30 : 1000 / 60;
    if (dt < interval - 1.5) return;
    this.last = now;
    const s = Math.min(dt, 100) / 1000;
    this.time += s;
    const k = 1 - Math.exp(-s * 2.2);
    this.px += (this.tx - this.px) * k;
    this.py += (this.ty - this.py) * k;
    this.draw();
  };

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.el.classList.remove('is-live');
    this.canvas.remove();
  };
}

/* ---------------------------------------------------------------------- */
/* boot                                                                    */
/* ---------------------------------------------------------------------- */

const ENGAGE_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const;

export function initCosmos(): void {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-cosmos]'));
  if (!roots.length) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn && conn.saveData) return;

  const start = () => {
    for (const el of roots) {
      if (el.dataset.cosmosReady) continue;
      el.dataset.cosmosReady = '1';
      const variant: Variant = el.dataset.cosmos === 'galaxy' ? 'galaxy' : 'stars';
      try {
        new Sky(el, variant);
      } catch {
        /* no WebGL2 / compile failure: the CSS sky stays */
        el.querySelector('canvas.cosmos__gl')?.remove();
      }
    }
  };
  const idle = () => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 1200 });
    else window.setTimeout(start, 200);
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
