/* =========================================================================
   Vesta — <Asteroid> renderer: 4 Vesta in 3D (raw WebGL2, no libraries)

   Shape: an oblate triaxial body, 572 × 557 × 446 km (x, y, spin axis z),
   carrying a procedural relief that is BAKED once into two cube maps:
     - relief cube (R height, G albedo, B diogenite tint),
     - normal cube (object-space normal of the full relief).
   The bake holds what makes Vesta read as Vesta:
     - Rheasilvia (Ø ≈ 500 km, centre 75° S): a deep basin at the south
       pole with a steep, uneven rim scarp, arcing ridges on its floor and
       the ~20 km central peak massif;
     - Veneneia (Ø ≈ 400 km, centre 52° S), older, half erased by Rheasilvia;
     - Divalia Fossae (troughs around the equator, concentric to
       Rheasilvia) and the degraded Saturnalia Fossae in the north,
       concentric to Veneneia;
     - the "snowman" (Marcia, Calpurnia, Minucia) and five populations of
       smaller craters, fewer on the young Rheasilvia floor;
     - grey-brown regolith with dark-material patches and bright ejecta.
   Per frame a fragment shader sphere-traces the relief (height read from
   the cube), marches a shadow ray toward a warm key light, and adds a thin
   lilac rim light from behind plus a faint specular. Output is premultiplied
   and transparent, with an analytically anti-aliased silhouette.

   One shared WebGL2 context serves every <Asteroid> on the page (one compile,
   one bake); each instance copies its frame into its own 2D canvas.

   Motion: a slow spin (the 5.342 h day compressed 400×: one turn in 48 s),
   drag to spin/tilt with inertia (pointer + touch, only with data-drag), and
   a small scroll-linked tilt and turn fed by the page's one scroll loop.

   Contract: starts after load on idle; skips on Save-Data, missing WebGL2 and
   software rasterisers (the CSS body stays); compiles off the main thread
   where the driver allows; renders only while on screen and in a visible
   tab; 60 fps on desktop, 30 fps on low-power devices; DPR ≤ 1.5; drops the
   canvases on context loss; never logs.
   ========================================================================= */

import { addFrame, isReduced, requestFrame } from './motion';

const TAU = Math.PI * 2;
const SPIN = TAU / 48; // rad/s
const BASE_TILT = -0.24; // south pole leaning toward the viewer: Rheasilvia on the lower limb
const BASE_ROLL = 0.22;

const norm = (v: number[]): number[] => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
/* key light (warm, upper left, in front) and rim light (lilac, behind right) */
const KEY = norm([-0.9, 0.22, 0.36]);
const RIM = norm([0.45, 0.24, -0.86]);

/* lat/lon (degrees) → body-frame unit vector */
const dir = (la: number, lo: number): number[] => {
  const a = (la * Math.PI) / 180;
  const o = (lo * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(o), Math.cos(a) * Math.sin(o), Math.sin(a)];
};
const glv = (v: number[]): string => `vec3(${v.map((c) => c.toFixed(5)).join(', ')})`;

/* ---------------------------------------------------------------------- */
/* shaders                                                                 */
/* ---------------------------------------------------------------------- */

const HMIN = -0.17;
const HMAX = 0.1;

const COMMON = /* glsl */ `
const float HMIN = ${HMIN.toFixed(3)};
const float HMAX = ${HMAX.toFixed(3)};
const vec3 AX = vec3(1.0, 0.974, 0.780);
float baseR(vec3 u) { vec3 q = u / AX; return inversesqrt(dot(q, q)); }
`;

const FACE = /* glsl */ `
vec3 faceDir(vec2 st) {
  if (uFace == 0) return vec3(1.0, -st.y, -st.x);
  if (uFace == 1) return vec3(-1.0, -st.y, st.x);
  if (uFace == 2) return vec3(st.x, 1.0, st.y);
  if (uFace == 3) return vec3(st.x, -1.0, -st.y);
  if (uFace == 4) return vec3(st.x, -st.y, 1.0);
  return vec3(-st.x, -st.y, -1.0);
}
`;

const VS = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* Every loop bound is offset by a uniform zero and every noise call goes
   through one call site: D3D shader compilers inline and unroll everything
   else, and the compile would take seconds. */
