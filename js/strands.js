// The strands between the menu and what the liquid holds: the pictures and
// the chapter titles' letters. The liquid sticks to a thing only once the two
// have touched. From then on a strand holds on to the thing's nearest point,
// rooted inside the menu where it doesn't show, so the thing's edge pulls the
// liquid out with it as it leaves the menu. As it moves away, the strand
// stretches between them: one neck, thinnest at its waist, that flares into
// the menu at one end and widens into a foot against the thing's edge at the
// other. It thins as it gets longer, and necks down where it's about to
// break; then it snaps, and each half draws back into its own shape with a
// drop at its tip. The menu's half leaves a mound on the menu that levels out.
// While a strand holds, the menu leans towards the thing and a picture's
// pixels are drawn into the strand; when it snaps, the menu wobbles and the
// pixels settle back. Every change is gradual: nothing is added to the liquid
// or taken from it in one frame.

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Distances are in units of the menu's half height, so the strands keep their
// proportions when the menu is smaller (phones)
export const SETTINGS = {
  touch: 0.03, // the gap under which a thing and the menu count as touching
  length: 4.2, // how long a strand gets before it snaps, when scrolling slowly
  waist: [0.26, 0.07], // the strand's radius in the middle: just formed, about to snap
  flare: 0.06, // how much thicker than its waist a strand is at its ends
  foot: [0.45, 0.24], // how much wider than the strand its foot is at the thing's edge: just formed, about to snap
  bell: 0.8, // how far from the thing's edge the foot narrows into the strand
  corner: 0.5, // how much of its width the foot keeps on a picture's corner, where there's less edge to hold on to
  root: 0.45, // how deep inside the menu a strand's other end sits, at least; always deeper than the strand is thick, so it never shows
  grip: 0.3, // seconds the liquid takes to grip a thing that has just touched it
  pull: 0, // how far a picture's pixels are drawn towards the strand at full stretch (none on any page; the panel can try it)
  lean: 0.15, // how far the menu leans towards the strands it holds
  wobble: 1.2, // the kick the menu's squash gets when a picture's strand snaps
  letters: 0.35, // how hard a letter's strand tugs at the menu, next to a picture's
  breakAt: 0.5, // where along a strand it's thinnest and breaks, from its higher end: 0.5 is the middle
  neck: 0.045, // a strand's radius where it breaks, at most: a thicker one necks down to this over the last of its stretch, so it parts in a point and not in a cut
  bead: 0.1, // the drop that gathers at a snapped half's tip as the half draws back: its radius at most
  strings: 0, // how many more threads a picture pulls beside its strand, thinner ones that break sooner: a sticky material's
  level: 0.25, // seconds the mound a snapped strand leaves on the menu takes to level out
  // springs: stiffness and damping, per second
  tip: [420, 22], // a snapped half drawing back
  settle: [300, 10], // a picture's pixels after a snap, a few small wobbles
  squash: [500, 8], // the menu's wobble
  sway: [300, 14], // the menu leaning and swinging back
};

const step = (s, target, [k, c], dt) => {
  s.v += (-k * (s.x - target) - c * s.v) * dt;
  s.x += s.v * dt;
};

// seconds the page's speed is evened out over, so a strand's reach doesn't jump when the scroll does
const EVEN = 0.12;
// seconds a snap's kick takes to reach the menu, so its wobble starts with a swell and not a jolt
const KICK = 0.05;

// A whole strand's radius at `at` along it, from its anchor on the thing: each half eases from its end
// to the waist, the way sdStrand() in js/goo.js draws it
const radiusAlong = (s, at) => {
  const w = s.waistAt;
  const thing = at <= w;
  const h = thing ? at / Math.max(w, 1e-3) : (1 - at) / Math.max(1 - w, 1e-3);
  return thing ? lerp(s.radius[0], s.radius[1], h * (2 - h)) : lerp(s.radius[2], s.radius[3], h * (2 - h));
};

