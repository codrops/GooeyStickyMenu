// Draws the page's pictures and chapter titles, and over them the menu: a body
// of liquid. The liquid is the menu and the strands from Strands, blended into
// one distance field: a capsule, and necks that flare into it at one end and
// into a foot along the edge of a picture or a letter at the other. Whatever
// lies under the liquid is seen through it in one way: bent towards the middle
// like under a lens, frosted, and coloured by the liquid, more the deeper it
// is, so a picture's edge and its colours run into the page gradually. What
// the liquid is made of (js/materials.js) sets its colour, light and motion.

import { fillSpaced } from './letters.js';

export const MAX = 8; // pictures drawn at once
export const MAX_LETTERS = 16; // strands on the titles' letters drawn at once, a sticky material's extra threads among them
export const MAX_TITLES = 2; // chapter titles drawn at once: two can be on screen together
export const MAX_STRINGS = 8; // a sticky material's extra threads on the pictures drawn at once
// A strand can be cut with a stroke of the mouse (js/index.js): only where there's a mouse or a
// trackpad. Elsewhere the shader leaves out what a cut strand needs, and keeps to fewer uniforms.
export const CUTS = matchMedia('(hover: hover) and (pointer: fine)').matches;
// The most device pixels the canvas has, about a 1920x1080 window at twice its resolution: a larger
// screen draws the liquid a little softer, never below its own resolution, rather than more slowly
const MAX_PIXELS = 8e6;
// no stretch of the page on a ground of its own
const NO_DARK = { x: 0, y: 0, hx: 0, hy: 0, color: [0, 0, 0] };

// How the liquid looks: clear glass, unless the page's material changes it.
// Distances are in units of the menu's half height.
export const GLASS = {
  flare: 1.5, // how wide a strand flares into the menu: how much of the menu's surface it draws up
  soften: [0, 2], // how round a picture's corner gets near the menu and where a strand holds it, and from how far away
  rim: 0.6, // how far in from its edge the liquid's surface keeps rising
  bend: 0.4, // how far the rim shifts what's under it, like a lens
  frost: [0.14, 0.45], // how far out of focus what's under it is: at the rim, in the middle
  veil: 0.52, // how milky the liquid is in the middle
  dark: [0.1, 0], // the darker rim on the side away from the light, and the thin dark line round the whole edge
  sheen: 0.45, // the soft light on the slope that faces the light
  bright: 0.5, // the thin bright edge on that side
  shadow: 0.05, // how dark the liquid's shadow is
  tint: [1, 1, 1], // the colour of the light that comes through it where it's deepest (white: none)
  depth: 1, // how strongly it takes on that colour
  veilColor: [1, 1, 1], // the colour of the milky veil
  gloss: 30, // how small and sharp the sheen is
  caustic: 0, // how much of the light that comes through it lands in its shadow, in its colour
  bubbles: 0, // how many small air bubbles it holds
};