const NZ = [
  // frequency, offset, octaves
  [1.2, 4.0, 4], //  0 body lumps
  [3.2, 9.0, 4], //  1 body lumps, finer
  [2.4, 1.3, 3], //  2 Rheasilvia outline wobble
  [1.6, 5.0, 3], //  3 rim scarp height (Matronalia Rupes where high)
  [5.0, 0.0, 2], //  4 peak footprint
  [10.0, 0.0, 3], //  5 peak ruggedness
  [4.0, 0.0, 2], //  6 floor ridge phase
  [8.0, 2.0, 4], //  7 basin floor hummocks
  [2.8, 7.0, 3], //  8 Veneneia outline wobble
  [5.0, 3.0, 2], //  9 trough wobble
  [4.0, 8.0, 2], // 10 Saturnalia wobble
  [2.1, 11.0, 4], // 11 albedo, broad
  [8.0, 5.0, 3], // 12 albedo, fine
  [3.3, 17.0, 4], // 13 dark material
  [3.0, 21.0, 3], // 14 trough continuity
  [22.0, 3.0, 4], // 15 fine relief
  [70.0, 0.0, 2], // 16 regolith grain
  [9.0, 13.0, 3], // 17 medium relief (hummocky terrain)
  [16.0, 31.0, 3], // 18 albedo, speckle
];
const NZN = NZ.length;

const LAYERS = [
  // scale, density, seed, freshness
  [2.6, 0.45, 1.0, 0.35],
  [5.0, 0.7, 7.0, 0.6],
  [9.5, 0.85, 13.0, 0.9],
  [18.0, 0.9, 29.0, 1.0],
  [34.0, 0.92, 41.0, 1.0],
];

const NAMED = [
  // lat, lon, angular radius, freshness — the snowman
  [9.4, 190.2, 0.105, 0.95], // Marcia
  [17.8, 196.6, 0.09, 0.55], // Calpurnia
  [23.6, 201.5, 0.042, 0.7], // Minucia
];

