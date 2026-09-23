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

import { addFrame, isReduced, requestFrame, vestibular } from './motion';

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
/* 0 behind the text column (A) → 1 in the open sky (B) */
float maskT(vec2 uv) {
  vec2 d = u_mask.zw - u_mask.xy;
  float t = clamp(dot(uv - u_mask.xy, d) / max(dot(d, d), 1e-5), 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  return t * t;
}
float textMask(vec2 uv) {
  return mix(u_maskFloor, 1.0, maskT(uv));
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
uniform float u_boost;  // resolved stars thin out as the disc swells: keep its surface brightness
out vec3 v_col;
out float v_size;
out float v_sig;
out float v_hsig;
out float v_h;
out float v_g;
out float v_sl;

const float OMP = 0.02991993; // 2π / 210 s: one turn every 3.5 minutes at mid-disc
const float TAU = 236.25; // bounds the shear: same maximum winding as the 8-minute disc

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
  v_g = 0.0;
  v_sl = 1.0;
  if (u_mode < 0.5) {
    float sig = max(a_c.w * u_dpr, 0.6);
    v_sig = sig;
    v_hsig = sig * 5.5;
    v_size = 2.0 * (a_h > 0.0 ? 2.8 * v_hsig : 3.2 * sig) + 1.0;
    v_col = a_c.rgb * a_p.w * textMask(uv) * u_gain * u_boost;
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

/* Background field, three depth layers.
   a_s = (x, y in the wrap domain [0,1], flux, sigma css px)
   a_c = (rgb, halo)
   a_t = (twinkle depth, phase, glint, layer 0 far · 1 mid · 2 near)
   Every layer lags the page by its own factor as the section scrolls, drifts
   sideways at its own speed and follows the pointer by its own amount; the
   domain wraps with a margin, so no star ever pops inside the frame. */
const VS_FIELD = COMMON + /* glsl */ `
layout(location = 0) in vec4 a_s;
layout(location = 1) in vec4 a_c;
layout(location = 2) in vec4 a_t;
uniform float u_t;
uniform vec2 u_res;
uniform vec2 u_css;     // canvas size in css px
uniform float u_dpr;
uniform vec2 u_par;     // pointer parallax, css px at the near layer
uniform float u_scroll; // section scroll offset, css px
uniform vec3 u_lag;     // scroll lag per layer (far, mid, near)
uniform float u_drift;  // sideways drift of the near layer, css px/s
uniform float u_maxPt;
uniform float u_gain;
uniform float u_glint;
uniform float u_keep;   // share of stars kept behind the text column
uniform float u_dive;   // 0 → 1 as the hero scrolls away
uniform vec2 u_zc;      // dive centre (the galaxy core), css px
out vec3 v_col;
out float v_size;
out float v_sig;
out float v_hsig;
out float v_h;
out float v_g;
out float v_sl;

const float M = 40.0;   // wrap margin, css px

void main() {
  float layer = a_t.w;
  // layer 3 is the stream in the hero: as far as the far layer, but it only
  // scrolls — its haze is painted in the composite and must stay on it
  float depth = layer < 0.5 ? 0.34 : (layer < 1.5 ? 0.62 : (layer < 2.5 ? 1.0 : 0.34));
  float lag = layer < 0.5 ? u_lag.x : (layer < 1.5 ? u_lag.y : (layer < 2.5 ? u_lag.z : u_lag.x));
  float drift = layer > 2.5 ? 0.0 : depth;
  vec2 dom = u_css + 2.0 * M;
  vec2 p = a_s.xy * dom;
  p += vec2(u_t * u_drift * drift, u_scroll * lag) + u_par * depth;
  p = mod(p, dom) - M;
  // the dive: the sky opens outward from the galaxy core, near layers fastest
  float zoom = u_dive * (0.18 + 1.05 * depth * depth);
  p = u_zc + (p - u_zc) * (1.0 + zoom);
  vec2 uv = p / u_css;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);

  // scintillation: three incommensurate waves at a per-star tempo, so the
  // light shimmers and dips instead of blinking on a beat
  float f = 0.65 + 0.7 * fract(a_t.y * 3.17);
  float s = 0.5 * sin(u_t * 1.7 * f + a_t.y) + 0.32 * sin(u_t * 3.9 * f + a_t.y * 2.3) + 0.18 * sin(u_t * 7.1 * f + a_t.y * 4.1);
  float tw = max(1.0 + a_t.x * s, 0.08);

  float sig = max(a_s.w * u_dpr * (1.0 + 0.6 * zoom), 0.6);
  v_sig = sig;
  v_hsig = sig * 5.5;
  v_h = a_c.w;
  v_size = 2.0 * (a_c.w > 0.0 ? 2.8 * v_hsig : 3.2 * sig) + 1.0;
  // diffraction glint on the brightest stars: breathes on its own slow cycle
  v_g = a_t.z * u_glint * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(u_t * 0.55 * f + a_t.y * 1.7), 2.0));
  v_sl = (7.0 + 11.0 * a_t.z) * u_dpr;
  if (a_t.z > 0.0) v_size = max(v_size, 2.0 * v_sl + 1.0);
  v_size = min(v_size, u_maxPt);
  // behind the text column the sky thins out star by star (each star has
  // its own threshold, so they fade in and out as they drift across it)
  // and the survivors are dimmer; no glints there at all
  float mt = maskT(uv);
  float rnd = fract(a_t.y * 7.1231 + a_s.x * 13.37);
  float keep = smoothstep(rnd - 0.1, rnd + 0.1, mix(u_keep, 1.0, mt));
  float m = textMask(uv) * keep;
  v_col = a_c.rgb * a_s.z * tw * m * u_gain;
  v_g *= mt * keep;
  gl_PointSize = keep < 0.004 ? 0.0 : v_size;
}
`;

const FS_SPRITE = /* glsl */ `#version 300 es
precision highp float;
in vec3 v_col;
in float v_size;
in float v_sig;
in float v_hsig;
in float v_h;
in float v_g;
in float v_sl;
uniform float u_mode;
out vec4 o;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * v_size;
  float r2 = dot(c, c);
  float e = 1.0 - r2 / (0.25 * v_size * v_size);
  if (e <= 0.0) discard;
  float w = e * e;
  if (u_mode < 0.5) {
    // energy-normalised gaussian core + wide faint halo
    float core = exp(-0.5 * r2 / (v_sig * v_sig)) / (6.2831853 * v_sig * v_sig);
    float halo = exp(-0.5 * r2 / (v_hsig * v_hsig)) / (6.2831853 * v_hsig * v_hsig);
    float I = (1.0 - v_h) * core + v_h * halo;
    if (v_g > 0.0) {
      // four-point diffraction spikes, turned 14° off the axes
      vec2 k = vec2(c.x * 0.9703 - c.y * 0.2419, c.x * 0.2419 + c.y * 0.9703);
      vec2 a = abs(k);
      float wd = 0.45 * v_sig;
      float fall = v_sl * 0.3;
      float sp = exp(-a.x / fall) * exp(-0.5 * k.y * k.y / (wd * wd)) + exp(-a.y / fall) * exp(-0.5 * k.x * k.x / (wd * wd));
      I += v_g * 0.075 * sp * (1.0 - smoothstep(0.55 * v_sl, v_sl, max(a.x, a.y)));
    }
    o = vec4(v_col * I * w, 1.0);
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

const float OMP = 0.02991993;
const float TAU = 236.25; // bounds the shear: same maximum winding as the 8-minute disc
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

/* Composite: tone curve, vignette, then the living layers that sit on top of
   the light — breathing nebula haze (stars) or a faint star stream (galaxy),
   and the occasional meteor. Coordinates here are top-left, y down. */
const FS_COMPOSITE = COMMON + /* glsl */ `
in vec2 v_uv;
uniform sampler2D u_hi;
uniform sampler2D u_lo;
uniform float u_decode;
uniform float u_exposure;
uniform vec2 u_res;
uniform float u_t;
uniform float u_haze;      // nebula strength (0 = none)
uniform vec2 u_hazeOff;    // nebula parallax + drift, in aspect units
uniform vec4 u_stream;     // star stream: point (x, y), angle, strength
uniform vec3 u_violet;
uniform vec3 u_lilac;
uniform float u_vig;
uniform float u_textFloor; // how much light is allowed behind text
uniform vec4 u_m0;         // meteor head (canvas px, top-left), unit direction
uniform vec4 u_m1;         // tail length px, width px, intensity, 0
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
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

void main() {
  vec4 lo = texture(u_lo, v_uv);
  vec3 h = (texture(u_hi, v_uv).rgb * (1.0 - lo.a) + lo.rgb) * u_decode;
  h = max(h, vec3(0.0));
  vec3 L = 1.0 - exp(-h * u_exposure);
  L = pow(L, vec3(1.0 / 2.2));

  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 a = vec2(u_res.x / u_res.y, 1.0);
  vec2 vv = (uv - 0.5) * a;
  L *= 1.0 - u_vig * smoothstep(0.3, 1.1, length(vv));
  float tm = textMask(uv);

  if (u_haze > 0.0) {
    // two emission clouds that drift with the far sky and breathe out of
    // phase with each other; the noise itself flows very slowly
    vec2 p = uv * a + u_hazeOff;
    vec2 flow = vec2(u_t * 0.006, -u_t * 0.004);
    float n = fbm(p * 2.2 + 3.7 + flow);
    float n2 = fbm(p * 5.0 - 1.3 - flow * 1.7);
    vec2 d1 = p - vec2(0.8 * a.x, 0.66);
    vec2 d2 = p - vec2(0.16 * a.x, 0.12);
    float b1 = 0.72 + 0.28 * sin(u_t * 0.31);
    float b2 = 0.72 + 0.28 * sin(u_t * 0.23 + 2.1);
    float c1 = exp(-dot(d1, d1) * 2.6) * b1;
    float c2 = exp(-dot(d2, d2) * 4.2) * b2 * 0.7;
    float cloud = (c1 + c2) * smoothstep(0.34, 0.8, n) * (0.5 + 0.5 * n2);
    L += (u_violet * 0.22 + u_lilac * 0.06) * cloud * u_haze * mix(u_textFloor, 1.0, tm);
  }

  if (u_stream.w > 0.0) {
    // a faint band of unresolved stars crossing the sky behind the galaxy
    vec2 p = uv * a;
    vec2 dir = vec2(cos(u_stream.z), sin(u_stream.z));
    vec2 q = p - u_stream.xy * a;
    float along = dot(q, dir);
    float across = dot(q, vec2(-dir.y, dir.x));
    float wob = 0.05 * sin(along * 3.1 + 0.7) + 0.03 * sin(along * 7.3);
    float band = exp(-pow((across - wob) / 0.16, 2.0));
    float mott = fbm(vec2(along * 3.0, across * 9.0) + vec2(u_t * 0.004, 0.0));
    float rift = smoothstep(0.02, 0.07, abs(across - wob + 0.02 * sin(along * 11.0)));
    L += (u_lilac * 0.05 + u_violet * 0.1) * band * smoothstep(0.3, 0.85, mott) * mix(0.35, 1.0, rift) * u_stream.w * mix(u_textFloor, 1.0, tm);
  }

  if (u_m1.z > 0.0) {
    vec2 px = uv * u_res;
    vec2 d = px - u_m0.xy;
    float behind = -dot(d, u_m0.zw);
    float side = abs(d.x * u_m0.w - d.y * u_m0.z);
    float len = u_m1.x;
    if (behind > -6.0 * u_m1.y && behind < len) {
      float k = clamp(1.0 - behind / len, 0.0, 1.0);
      float w = u_m1.y * (0.35 + 0.65 * k);
      float tail = pow(k, 2.2) * step(0.0, behind);
      float core = exp(-0.5 * side * side / (w * w));
      float glow = 0.16 * exp(-0.5 * side * side / (9.0 * w * w));
      float head = exp(-0.5 * dot(d, d) / (2.2 * u_m1.y * u_m1.y));
      float I = u_m1.z * ((core + glow) * tail + 0.9 * head);
      L += vec3(0.96, 0.95, 1.0) * I * tm;
    }
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
const F_STRIDE = 12; // x, y, flux, sigma, r, g, b, halo, twinkle, phase, glint, layer

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

/** The band of unresolved stars crossing the hero: a point (uv, top-left),
    an angle in aspect-corrected units, and the share of the field it takes. */
interface Stream {
  x: number;
  y: number;
  angle: number;
  share: number;
}

/** wrap margin in css px — mirrors M in VS_FIELD */
const WRAP = 40;

/**
 * Background field in three depth layers (+ layer 3: the stream, which only
 * scrolls, never drifts). Far: many faint, small, barely twinkling. Near:
 * few, brighter, larger, twinkling harder; the brightest of them carry a
 * diffraction glint. Positions live in the wrap domain (css box + margin).
 */
function buildField(n: number, seed: number, galaxies: number, w: number, h: number, stream: Stream | null): Float32Array {
  const R = rng(seed);
  const out: number[] = [];
  const dw = w + 2 * WRAP;
  const dh = h + 2 * WRAP;
  const toDom = (ux: number, uy: number): [number, number] => [(ux * w + WRAP) / dw, (uy * h + WRAP) / dh];
  const colour = (): RGB => {
    const t = R.next();
    return t < 0.13 ? mix(STARLIGHT, WARM, 0.8) : t < 0.32 ? mix(STARLIGHT, BLUEWHITE, 0.9) : t < 0.4 ? mix(STARLIGHT, LILAC, 0.5) : STARLIGHT;
  };
  const push = (x: number, y: number, flux: number, sigma: number, col: RGB, halo: number, tw: number, glint: number, layer: number) => {
    out.push(x, y, flux, sigma, col[0], col[1], col[2], halo, tw, R.next() * 6.2831853, glint, layer);
  };

  const nStream = stream ? Math.round(n * stream.share) : 0;
  const nMain = n - nStream;
  const near: number[] = [];
  for (let i = 0; i < nMain; i++) {
    const t = R.next();
    const layer = t < 0.56 ? 0 : t < 0.87 ? 1 : 2;
    const flux = layer === 0 ? R.power(0.02, 3, 1.5) : layer === 1 ? R.power(0.035, 16, 1.35) : R.power(0.07, 80, 1.2);
    const sigma = layer === 0 ? 0.48 + 0.08 * R.next() : layer === 1 ? 0.54 + 0.1 * R.next() : 0.6 + 0.14 * R.next();
    const bright = flux > 9;
    const tw = layer === 0 ? 0.16 + 0.2 * R.next() : layer === 1 ? 0.26 + 0.26 * R.next() : 0.32 + 0.3 * R.next();
    if (layer === 2 && flux > 10) near.push(out.length);
    push(R.next(), R.next(), flux, sigma, colour(), bright ? Math.min(0.14, 0.04 + flux * 0.002) : 0, tw, 0, layer);
  }
  // the brightest near stars get the glint, a handful per canvas
  const glints = Math.round(Math.min(14, Math.max(4, (w * h) / 100000)));
  near
    .sort((a, b) => out[b + 2] - out[a + 2])
    .slice(0, glints)
    .forEach((o) => {
      out[o + 10] = 0.45 + 0.55 * R.next();
      out[o + 2] = Math.max(out[o + 2], 22);
    });

  if (stream) {
    const ax = w / h;
    const dx = Math.cos(stream.angle);
    const dy = Math.sin(stream.angle);
    for (let i = 0; i < nStream; i++) {
      const along = (R.next() * 2 - 1) * 1.6;
      const wob = 0.05 * Math.sin(along * 3.1 + 0.7) + 0.03 * Math.sin(along * 7.3);
      const across = wob + R.gauss() * 0.075;
      const px = stream.x * ax + dx * along - dy * across;
      const py = stream.y + dy * along + dx * across;
      const [x, y] = toDom(px / ax, py);
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      const col = R.next() < 0.3 ? mix(STARLIGHT, LILAC, 0.6) : R.next() < 0.3 ? mix(STARLIGHT, WARM, 0.5) : STARLIGHT;
      push(x, y, R.power(0.012, 1.6, 1.5), 0.46 + 0.06 * R.next(), col, 0, 0.12 + 0.2 * R.next(), 0, 3);
    }
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
      push(cx + (u * Math.cos(ang) - v * Math.sin(ang)) / dw, cy + (u * Math.sin(ang) + v * Math.cos(ang)) / dh, 0.035 + 0.035 * R.next(), 0.7, col, 0, 0, 0, 0);
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

/* per-variant tuning */
interface Tune {
  /** scroll lag of the galaxy itself: the farthest object on the page */
  lagGalaxy: number;
  /** scroll lag per star layer (far, mid, near) */
  lag: [number, number, number];
  /** sideways drift of the near layer, css px/s (far/mid are slower) */
  drift: number;
  /** pointer parallax of the near layer, css px */
  par: [number, number];
  fieldGain: number;
  glint: number;
  exposure: number;
  vignette: number;
  haze: number;
  /** share of field stars kept behind a masked text column */
  keep: number;
}
const TUNE: Record<Variant, Tune> = {
  galaxy: {
    lagGalaxy: 0.5,
    lag: [0.4, 0.26, 0.12],
    drift: -3.2,
    par: [16, 11],
    fieldGain: 1.6,
    glint: 1,
    exposure: 1.7,
    vignette: 0.5,
    haze: 0.45,
    keep: 0.18,
  },
  stars: {
    lagGalaxy: 0,
    lag: [0.46, 0.3, 0.14],
    drift: -4,
    par: [10, 7],
    fieldGain: 1.55,
    glint: 1,
    exposure: 1.0,
    vignette: 0.35,
    haze: 1,
    keep: 0.45,
  },
};

/** one pointer for every sky on the page, mouse only */
const pointer = { x: 0, y: 0 };
let pointerBound = false;
function bindPointer(): void {
  if (pointerBound) return;
  pointerBound = true;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );
}

interface Meteor {
  t0: number;
  dur: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  len: number;
  width: number;
  peak: number;
}

interface Composition {
  cx: number;
  cy: number;
  R: number;
  /** text-safe gradient "ax ay bx by" (dark at A → full at B) */
  mask: number[];
  masked: boolean;
  /** where meteors may start, "x0 y0 x1 y1" as fractions of the box */
  meteor: number[];
  stream: Stream | null;
}

class Sky {
  private el: HTMLElement;
  private variant: Variant;
  private tune: Tune;
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
  /** first frame was expensive: keep the still image, never animate */
  private slow = false;
  private lowPower: boolean;
  private fine: boolean;
  /** pointer parallax, eased */
  private px = 0;
  private py = 0;
  /** section scroll offset in css px (read in the page's scroll loop) */
  private scroll = 0;
  private scrollAt = 0;
  /** the hero dive, 0 → 1 (eased in draw); external driver or automatic */
  private dive = 0;
  private diveHost: HTMLElement | null = null;
  private meteor: Meteor | null = null;
  private nextMeteor = 1.6 + Math.random() * 2.4;
  private comp: Composition = {
    cx: 0.7,
    cy: 0.42,
    R: 0.4,
    mask: [0.3, 0.6, 0.6, 0.4],
    masked: true,
    meteor: [0.5, 0.04, 0.97, 0.45],
    stream: null,
  };

  constructor(el: HTMLElement, variant: Variant) {
    this.el = el;
    this.variant = variant;
    this.tune = TUNE[variant];
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
    // A software rasteriser (SwiftShader, llvmpipe — GPU-less VMs,
    // Lighthouse/PageSpeed) draws this on the CPU at seconds per frame.
    // Those get the CSS sky instead.
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) throw new Error('software renderer');
    this.gl = gl;
    const nav = navigator as Navigator & { deviceMemory?: number };
    this.fine = window.matchMedia('(pointer: fine)').matches;
    this.lowPower = !this.fine || (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;

    // a star sky never draws the galaxy: skip those two compiles
    if (variant === 'galaxy') {
      this.pGalaxy = this.program(VS_GALAXY, FS_SPRITE);
      this.pDisc = this.program(VS_QUAD, FS_DISC);
    }
    this.pField = this.program(VS_FIELD, FS_SPRITE);
    this.pComp = this.program(VS_QUAD, FS_COMPOSITE);

    const half = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    this.half = !!half;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    this.maxPt = range ? range[1] : 64;

    this.canvas.addEventListener('webglcontextlost', this.onLost, false);

    this.measure();
    this.resize();
    const r0 = el.getBoundingClientRect();
    this.scroll = this.scrollOf(r0.top, r0.height, window.innerHeight);
    this.dive = this.diveOf(r0.top, r0.height);
    // The first frame pays for shader compiles and uploads; the second is
    // what every frame will cost. A slow first frame (>250 ms) or a second
    // one over ~50 ms means the device can't carry the animation: the still
    // frame stays, the loop never starts.
    let t0 = performance.now();
    this.draw();
    gl.finish();
    const first = performance.now() - t0;
    t0 = performance.now();
    this.draw();
    gl.finish();
    const second = performance.now() - t0;
    if (gl.isContextLost()) throw new Error('lost');
    this.slow = first > 250 || second > 50;
    el.dataset.cosmosMs = `${Math.round(first)}/${Math.round(second)}${this.slow ? ' still' : ''}`;

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
        if (this.visible) requestFrame();
        this.sync();
      },
      { rootMargin: '80px' },
    ).observe(el);

    // depth on scroll: the layout read happens in the page's one scroll
    // loop; this sky's own frame turns it into uniforms
    addFrame({
      read: (_y, vh) => {
        if (this.dead || !this.visible || this.slow) return;
        const r = this.el.getBoundingClientRect();
        const s = this.scrollOf(r.top, r.height, vh);
        const d = this.diveOf(r.top, r.height);
        if (Math.abs(s - this.scroll) > 0.05 || Math.abs(d - this.dive) > 0.0005) {
          this.scroll = s;
          this.dive = d;
          this.scrollAt = performance.now();
        }
      },
    });

    document.addEventListener('visibilitychange', () => this.sync());
    document.addEventListener('vesta:motion', () => {
      if (isReduced()) {
        this.px = this.py = 0;
        this.meteor = null;
        this.draw();
      }
      this.sync();
    });
    if (this.fine) bindPointer();
    this.sync();
  }

  /**
   * The dive, 0 → 1. A parent can drive it: an inline `--dive` custom
   * property (style.setProperty) or a `data-dive` attribute on the cosmos
   * root or any ancestor. Without a driver the galaxy dives by itself as its
   * section scrolls away; star skies never dive.
   */
  private diveOf(top: number, height: number): number {
    if (vestibular()) return 0;
    if (!this.diveHost) {
      for (let n: HTMLElement | null = this.el; n && n !== document.body; n = n.parentElement) {
        if (n.hasAttribute('data-dive') || n.style.getPropertyValue('--dive')) {
          this.diveHost = n;
          break;
        }
      }
    }
    const h = this.diveHost;
    if (h) {
      const raw = parseFloat(h.style.getPropertyValue('--dive') || h.getAttribute('data-dive') || '');
      if (Number.isFinite(raw)) return Math.min(1, Math.max(0, raw));
    }
    if (this.variant !== 'galaxy') return 0;
    return Math.min(1, Math.max(0, -top / Math.max(height * 0.85, 1)));
  }

  /** galaxy: 0 with the hero at the top of the page; star fields: 0 when centred */
  private scrollOf(top: number, height: number, vh: number): number {
    return this.variant === 'galaxy' ? -top : vh * 0.5 - (top + height * 0.5);
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
    const quad = (name: string) => {
      const m = cs.getPropertyValue(name).trim().split(/\s+/).map(Number);
      return m.length === 4 && m.every(Number.isFinite) ? m : null;
    };
    const maskVar = quad('--cosmos-mask');
    const meteorVar = quad('--cosmos-meteor');
    if (this.variant === 'galaxy') {
      this.comp = landscape
        ? {
            cx: v('--cosmos-x', 0.73),
            cy: v('--cosmos-y', 0.44),
            R: Math.min(v('--cosmos-r', 0.36) * this.cssW, this.cssH * 0.95),
            mask: maskVar || [0.34, 0.62, 0.62, 0.4],
            masked: true,
            meteor: meteorVar || [0.52, 0.04, 0.97, 0.42],
            stream: { x: 0.66, y: 1.0, angle: -60 * DEG, share: 0.2 },
          }
        : {
            cx: v('--cosmos-x', 0.7),
            cy: v('--cosmos-y', 0.2),
            R: v('--cosmos-r', 0.86) * this.cssW,
            mask: maskVar || [0.3, 0.56, 0.6, 0.26],
            masked: true,
            meteor: meteorVar || [0.3, 0.6, 1.0, 0.8],
            stream: { x: 0.7, y: 0.9, angle: -34 * DEG, share: 0.16 },
          };
    } else {
      this.comp = {
        cx: 0,
        cy: 0,
        R: 1,
        mask: maskVar || [0, 0, 1, 0],
        masked: !!maskVar,
        meteor: meteorVar || (landscape ? [0.56, 0.05, 0.97, 0.55] : [0.25, 0.03, 1.0, 0.3]),
        stream: null,
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
      // only the galaxy draws into the half-res target
      const g = this.variant === 'galaxy';
      this.lo = this.target(g ? Math.max(1, Math.ceil(w / 2)) : 1, g ? Math.max(1, Math.ceil(h / 2)) : 1, this.lo);
    }
    // particle budget follows canvas area; rebuild only on a real change
    const area = this.cssW * this.cssH;
    if (this.builtFor && Math.abs(area - this.builtFor) / this.builtFor < 0.35) return;
    this.builtFor = area;
    const small = this.cssW < 768;
    if (this.variant === 'galaxy') {
      // ≈ 57k galaxy particles at 1440×900, ≈ 14k on a phone
      const nStars = Math.round(Math.min(32000, Math.max(5000, area * (small ? 0.02 : 0.024))));
      const g = buildGalaxy(nStars, small ? 4000 : 12000, small ? 1300 : 4200);
      this.layers.stars = this.layer(g.stars, G_STRIDE, [4, 4, 1], this.layers.stars);
      this.layers.glow = this.layer(g.glow, G_STRIDE, [4, 4, 1], this.layers.glow);
      this.layers.dust = this.layer(g.dust, G_STRIDE, [4, 4, 1], this.layers.dust);
      const nField = Math.round(Math.min(15000, Math.max(3000, area * 0.0105)));
      this.layers.field = this.layer(buildField(nField, 29, 4, this.cssW, this.cssH, this.comp.stream), F_STRIDE, [4, 4, 4], this.layers.field);
    } else {
      const nField = Math.round(Math.min(13000, Math.max(2400, area * 0.0085)));
      this.layers.field = this.layer(buildField(nField, 431, 3, this.cssW, this.cssH, null), F_STRIDE, [4, 4, 4], this.layers.field);
    }
  }

  /* ---------------- drawing ---------------- */

  private draw(): void {
    const gl = this.gl;
    if (this.dead || gl.isContextLost() || !this.hi || !this.lo) return;
    const hi = this.hi;
    const lo = this.lo;
    const T = this.tune;
    const galaxy = this.variant === 'galaxy';
    const still = isReduced();
    const scroll = still ? 0 : this.scroll;
    // the dive: as the hero leaves, the galaxy swells, swings toward face-on
    // and turns a little, the camera closes in (stronger perspective) and the
    // star field opens outward from the core. The pointer tilts it ≤ 4°.
    const dv = still ? 0 : this.dive;
    const d = dv * dv * (3 - 2 * dv);
    const view = [(60 + this.py * 3.4 - d * 26) * DEG, this.px * 4 * DEG, (-21 - d * 12) * DEG, 0.14 + d * 0.22];
    // landscape: the galaxy sits beside the copy and holds its place on
    // screen as it swells; portrait: it sits below the copy, so it rises
    // with the page into the part of the hero still in view
    const wide = this.cssW >= this.cssH * 1.05;
    const lagG = wide ? T.lagGalaxy + d * 0.44 : T.lagGalaxy * (1 - d);
    const cy = this.comp.cy - (wide ? 0 : 0.14 * d);
    const grow = 1 + 1.35 * d * d + 0.12 * d;
    // …and slides in toward the middle of the frame as it comes closer
    const cx = this.comp.cx + (0.62 - this.comp.cx) * d * 0.3;
    // the text-safe mask lives in the section's frame, but the diving galaxy
    // sinks into its lower half while the copy leaves upward: let it through
    const gFloor = Math.min(0.8, 0.85 * d * d);
    const mask = this.comp.mask;
    const t = this.time;
    const par = [-this.px * T.par[0], -this.py * T.par[1]];

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
      gl.uniform2f(pr.u.u_center, cx * tgt.w, (cy * this.cssH + scroll * lagG) * s);
      gl.uniform1f(pr.u.u_R, this.comp.R * s * grow);
      if (pr.u.u_boost) gl.uniform1f(pr.u.u_boost, Math.pow(grow, 1.4));
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
      setCommon(this.pGalaxy, lo, gFloor);
      setGalaxy(this.pGalaxy, lo);
      points(this.pGalaxy, this.layers.glow, 1);
      points(this.pGalaxy, this.layers.dust, 2);

      gl.useProgram(this.pDisc.p);
      setCommon(this.pDisc, lo, gFloor);
      setGalaxy(this.pDisc, lo);
      gl.uniform3fv(this.pDisc.u.u_cCore, CORE);
      gl.uniform3fv(this.pDisc.u.u_cDisc, mix(CORE, LILAC, 0.3));
      gl.uniform3fv(this.pDisc.u.u_cOuter, mix(LILAC, VIOLET, 0.5));
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ZERO);
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // full-res target: the star field in depth, then resolved galaxy stars
    gl.bindFramebuffer(gl.FRAMEBUFFER, hi.fb);
    gl.viewport(0, 0, hi.w, hi.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pf = this.pField;
    gl.useProgram(pf.p);
    setCommon(pf, hi, this.comp.masked ? (galaxy ? 0.36 : 0.35) : 1);
    gl.uniform1f(pf.u.u_gain, this.gain * T.fieldGain);
    gl.uniform2f(pf.u.u_css, this.cssW, this.cssH);
    gl.uniform2f(pf.u.u_par, par[0], par[1]);
    gl.uniform1f(pf.u.u_scroll, scroll);
    gl.uniform3fv(pf.u.u_lag, T.lag);
    gl.uniform1f(pf.u.u_drift, still ? 0 : T.drift);
    gl.uniform1f(pf.u.u_glint, T.glint);
    gl.uniform1f(pf.u.u_keep, this.comp.masked ? T.keep : 1);
    gl.uniform1f(pf.u.u_dive, d);
    gl.uniform2f(pf.u.u_zc, cx * this.cssW, cy * this.cssH + scroll * lagG);
    points(pf, this.layers.field, 0);
    if (galaxy) {
      gl.useProgram(this.pGalaxy.p);
      setCommon(this.pGalaxy, hi, gFloor);
      setGalaxy(this.pGalaxy, hi);
      points(this.pGalaxy, this.layers.stars, 0);
      points(this.pGalaxy, this.layers.dust, 2);
    }

    // composite onto the page
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pc = this.pComp;
    gl.useProgram(pc.p);
    const u = pc.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hi.tex);
    gl.uniform1i(u.u_hi, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lo.tex);
    gl.uniform1i(u.u_lo, 1);
    gl.uniform1f(u.u_decode, 1 / this.gain);
    gl.uniform1f(u.u_exposure, T.exposure * (1 + 0.3 * d));
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_t, t);
    gl.uniform4fv(u.u_mask, mask);
    gl.uniform1f(u.u_maskFloor, this.comp.masked ? 0 : 1);
    gl.uniform1f(u.u_textFloor, galaxy ? 0.3 : 0.45);
    // the nebula is the farthest thing in a star section: it lags the most
    gl.uniform1f(u.u_haze, T.haze);
    gl.uniform2f(u.u_hazeOff, (-par[0] * 0.2) / this.cssH, -(scroll * 0.6 + par[1] * 0.2) / this.cssH);
    const st = this.comp.stream;
    if (st) {
      gl.uniform4f(u.u_stream, st.x + (par[0] * 0.34) / this.cssW, st.y + (scroll * T.lag[0] + par[1] * 0.34) / this.cssH, st.angle, 1);
    } else gl.uniform4f(u.u_stream, 0, 0, 0, 0);
    gl.uniform3fv(u.u_violet, VIOLET);
    gl.uniform3fv(u.u_lilac, LILAC);
    gl.uniform1f(u.u_vig, T.vignette);
    const m = this.meteor;
    if (m && !still) {
      const e = (t - m.t0) / m.dur;
      const env = smoothstep(0, 0.12, e) * (1 - smoothstep(0.5, 1, e));
      const d = m.speed * (t - m.t0);
      const k = this.dpr;
      gl.uniform4f(u.u_m0, (m.x + m.dx * d) * k, (m.y + m.dy * d) * k, m.dx, m.dy);
      gl.uniform4f(u.u_m1, m.len * Math.min(1, e * 3) * k + 1, m.width * k, m.peak * env, 0);
    } else gl.uniform4f(u.u_m1, 0, 0, 0, 0);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  /* ---------------- meteors ---------------- */

  /** a thin, fast streak starting inside the meteor box and heading down,
      away from the text side; one at a time, every ~5–12 s of visible time */
  private launch(): void {
    const [x0, y0, x1, y1] = this.comp.meteor;
    const W = this.cssW;
    const H = this.cssH;
    const small = W < 768;
    const x = (x0 + Math.random() * (x1 - x0)) * W;
    const y = (y0 + Math.random() * (y1 - y0)) * H;
    const ang = (16 + Math.random() * 22) * DEG;
    const speed = (small ? 560 : 820) + Math.random() * 360;
    const dur = 0.5 + Math.random() * 0.35;
    let dir = Math.random() < 0.6 ? 1 : -1;
    const end = x + dir * Math.cos(ang) * speed * dur;
    if (end < (x0 - 0.06) * W || end > W * 1.04) dir = -dir;
    this.meteor = {
      t0: this.time,
      dur,
      x,
      y,
      dx: dir * Math.cos(ang),
      dy: Math.sin(ang),
      speed,
      len: (small ? 70 : 110) + Math.random() * 90,
      width: 0.62 + Math.random() * 0.3,
      peak: 0.5 + Math.random() * 0.4,
    };
  }

  /* ---------------- loop ---------------- */

  private sync(): void {
    const run = this.live && !this.slow && !this.dead && this.visible && !document.hidden && !isReduced();
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
    const tx = this.fine ? pointer.x : 0;
    const ty = this.fine ? pointer.y : 0;
    const settling = Math.abs(tx - this.px) + Math.abs(ty - this.py) > 0.002;
    const scrolling = now - this.scrollAt < 400;
    // 60fps while something moves fast (pointer ease, scroll, a meteor);
    // 30fps for the slow sky, and always on low-power devices
    const fast = !this.lowPower && (settling || scrolling || !!this.meteor);
    const interval = fast ? 1000 / 60 : 1000 / 30;
    if (dt < interval - 1.5) return;
    this.last = now;
    const s = Math.min(dt, 100) / 1000;
    this.time += s;
    const k = 1 - Math.exp(-s * 2.4);
    this.px += (tx - this.px) * k;
    this.py += (ty - this.py) * k;
    if (this.meteor && this.time - this.meteor.t0 > this.meteor.dur) {
      this.meteor = null;
      this.nextMeteor = this.time + 5 + Math.random() * 7;
    } else if (!this.meteor && this.time >= this.nextMeteor) this.launch();
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

export function initCosmos(): void {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-cosmos]'));
  if (!roots.length) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn && conn.saveData) return;

  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const idle = (cb: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 1200 }) : window.setTimeout(cb, 200));

  const make = (el: HTMLElement) => {
    if (el.dataset.cosmosReady) return;
    el.dataset.cosmosReady = '1';
    const variant: Variant = el.dataset.cosmos === 'galaxy' ? 'galaxy' : 'stars';
    try {
      new Sky(el, variant);
    } catch {
      /* no WebGL2 / software renderer / compile failure: the CSS sky stays */
      el.querySelector('canvas.cosmos__gl')?.remove();
    }
  };

  // Each sky is its own context: build it on idle when it comes within about
  // a viewport of the screen, one per idle slot, so the compiles never land
  // together and a sky that is never reached (a closed menu) costs nothing.
  const queue: HTMLElement[] = [];
  let pumping = false;
  const pump = () => {
    const el = queue.shift();
    if (el) make(el);
    if (queue.length) idle(pump);
    else pumping = false;
  };
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        near.unobserve(e.target);
        queue.push(e.target as HTMLElement);
      }
      if (queue.length && !pumping) {
        pumping = true;
        idle(pump);
      }
    },
    { rootMargin: '150% 0px' },
  );
  const start = () => roots.forEach((el) => near.observe(el));
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