const vertex = /* glsl */ `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler2DArray;

#define MAX ${MAX}
#define MAX_LETTERS ${MAX_LETTERS}
#define MAX_STRINGS ${MAX_STRINGS}
#define TAPS 12
${CUTS ? '#define CUTS' : ''}

uniform vec2 uViewport;      // CSS px
uniform float uDpr;
uniform float uUnit;         // the menu's half height at rest: the effect's distances are multiples of it
uniform sampler2DArray uPictures;
uniform vec2 uLayerSize;
uniform int uCount;
uniform vec4 uRect[MAX];     // centre, half size (CSS px, y down)
uniform float uLayer[MAX];
uniform vec4 uFit[MAX];      // the part of its image a picture shows: where it starts and how much, in the image's uv
uniform vec4 uStrandA[MAX];  // the picture's half of the strand: anchor, tip
uniform vec4 uStrandB[MAX];  // the menu's half: anchor, tip
uniform vec4 uRadius[MAX];   // picture anchor, picture tip, menu anchor, menu tip
uniform vec2 uBead[MAX];     // the drop at the tip of each snapped half: the picture's, the menu's
uniform vec4 uFoot[MAX];     // the strand's foot: how much wider it is at the picture's edge, and how far from the edge it narrows; how much the strand blends with the menu; and how much the strand rounds the picture's corner
uniform vec4 uPull[MAX];     // where the picture is pulled from, and how far
uniform float uPullRadius;
uniform vec4 uMenu;          // centre, half size
uniform float uFlare;        // the settings in GLASS, under the same names
uniform vec2 uSoften;
uniform float uRim;
uniform float uBend;
uniform vec2 uFrost;
uniform float uVeil;
uniform vec2 uDark;
uniform float uSheen;
uniform float uBright;
uniform float uShadow;
uniform vec3 uAbsorb;        // how much of each colour it absorbs at full depth, from GLASS.tint and depth
uniform vec3 uVeilColor;
uniform float uGloss;
uniform float uCaustic;
uniform float uBubbles;
uniform vec3 uGround;        // the page's own background colour
uniform vec4 uDarkRect;      // a stretch of the page on a ground of its own (the other variations, on black): centre, half size; no size for none
uniform vec3 uDarkGround;    // and that ground's colour
vec3 ground;                 // the page's colour under this pixel: uGround, or uDarkGround on that stretch
uniform sampler2D uTitle0;   // the chapter titles on screen, up to two: their letters in the alpha channel
uniform sampler2D uTitle1;
uniform sampler2D uTitleShape0; // and the distance to their letters' outline, CSS px, negative inside them
uniform sampler2D uTitleShape1;
uniform vec4 uTitleRect[2];  // centre, half size; no size for one that isn't there
uniform vec3 uTitleColor[2];
uniform float uTitleScale[2]; // texels per CSS px
uniform int uLetters;        // the strands on its letters, laid out as the pictures' strands are
uniform vec4 uLetterA[MAX_LETTERS];
uniform vec4 uLetterB[MAX_LETTERS];
uniform vec4 uLetterRadius[MAX_LETTERS];
uniform vec2 uLetterBead[MAX_LETTERS];
uniform int uStrings;        // a sticky material's extra threads on the pictures, laid out the same way
uniform vec4 uStringA[MAX_STRINGS];
uniform vec4 uStringB[MAX_STRINGS];
uniform vec4 uStringRadius[MAX_STRINGS];
uniform vec2 uStringBead[MAX_STRINGS];
uniform vec4 uStringFoot[MAX_STRINGS]; // the foot and the blend, as uFoot's; and which picture it's on
uniform vec3 uLetterFoot[MAX_LETTERS];
// Where each half of a strand is thinnest and how thin: along the thing's half and the menu's
// (1 at its tip, the waist of a whole strand; less, inside a piece cut away from the waist; more,
// beyond the tip, on the other piece), then the radius there for each. A strand that has never been
// cut has its waist at its tips, which is all there is without cuts.
#ifdef CUTS
uniform vec4 uNeck[MAX];
uniform vec4 uStringNeck[MAX_STRINGS];
uniform vec4 uLetterNeck[MAX_LETTERS];
#define NECK(neck, radius) neck
#else
#define NECK(neck, radius) vec4(1.0, 1.0, radius.y, radius.w)
#endif

out vec4 outColor;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// a capsule lying on its side
float sdMenu(vec2 p, vec4 m) {
  vec2 q = p - m.xy;
  float span = max(m.z - m.w, 0.0);
  q.x -= clamp(q.x, -span, span);
  return length(q) - m.w;
}

// Half a strand: a segment whose radius eases from ra at its anchor to the neck's, levelling out
// there, so two halves meet in a smooth neck. neck: where along it that is (x, 1 at its tip) and its
// radius (y). A piece of a cut strand can hold the neck inside it (x below 1): from there its radius
// rises again, to rb at the tip, as the strand did; or have it beyond its tip (x above 1), on the
// other piece, so it only ever thins towards it. A snapped half ends in a drop: its last stretch
// swells by bead, round at the tip.
float sdStrand(vec2 p, vec2 a, vec2 b, float ra, float rb, vec2 neck, float bead) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float span = max(dot(ba, ba), 1e-4);
  float h = clamp(dot(pa, ba) / span, 0.0, 1.0);
  float swell = clamp(2.5 * bead * inversesqrt(span), 1e-3, 1.0);
  float toNeck = 1.0 - h / max(neck.x, 1e-4);
  float fromNeck = (h - neck.x) / max(1.0 - neck.x, 1e-4);
  float radius = h <= neck.x ? neck.y + (ra - neck.y) * toNeck * toNeck : neck.y + (rb - neck.y) * fromNeck * fromNeck;
  return length(pa - ba * h) - radius - bead * smoothstep(1.0 - swell, 1.0, h);
}

// smooth minimum (cubic): the blended distance, and how active the blend is there (0 to 1)
vec2 smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return vec2(min(a, b) - h * h * h * k / 6.0, h);
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k).x;
}

// Picture i's outline at p, negative inside. Its corners are round where the menu is near
// (menu: the menu's distance at p), and round the point its strand holds on to.
float sdPicture(vec2 p, int i, float menu) {
  vec4 r = uRect[i];
  float reach = max(uSoften.y, 0.01) * uUnit;
  float near = max(
    1.0 - smoothstep(0.0, reach, menu),
    uFoot[i].w * (1.0 - smoothstep(0.0, reach, length(p - uStrandA[i].xy)))
  );
  float soft = min(uSoften.x * uUnit * near, min(r.z, r.w));
  return sdBox(p - r.xy, r.zw - soft) - soft;
}

// one title's outline at p, negative inside its letters
float sdTitleOf(sampler2D shape, vec4 rect, vec2 p) {
  if (rect.z <= 0.0) return 1e5;
  vec2 uv = (p - rect.xy + rect.zw) / (2.0 * rect.zw);
  vec2 inside = clamp(uv, 0.0, 1.0);
  return textureLod(shape, inside, 0.0).r + length((uv - inside) * 2.0 * rect.zw);
}

// the outline of the titles on screen at p
float sdTitle(vec2 p) {
  return min(sdTitleOf(uTitleShape0, uTitleRect[0], p), sdTitleOf(uTitleShape1, uTitleRect[1], p));
}

// whether p is close enough to a strand for it to count: within reach of the line between its two ends
bool within(vec2 p, vec4 a, vec4 b, float reach) {
  vec2 pa = p - a.xy;
  vec2 ba = b.xy - a.xy;
  vec2 off = pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return dot(off, off) < reach * reach;
}

// One strand at p: the half on the thing it holds and the half rooted in the menu.
// outline: that thing's distance at p, negative inside it. menu: the menu's own distance at p.
// thickest: the strand's largest radius. neck: where each half is thinnest, and how thin (NECK).
float sdHeld(vec2 p, vec4 a, vec4 b, vec4 radius, vec2 bead, vec4 neck, vec2 foot, float outline, float menu, float thickest, float lift) {
  float held = sdStrand(p, a.xy, a.zw, radius.x, radius.y, neck.xz, bead.x);
  float rooted = sdStrand(p, b.xy, b.zw, radius.z, radius.w, neck.yw, bead.y);
  // The strand's foot. The closer to the thing's outline, the wider the strand: it opens into a bell
  // that ends flat against the thing, a little over its rim. It's measured from the outline,
  // not along the strand, so the foot follows the edge it sits on; and only on the strand's side
  // of the point it holds, so it doesn't climb the thing's other edges.
  float narrowing = 1.0 - clamp(max(outline, 0.0) / max(foot.y, 1e-4), 0.0, 1.0);
  vec2 along = b.xy - a.xy;
  float ahead = smoothstep(-0.15 * uUnit, 0.1 * uUnit, dot(p - a.xy, along / max(length(along), 1e-4)));
  held -= foot.x * narrowing * narrowing * ahead;
  // The strand ends on the thing's edge. Under the menu's own surface that edge isn't the liquid's,
  // so there the strand isn't cut by it: the liquid's depth stays smooth across it, with no fold.
  float ended = smax(held, -outline - 0.1 * uUnit, 0.15 * uUnit);
  held = mix(held, ended, smoothstep(-0.5 * uUnit, 0.0, menu));
  return min(held, rooted) + lift * 0.6 * uUnit * (1.0 - clamp(thickest / (0.1 * uUnit), 0.0, 1.0));
}

// A strand as far as it counts under the menu's own surface. The part of it that lies there is
// liquid in liquid: the less the strand blends with the menu (shown: 0 to 1), the less it adds
// to the menu's depth, so a strand on its way out, or a snapped one that has sunk back, leaves
// no mark inside the menu. Outside the menu the strand is untouched.
float surfaced(float strand, float menu, float shown) {
  float under = (1.0 - shown * shown) * (1.0 - smoothstep(-0.3 * uUnit, 0.0, menu));
  return mix(strand, max(strand, menu), under);
}

// The liquid at p, negative inside it: the menu and every strand. With lift, a strand counts
// for less the thinner it is, down to nothing: that's the liquid as its shadow sees it,
// so what's left of a strand that draws back in doesn't keep a full shadow to the end.
float liquidAt(vec2 p, float lift) {
  float menu = sdMenu(p, uMenu);
  float d = menu;
  float far = 0.9 * uUnit; // beyond a strand's blend with the menu and its shadow, it changes nothing

  for (int i = 0; i < MAX; i++) {
    if (i >= uCount) break;
    vec4 radius = uRadius[i];
    // a strand that lies deep inside the menu doesn't show and doesn't change the menu's outline
    if ((radius.x <= 0.0 && radius.z <= 0.0) || uFoot[i].z <= 0.0) continue;
    float thickest = max(max(radius.x, radius.y), max(radius.z, radius.w)) + max(uBead[i].x, uBead[i].y);
    // once it shows, the strand flares into the menu
    float blend = max(uFlare * uUnit * uFoot[i].z, 1e-3);
    if (!within(p, uStrandA[i], uStrandB[i], thickest + uFoot[i].x + max(blend, far))) continue;
    float strand = sdHeld(p, uStrandA[i], uStrandB[i], radius, uBead[i], NECK(uNeck[i], radius), uFoot[i].xy, sdPicture(p, i, menu), menu, thickest, lift);
    d = smin(d, surfaced(strand, menu, uFoot[i].z), blend).x;
  }

  for (int i = 0; i < MAX_STRINGS; i++) {
    if (i >= uStrings) break;
    vec4 radius = uStringRadius[i];
    if ((radius.x <= 0.0 && radius.z <= 0.0) || uStringFoot[i].z <= 0.0) continue;
    float thickest = max(max(radius.x, radius.y), max(radius.z, radius.w)) + max(uStringBead[i].x, uStringBead[i].y);
    float blend = max(uFlare * uUnit * uStringFoot[i].z, 1e-3);
    if (!within(p, uStringA[i], uStringB[i], thickest + uStringFoot[i].x + max(blend, far))) continue;
    float strand = sdHeld(p, uStringA[i], uStringB[i], radius, uStringBead[i], NECK(uStringNeck[i], radius), uStringFoot[i].xy, sdPicture(p, int(uStringFoot[i].w), menu), menu, thickest, lift);
    d = smin(d, surfaced(strand, menu, uStringFoot[i].z), blend).x;
  }

  float title = 0.0;
  bool read = false;
  for (int i = 0; i < MAX_LETTERS; i++) {
    if (i >= uLetters) break;
    vec4 radius = uLetterRadius[i];
    float thickest = max(max(radius.x, radius.y), max(radius.z, radius.w)) + max(uLetterBead[i].x, uLetterBead[i].y);
    float blend = max(uFlare * uUnit * uLetterFoot[i].z, 1e-3);
    if (!within(p, uLetterA[i], uLetterB[i], thickest + uLetterFoot[i].x + max(blend, far))) continue;
    if (!read) {
      title = sdTitle(p);
      read = true;
    }
    float strand = sdHeld(p, uLetterA[i], uLetterB[i], radius, uLetterBead[i], NECK(uLetterNeck[i], radius), uLetterFoot[i].xy, title, menu, thickest, lift);
    d = smin(d, surfaced(strand, menu, uLetterFoot[i].z), blend).x;
  }
  return d;
}

float liquidAt(vec2 p) {
  return liquidAt(p, 0.0);
}

// the picture nearest to p and the distance to it
void pictureAt(vec2 p, out float dPicture, out int pick) {
  float menu = sdMenu(p, uMenu);
  dPicture = 1e5;
  pick = -1;
  for (int i = 0; i < MAX; i++) {
    if (i >= uCount) break;
    float d = sdPicture(p, i, menu);
    if (d < dPicture) {
      dPicture = d;
      pick = i;
    }
  }
}

// the liquid's surface, 0 to 1: flat at the rim, so thin films lie flat, then rising and levelling out
float surface(float liquid) {
  float t = pow(clamp(-liquid / (max(uRim, 0.01) * uUnit), 0.0, 1.0), 0.7);
  return t * t * (3.0 - 2.0 * t);
}

// how much of one title covers s; px: the CSS px one look stands for, which picks the mip level
float coverOf(sampler2D tex, vec4 rect, float scale, vec2 s, float px) {
  if (rect.z <= 0.0) return 0.0;
  vec2 uv = (s - rect.xy + rect.zw) / (2.0 * rect.zw);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
  return textureLod(tex, uv, max(log2(scale * px), 0.0)).a;
}

// the titles on screen at s, in their colours, premultiplied
vec4 titlesAt(vec2 s, float px) {
  vec4 c = vec4(uTitleColor[0], 1.0) * coverOf(uTitle0, uTitleRect[0], uTitleScale[0], s, px);
  float a = coverOf(uTitle1, uTitleRect[1], uTitleScale[1], s, px);
  return vec4(uTitleColor[1], 1.0) * a + c * (1.0 - a);
}

// picture i's colour at s; past its edge, the edge pixels run on
vec3 colorAt(vec2 s, int i, float lod) {
  vec4 r = uRect[i];
  vec4 pull = uPull[i];
  vec2 lo = r.xy - r.zw;
  vec2 size = 2.0 * r.zw;
  vec2 toAnchor = s - pull.xy;
  vec2 shift = pull.zw * exp(-dot(toAnchor, toAnchor) / (2.0 * uPullRadius * uPullRadius));
  // what's dragged eases off towards the picture's far side, which stays where it is, so a small
  // picture never shows from beyond its edge: the room behind s, against the drag, is never used up
  vec2 room = max(mix(lo + size - s, s - lo, step(0.0, shift)), 0.0);
  vec2 reach = max(abs(shift), 1e-4);
  s -= shift * (1.0 - exp(-room / reach));
  vec2 uv = uFit[i].xy + (clamp(s, lo, lo + size) - lo) / size * uFit[i].zw;
  return textureLod(uPictures, vec3(uv, uLayer[i]), lod).rgb;
}

// What lies under the liquid around q, out of focus by blur px: the title, and picture i over it.
// Premultiplied: where it's transparent, the page's own background shows.
vec4 frosted(vec2 q, int i, float blur, float turn) {
  float spacing = max(blur * 0.6, 1.0); // CSS px between samples
  float lodPicture = 0.0;
  vec4 r = vec4(0.0);
  if (i >= 0) {
    r = uRect[i];
    lodPicture = max(log2(uLayerSize.x * uFit[i].z / (2.0 * r.z) * spacing), 0.0);
  }
  // a clear liquid needs one look, not a spread of them
  int taps = blur < 0.5 ? 1 : TAPS;
  vec4 sum = vec4(0.0);
  for (int j = 0; j < TAPS; j++) {
    if (j >= taps) break;
    float angle = float(j) * 2.39996 + turn;
    vec2 s = q + vec2(cos(angle), sin(angle)) * blur * sqrt((float(j) + 0.5) / float(taps));
    vec4 c = titlesAt(s, spacing);
    if (i >= 0) {
      // the picture's edge is as soft as the rest, so it fades into the page instead of ending
      float cover = clamp(0.5 - sdBox(s - r.xy, r.zw) / spacing, 0.0, 1.0);
      c = vec4(colorAt(s, i, lodPicture), 1.0) * cover + c * (1.0 - cover);
    }
    sum += c;
  }
  return sum / float(taps);
}

// Premultiplied colour c, over the page, seen through a filter that lets through keep of each colour.
// The canvas can only lay colour over the page, not tint it, so the page's own colour there (ground)
// stands in for what the filter does to the page beyond its darkest colour, which is laid exactly.
vec4 filtered(vec4 c, vec3 keep) {
  float least = min(min(keep.r, min(keep.g, keep.b)), 1.0);
  return vec4(c.rgb * keep + ground * (1.0 - c.a) * (keep - least), 1.0 - (1.0 - c.a) * least);
}

// a value from 0 to 1, the same for every point of a cell
float hash(vec2 c) {
  return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uViewport.y * uDpr - gl_FragCoord.y) / uDpr;
  float u = uUnit;
  vec2 outsideDark = abs(p - uDarkRect.xy) - uDarkRect.zw;
  ground = uDarkRect.z > 0.0 && max(outsideDark.x, outsideDark.y) < 0.0 ? uDarkGround : uGround;

  float liquid = liquidAt(p);
  float dPicture;
  int pick;
  pictureAt(p, dPicture, pick);
  float aLiquid = clamp(0.5 - liquid * uDpr, 0.0, 1.0);
  float aPicture = clamp(0.5 - dPicture * uDpr, 0.0, 1.0);
  float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));

  // the page's own layers: the chapter titles, and the nearest picture over them
  vec4 color = titlesAt(p, 1.0 / uDpr);
  if (pick >= 0 && aPicture > 0.0) {
    float lod = max(log2(uLayerSize.x * uFit[pick].z / (2.0 * uRect[pick].z * uDpr)), 0.0);
    color = vec4(colorAt(p, pick, lod), 1.0) * aPicture + color * (1.0 - aPicture);
  }

  // The soft shadow of the menu and the strands, on the page and on the pictures, a little down and to
  // the right; further than this from the liquid, there's none. The light that came through the liquid
  // lands in it, in the liquid's colour, most where the shadow is deepest, gathered as by a lens.
  if (aLiquid < 1.0 && liquid < 1.2 * u) {
    float shade = (1.0 - smoothstep(-0.5 * u, 0.6 * u, liquidAt(p - vec2(0.06, 0.24) * u, 1.0))) * uShadow;
    float core = shade / max(uShadow, 1e-3);
    color = filtered(color, 1.0 - shade + shade * core * uCaustic * exp(-uAbsorb * 0.6));
  }

  if (aLiquid > 0.0) {
    // The liquid around p, a few pixels apart: which way its edge faces, and how its surface slopes.
    // Measured this wide, the slope stays smooth over the middle of thin parts.
    float e = 0.12 * u;
    vec4 around = vec4(
      liquidAt(p + vec2(e, 0.0)), liquidAt(p - vec2(e, 0.0)),
      liquidAt(p + vec2(0.0, e)), liquidAt(p - vec2(0.0, e))
    );
    vec2 outward = vec2(around.x - around.y, around.z - around.w);
    outward /= max(length(outward), 1e-4);
    vec2 slope = vec2(
      surface(around.x) - surface(around.y),
      surface(around.z) - surface(around.w)
    ) / (2.0 * e) * 0.75 * uRim * u;
    float height = surface(liquid);
    float depth = -liquid;

    // What's underneath: shifted towards the middle at the rim, like under a lens, and frosted.
    // A lens bends by its thickness: where there's little liquid behind the rim (a strand, its foot
    // on a picture's edge) what's under it stays almost where it is.
    float behind = -liquidAt(p - outward * 0.5 * u);
    float lens = mix(0.15, 1.0, smoothstep(0.0, 0.35 * u, behind));
    vec4 seen = frosted(p + slope * uBend * u * lens, pick, mix(uFrost.x, uFrost.y, height) * u, grain * 6.2832);

    // each colour of the light is absorbed by its own amount, the more the deeper the liquid
    vec4 glass = filtered(seen, exp(-uAbsorb * height));

    // light scattered inside it: a milky veil in its own colour, thicker in the middle
    float veil = uVeil * height;
    glass = glass * (1.0 - veil) + vec4(uVeilColor, 1.0) * veil;

    // Small air bubbles held in it, fixed to the menu so they move with it, only where it's deep enough
    // to hold one, most of them tiny: a faint shade on the side away from the light, a little lighter
    // inside, and a bright point where the light catches it
    if (uBubbles > 0.0) {
      float cell = 0.5 * u;
      vec2 q = (p - uMenu.xy) / cell;
      vec2 id = floor(q);
      if (hash(id) < uBubbles * 0.3) {
        vec2 centre = id + 0.3 + 0.4 * vec2(hash(id + 7.1), hash(id + 3.7));
        float r = mix(0.04, 0.16, pow(hash(id + 1.3), 2.0));
        vec2 off = q - centre;
        float b = (length(off) - r) * cell;
        float held = smoothstep(0.25 * u, 0.45 * u, depth);
        float inside = clamp(0.5 - b * uDpr, 0.0, 1.0) * held;
        float rim = smoothstep(0.4 * r, r, length(off)) * inside;
        float away = 0.5 + 0.5 * dot(normalize(off + 1e-4), vec2(0.5, 0.866));
        float glint = (1.0 - smoothstep(0.1 * r, 0.28 * r, length(off + 0.35 * r))) * inside;
        float shade = rim * away * 0.16;
        glass.rgb *= 1.0 - shade;
        glass.a += shade * (1.0 - glass.a);
        glass.rgb += 0.04 * inside + 0.55 * glint;
      }
    }

    // light from the upper left: the rim that faces away is a little darker, the rim that faces it
    // catches a thin bright edge, and the slope below it a soft sheen
    float facing = dot(outward, vec2(-0.5, -0.866));
    float dark = max(-facing, 0.0) * (1.0 - smoothstep(0.0, 0.4 * u, depth)) * uDark.x
      + (1.0 - smoothstep(0.0, 0.08 * u, depth)) * uDark.y;
    glass.rgb *= 1.0 - dark;
    glass.a += dark * (1.0 - glass.a);
    vec3 normal = normalize(vec3(-slope, 1.0));
    float sheen = pow(max(dot(normal, normalize(vec3(-0.4, -0.75, 1.2))), 0.0), uGloss) * uSheen;
    float bright = max(facing, 0.0) * (1.0 - smoothstep(0.0, 0.1 * u, depth)) * uBright;
    glass.rgb += vec3(1.0, 0.99, 0.97) * (sheen + bright);

    color = glass * aLiquid + color * (1.0 - aLiquid);
  }

  // a little noise, so soft gradients don't band
  color.rgb += (grain - 0.5) / 255.0 * color.a;
  outColor = color;
}`;