const FS_BAKE = /* glsl */ `#version 300 es
precision highp float;
uniform int uFace;
uniform int uZero;
uniform float uN;
uniform vec4 uLay[${LAYERS.length}];
uniform vec4 uNz[${NZN}];
uniform vec4 uNamed[${NAMED.length}];
uniform float uNamedF[${NAMED.length}];
layout(location = 0) out vec4 oH;
layout(location = 1) out vec4 oP;
${COMMON}
${FACE}
const vec3 CR = ${glv(dir(-75, 301))};   // Rheasilvia
const vec3 CV = ${glv(dir(-52, 170))};   // Veneneia

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 w = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), w.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), w.x), w.y);
  float b = mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), w.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), w.x), w.y);
  return mix(a, b, w.z) * 2.0 - 1.0;
}
float gauss(float x, float w) { return exp(-(x * x) / (w * w)); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float azimuth(vec3 u, vec3 c) {
  vec3 e1 = normalize(cross(c, abs(c.z) < 0.9 ? vec3(0, 0, 1) : vec3(1, 0, 0)));
  return atan(dot(u, cross(c, e1)), dot(u, e1));
}
// graben: flat floor, steep walls, a faint raised lip
float trough(float a, float a0, float w) {
  float d = abs(a - a0) / w;
  return (1.0 - smoothstep(0.3, 1.0, d)) - 0.2 * gauss(d - 1.2, 0.4);
}
// crater profile, x = distance / radius (rim crest near 1), unit depth
float craterShape(float x, float fresh) {
  float cavity = x * x - 1.0;
  float rx = min(x - 1.5, 0.0);
  float rim = rx * rx * 0.8;
  return smin(smax(cavity, mix(-0.3, -0.72, fresh), 0.2), rim, mix(0.2, 0.1, fresh));
}
float youngMask(vec3 d) { return mix(0.3, 1.0, smoothstep(0.7, 1.0, acos(clamp(dot(d, CR), -1.0, 1.0)) / 0.93)); }

void crater(float xx, float R, float fresh, float sgn, float ray, inout float h, inout float alb) {
  if (xx < 1.6) h += craterShape(xx, fresh) * R * mix(0.2, 0.55, fresh);
  // fresh craters: bright floor and ray-streaked ejecta; some are dark-haloed
  alb += fresh * sgn * (0.18 * (1.0 - smoothstep(0.7, 1.1, xx)) + 0.24 * ray * exp(-max(xx - 1.0, 0.0) * 2.2) * step(0.85, xx));
}

float surf(vec3 u, out float alb, out float tint) {
  float nz[${NZN}];
  for (int k = uZero; k < ${NZN} + uZero; k++) {
    vec4 q = uNz[k];
    vec3 p = u * q.x + q.y;
    float s = 0.0, a = 0.5;
    for (int i = uZero; i < int(q.z) + uZero; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    nz[k] = s;
  }

  // the body is lumpy, not a clean ellipsoid
  float h = nz[0] * 0.05 + nz[1] * 0.016 + nz[17] * 0.009 + nz[15] * 0.006;

  // Rheasilvia
  float aR = acos(clamp(dot(u, CR), -1.0, 1.0));
  float phR = azimuth(u, CR);
  float xR0 = aR / 0.93;
  float xR = xR0 + nz[2] * 0.08;
  float rimAmp = 0.01 + 0.032 * smoothstep(-0.15, 0.45, nz[3]);
  float basin = -0.1 * (1.0 - smoothstep(0.42, 1.0, xR));
  float rimR = rimAmp * (xR < 1.0 ? gauss(xR - 1.0, 0.06) : gauss(xR - 1.0, 0.24));
  float pk = gauss(xR0, 0.25 + 0.06 * nz[4]);
  float peak = 0.11 * pk + 0.018 * nz[5] * gauss(xR0, 0.34);
  float ridges = sin(phR * 7.0 + xR * 11.0 + nz[6] * 1.6) * 0.005 * smoothstep(0.28, 0.45, xR) * (1.0 - smoothstep(0.78, 0.95, xR));
  float inR = 1.0 - smoothstep(0.9, 1.02, xR);
  h += basin + rimR + peak + ridges + nz[7] * 0.011 * inR;

  // Veneneia, older, overprinted by Rheasilvia
  float aV = acos(clamp(dot(u, CV), -1.0, 1.0));
  float xV = aV / 0.75 + nz[8] * 0.09;
  float keep = smoothstep(0.85, 1.15, xR);
  h += -0.055 * (1.0 - smoothstep(0.4, 1.0, xV)) * mix(0.4, 1.0, keep);
  h += 0.016 * (xV < 1.0 ? gauss(xV - 1.0, 0.08) : gauss(xV - 1.0, 0.22)) * keep;

  // Divalia Fossae: graben around the equator, concentric to Rheasilvia,
  // uneven in depth and broken along their length
  float fa = aR + nz[9] * 0.016;
  float cont = smoothstep(-0.35, 0.25, nz[14]);
  float div = trough(fa, 1.52, 0.05) * smoothstep(-0.2, 0.6, sin(phR + 0.6)) * (0.6 + 0.4 * sin(phR * 3.0));
  div += trough(fa, 1.64, 0.072) * smoothstep(-0.7, 0.2, sin(phR - 0.4)) * (0.75 + 0.25 * sin(phR * 2.0 + 2.0));
  div += trough(fa, 1.76, 0.042) * smoothstep(0.1, 0.7, sin(phR - 1.9));
  h -= div * cont * 0.013;

  // Saturnalia Fossae: degraded troughs in the north, concentric to Veneneia
  float phV = azimuth(u, CV);
  float fv = aV + nz[10] * 0.03;
  float sat = (1.0 - smoothstep(0.02, 0.07, abs(fv - 1.64))) * smoothstep(0.0, 0.5, sin(phV + 1.0));
  sat += (1.0 - smoothstep(0.02, 0.06, abs(fv - 1.80))) * smoothstep(0.2, 0.7, sin(phV - 0.3));
  h -= sat * smoothstep(0.05, 0.35, u.z) * 0.011;

  // albedo: grey-brown regolith, dark-material patches near the basin rims
  alb = 0.5 + 0.24 * nz[11] + 0.16 * nz[12] + 0.1 * nz[18];
  float dark = smoothstep(0.02, 0.38, nz[13]) * (0.3 + 0.7 * gauss(xV - 1.0, 0.3) + 0.5 * gauss(xR - 1.05, 0.18));
  alb -= 0.4 * dark;
  alb += 0.07 * (1.0 - smoothstep(0.85, 1.0, xR));
  alb += 0.1 * smoothstep(0.02, 0.08, peak - 0.03); // fresh exposures on the peak massif
  tint = 1.0 - smoothstep(0.8, 1.0, xR);

  // the snowman
  for (int k = uZero; k < ${NAMED.length} + uZero; k++) {
    vec4 c = uNamed[k];
    float xx = acos(clamp(dot(u, c.xyz), -1.0, 1.0)) / c.w;
    if (xx > 3.0) continue;
    float ray = 0.6 + 0.4 * vnoise(normalize(u - c.xyz + 1e-5) * 9.0 + c.xyz * 13.0);
    crater(xx, c.w, uNamedF[k], k == 0 ? -1.0 : 1.0, ray, h, alb);
  }

  // five crater populations (cellular, 3×3×3 neighbourhood)
  for (int l = uZero; l < ${LAYERS.length} + uZero; l++) {
    vec4 L = uLay[l];
    vec3 p = u * L.x;
    vec3 ip = floor(p);
    for (int i = uZero; i < 27 + uZero; i++) {
      vec3 c = ip + vec3(float(i % 3), float((i / 3) % 3), float(i / 9)) - 1.0;
      vec3 r = hash33(c + L.z);
      vec3 cp = c + 0.15 + 0.7 * hash33(c + L.z + 11.1);
      if (r.x > L.y * youngMask(normalize(cp))) continue;
      float R = mix(0.14, 0.45, r.y * r.y);
      vec3 dv = p - cp;
      float d = length(dv);
      if (d > R * 2.2) continue;
      float fresh = pow(r.z, 4.0) * L.w;
      float ray = 0.55 + 0.45 * vnoise(normalize(dv + 1e-5) * 7.0 + r * 40.0);
      crater(d / R, R / L.x, fresh, fract(r.x * 17.13) < 0.22 ? -0.8 : 1.0, ray, h, alb);
    }
  }

  // regolith grain for the normals
  h += nz[16] * 0.0012;
  return h;
}

void main() {
  vec2 st = gl_FragCoord.xy / uN * 2.0 - 1.0;
  vec3 u = normalize(faceDir(st));
  float alb, tint;
  float h = clamp((surf(u, alb, tint) - HMIN) / (HMAX - HMIN), 0.0, 1.0);
  oH = vec4(h, clamp(alb, 0.0, 1.0), tint, 1.0);
  // 16-bit copy of the height for the normal pass (read unfiltered)
  float v = floor(h * 65535.0 + 0.5);
  float hi = floor(v / 256.0);
  oP = vec4(hi / 255.0, (v - hi * 256.0) / 255.0, 0.0, 1.0);
}`;

