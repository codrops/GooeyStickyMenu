import { Goo, GLASS, MAX, MAX_LETTERS, MAX_STRINGS, MAX_TITLES, CUTS } from './goo.js';
import { Strands, MenuMotion, SETTINGS, closestToBox, closestAlongBox } from './strands.js';
import { letterShapes, closestToPart, closestBesidePart } from './letters.js';
import { applyMaterial, stagesOf, blendStages } from './materials.js';
import { createPanel } from './panel.js';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

// what the menu is made of on this page, and its stages if it changes with the scroll
applyMaterial(document.body.dataset.material, SETTINGS, GLASS);
const stages = stagesOf(document.body.dataset.material);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const content = document.querySelector('#smooth-content');
const menu = document.querySelector('.menu');
const menuLinks = [...menu.querySelectorAll('.menu__link')];
const pictures = [...document.querySelectorAll('.goo-picture')];
const images = pictures.map((el) => el.querySelector('img'));
const titles = [...document.querySelectorAll('.chapter__title')];
const canvas = document.querySelector('.goo');

// The canvas and the page move in the same frame only when the smoother moves the page,
// so the effect runs only with it
const smoother = reducedMotion
  ? null
  : ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1 });

// In-page links go through the smoother
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  const target = link.hash.length > 1 && document.querySelector(link.hash);
  if (!target) return;
  link.addEventListener('click', (event) => {
    if (!smoother) return;
    event.preventDefault();
    smoother.scrollTo(target, true, 'top top');
  });
});

// The menu marks the section in the middle of the screen
document.querySelectorAll('.hero, .chapter').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => {
      if (!self.isActive) return;
      menuLinks.forEach((link) =>
        link.hash === `#${section.id}` ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'),
      );
    },
  });
});

// A hero picture: the settings button reads light while it's over it (css/<material>.css)
const hero = document.querySelector('.hero');
if (hero) {
  ScrollTrigger.create({
    trigger: hero,
    start: 'top bottom',
    end: 'bottom top+=60',
    toggleClass: { targets: document.body, className: 'is-over-hero' },
  });
}

// The looks are placed around the menu's width (css/base.css)
const setMenuWidth = () => document.documentElement.style.setProperty('--menu-hw', `${menu.offsetWidth / 2}px`);
ScrollTrigger.addEventListener('refreshInit', setMenuWidth);

// how much larger than its box a section's picture shows its image, for its parallax (the hero: 1.25)
const LOOK_ZOOM = 1.15;

// Cutting a strand with the mouse: a quick stroke across one in the last of its stretch breaks it
// where the stroke crossed it. from: how far through its stretch a strand has to be (it snaps by
// itself at 1); speed: how fast the stroke, CSS px a second, so a slow move across one does nothing;
// near: how close the mouse has to be to such a strand for the cursor to become a crosshair, the hint
// that it can be cut now. Only with a mouse or a trackpad (CUTS): on a touch screen a finger scrolls the page.
const CUT = { from: 0.8, speed: 600, near: 20 };