// Where the segment from (x0, y0) to (x1, y1) crosses the one from (ax, ay) to (bx, by), as a fraction of
// the way along the second; -1 where they don't cross
const crossing = (x0, y0, x1, y1, ax, ay, bx, by) => {
  const rx = x1 - x0;
  const ry = y1 - y0;
  const sx = bx - ax;
  const sy = by - ay;
  const d = rx * sy - ry * sx;
  if (Math.abs(d) < 1e-9) return -1;
  const qx = ax - x0;
  const qy = ay - y0;
  const t = (qx * sy - qy * sx) / d;
  const u = (qx * ry - qy * rx) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1;
};

// The closest points between a picture and the menu (a capsule), found by
// projecting back and forth between the two shapes, which settles in a few
// steps because both are convex. The picture is a box whose corners are
// rounded by soft, the way it's drawn next to the liquid, so the strand ends
// on the corner that's there and not on the square one.
export function closestToBox(box, menu, soft, out) {
  const r = menu.hy;
  const span = Math.max(menu.hx - r, 0);
  soft = Math.min(soft, box.hx, box.hy);
  // the box without its rounded border: the picture is everything within soft of it
  const ix = box.hx - soft;
  const iy = box.hy - soft;
  let sx = clamp(box.x, menu.x - span, menu.x + span);
  let ax = 0;
  let ay = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < 3; i++) {
    cx = clamp(sx, box.x - ix, box.x + ix);
    cy = clamp(menu.y, box.y - iy, box.y + iy);
    const beyond = Math.hypot(sx - cx, menu.y - cy);
    // inside the picture, the nearest point is where we are
    const k = beyond > soft ? soft / beyond : 1;
    ax = cx + (sx - cx) * k;
    ay = cy + (menu.y - cy) * k;
    sx = clamp(ax, menu.x - span, menu.x + span);
  }
  let dx = sx - ax;
  let dy = menu.y - ay;
  const d = Math.hypot(dx, dy);
  if (d > 1e-3) {
    dx /= d;
    dy /= d;
  } else {
    dx = 0;
    dy = 1;
  }
  out.ax = ax;
  out.ay = ay;
  out.bx = sx - dx * r; // the menu's nearest point
  out.by = menu.y - dy * r;
  out.dx = dx; // from the picture towards the menu
  out.dy = dy;
  out.gap = Math.max(d - r, 0);
  out.apart = d - r; // the same, and negative while they overlap: how deep the picture's point is in the menu
  // how far the picture's point is from its nearest rounded corner, along the edge
  out.fromCorner = Math.max(ix - Math.abs(cx - box.x), iy - Math.abs(cy - box.y));
}

// A further point on a picture, for one of a sticky material's extra threads: the picture's nearest
// point to the menu, moved along the picture's outline by `along` px (round a corner if it comes to
// one), and the menu's nearest point to that. Fills out as closestToBox does.
export function closestAlongBox(box, menu, soft, along, out) {
  closestToBox(box, menu, soft, out);
  const left = box.x - box.hx;
  const right = box.x + box.hx;
  const top = box.y - box.hy;
  const bottom = box.y + box.hy;
  const w = 2 * box.hx;
  const h = 2 * box.hy;
  // the nearest point as a distance along the outline, clockwise from the top left corner
  let x = clamp(out.ax, left, right);
  let y = clamp(out.ay, top, bottom);
  const nearest = Math.min(x - left, right - x, y - top, bottom - y);
  let s;
  if (nearest === bottom - y) s = w + h + (right - x);
  else if (nearest === y - top) s = x - left;
  else if (nearest === right - x) s = w + (y - top);
  else s = 2 * w + h + (bottom - y);
  const round = 2 * (w + h);
  s = (((s + along) % round) + round) % round;
  if (s < w) [x, y] = [left + s, top];
  else if (s < w + h) [x, y] = [right, top + s - w];
  else if (s < 2 * w + h) [x, y] = [right - (s - w - h), bottom];
  else [x, y] = [left, bottom - (s - 2 * w - h)];

  const r = menu.hy;
  const span = Math.max(menu.hx - r, 0);
  const sx = clamp(x, menu.x - span, menu.x + span);
  let dx = sx - x;
  let dy = menu.y - y;
  const d = Math.hypot(dx, dy);
  if (d > 1e-3) {
    dx /= d;
    dy /= d;
  } else {
    dx = 0;
    dy = 1;
  }
  out.ax = x;
  out.ay = y;
  out.bx = sx - dx * r;
  out.by = menu.y - dy * r;
  out.dx = dx;
  out.dy = dy;
  out.gap = Math.max(d - r, 0);
  out.apart = d - r;
  out.fromCorner = Math.max(box.hx - Math.abs(x - box.x), box.hy - Math.abs(y - box.y));
}