/* normals of the full relief, from the 16-bit height by central differences */
const FS_NORMAL = /* glsl */ `#version 300 es
precision highp float;
uniform int uFace;
uniform float uN;
uniform samplerCube uP;
out vec4 oN;
${COMMON}
${FACE}
vec3 P(vec2 st) {
  vec3 u = normalize(faceDir(st));
  vec2 e = floor(texture(uP, u).rg * 255.0 + 0.5);
  float h = mix(HMIN, HMAX, (e.x * 256.0 + e.y) / 65535.0);
  return u * baseR(u) * (1.0 + h);
}
void main() {
  vec2 st = gl_FragCoord.xy / uN * 2.0 - 1.0;
  float d = 2.0 / uN;
  vec3 n = normalize(cross(P(st + vec2(d, 0.0)) - P(st - vec2(d, 0.0)), P(st + vec2(0.0, d)) - P(st - vec2(0.0, d))));
  if (dot(n, faceDir(st)) < 0.0) n = -n;
  oN = vec4(n * 0.5 + 0.5, 1.0);
}`;

const FS_VIEW = /* glsl */ `#version 300 es
precision highp float;
uniform samplerCube uH;
uniform samplerCube uN;
uniform mat3 uRot;     // world → body
uniform vec2 uRes;
uniform float uLod;
uniform float uSeed;
uniform vec3 uKey;     // world space
uniform vec3 uRim;
uniform int uZero;
out vec4 o;
${COMMON}
const float CAM = 7.0;
const float HALF = 1.17;
const float RB = ${(1 + HMAX + 0.005).toFixed(3)};

float surfR(vec3 u) { return baseR(u) * (1.0 + mix(HMIN, HMAX, textureLod(uH, u, uLod).r)); }
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / m;
  vec3 ro = uRot * vec3(0.0, 0.0, CAM);
  vec3 rd = uRot * normalize(vec3(uv * HALF, -CAM));
  float b = dot(ro, rd);
  float disc = b * b - dot(ro, ro) + RB * RB;
  if (disc <= 0.0) { o = vec4(0.0); return; }
  float sq = sqrt(disc);
  float t = -b - sq;
  float tEnd = -b + sq;
  float pix = 2.0 * HALF / CAM / m;

  // sphere-trace the relief; remember the closest miss for the soft edge
  bool hit = false;
  float best = 1e9;
  float tBest = t;
  for (int i = uZero; i < 110 + uZero; i++) {
    vec3 p = ro + rd * t;
    float l = length(p);
    float d = l - surfR(p / l);
    float r = d / (pix * t);
    if (r < best) { best = r; tBest = t; }
    if (d < 0.00025 * t) { hit = true; break; }
    t += d * 0.6;
    if (t > tEnd) break;
  }
  float cover = hit ? 1.0 : 1.0 - smoothstep(0.0, 1.1, best);
  if (cover < 0.003) { o = vec4(0.0); return; }
  if (!hit) t = tBest;
  vec3 u = normalize(ro + rd * t);
  vec3 p = u * surfR(u);

  vec3 n = normalize(textureLod(uN, u, uLod).xyz * 2.0 - 1.0);
  vec4 hs = textureLod(uH, u, uLod);
  vec3 L = uRot * uKey;
  vec3 R = uRot * uRim;
  vec3 V = -rd;
  float mu0 = dot(n, L);
  float mu = max(dot(n, V), 0.0);

  // cast shadows: march toward the sun through the relief
  float sh = 0.0;
  if (mu0 > 0.0 && dot(u, L) > -0.3) {
    sh = 1.0;
    vec3 q0 = p + n * 0.0015;
    float ts = 0.003;
    for (int i = uZero; i < 44 + uZero; i++) {
      vec3 q = q0 + L * ts;
      float l = length(q);
      if (l > RB) break;
      float d = l - surfR(q / l);
      sh = min(sh, 24.0 * d / ts);
      if (sh < 0.005) break;
      ts += clamp(d * 0.7, 0.003, 0.05);
    }
    sh = clamp(sh, 0.0, 1.0);
  }
  mu0 = max(mu0, 0.0);
  // airless regolith: Lommel-Seeliger blended with Lambert
  float diff = mix(mu0, 2.0 * mu0 / (mu0 + mu + 0.05), 0.45);

  vec3 tone = mix(vec3(0.53, 0.49, 0.45), vec3(0.51, 0.5, 0.48), hs.b);
  vec3 base = tone * (0.1 + 1.0 * hs.g);
  vec3 keyC = vec3(1.0, 0.9, 0.78) * 1.42;
  vec3 col = base * keyC * diff * sh;
  vec3 H = normalize(L + V);
  col += keyC * 0.035 * pow(max(dot(n, H), 0.0), 30.0) * sh * mu0;
  // thin lilac rim from behind
  // (a light almost straight behind lights only a thin crescent of the
  // visible side, and the relief breaks it up like a real backlit limb)
  float rim = max(dot(n, R), 0.0);
  rim *= rim;
  // plus a hairline along the smooth limb on the backlit side
  vec3 g = normalize(u / (AX * AX));
  rim += pow(1.0 - max(dot(g, V), 0.0), 12.0) * smoothstep(0.02, 0.4, dot(g, R)) * 0.6;
  col += vec3(0.44, 0.33, 1.0) * rim * (0.5 + hs.g) * 3.2;
  // a trace of violet fill so the night side keeps its form
  col += base * vec3(0.012, 0.01, 0.024) * (0.5 + 0.5 * max(dot(n, -L), 0.0));

  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col += (hash12(gl_FragCoord.xy + uSeed) - 0.5) * (2.5 / 255.0);
  o = vec4(clamp(col, 0.0, 1.0) * cover, cover);
}`;