export class Goo {
  static supported() {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  }

  // images: decoded <img> elements, one texture layer each, in order
  constructor(canvas, images) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    this.program = this.createProgram(vertex, fragment);
    gl.useProgram(this.program);
    this.uniforms = {};
    const count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(this.program, i).name.replace('[0]', '');
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }

    // one triangle that covers the screen
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const position = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    // texture unit 0 holds the pictures, units 1 and 2 the first title on screen and its shape, 3 and 4 the second
    this.createPictures(images);
    this.noTitle = { texture: this.createTexture(new Uint8Array(4), 1, 1), shape: this.createShape(new Float32Array([1e5]), 1, 1) };
    gl.uniform1i(this.uniforms.uPictures, 0);
    gl.uniform1i(this.uniforms.uTitle0, 1);
    gl.uniform1i(this.uniforms.uTitleShape0, 2);
    gl.uniform1i(this.uniforms.uTitle1, 3);
    gl.uniform1i(this.uniforms.uTitleShape1, 4);
    gl.uniform2f(this.uniforms.uLayerSize, this.layer.width, this.layer.height);
    // the page's own background, for what the liquid's colour does to it (filtered() in the shader)
    const ground = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    gl.uniform3fv(this.uniforms.uGround, ground.slice(0, 3).map((v) => v / 255));

    this.data = {
      rect: new Float32Array(MAX * 4),
      layer: new Float32Array(MAX),
      strandA: new Float32Array(MAX * 4),
      strandB: new Float32Array(MAX * 4),
      radius: new Float32Array(MAX * 4),
      bead: new Float32Array(MAX * 2),
      foot: new Float32Array(MAX * 4),
      pull: new Float32Array(MAX * 4),
      fit: new Float32Array(MAX * 4),
      letterA: new Float32Array(MAX_LETTERS * 4),
      letterB: new Float32Array(MAX_LETTERS * 4),
      letterRadius: new Float32Array(MAX_LETTERS * 4),
      letterBead: new Float32Array(MAX_LETTERS * 2),
      stringA: new Float32Array(MAX_STRINGS * 4),
      stringB: new Float32Array(MAX_STRINGS * 4),
      stringRadius: new Float32Array(MAX_STRINGS * 4),
      stringBead: new Float32Array(MAX_STRINGS * 2),
      stringFoot: new Float32Array(MAX_STRINGS * 4),
      letterFoot: new Float32Array(MAX_LETTERS * 3),
      neck: new Float32Array(MAX * 4),
      stringNeck: new Float32Array(MAX_STRINGS * 4),
      letterNeck: new Float32Array(MAX_LETTERS * 4),
      titleRect: new Float32Array(MAX_TITLES * 4),
      titleColor: new Float32Array(MAX_TITLES * 3),
      titleScale: new Float32Array(MAX_TITLES),
    };
    // what this frame would draw, in numbers, and what the last frame drawn did (unchanged())
    const size = Object.values(this.data).reduce((sum, list) => sum + list.length, 0) + 256;
    this.state = new Float64Array(size);
    this.drawn = new Float64Array(size);
    this.stateLength = 0;
    this.textures = [];
    this.resize();
  }

  createProgram(vs, fs) {
    const gl = this.gl;
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  // All the pictures in one texture array, so the shader can pick any of them by index. Each image fills
  // a whole layer, stretched if its shape differs; uFit maps a picture's box onto the part of it that shows.
  createPictures(images) {
    const gl = this.gl;
    const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const width = Math.min(Math.max(...images.map((img) => img.naturalWidth)), limit);
    const height = Math.min(Math.max(...images.map((img) => img.naturalHeight)), limit);
    this.layer = { width, height };
    this.aspects = images.map((img) => img.naturalWidth / img.naturalHeight);
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, width, height, images.length);

    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const ctx = scratch.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    images.forEach((img, i) => {
      ctx.drawImage(img, 0, 0, width, height);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, width, height, 1, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
    });
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // a mipmapped texture on unit 1, from a canvas or from raw pixels
  createTexture(source, width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (source instanceof Uint8Array) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  // a distance field on unit 2: one float per texel
  createShape(distances, width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.FLOAT, distances);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  // A chapter title drawn into a texture, so the liquid can bend and frost it like a picture.
  // text and font (a CSS font) as the page sets them; width, height: the texture's box in CSS px;
  // x, baseline: where the text starts in that box; spacing: its letter-spacing, CSS px;
  // shape: its letters' outline, from letterShapes()
  createTitle({ text, font, width, height, x, baseline, spacing, shape }) {
    const limit = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
    const scale = Math.min(this.dpr, limit / width, limit / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.font = font;
    ctx.fillStyle = '#fff';
    fillSpaced(ctx, text, x, baseline, spacing);
    return { texture: this.createTexture(canvas), shape: this.createShape(shape.sdf, shape.width, shape.height), scale };
  }

  deleteTitle(title) {
    this.gl.deleteTexture(title.texture);
    this.gl.deleteTexture(title.shape);
  }

  // the screen's resolution, twice the CSS size at most, within MAX_PIXELS
  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    const budget = Math.sqrt(MAX_PIXELS / Math.max(this.width * this.height, 1));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = Math.min(dpr, Math.max(budget, 1));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.dirty = true; // a canvas that's been sized is empty
  }

  // Whether this frame would look just like the last one drawn: the same numbers, near enough not to
  // show (a thousandth of a pixel), for everything the shader reads, and the same titles' textures.
  // A canvas that isn't drawn keeps showing its last frame, so a page at rest costs the GPU nothing,
  // and a wobble dying away stops being drawn once what's left of it can't be seen. It's measured
  // against the last frame drawn, so changes too small to draw one at a time still add up to one.
  // dirty: a draw is needed whatever the numbers.
  unchanged(lists, textures) {
    let n = 0;
    for (const list of lists) for (let i = 0; i < list.length; i++) this.state[n++] = list[i];
    let same = !this.dirty && n === this.stateLength && textures.every((t, k) => t === this.textures[k]);
    for (let i = 0; same && i < n; i++) same = Math.abs(this.state[i] - this.drawn[i]) < 1e-3;
    if (same) return true;
    [this.state, this.drawn] = [this.drawn, this.state];
    this.stateLength = n;
    this.textures = textures;
    this.dirty = false;
    return false;
  }

  // The part of its image a picture shows, like object-fit: cover, writing offset and size into out at
  // offset. A box may say which part to keep when the image is cropped (focusX, 0 the left to 1 the
  // right), zoom into its image (zoom, at least 1) and move what shows up and down (focusY, 0 the top
  // to 1 the bottom): a parallax inside the picture.
  fit(box, aspect, out, offset) {
    const shape = box.hx / box.hy;
    const zoom = box.zoom || 1;
    const w = (shape > aspect ? 1 : shape / aspect) / zoom;
    const h = (shape > aspect ? aspect / shape : 1) / zoom;
    out[offset] = (1 - w) * (box.focusX ?? 0.5);
    out[offset + 1] = (1 - h) * (box.focusY ?? 0.5);
    out[offset + 2] = w;
    out[offset + 3] = h;
  }

  // boxes: every picture on screen; visible: the indices to draw; strands: the pictures' Strands after
  // its update; strings: the pictures' extra threads to draw, each an item of their Strands and the
  // place in visible of the picture it's on; letters: the letters' strands to draw (items of their
  // Strands); titles: the chapter titles on screen, up to MAX_TITLES (their boxes on screen, textures,
  // scale and colour); motion: the MenuMotion; dark: a stretch of the page on a ground of its own, its
  // box on screen and colour (0 to 1), or none
  render({ boxes, visible, strands, strings = [], letters, titles, motion, dark = NO_DARK }) {
    const { gl, data, uniforms: u } = this;
    const count = Math.min(visible.length, MAX);
    for (let j = 0; j < count; j++) {
      const i = visible[j];
      const b = boxes[i];
      const s = strands.items[i];
      data.rect.set([b.x, b.y, b.hx, b.hy], j * 4);
      data.layer[j] = i;
      this.fit(b, this.aspects[i], data.fit, j * 4);
      data.strandA.set([s.ax, s.ay, s.ax + s.t1.x, s.ay + s.t1.y], j * 4);
      data.strandB.set([s.bx, s.by, s.bx + s.t2.x, s.by + s.t2.y], j * 4);
      data.radius.set(s.radius, j * 4);
      data.bead.set(s.bead, j * 2);
      data.foot.set(s.foot, j * 4);
      data.neck.set(s.neck, j * 4);
      const pull = s.pull.x * motion.pullMax;
      data.pull.set([s.ax, s.ay, s.dx * pull, s.dy * pull], j * 4);
    }
    const stringCount = Math.min(strings.length, MAX_STRINGS);
    for (let j = 0; j < stringCount; j++) {
      const { item: s, on } = strings[j];
      data.stringA.set([s.ax, s.ay, s.ax + s.t1.x, s.ay + s.t1.y], j * 4);
      data.stringB.set([s.bx, s.by, s.bx + s.t2.x, s.by + s.t2.y], j * 4);
      data.stringRadius.set(s.radius, j * 4);
      data.stringBead.set(s.bead, j * 2);
      data.stringFoot.set([s.foot[0], s.foot[1], s.foot[2], on], j * 4);
      data.stringNeck.set(s.neck, j * 4);
    }
    const letterCount = Math.min(letters.length, MAX_LETTERS);
    for (let j = 0; j < letterCount; j++) {
      const s = letters[j];
      data.letterA.set([s.ax, s.ay, s.ax + s.t1.x, s.ay + s.t1.y], j * 4);
      data.letterB.set([s.bx, s.by, s.bx + s.t2.x, s.by + s.t2.y], j * 4);
      data.letterRadius.set(s.radius, j * 4);
      data.letterBead.set(s.bead, j * 2);
      data.letterFoot.set([s.foot[0], s.foot[1], s.foot[2]], j * 3);
      data.letterNeck.set(s.neck, j * 4);
    }
    data.titleRect.fill(0);
    data.titleColor.fill(0);
    data.titleScale.fill(0);
    titles.slice(0, MAX_TITLES).forEach((title, k) => {
      data.titleRect.set([title.x, title.y, title.hx, title.hy], k * 4);
      data.titleColor.set(title.color, k * 3);
      data.titleScale[k] = title.scale;
    });

    const m = motion.menu;
    const settings = [count, stringCount, letterCount, motion.unit, motion.pullRadius, m.x, m.y, m.hx, m.hy, this.width, this.height, this.dpr, dark.x, dark.y, dark.hx, dark.hy, ...dark.color];
    const glass = Object.values(GLASS).flat();
    const textures = [0, 1].map((k) => titles[k]?.texture ?? null);
    if (this.unchanged([settings, glass, ...Object.values(data)], textures)) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uViewport, this.width, this.height);
    gl.uniform1f(u.uDpr, this.dpr);
    gl.uniform1f(u.uUnit, motion.unit);
    gl.uniform1i(u.uCount, count);
    gl.uniform4fv(u.uRect, data.rect);
    gl.uniform1fv(u.uLayer, data.layer);
    gl.uniform4fv(u.uFit, data.fit);
    gl.uniform4fv(u.uStrandA, data.strandA);
    gl.uniform4fv(u.uStrandB, data.strandB);
    gl.uniform4fv(u.uRadius, data.radius);
    gl.uniform2fv(u.uBead, data.bead);
    gl.uniform4fv(u.uFoot, data.foot);
    gl.uniform4fv(u.uPull, data.pull);
    gl.uniform1f(u.uPullRadius, motion.pullRadius);
    gl.uniform1i(u.uStrings, stringCount);
    gl.uniform4fv(u.uStringA, data.stringA);
    gl.uniform4fv(u.uStringB, data.stringB);
    gl.uniform4fv(u.uStringRadius, data.stringRadius);
    gl.uniform2fv(u.uStringBead, data.stringBead);
    gl.uniform4fv(u.uStringFoot, data.stringFoot);
    gl.uniform1i(u.uLetters, letterCount);
    gl.uniform4fv(u.uLetterA, data.letterA);
    gl.uniform4fv(u.uLetterB, data.letterB);
    gl.uniform4fv(u.uLetterRadius, data.letterRadius);
    gl.uniform2fv(u.uLetterBead, data.letterBead);
    gl.uniform3fv(u.uLetterFoot, data.letterFoot);
    if (CUTS) {
      gl.uniform4fv(u.uNeck, data.neck);
      gl.uniform4fv(u.uStringNeck, data.stringNeck);
      gl.uniform4fv(u.uLetterNeck, data.letterNeck);
    }
    gl.uniform4f(u.uMenu, m.x, m.y, m.hx, m.hy);
    gl.uniform4f(u.uDarkRect, dark.x, dark.y, dark.hx, dark.hy);
    gl.uniform3fv(u.uDarkGround, dark.color);
    gl.uniform1f(u.uFlare, GLASS.flare);
    gl.uniform2fv(u.uSoften, GLASS.soften);
    gl.uniform1f(u.uRim, GLASS.rim);
    gl.uniform1f(u.uBend, GLASS.bend);
    gl.uniform2fv(u.uFrost, GLASS.frost);
    gl.uniform1f(u.uVeil, GLASS.veil);
    gl.uniform2fv(u.uDark, GLASS.dark);
    gl.uniform1f(u.uSheen, GLASS.sheen);
    gl.uniform1f(u.uBright, GLASS.bright);
    gl.uniform1f(u.uShadow, GLASS.shadow);
    gl.uniform3fv(u.uAbsorb, GLASS.tint.map((c) => GLASS.depth * -Math.log(Math.max(c, 1e-3))));
    gl.uniform3fv(u.uVeilColor, GLASS.veilColor);
    gl.uniform1f(u.uGloss, GLASS.gloss);
    gl.uniform1f(u.uCaustic, GLASS.caustic);
    gl.uniform1f(u.uBubbles, GLASS.bubbles);

    for (let k = 0; k < MAX_TITLES; k++) {
      const title = titles[k] || this.noTitle;
      gl.activeTexture(gl.TEXTURE1 + k * 2);
      gl.bindTexture(gl.TEXTURE_2D, title.texture);
      gl.activeTexture(gl.TEXTURE2 + k * 2);
      gl.bindTexture(gl.TEXTURE_2D, title.shape);
    }
    gl.uniform4fv(u.uTitleRect, data.titleRect);
    gl.uniform3fv(u.uTitleColor, data.titleColor);
    gl.uniform1fv(u.uTitleScale, data.titleScale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