// The strands of one kind of thing: one each
export class Strands {
  // weight: how hard one of these strands tugs at the menu
  constructor(count, weight = 1) {
    this.items = Array.from({ length: count }, () => ({
      joined: false,
      springing: false,
      grip: 0,
      scale: 1, // how thick this strand is next to the settings: thin things pull thin strands
      share: 1, // how much of that it has for now, 0 to 1: an extra thread comes and goes with the material
      ax: 0, ay: 0, // the strand's anchor on the thing
      bx: 0, by: 0, // and its end inside the menu
      dx: 0, dy: 1,
      t1: { x: 0, y: 0, vx: 0, vy: 0 }, // the thing's half's tip, relative to its anchor
      t2: { x: 0, y: 0, vx: 0, vy: 0 }, // the menu half's tip
      halfA: 1, // how long each half was when it snapped
      halfB: 1,
      radius: [0, 0, 0, 0], // thing's anchor, thing's tip, menu anchor, menu tip
      // where each half is thinnest, along it (1: at its tip), and its radius there: the thing's half,
      // the menu's half, then the two radii. Only a cut strand's pieces have it anywhere but at the tip.
      neck: [1, 1, 0, 0],
      waistAt: 0.5, // where along the strand its halves meet, from its anchor on the thing
      stretch: 0, // how far through its stretch the strand is, 0 to 1 (it snaps by itself at 1)
      bead: [0, 0], // the drop at each half's tip once it has snapped: the thing's, the menu's
      // what the strand was when it broke: its radius at the ends and at its waist, its foot, its blend
      // with the menu, and its radius where it broke (its waist, unless it was cut)
      snap: [0, 0, 0, 0, 0],
      mound: 0, // how much the menu's half still draws the menu's surface up, once snapped
      settled: false, // snapped, and drawn back far enough for the liquid to take hold again
      // how much wider the foot is, how far from the thing's edge it narrows, how much the strand
      // blends with the menu, and how much it rounds a picture's corner
      foot: [0, 0, 0, 0],
      pull: { x: 0, v: 0 },
    }));
    this.weight = weight;
    this.speed = 0; // the page's speed, evened out
    // what these strands do to the menu this frame: which way they draw it, and the kick of those that snapped
    this.leanX = 0;
    this.leanY = 0;
    this.kick = 0;
    this.c = {};
  }