function run(goo, panel) {
  const strands = new Strands(pictures.length); // the liquid's strands on the pictures
  let letters = new Strands(0); // and on the parts of the titles' letters
  // A sticky material's extra threads: up to two more per picture and per part of a letter, one to
  // each side of its strand (along a picture's edge, aside on a letter, in menu half-heights),
  // thinner than the strand, so they break before it, one after the other
  const EXTRA = [
    { along: -2.2, aside: -1.3, scale: 0.62 },
    { along: 2.2, aside: 1.3, scale: 0.8 },
  ];
  const strings = new Strands(pictures.length * EXTRA.length, 0.4);
  strings.items.forEach((item, i) => (item.scale = EXTRA[i % EXTRA.length].scale));
  let letterStrings = new Strands(0);
  const drawnStrings = [];
  // how much of an extra thread the material has for now
  const share = (group) =>
    group.items.forEach((item, i) => (item.share = gsap.utils.clamp(0, 1, SETTINGS.strings - (i % EXTRA.length))));
  const motion = new MenuMotion();
  const page = pictures.map(() => ({ x: 0, y: 0, hx: 0, hy: 0 })); // each picture on the page
  // and on screen, with the part of its image that shows (zoom, focusY: see Goo.fit)
  const boxes = pictures.map(() => ({ x: 0, y: 0, hx: 0, hy: 0, zoom: 1, focusY: 0.5 }));

  // Parallax: a picture shows its image a little larger than its box, and the image drifts down inside
  // it as the page scrolls past, so it moves slower than the page. The box stays where the page has it,
  // so the liquid meets the same edges. The hero (data-parallax), from the top of the page until it has
  // left the screen; a section's pictures (.look__img), less, from the moment they come into view at
  // the bottom until they've left at the top.
  pictures.forEach((el, i) => {
    if (el.dataset.focusX) boxes[i].focusX = parseFloat(el.dataset.focusX);
    if ('parallax' in el.dataset) {
      boxes[i].zoom = 1.25;
      gsap.to(boxes[i], {
        focusY: 0,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
      });
    } else if (el.classList.contains('look__img')) {
      boxes[i].zoom = LOOK_ZOOM;
      gsap.fromTo(
        boxes[i],
        { focusY: 1 },
        { focusY: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    }
  });
  const rest = { x: 0, y: 0, hx: 0, hy: 0 }; // the menu, without its lean
  // The other variations at the end of the page, on a black ground of their own: the canvas colours
  // the liquid over them as over black. A material with dark labels gives light ones for over that
  // ground (--color-menu-link-on-dark, css/base.css): they turn as far as the black has come up
  // under the menu, with the scroll.
  const band = document.querySelector('.others');
  const dark = { x: 0, y: 0, hx: 0, hy: 0, pageY: 0, color: [0, 0, 0] };
  const labels = getComputedStyle(menu);
  const onDark = labels.getPropertyValue('--color-menu-link-on-dark').trim();
  const turnLabels = onDark && {
    link: gsap.utils.interpolate(labels.getPropertyValue('--color-menu-link').trim(), onDark),
    hover: gsap.utils.interpolate(labels.getPropertyValue('--color-menu-link-hover').trim(), labels.getPropertyValue('--color-menu-link-hover-on-dark').trim()),
  };
  let overDark = 0;
  const visible = [];
  let drawnTitles = []; // the chapter titles as the canvas draws them
  let parts = []; // the parts of their letters, each with its title
  const drawnLetters = [];
  const onScreen = []; // the titles on screen this frame
  let scroll = 0;
  let leanX = 0;
  let leanY = 0;
  let turns = []; // for a material with stages: the stretch of scroll over which each chapter's title passes under the menu
  let stage = -1; // and the stage the material is at

  // A material with stages is at its first one when the page opens, and turns into the next while
  // each chapter's title passes under the menu: from the title's top reaching the menu to its foot
  // leaving it. So a title's letters, and every picture of its chapter, pull on the material that
  // chapter is about, and the last chapter's strands are left alone until the next title arrives.
  const stageAt = (y) => {
    let at = 0;
    for (const [from, to] of turns) {
      if (y >= to) {
        at += 1;
        continue;
      }
      const t = gsap.utils.clamp(0, 1, (y - from) / Math.max(to - from, 1));
      return at + t * t * (3 - 2 * t);
    }
    return at;
  };
  // the settings go back to the stage's own when the panel is reset
  panel.addEventListener('reset', () => (stage = -1));

  // the labels lean with the shape the canvas draws for them
  gsap.set(menu, { xPercent: -50, x: 0, y: 0 });
  const setX = gsap.quickSetter(menu, 'x', 'px');
  const setY = gsap.quickSetter(menu, 'y', 'px');

  const measure = () => {
    const top = content.getBoundingClientRect().top;
    pictures.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      Object.assign(page[i], { x: r.left + r.width / 2, y: r.top - top + r.height / 2, hx: r.width / 2, hy: r.height / 2 });
    });
    if (band) {
      const r = band.getBoundingClientRect();
      Object.assign(dark, { x: r.left + r.width / 2, pageY: r.top - top + r.height / 2, hx: r.width / 2, hy: r.height / 2 });
      dark.color = getComputedStyle(band).backgroundColor.match(/[\d.]+/g).slice(0, 3).map((v) => v / 255);
    }
    const m = menu.getBoundingClientRect();
    Object.assign(rest, { x: m.left + m.width / 2 - leanX, y: m.top + m.height / 2 - leanY, hx: m.width / 2, hy: m.height / 2 });
    goo.resize();

    // The canvas draws the chapter titles too, so the liquid can bend and frost them and hold on
    // to their letters: each one's text goes into a texture, placed where the page has it
    drawnTitles.forEach((title) => goo.deleteTitle(title));
    parts = [];
    const scales = [];
    drawnTitles = titles.map((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const pad = Math.ceil(size * 0.2); // room for what a tight line height leaves outside the box
      // an empty inline box sits on the text's baseline
      const probe = document.createElement('span');
      probe.style.cssText = 'display: inline-block; width: 0; height: 0;';
      el.append(probe);
      const baseline = probe.getBoundingClientRect().bottom - r.top;
      probe.remove();
      const hex = style.getPropertyValue('--color-title').trim().slice(1);
      const text = el.textContent.trim();
      const drawing = {
        text: style.textTransform === 'uppercase' ? text.toUpperCase() : text,
        font: `${style.fontWeight} ${size}px ${style.fontFamily}`,
        spacing: parseFloat(style.letterSpacing) || 0,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
        x: pad,
        baseline: pad + baseline,
      };
      const shape = letterShapes(drawing);
      const title = {
        ...goo.createTitle({ ...drawing, shape }),
        color: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
        x: r.left + r.width / 2,
        pageY: r.top - top + r.height / 2,
        y: 0,
        hx: r.width / 2 + pad,
        hy: r.height / 2 + pad,
        left: r.left - pad, // its box's corner, for the parts' points
        pageTop: r.top - top - pad,
      };
      for (const part of shape.parts) {
        parts.push({ ...part, title });
        // thin letters pull thin strands
        scales.push(gsap.utils.clamp(0.3, 1, shape.stroke / (1.4 * rest.hy)));
      }
      return title;
    });
    letters = new Strands(parts.length, SETTINGS.letters);
    letters.items.forEach((item, i) => (item.scale = scales[i]));
    letterStrings = new Strands(parts.length * EXTRA.length, SETTINGS.letters * 0.4);
    letterStrings.items.forEach((item, i) => {
      const which = i % EXTRA.length;
      item.scale = scales[(i - which) / EXTRA.length] * EXTRA[which].scale;
      item.pin = { x: null, y: null }; // where on its letter it holds
    });
    turns = stages
      ? titles.slice(0, stages.length - 1).map((el) => {
          const r = el.getBoundingClientRect();
          return [r.top - top - (rest.y + rest.hy), r.bottom - top - (rest.y - rest.hy)];
        })
      : [];
    stage = -1;
  };
  ScrollTrigger.addEventListener('refresh', measure);
  measure();

  const findPicture = (i, round, out) => {
    closestToBox(boxes[i], rest, GLASS.soften[0] * rest.hy * round, out);
    return true;
  };

  // An extra thread holds on beside its picture's strand, a little way along the picture's outline.
  // It's there only as far as the material pulls extra threads (SETTINGS.strings).
  const findString = (i, round, out, held) => {
    const which = i % EXTRA.length;
    if (!held && SETTINGS.strings <= which) return false;
    const picture = (i - which) / EXTRA.length;
    closestAlongBox(boxes[picture], rest, GLASS.soften[0] * rest.hy * round, EXTRA[which].along * rest.hy, out);
    return true;
  };

  // a part matters once it's within a strand's length of the menu
  const farFrom = (part, top) => {
    const reach = rest.hy * (SETTINGS.length * 1.2 + 1);
    return (
      top + part.minY > rest.y + reach ||
      top + part.maxY < rest.y - reach ||
      part.title.left + part.minX > rest.x + rest.hx + reach ||
      part.title.left + part.maxX < rest.x - rest.hx - reach
    );
  };
  const findLetter = (i, round, out, held) => {
    const part = parts[i];
    const top = part.title.pageTop - scroll;
    if (!held && farFrom(part, top)) {
      part.near = part.centre;
      return false;
    }
    closestToPart(part, part.title.left, top, rest, out);
    return true;
  };
  // an extra thread on a part of a letter, to one side of where the part's strand holds on
  const findLetterString = (i, round, out, held) => {
    const which = i % EXTRA.length;
    const part = parts[(i - which) / EXTRA.length];
    const top = part.title.pageTop - scroll;
    if (!held && (SETTINGS.strings <= which || farFrom(part, top))) return false;
    closestBesidePart(part, part.title.left, top, rest, EXTRA[which].aside * rest.hy, letterStrings.items[i].pin, held, out);
    return true;
  };

  // where the mouse is, and where it was the frame before: the stroke that may cut a strand
  const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, on: false, hint: false };
  if (CUTS) {
    addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (pointer.on) return;
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
      pointer.on = true;
    });
    document.documentElement.addEventListener('pointerleave', () => (pointer.on = false));
  }

  const frame = () => {
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 1 / 30);
    scroll = smoother.scrollTop();
    // The canvas sits in the page, so the frame and a hero's text can be above it, and is moved back
    // by as much as the page has scrolled, which keeps it on the screen
    canvas.style.transform = `translate3d(0, ${scroll}px, 0)`;
    visible.length = 0;
    page.forEach((p, i) => {
      const b = boxes[i];
      b.x = p.x;
      b.y = p.y - scroll;
      b.hx = p.hx;
      b.hy = p.hy;
      if (b.y + b.hy > -goo.height * 0.25 && b.y - b.hy < goo.height * 1.25) visible.push(i);
    });
    dark.y = dark.pageY - scroll;
    if (band && turnLabels) {
      const covered = Math.min(rest.y + rest.hy, dark.y + dark.hy) - Math.max(rest.y - rest.hy, dark.y - dark.hy);
      const t = gsap.utils.clamp(0, 1, covered / (2 * rest.hy));
      const over = t * t * (3 - 2 * t);
      if (Math.abs(over - overDark) > 1e-3) {
        overDark = over;
        menu.style.setProperty('--color-menu-link', turnLabels.link(over));
        menu.style.setProperty('--color-menu-link-hover', turnLabels.hover(over));
      }
    }

    if (stages) {
      const at = stageAt(scroll);
      if (Math.abs(at - stage) > 1e-4) {
        stage = at;
        const [r, g, b] = blendStages(stages, at, SETTINGS, GLASS).map((c) => Math.round(c * 255));
        menu.style.setProperty('--color-menu-link', `rgb(${r} ${g} ${b} / 75%)`);
        menu.style.setProperty('--color-menu-link-hover', `rgb(${r} ${g} ${b})`);
        panel.sync();
      }
    }

    const speed = Math.abs(smoother.getVelocity());
    strands.update(dt, rest, speed, findPicture);
    share(strings);
    strings.update(dt, rest, speed, findString);
    letters.update(dt, rest, speed, findLetter);
    share(letterStrings);
    letterStrings.update(dt, rest, speed, findLetterString);
    // a quick enough stroke cuts what it crosses, before the menu's motion takes in this frame's snaps
    if (pointer.on) {
      if (Math.hypot(pointer.x - pointer.lastX, pointer.y - pointer.lastY) >= CUT.speed * dt) {
        for (const group of [strands, strings, letters, letterStrings]) {
          group.cutAcross(pointer.lastX, pointer.lastY, pointer.x, pointer.y, motion.menu, CUT.from);
        }
      }
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
    }
    // the hint: a crosshair while the mouse is near a strand it could cut now
    const cuttable =
      pointer.on &&
      [strands, strings, letters, letterStrings].some((group) => group.canCutNear(pointer.x, pointer.y, CUT.near, motion.menu, CUT.from));
    if (cuttable !== pointer.hint) {
      pointer.hint = cuttable;
      document.documentElement.classList.toggle('is-cuttable', cuttable);
    }
    motion.update(dt, rest, [strands, strings, letters, letterStrings]);

    const x = motion.menu.x - rest.x;
    const y = motion.menu.y - rest.y;
    if (Math.abs(x - leanX) > 0.01 || Math.abs(y - leanY) > 0.01) {
      leanX = x;
      leanY = y;
      setX(x);
      setY(y);
    }

    // The titles on screen, two at most, so the canvas can draw them all; if ever there were more,
    // the two nearest the menu. A title that has left the screen still counts while the liquid holds
    // one of its letters: the menu sits near the screen's lower edge, and a long strand to a title
    // just below it must not be cut there.
    const showing = (item, part) => item.foot[2] > 0 && (item.radius[0] > 0 || item.radius[2] > 0) && part.title;
    const holding = new Set();
    letters.items.forEach((item, i) => showing(item, parts[i]) && holding.add(parts[i].title));
    letterStrings.items.forEach((item, i) => {
      const part = parts[(i - (i % EXTRA.length)) / EXTRA.length];
      if (showing(item, part)) holding.add(part.title);
    });
    onScreen.length = 0;
    for (const t of drawnTitles) {
      t.y = t.pageY - scroll;
      if ((t.y + t.hy > 0 && t.y - t.hy < goo.height) || holding.has(t)) onScreen.push(t);
    }
    if (onScreen.length > MAX_TITLES) {
      onScreen.sort((a, b) => Math.abs(a.y - rest.y) - Math.abs(b.y - rest.y));
      onScreen.length = MAX_TITLES;
    }

    // Their letters' strands that show (one that lies deep inside the menu doesn't);
    // if there are more than the canvas draws, the thickest
    drawnLetters.length = 0;
    const drawn = (item, part) => showing(item, part) && onScreen.includes(part.title);
    letters.items.forEach((item, i) => drawn(item, parts[i]) && drawnLetters.push(item));
    letterStrings.items.forEach((item, i) => drawn(item, parts[(i - (i % EXTRA.length)) / EXTRA.length]) && drawnLetters.push(item));
    if (drawnLetters.length > MAX_LETTERS) drawnLetters.sort((a, b) => b.radius[0] - a.radius[0]);

    // The extra threads that show, each with its picture's place among those drawn; if there are
    // more than the canvas draws, the thickest
    drawnStrings.length = 0;
    strings.items.forEach((item, i) => {
      if (!(item.foot[2] > 0 && (item.radius[0] > 0 || item.radius[2] > 0))) return;
      const on = visible.indexOf((i - (i % EXTRA.length)) / EXTRA.length);
      if (on >= 0 && on < MAX) drawnStrings.push({ item, on });
    });
    if (drawnStrings.length > MAX_STRINGS) drawnStrings.sort((a, b) => b.item.radius[0] - a.item.radius[0]);

    goo.render({ boxes, visible, strands, strings: drawnStrings, letters: drawnLetters, titles: onScreen, motion, dark: band ? dark : undefined });
  };
  gsap.ticker.add(frame);
  // the first frame now, so the pictures are there the moment the page shows
  frame();
}

