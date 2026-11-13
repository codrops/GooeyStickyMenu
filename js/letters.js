// What the liquid needs to hold on to a chapter title's letters: the letters'
// outline as a distance field for the shader, and the outline's points for
// finding where a strand ends. A letter that stands on two feet (an M, an R)
// is split between them into two parts; each part holds one strand.

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const INF = 1e20;

// Draws text the way the page sets it, with its letter-spacing (CSS px): letter by letter, each where the
// text before it ends, so the font's own kerning between letters is kept
export function fillSpaced(ctx, text, x, y, spacing) {
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }
  for (let i = 0; i < text.length; i++) {
    const start = ctx.measureText(text.slice(0, i + 1)).width - ctx.measureText(text[i]).width;
    ctx.fillText(text[i], x + start + i * spacing, y);
  }
}

// One pass of the squared distance transform (Felzenszwalb and Huttenlocher) along a row or a column
function transform(grid, offset, stride, length, f, v, z) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    grid[offset + q * stride] = f[r] + (q - r) * (q - r);
  }
}

// grid: squared distances to start from (0 on the shape, INF away from it); ends as squared distances to the shape
function distances(grid, width, height) {
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const v = new Uint16Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < width; x++) transform(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) transform(grid, y * width, 1, width, f, v, z);
}

// text and font (a CSS font) as the page sets them; width, height: the title's box in CSS px;
// x, baseline: where the text starts in that box; spacing: its letter-spacing, CSS px.
// The distance field has one value per CSS px, positive outside the letters, in CSS px.
export function letterShapes({ text, font, width, height, x, baseline, spacing = 0 }) {
  const w = Math.round(width);
  const h = Math.round(height);
  const sx = w / width;
  const sy = h / height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(sx, sy);
  ctx.font = font;
  ctx.fillStyle = '#fff';
  fillSpaced(ctx, text, x, baseline, spacing);
  const pixels = ctx.getImageData(0, 0, w, h).data;

  // the distance field, exact to a fraction of a pixel through the letters' soft edges
  const outside = new Float64Array(w * h);
  const inside = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = pixels[i * 4 + 3] / 255;
    const d = 0.5 - a;
    outside[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(d, 0) ** 2;
    inside[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(-d, 0) ** 2;
  }
  distances(outside, w, h);
  distances(inside, w, h);
  const sdf = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) sdf[i] = (Math.sqrt(outside[i]) - Math.sqrt(inside[i])) / sx;

  const on = (px, py) => px >= 0 && py >= 0 && px < w && py < h && pixels[(py * w + px) * 4 + 3] >= 128;

  // Each letter's span, from where the text before it ends. A letter standing on several feet is
  // split between them: its feet are the runs of ink along a row just above its lowest point.
  const edges = []; // where each part ends, in pixels
  let from = x * sx;
  for (let i = 0; i < text.length; i++) {
    const to = (x + ctx.measureText(text.slice(0, i + 1)).width + (i + 0.5) * spacing) * sx;
    const x0 = Math.max(Math.round(from), 0);
    const x1 = Math.min(Math.round(to), w);
    let top = h;
    let bottom = -1;
    for (let py = 0; py < h; py++) {
      for (let px = x0; px < x1; px++) {
        if (!on(px, py)) continue;
        top = Math.min(top, py);
        bottom = py;
        break;
      }
    }
    if (bottom >= 0) {
      const py = Math.round(bottom - 0.08 * (bottom - top));
      let end = -1; // where the last foot ended
      for (let px = x0, start = -1; px <= x1; px++) {
        const ink = px < x1 && on(px, py);
        if (ink && start < 0) start = px;
        if (!ink && start >= 0) {
          if (px - start >= 2) {
            if (end >= 0) edges.push((end + start) / 2);
            end = px;
          }
          start = -1;
        }
      }
    }
    edges.push(to);
    from = to;
  }
  const partAt = new Uint16Array(w);
  for (let px = 0, i = 0; px < w; px++) {
    while (i < edges.length - 1 && px + 0.5 >= edges[i]) i++;
    partAt[px] = i;
  }

  // the outline's points, by part, and how wide the letters' strokes are (the median run of ink along a row)
  const points = edges.map(() => []);
  const runs = [];
  for (let py = 0; py < h; py++) {
    let run = 0;
    for (let px = 0; px < w; px++) {
      if (!on(px, py)) {
        if (run) runs.push(run);
        run = 0;
        continue;
      }
      run++;
      if (!on(px - 1, py) || !on(px + 1, py) || !on(px, py - 1) || !on(px, py + 1)) {
        points[partAt[px]].push((px + 0.5) / sx, (py + 0.5) / sy);
      }
    }
    if (run) runs.push(run);
  }
  runs.sort((a, b) => a - b);
  const stroke = runs.length ? runs[runs.length >> 1] / sx : 0;

  const parts = [];
  for (const list of points) {
    if (list.length < 6) continue;
    const part = { points: new Float32Array(list), minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, centre: 0, near: 0 };
    for (let i = 0; i < list.length; i += 2) {
      part.minX = Math.min(part.minX, list[i]);
      part.maxX = Math.max(part.maxX, list[i]);
      part.minY = Math.min(part.minY, list[i + 1]);
      part.maxY = Math.max(part.maxY, list[i + 1]);
      part.centre += list[i] / (list.length / 2);
    }
    part.near = part.centre; // along the part, where its strand last held on
    parts.push(part);
  }

  return { sdf, width: w, height: h, parts, stroke };
}

