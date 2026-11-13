// What the menu's liquid can be made of. A page names one on its body
// (data-material); its values replace the defaults in SETTINGS (js/strands.js)
// and GLASS (js/goo.js), so a material only lists what it changes. Without
// one, the menu is clear glass. A material can also change as the page
// scrolls: it then lists its stages, one for the page's opening and one per
// chapter, and blendStages() mixes the two the page is between.

export const MATERIALS = {
  // Sheer cherry gel polish. Thick and self-levelling: it pulls short, heavy strands that thin near
  // the top and break there, and each half sinks back slowly, without a bounce, a drop at its tip.
  // Clear like red glass, deeper where it's thicker, very glossy. The menu's own motion (its lean
  // and wobble) is the clear glass's, as tuned.
  jelly: {
    strands: {
      length: 3.4,
      waist: [0.3, 0.06],
      flare: 0.07,
      breakAt: 0.3,
      bead: 0.11,
      level: 0.3,
      tip: [70, 17],
      settle: [200, 28],
    },
    glass: {
      rim: 0.8,
      bend: 0.7,
      frost: [0, 0.08],
      veil: 0.04,
      veilColor: [1, 0.85, 0.88],
      tint: [214 / 255, 10 / 255, 34 / 255], // #d60a22
      depth: 1,
      gloss: 60,
      sheen: 0.9,
      caustic: 1.2,
    },
  },

  // Thick and slow. It wets what it touches with a wide foot and stretches into long threads that
  // run very thin before they break, near their higher end; the broken thread falls back at once,
  // without a bounce, and the mound it leaves is slow to level; the menu hardly wobbles. Amber,
  // deeper where it's thicker and pale gold where it's thin, and very glossy. It has a body of its
  // own: what's under it shows soft and out of focus, in the honey's colour, so it stays amber over
  // a dark or busy picture too. The light that comes through it lands gold in its shadow.
  honey: {
    strands: {
      length: 7,
      waist: [0.24, 0.035],
      flare: 0.05,
      foot: [0.55, 0.32],
      bell: 1,
      grip: 0.12,
      lean: 0.1,
      wobble: 0.5,
      breakAt: 0.18,
      bead: 0.09,
      level: 0.6,
      tip: [130, 23],
      settle: [110, 18],
      squash: [110, 20],
      sway: [70, 15],
    },
    glass: {
      flare: 1.8,
      rim: 0.9,
      bend: 0.8,
      frost: [0.07, 0.42],
      veil: 0.36,
      veilColor: [0.78, 0.44, 0.09],
      tint: [0.78, 0.42, 0.07],
      depth: 1,
      dark: [0.1, 0.05],
      gloss: 70,
      sheen: 1,
      bright: 0,
      shadow: 0.2,
      caustic: 1.4,
    },
  },

  // A gel. It pulls short, thick strands that neck down and break early, in the middle, each with a
  // second, thinner one beside it (strings 0.8: one extra thread, at four fifths of its thickness);
  // the halves go straight back into shape without overshooting, each rounded into a fat drop, and the
  // menu wobbles like jelly. Nearly clear with a pale green cast, cloudy inside, holding small air bubbles.
  aloe: {
    strands: {
      length: 2.8,
      waist: [0.34, 0.14],
      flare: 0.08,
      foot: [0.3, 0.2],
      bell: 0.6,
      grip: 0.2,
      lean: 0.22,
      wobble: 3.6,
      breakAt: 0.5,
      bead: 0.18,
      strings: 0.8,
      level: 0.14,
      tip: [400, 40],
      settle: [300, 35],
      squash: [240, 4.5],
      sway: [200, 8],
    },
    glass: {
      flare: 1.2,
      rim: 0.7,
      bend: 0.5,
      frost: [0.15, 0.6],
      veil: 0.45,
      veilColor: [1, 1, 1],
      tint: [0.875, 0.941, 0.816],
      depth: 1,
      dark: [0.15, 0.06],
      gloss: 40,
      sheen: 0.6,
      bright: 0.5,
      shadow: 0.14,
      caustic: 0.6,
      bubbles: 0.7,
    },
  },

  // Caramel, cooking as the page scrolls. It starts as a syrup, pale and runny; thickens and takes
  // colour at the boil; is at its stickiest once it can be pulled, when its threads run longer and
  // thinner than any other material's, a picture pulls three of them, they cling to a wide stretch
  // of what they hold and drag the menu towards it; and ends set: dark, hard and glassy, a thing
  // that barely stretches before it snaps clean. Scrolling back melts it again.
  // Every stage lists the same values, so each one can be blended with the next. `labels` is the
  // colour of the menu's labels over the caramel at that stage.
  caramel: {
    stages: [
      {
        name: 'syrup',
        labels: [0.2, 0.125, 0.04],
        strands: {
          length: 2.2,
          waist: [0.2, 0.04],
          flare: 0.05,
          foot: [0.4, 0.2],
          bell: 0.6,
          grip: 0.08,
          pull: 0,
          lean: 0.08,
          wobble: 2,
          breakAt: 0.4,
          neck: 0.03,
          bead: 0.14,
          strings: 0,
          level: 0.12,
          tip: [520, 46],
          settle: [320, 34],
          squash: [300, 12],
          sway: [260, 22],
        },
        glass: {
          flare: 1.3,
          soften: [0, 2],
          rim: 0.7,
          bend: 0.6,
          frost: [0, 0.05],
          veil: 0.55,
          veilColor: [1, 0.94, 0.74],
          tint: [0.98, 0.88, 0.56],
          depth: 0.8,
          dark: [0.08, 0.03],
          gloss: 80,
          sheen: 1,
          bright: 0.4,
          shadow: 0.1,
          caustic: 1.2,
          bubbles: 0.2,
        },
      },
      {
        name: 'boil',
        labels: [0.2, 0.125, 0.04],
        strands: {
          length: 4,
          waist: [0.26, 0.05],
          flare: 0.06,
          foot: [0.5, 0.26],
          bell: 0.8,
          grip: 0.12,
          pull: 0,
          lean: 0.12,
          wobble: 1.2,
          breakAt: 0.3,
          neck: 0.04,
          bead: 0.12,
          strings: 0,
          level: 0.3,
          tip: [140, 24],
          settle: [200, 28],
          squash: [200, 14],
          sway: [160, 18],
        },
        glass: {
          flare: 1.6,
          soften: [0, 2],
          rim: 0.8,
          bend: 0.7,
          frost: [0.05, 0.32],
          veil: 0.4,
          veilColor: [0.97, 0.74, 0.32],
          tint: [0.94, 0.63, 0.2],
          depth: 1,
          dark: [0.1, 0.04],
          gloss: 70,
          sheen: 1,
          bright: 0.25,
          shadow: 0.14,
          caustic: 1.4,
          bubbles: 0.7,
        },
      },
      {
        name: 'pull',
        labels: [1, 0.953, 0.863],
        strands: {
          length: 12,
          waist: [0.26, 0.03],
          flare: 0.05,
          foot: [0.8, 0.48],
          bell: 1.4,
          grip: 0.12,
          pull: 0,
          lean: 0.34,
          wobble: 0.4,
          breakAt: 0.15,
          neck: 0.03,
          bead: 0.1,
          strings: 2,
          level: 1.3,
          tip: [110, 21],
          settle: [80, 18],
          squash: [90, 19],
          sway: [50, 14],
        },
        glass: {
          flare: 2.1,
          soften: [0, 2],
          rim: 0.9,
          bend: 0.8,
          frost: [0.06, 0.32],
          veil: 0.34,
          veilColor: [0.8, 0.42, 0.1],
          tint: [0.8, 0.38, 0.06],
          depth: 1.1,
          dark: [0.1, 0.05],
          gloss: 75,
          sheen: 1.1,
          bright: 0,
          shadow: 0.2,
          caustic: 1.4,
          bubbles: 0.15,
        },
      },
      {
        name: 'set',
        labels: [1, 0.953, 0.863],
        strands: {
          length: 1.1,
          waist: [0.2, 0.1],
          flare: 0.04,
          foot: [0.3, 0.2],
          bell: 0.5,
          grip: 0.25,
          pull: 0,
          lean: 0.03,
          wobble: 0,
          breakAt: 0.5,
          neck: 0.1,
          bead: 0,
          strings: 0,
          level: 0.05,
          tip: [900, 60],
          settle: [400, 40],
          squash: [500, 45],
          sway: [400, 40],
        },
        glass: {
          flare: 0.7,
          soften: [0, 2],
          rim: 0.5,
          bend: 0.5,
          frost: [0.04, 0.3],
          veil: 0.5,
          veilColor: [0.44, 0.18, 0.04],
          tint: [0.56, 0.2, 0.04],
          depth: 1.3,
          dark: [0.14, 0.08],
          gloss: 110,
          sheen: 1.2,
          bright: 0.5,
          shadow: 0.24,
          caustic: 0.8,
          bubbles: 0,
        },
      },
    ],
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
// a spring's stiffness and damping span orders of magnitude between stages: blended by ratio, not by difference
const SPRINGS = ['tip', 'settle', 'squash', 'sway'];
const ratio = (a, b, t) => a * Math.pow(b / a, t);

// Writes values into a target in place, so whatever holds on to its arrays (the settings panel)
// keeps seeing the live values
function write(target, values) {
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((v, i) => (target[key][i] = v));
    else target[key] = value;
  }
}

// Writes a material's values over the defaults; one with stages starts at its first
export function applyMaterial(name, settings, glass) {
  const material = MATERIALS[name];
  if (!material) return;
  if (material.strands) write(settings, material.strands);
  if (material.glass) write(glass, material.glass);
  if (material.stages) blendStages(material.stages, 0, settings, glass);
}

// a material's stages, if it changes with the scroll
export const stagesOf = (name) => MATERIALS[name]?.stages || null;

// The material at stage `at` (0 is the first stage, 1 the second, 1.5 halfway between the second
// and the third), written into the settings in place. Returns the labels' colour there. The labels
// change over a short stretch late between two stages, once the liquid is nearly the next one's
// colour, so they're never long without contrast.
export function blendStages(stages, at, settings, glass) {
  const last = stages.length - 1;
  const i = Math.min(Math.max(Math.floor(at), 0), Math.max(last - 1, 0));
  const t = Math.min(Math.max(at - i, 0), 1);
  const from = stages[i];
  const to = stages[Math.min(i + 1, last)];
  for (const [target, a, b] of [
    [settings, from.strands, to.strands],
    [glass, from.glass, to.glass],
  ]) {
    for (const [key, value] of Object.entries(a)) {
      const mix = SPRINGS.includes(key) ? ratio : lerp;
      if (Array.isArray(value)) value.forEach((v, k) => (target[key][k] = mix(v, b[key][k], t)));
      else target[key] = mix(value, b[key], t);
    }
  }
  const s = Math.min(Math.max((t - 0.6) / 0.2, 0), 1);
  const turn = s * s * (3 - 2 * s);
  return from.labels.map((c, k) => lerp(c, to.labels[k], turn));
}