  // menu: the menu at rest (centre and half size, CSS px); speed: how fast the page scrolls, px/s.
  // find(i, round, out, held): fills out with the closest points between thing i and the menu, as
  // closestToBox does. round: how round the corner it holds is drawn, 0 to 1. It may return false for
  // a thing too far from the menu to matter, but never for one the liquid holds (held).
  update(dt, menu, speed, find) {
    const u = menu.hy;
    this.speed += (speed - this.speed) * (1 - Math.exp(-dt / EVEN));
    const length = SETTINGS.length * u * clamp(1.2 - this.speed / 5000, 0.6, 1.2);
    const c = this.c;
    const root = Math.max(SETTINGS.root, SETTINGS.waist[0] + SETTINGS.flare + 0.1) * u;
    this.leanX = 0;
    this.leanY = 0;
    this.kick = 0;

    this.items.forEach((s, i) => {
      // The corner the liquid holds is round only as long as liquid is on it: fully while the strand
      // holds, and less and less as a snapped half draws back in, so it's square again when that's gone
      const left = s.springing ? clamp(Math.hypot(s.t1.x, s.t1.y) / s.halfA, 0, 1) : 0;
      const round = s.joined ? 1 : smoothstep(0, 1, Math.sqrt(left));
      s.foot[3] = round;
      s.stretch = 0;
      if (!find(i, round, c, s.joined || s.springing)) return;
      const k = s.scale;
      const snapAt = length * (0.5 + 0.5 * k);
      s.ax = c.ax;
      s.ay = c.ay;
      // the strand's end in the menu: under the menu's nearest point
      s.bx = c.bx + c.dx * root;
      s.by = c.by + c.dy * root;
      s.dx = c.dx;
      s.dy = c.dy;
      // The halves meet where the strand is thinnest: in the middle, or nearer its higher end,
      // where a thread pulled upwards runs thin and breaks
      const fromA = s.ay <= s.by ? SETTINGS.breakAt : 1 - SETTINGS.breakAt;
      if (s.joined) s.waistAt = fromA;
      const abX = s.bx - s.ax;
      const abY = s.by - s.ay;

      // The liquid takes hold of a thing that touches it. If that thing's snapped strand is still
      // drawing back, it waits until the halves are home and their mound has levelled, so nothing
      // that shows is dropped.
      if (!s.joined && c.gap < SETTINGS.touch * u && (!s.springing || s.settled)) {
        s.joined = true;
        s.springing = false;
        s.bead.fill(0);
        s.mound = 0;
      }

      // snap: at its waist, each half keeps what it had and springs back to its own shape
      if (s.joined && c.gap > snapAt) this.part(s, fromA);

      if (s.joined) {
        s.grip = Math.min(s.grip + dt / Math.max(SETTINGS.grip, 0.001), 1);
        const t = c.gap / snapAt;
        // The strand is whole from the moment the liquid has gripped the thing. While the two overlap
        // it lies inside the menu; it comes out with the thing's edge, and only gets thinner from there.
        const fill = smoothstep(0, 1, s.grip) * k * s.share;
        const full = lerp(SETTINGS.waist[0], SETTINGS.waist[1], Math.pow(t, 0.6));
        const waist = lerp(full, Math.min(full, SETTINGS.neck), smoothstep(0.6, 1, t)) * u * fill;
        const end = (full + SETTINGS.flare) * u * fill;
        s.radius[0] = s.radius[2] = end;
        s.radius[1] = s.radius[3] = waist;
        s.neck[0] = s.neck[1] = 1;
        s.neck[2] = s.neck[3] = waist;
        s.stretch = t;
        s.bead.fill(0);
        const hold = lerp(SETTINGS.corner, 1, smoothstep(0, SETTINGS.bell * u, c.fromCorner));
        s.foot[0] = lerp(SETTINGS.foot[0], SETTINGS.foot[1], t) * u * fill * hold;
        s.foot[1] = SETTINGS.bell * u * k;
        // A strand deep inside the menu leaves the menu's outline alone. It starts blending with it
        // once its own end is about to reach the outline, and the liquid on it starts to show: no
        // sooner, or a thing whose edge stays just under the menu's surface (a picture across one of
        // its ends) would keep a swell over it. A thin strand draws up less of the menu, and so does
        // one the liquid is still taking hold of: the swell towards a thing that has just touched
        // grows with the grip.
        s.foot[2] = smoothstep(-Math.max(end + 0.35 * u * fill, 1e-3), 0, c.apart) * fill;
        Object.assign(s.t1, { x: abX * fromA, y: abY * fromA, vx: 0, vy: 0 });
        Object.assign(s.t2, { x: -abX * (1 - fromA), y: -abY * (1 - fromA), vx: 0, vy: 0 });
        s.pull.x = t;
        s.pull.v = 0;
        this.leanX -= c.dx * t * this.weight;
        this.leanY -= c.dy * t * this.weight;
      } else if (s.springing) {
        const [stiff, damp] = SETTINGS.tip;
        for (const tip of [s.t1, s.t2]) {
          tip.vx += (-stiff * tip.x - damp * tip.vx) * dt;
          tip.vy += (-stiff * tip.y - damp * tip.vy) * dt;
          tip.x += tip.vx * dt;
          tip.y += tip.vy * dt;
        }
        const lenA = Math.hypot(s.t1.x, s.t1.y);
        const lenB = Math.hypot(s.t2.x, s.t2.y);
        const fA = clamp(lenA / s.halfA, 0, 1);
        const fB = clamp(lenB / s.halfB, 0, 1);
        // each half keeps at its tip the thickness it broke with, and thins at its anchor as it shortens;
        // a cut piece's waist fills out the same way
        const [end, thin, foot, , broke] = s.snap;
        const endA = end * Math.sqrt(fA);
        const endB = end * Math.sqrt(fB);
        s.radius[0] = endA;
        s.radius[1] = lerp(endA, broke, fA);
        s.radius[2] = endB;
        s.radius[3] = lerp(endB, broke, fB);
        s.neck[2] = lerp(endA, thin, fA);
        s.neck[3] = lerp(endB, thin, fB);
        // What a half gives up in length gathers in a drop at its tip. The drop goes back into what
        // the half hangs from over the last of the way: into the thing's edge, or under the menu's surface.
        const drop = SETTINGS.bead * u * k;
        s.bead[0] = drop * Math.sqrt(1 - fA) * smoothstep(0, 0.5 * u, lenA);
        s.bead[1] = drop * Math.sqrt(1 - fB) * smoothstep(0, 0.5 * u, lenB);
        // the foot draws back in with its half
        s.foot[0] = foot * fA;
        // The menu's half draws the menu's surface up less as it shortens. Once its tip is under the
        // surface, what's left is a mound, and that levels out in its own time.
        if (lenB > root) s.mound = Math.min(s.mound, s.snap[3] * lerp(0.6, 1, smoothstep(0, 1, fB)));
        else s.mound *= Math.exp(-dt / Math.max(SETTINGS.level, 0.01));
        s.foot[2] = s.mound;
        // home, and the mound low enough to have no height left: the liquid can take hold again
        s.settled = lenA < 0.1 * u && lenB < 0.5 * root && s.mound < 0.2;
        if (fA < 0.01 && fB < 0.02 && s.mound < 0.03) {
          s.springing = false;
          s.settled = false;
          s.radius.fill(0);
          s.bead.fill(0);
          s.foot.fill(0, 0, 3);
          s.neck.splice(0, 4, 1, 1, 0, 0);
          s.mound = 0;
        }
      }

      if (!s.joined) step(s.pull, 0, SETTINGS.settle, dt);
    });
  }