// The closest points between a part of a letter and the menu (a capsule), like closestToBox
// in strands.js. left, top: where the title's box is on screen. Where several points are as
// close (a flat foot over the menu), the one nearest to where the strand last held on wins,
// so the strand doesn't wander.
export function closestToPart(part, left, top, menu, out) {
  const r = menu.hy;
  const span = Math.max(menu.hx - r, 0);
  const points = part.points;
  let best = Infinity;
  let ax = 0;
  let ay = 0;
  let local = part.near;
  for (let i = 0; i < points.length; i += 2) {
    const px = left + points[i];
    const py = top + points[i + 1];
    const sx = clamp(px, menu.x - span, menu.x + span);
    const cost = Math.hypot(px - sx, py - menu.y) + 0.03 * Math.abs(points[i] - part.near);
    if (cost < best) {
      best = cost;
      ax = px;
      ay = py;
      local = points[i];
    }
  }
  part.near = local;

  const sx = clamp(ax, menu.x - span, menu.x + span);
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
  out.bx = sx - dx * r;
  out.by = menu.y - dy * r;
  out.dx = dx;
  out.dy = dy;
  out.gap = Math.max(d - r, 0);
  out.apart = d - r;
  out.fromCorner = Infinity; // a letter's foot is never narrowed for a corner
}

// A further point on a part of a letter, for one of a sticky material's extra threads: on the part's
// outline, `aside` px to one side of where the part's strand holds on (or at the part's edge, if
// it's narrower than that), as near the menu as the outline gets there. Fills out as closestToPart does.
// pin: where this thread held on last, in the part's own coordinates ({ x, y }, written here). A
// thread that holds (held) only slides along the outline from there, a few px a frame: it never
// lets go of one spot on a letter to take hold of another.
export function closestBesidePart(part, left, top, menu, aside, pin, held, out) {
  const r = menu.hy;
  const span = Math.max(menu.hx - r, 0);
  const points = part.points;
  const target = clamp(part.near + aside, part.minX, part.maxX);
  const stay = held && pin.x !== null;
  let best = Infinity;
  let ax = 0;
  let ay = 0;
  let lx = pin.x;
  let ly = pin.y;
  for (let i = 0; i < points.length; i += 2) {
    if (stay && Math.abs(points[i] - pin.x) + Math.abs(points[i + 1] - pin.y) > 8) continue;
    const px = left + points[i];
    const py = top + points[i + 1];
    const sx = clamp(px, menu.x - span, menu.x + span);
    const cost = Math.hypot(px - sx, py - menu.y) + 1.2 * Math.abs(points[i] - target);
    if (cost < best) {
      best = cost;
      ax = px;
      ay = py;
      lx = points[i];
      ly = points[i + 1];
    }
  }
  pin.x = lx;
  pin.y = ly;

  const sx = clamp(ax, menu.x - span, menu.x + span);
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
  out.bx = sx - dx * r;
  out.by = menu.y - dy * r;
  out.dx = dx;
  out.dy = dy;
  out.gap = Math.max(d - r, 0);
  out.apart = d - r;
  out.fromCorner = Infinity;
}