/* ---------------------------------------------------------------------- */
/* shared engine: one context, one compile, one bake                       */
/* ---------------------------------------------------------------------- */

type Mat = number[];
const mul = (a: Mat, b: Mat): Mat => {
  const r: Mat = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
const rz = (t: number): Mat => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];
const rx = (t: number): Mat => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const POLE_UP: Mat = [1, 0, 0, 0, 0, 1, 0, -1, 0]; // body z (spin axis) → world y

const lowPower = (): boolean => {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return !window.matchMedia('(pointer: fine)').matches || (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;
};

class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly low: boolean;
  ready = false;
  dead = false;
  slow = false;
  private N: number;
  private pView: WebGLProgram;
  private texH: WebGLTexture;
  private texN: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private waiting: Array<() => void> = [];
  private lost: Array<() => void> = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 2;
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
    // Lighthouse/PageSpeed) would draw this on the CPU: the CSS body stays.
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) throw new Error('software renderer');
    this.gl = gl;
    this.low = lowPower();
    this.N = this.low ? 256 : 512;

    const par = gl.getExtension('KHR_parallel_shader_compile');
    this.pView = this.program(FS_VIEW);
    const pBake = this.program(FS_BAKE);
    const pNorm = this.program(FS_NORMAL);
    this.texH = this.cube(true, true);
    this.texN = this.cube(true, true);
    const texP = this.cube(false, false);
    const fbo = gl.createFramebuffer();
    gl.bindVertexArray(gl.createVertexArray());

    this.canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.dead = true;
        this.lost.forEach((f) => f());
      },
      false,
    );

    // one GPU job per frame: wait for the compiler, bake the six relief
    // faces, derive the six normal faces, go live
    const progs = [this.pView, pBake, pNorm];
    let step = 0;
    const bake = (p: WebGLProgram, f: number, relief: boolean) => {
      const face = gl.TEXTURE_CUBE_MAP_POSITIVE_X + f;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.useProgram(p);
      if (relief) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, face, this.texH, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, face, texP, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      } else {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, face, this.texN, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, face, null, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texP);
        gl.uniform1i(gl.getUniformLocation(p, 'uP'), 0);
      }
      gl.uniform1i(gl.getUniformLocation(p, 'uFace'), f);
      gl.uniform1f(gl.getUniformLocation(p, 'uN'), this.N);
      gl.viewport(0, 0, this.N, this.N);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    const run = () => {
      if (this.dead || gl.isContextLost()) return;
      if (step === 0) {
        if (par && !progs.every((p) => gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR))) {
          requestAnimationFrame(run);
          return;
        }
        if (!progs.every((p) => gl.getProgramParameter(p, gl.LINK_STATUS))) {
          this.dead = true;
          this.lost.forEach((f) => f());
          return;
        }
        gl.useProgram(pBake);
        const flat = (a: number[][]) => new Float32Array(a.flat());
        gl.uniform1i(gl.getUniformLocation(pBake, 'uZero'), 0);
        gl.uniform4fv(gl.getUniformLocation(pBake, 'uLay'), flat(LAYERS));
        gl.uniform4fv(gl.getUniformLocation(pBake, 'uNz'), flat(NZ.map((q) => [q[0], q[1], q[2], 0])));
        gl.uniform4fv(gl.getUniformLocation(pBake, 'uNamed'), flat(NAMED.map((c) => [...dir(c[0], c[1]), c[2]])));
        gl.uniform1fv(gl.getUniformLocation(pBake, 'uNamedF'), new Float32Array(NAMED.map((c) => c[3])));
        step = 1;
      }
      if (step <= 6) bake(pBake, step - 1, true);
      else if (step <= 12) bake(pNorm, step - 7, false);
      else {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texH);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texN);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.deleteProgram(pBake);
        gl.deleteProgram(pNorm);
        gl.deleteTexture(texP);
        gl.deleteFramebuffer(fbo);
        this.live();
        return;
      }
      step++;
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  private program(fs: string): WebGLProgram {
    const gl = this.gl;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  private cube(mips: boolean, linear: boolean): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, mips ? Math.log2(this.N) + 1 : 1, gl.RGBA8, this.N, this.N);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, linear ? (mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR) : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private live(): void {
    const gl = this.gl;
    const p = this.pView;
    for (const k of ['uH', 'uN', 'uRot', 'uRes', 'uLod', 'uSeed', 'uKey', 'uRim', 'uZero']) this.u[k] = gl.getUniformLocation(p, k);
    gl.useProgram(p);
    gl.uniform1i(this.u.uH, 0);
    gl.uniform1i(this.u.uN, 1);
    gl.uniform1i(this.u.uZero, 0);
    gl.uniform3fv(this.u.uKey, KEY);
    gl.uniform3fv(this.u.uRim, RIM);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texH);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texN);

    // a representative frame, timed: over ~40 ms the device keeps still frames
    const m = mul(POLE_UP, rz(0));
    this.render(360, 360, m);
    gl.finish();
    const t0 = performance.now();
    this.render(360, 360, m);
    gl.finish();
    this.slow = performance.now() - t0 > 40;
    if (gl.isContextLost()) return;
    this.ready = true;
    this.waiting.splice(0).forEach((f) => f());
  }

  onReady(f: () => void): void {
    if (this.ready) f();
    else this.waiting.push(f);
  }

  onLost(f: () => void): void {
    this.lost.push(f);
  }

  /** Draws into the bottom-left w×h of the shared canvas. */
  render(w: number, h: number, m: Mat): void {
    const gl = this.gl;
    if (this.dead || gl.isContextLost()) return;
    if (this.canvas.width < w || this.canvas.height < h) {
      this.canvas.width = Math.max(this.canvas.width, w);
      this.canvas.height = Math.max(this.canvas.height, h);
    }
    gl.useProgram(this.pView);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // row-major body→world uploaded as-is is its transpose (world→body) in GLSL
    gl.uniformMatrix3fv(this.u.uRot, false, m);
    gl.uniform2f(this.u.uRes, w, h);
    gl.uniform1f(this.u.uLod, Math.max(0, Math.log2((1.6 * this.N * 1.17) / Math.min(w, h))));
    gl.uniform1f(this.u.uSeed, (performance.now() % 1000) * 0.37);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

let engine: Engine | null | undefined;
const getEngine = (): Engine | null => {
  if (engine === undefined) {
    try {
      engine = new Engine();
    } catch {
      engine = null;
    }
  }
  return engine;
};

/* ---------------------------------------------------------------------- */
/* one <Asteroid>                                                          */
/* ---------------------------------------------------------------------- */

class Rock {
  private el: HTMLElement;
  private eng: Engine;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private live = false;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;

  private spin = 0.9;
  private yaw = 0;
  private yawV = 0;
  private pitch = 0;
  private pitchV = 0;
  private dragging = false;
  private px = 0;
  private py = 0;
  private pt = 0;
  private scrollT = 0; // −1..1 across the viewport
  private scrollS = 0; // eased

  constructor(el: HTMLElement, eng: Engine) {
    this.el = el;
    this.eng = eng;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'asteroid__gl';
    this.canvas.setAttribute('aria-hidden', 'true');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d');
    this.ctx = ctx;
    this.resize();

    new ResizeObserver(() => {
      this.resize();
      if (this.live) this.draw();
    }).observe(el);

    new IntersectionObserver(
      (entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
        if (this.visible) requestFrame();
        this.sync();
      },
      { rootMargin: '120px' },
    ).observe(el);

    addFrame({
      read: (_y, vh) => {
        if (!this.visible) return;
        const r = this.el.getBoundingClientRect();
        this.scrollT = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)));
      },
    });

    document.addEventListener('visibilitychange', () => this.sync());
    document.addEventListener('vesta:motion', () => {
      if (this.live) this.draw();
      this.sync();
    });
    if (el.hasAttribute('data-drag')) this.bindDrag();

    eng.onLost(() => {
      this.live = false;
      this.sync();
      el.classList.remove('is-live');
      this.canvas.remove();
    });
    eng.onReady(() => {
      this.live = true;
      this.scrollS = this.scrollT;
      this.draw();
      // enters the page only with its first frame drawn
      el.appendChild(this.canvas);
      requestAnimationFrame(() => el.classList.add('is-live'));
      this.sync();
    });
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.eng.low ? 1.25 : 1.5);
    this.w = Math.max(2, Math.round(r.width * dpr));
    this.h = Math.max(2, Math.round(r.height * dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  private draw(): void {
    const e = this.eng;
    if (e.dead) return;
    const phi = this.spin + this.yaw + this.scrollS * 0.6;
    const tilt = BASE_TILT + this.pitch - this.scrollS * 0.16;
    e.render(this.w, this.h, mul(rz(BASE_ROLL), mul(rx(tilt), mul(POLE_UP, rz(phi)))));
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctx.drawImage(e.canvas, 0, e.canvas.height - this.h, this.w, this.h, 0, 0, this.w, this.h);
  }

  /* ---------------- interaction ---------------- */

  private bindDrag(): void {
    const el = this.el;
    const k = () => TAU / Math.max(240, el.getBoundingClientRect().width * 2.2);
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragging = true;
      this.px = e.clientX;
      this.py = e.clientY;
      this.pt = performance.now();
      this.yawV = this.pitchV = 0;
      el.classList.add('is-grabbing');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
      this.sync();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - this.pt) / 1000;
      const dx = (e.clientX - this.px) * k();
      const dy = (e.clientY - this.py) * k() * 0.7;
      this.px = e.clientX;
      this.py = e.clientY;
      this.pt = now;
      this.yaw += dx;
      this.pitch = Math.max(-0.7, Math.min(0.7, this.pitch + dy));
      this.yawV += (dx / dt - this.yawV) * 0.5;
      this.pitchV += (dy / dt - this.pitchV) * 0.5;
      if (!this.raf && this.live) this.draw();
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      el.classList.remove('is-grabbing');
      if (performance.now() - this.pt > 90) this.yawV = this.pitchV = 0; // held still before letting go
      this.yawV = Math.max(-9, Math.min(9, this.yawV));
      this.pitchV = Math.max(-4, Math.min(4, this.pitchV));
      this.sync();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  /* ---------------- loop ---------------- */

  private sync(): void {
    const e = this.eng;
    const run = this.live && !e.dead && !e.slow && this.visible && !document.hidden && (!isReduced() || this.dragging);
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
    const moving = this.dragging || Math.abs(this.yawV) > 0.05;
    const interval = this.eng.low && !moving ? 1000 / 30 : 1000 / 60;
    if (dt < interval - 1.5) return;
    this.last = now;
    const s = Math.min(dt, 100) / 1000;
    this.spin += SPIN * s;
    if (!this.dragging) {
      this.yaw += this.yawV * s;
      this.yawV *= Math.exp(-s * 1.5);
      this.pitch += this.pitchV * s;
      this.pitchV *= Math.exp(-s * 4);
      this.pitch = Math.max(-0.7, Math.min(0.7, this.pitch)) * Math.exp(-s * 0.9); // settles back
    }
    this.scrollS += (this.scrollT - this.scrollS) * (1 - Math.exp(-s * 3));
    this.draw();
  };
}

/* ---------------------------------------------------------------------- */
/* boot                                                                    */
/* ---------------------------------------------------------------------- */

export function initAsteroids(): void {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-asteroid]'));
  if (!roots.length) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn && conn.saveData) return;

  const start = () => {
    const eng = getEngine();
    if (!eng) return; // no WebGL2 / software renderer: the CSS bodies stay
    for (const el of roots) {
      if (el.dataset.asteroidReady) continue;
      el.dataset.asteroidReady = '1';
      try {
        new Rock(el, eng);
      } catch {
        el.querySelector('canvas.asteroid__gl')?.remove();
      }
    }
  };
  const idle = () => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 1500 });
    else window.setTimeout(start, 250);
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