  // Breaks strand s at `at` along it from its anchor on the thing: at its waist when it snaps by itself,
  // wherever it's cut. Each piece starts as just that stretch of the strand was, the waist too if it's
  // on it, so nothing changes in the frame it breaks, and springs back to its own shape from there.
  part(s, at) {
    const abX = s.bx - s.ax;
    const abY = s.by - s.ay;
    const length = Math.hypot(abX, abY);
    s.joined = false;
    s.springing = true;
    s.grip = 0;
    s.halfA = Math.max(length * at, 1e-3);
    s.halfB = Math.max(length * (1 - at), 1e-3);
    Object.assign(s.t1, { x: abX * at, y: abY * at, vx: 0, vy: 0 });
    Object.assign(s.t2, { x: -abX * (1 - at), y: -abY * (1 - at), vx: 0, vy: 0 });
    // the halves start as the strand was, whatever made it break
    s.snap[0] = s.radius[0];
    s.snap[1] = s.radius[1];
    s.snap[2] = s.foot[0];
    s.snap[3] = s.mound = s.foot[2];
    s.snap[4] = radiusAlong(s, at);
    // where the waist is along each piece: at both tips when it broke there
    s.neck[0] = s.waistAt / Math.max(at, 1e-3);
    s.neck[1] = (1 - s.waistAt) / Math.max(1 - at, 1e-3);
    s.radius[1] = s.radius[3] = s.snap[4];
    s.neck[2] = s.neck[3] = s.snap[1];
    s.settled = false;
    this.kick += SETTINGS.wobble * this.weight * s.scale;
  }