async function start() {
  await document.fonts.ready;
  setMenuWidth();
  await Promise.all(images.map((img) => img.decode().catch(() => {})));

  let goo = null;
  if (smoother && Goo.supported()) {
    try {
      goo = new Goo(canvas, images);
    } catch (error) {
      console.warn(error);
    }
  }
  if (goo) {
    document.body.classList.add('is-goo');
    menu.classList.add('is-drawn');
  }

  // The statement appears line by line, each line rising out of its own mask, every time it comes into
  // view as the page scrolls down. Once it has left the screen at the bottom, scrolling back up, it's
  // put back, out of sight, ready to play again; scrolling up into it from below shows it as it is, and
  // so does a page that opens past it. Split again whenever the lines change (autoSplit): the new lines
  // take over where the reveal was, and its two triggers are made again.
  if (!reducedMotion) {
    let triggers = [];
    SplitText.create('.statement__text', {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => {
        triggers.forEach((trigger) => trigger.kill());
        const statement = self.elements[0];
        const reveal = gsap.from(self.lines, { yPercent: 100, duration: 1.2, ease: 'expo.out', stagger: 0.08, paused: true });
        triggers = [
          ScrollTrigger.create({
            trigger: statement,
            start: 'top 85%',
            end: 'max',
            onEnter: () => reveal.progress() === 0 && reveal.play(),
          }),
          ScrollTrigger.create({ trigger: statement, start: 'top bottom', onLeaveBack: () => reveal.pause(0) }),
        ];
        return reveal;
      },
    });
  }

  ScrollTrigger.refresh();
  if (goo) run(goo, createPanel());
  document.body.classList.remove('loading');
}

start();