  // Cuts the strands that a stroke of the cursor crosses, from (x0, y0) to (x1, y1) in one frame: only
  // those in the last of their stretch (from: how far through it, 0 to 1), and only where they show,
  // outside the menu (menu: as it's drawn). Each breaks where the stroke crossed it.
  cutAcross(x0, y0, x1, y1, menu, from) {
    for (const s of this.items) {
      if (!cuttable(s, from)) continue;
      const at = crossing(x0, y0, x1, y1, s.ax, s.ay, s.bx, s.by);
      if (at < 0.02 || at > 0.98 || !outside(s, at, menu)) continue;
      this.part(s, at);
    }
  }

  // Whether a strand that could be cut now passes within reach (CSS px) of (x, y), where it shows
  canCutNear(x, y, reach, menu, from) {
    return this.items.some((s) => {
      if (!cuttable(s, from)) return false;
      const abX = s.bx - s.ax;
      const abY = s.by - s.ay;
      const at = clamp(((x - s.ax) * abX + (y - s.ay) * abY) / Math.max(abX * abX + abY * abY, 1e-6), 0.02, 0.98);
      return Math.hypot(s.ax + abX * at - x, s.ay + abY * at - y) <= reach && outside(s, at, menu);
    });
  }
}

// A strand can be cut while it holds, in the last of its stretch (from), and while it shows
const cuttable = (s, from) => s.joined && s.stretch >= from && s.radius[1] > 0;

// whether `at` along strand s lies outside the menu, which lies on its side, a capsule
const outside = (s, at, menu) => {
  const x = lerp(s.ax, s.bx, at);
  const y = lerp(s.ay, s.by, at);
  return Math.hypot(Math.max(Math.abs(x - menu.x) - (menu.hx - menu.hy), 0), y - menu.y) - menu.hy > 0;
};

// The menu's own motion: it leans towards the strands it holds and wobbles when one snaps
export class MenuMotion {
  constructor() {
    this.squash = { x: 0, v: 0 };
    this.kick = 0; // what's still to come of the snaps' kicks
    this.leanX = { x: 0, v: 0 };
    this.leanY = { x: 0, v: 0 };
    this.menu = { x: 0, y: 0, hx: 0, hy: 0 }; // the menu as it's drawn
    this.unit = 0;
    this.pullMax = 0;
    this.pullRadius = 0;
  }

  // rest: the menu at rest; groups: every Strands, after its update
  update(dt, rest, groups) {
    const u = rest.hy;
    let leanX = 0;
    let leanY = 0;
    for (const group of groups) {
      leanX += group.leanX;
      leanY += group.leanY;
      this.kick += group.kick;
    }
    const given = this.kick * (1 - Math.exp(-dt / KICK));
    this.squash.v += given;
    this.kick -= given;
    // it leans towards what it holds, never further than the setting
    const lean = Math.hypot(leanX, leanY);
    const k = lean > 1 ? 1 / lean : 1;
    step(this.leanX, leanX * k * SETTINGS.lean * u, SETTINGS.sway, dt);
    step(this.leanY, leanY * k * SETTINGS.lean * u, SETTINGS.sway, dt);
    step(this.squash, 0, SETTINGS.squash, dt);

    const sq = clamp(this.squash.x, -0.3, 0.3);
    this.menu.x = rest.x + this.leanX.x;
    this.menu.y = rest.y + this.leanY.x;
    this.menu.hx = rest.hx * (1 - sq * 0.3);
    this.menu.hy = rest.hy * (1 + sq);
    this.unit = u;
    this.pullMax = SETTINGS.pull * u;
    this.pullRadius = 2.4 * u;
  }
}
