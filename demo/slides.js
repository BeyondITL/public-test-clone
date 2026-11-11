/* Creator Publishing Kit slide designs. Original implementation.
   Everything is drawn on a canvas with text and plain shapes (rectangles, circles, strokes).
   No glyph or emoji stands in for a picture, no font is shipped, nothing is fetched.
   The only images ever drawn are the customer's own logo and cover photo, read from their device.
   Layout, colours, size, logo and photo are presentation only. They never enter the draft data. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CPKSlides = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const W = 1080, M = 84;
  // Two sizes. The safe area keeps text clear of the controls that apps draw over posts and stories.
  const SIZES = {
    portrait: {label: '4:5', h: 1350, run: 118, top: 214, foot: 1266, footTop: 1176, safeTop: 60, safeBottom: 60},
    story: {label: '9:16', h: 1920, run: 262, top: 390, foot: 1648, footTop: 1550, safeTop: 200, safeBottom: 250}
  };
  // Each preset is a full set of roles, so no colour is ever picked ad hoc in the renderer.
  const THEMES = {
    sheet: {bg: '#FFFFFF', ink: '#0D1117', soft: '#4A5362', accent: '#1F45E0', mark: '#EF4329', panel: '#E8ECF2', onAccent: '#FFFFFF', cover: '#1F45E0', onCover: '#FFFFFF'},
    cobalt: {bg: '#1F45E0', ink: '#FFFFFF', soft: '#DCE3FF', accent: '#FFFFFF', mark: '#FFC9BF', panel: '#1736B4', onAccent: '#1F45E0', cover: '#FFFFFF', onCover: '#1F45E0'},
    blush: {bg: '#FDEDE9', ink: '#0D1117', soft: '#4A5362', accent: '#A82412', mark: '#1F45E0', panel: '#FFFFFF', onAccent: '#FFFFFF', cover: '#A82412', onCover: '#FFFFFF'}
  };
  const SANS = '"Helvetica Neue", Helvetica, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';
  const LAYOUTS = [
    {id: 'statement', label: 'Statement'},
    {id: 'step', label: 'Step'},
    {id: 'quote', label: 'Quote'},
    {id: 'checklist', label: 'Checklist'},
    {id: 'closing', label: 'Closing'}
  ];

  /* ---------- colour ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function normalizeHex(h) {
    const s = String(h || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map(c => c + c).join('')).toUpperCase();
    return null;
  }
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgb2hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
  function luminance(h) {
    const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); }
  function toHsl(h) {
    const [r, g, b] = hex2rgb(h).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [hue / 6, s, l];
  }
  function fromHsl(h, s, l) {
    if (!s) return rgb2hex([l * 255, l * 255, l * 255]);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return rgb2hex([f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]);
  }
  // Moves a colour's lightness away from the background, keeping its hue, until the contrast target is met.
  function ensure(color, against, target) {
    if (contrast(color, against) >= target) return color;
    const darken = contrast('#000000', against) >= contrast('#FFFFFF', against);
    let [h, s, l] = toHsl(color);
    for (let k = 0; k < 120; k++) {
      l = clamp(l + (darken ? -0.01 : 0.01), 0, 1);
      const c = fromHsl(h, s, l);
      if (contrast(c, against) >= target) return c;
    }
    return darken ? '#000000' : '#FFFFFF';
  }
  // One brand colour in, a full set of roles out. Text roles reach 4.5:1 and graphics 3:1 against what they sit on.
  function deriveTheme(brand) {
    const b = normalizeHex(brand) || '#1F45E0';
    const bg = mix(b, '#FFFFFF', 0.9);
    const ink = ensure(mix(b, '#0D1117', 0.86), bg, 7);
    const soft = ensure(mix(ink, bg, 0.32), bg, 4.5);
    let accent = ensure(b, bg, 4.5);
    let onAccent = contrast('#FFFFFF', accent) >= 4.5 ? '#FFFFFF' : contrast(ink, accent) >= 4.5 ? ink : null;
    if (!onAccent) { accent = ensure(accent, '#FFFFFF', 4.5); onAccent = '#FFFFFF'; }
    const mark = ensure(b, bg, 3);
    // The cover and closing slides are filled with the brand colour itself where possible, with whichever
    // of white or dark ink reads better on it. Only if neither reaches 4.5:1 is the fill adjusted.
    const onCover = contrast('#FFFFFF', b) >= contrast(ink, b) ? '#FFFFFF' : ink;
    const cover = ensure(b, onCover, 4.5);
    return {bg, ink, soft, accent, mark, panel: mix(b, '#FFFFFF', 0.78), onAccent, cover, onCover, brand: b};
  }
  function palette(name, brand) { return name === 'brand' ? deriveTheme(brand) : (THEMES[name] || THEMES.sheet); }

  /* ---------- which layouts suit a slide ---------- */
  const NUM = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10};
  // A step number comes from the slide's own words ("Step 02", "Panel three"), never from its position.
  function stepNumber(slide) {
    for (const t of [slide && slide.eyebrow, slide && slide.headline]) {
      const m = String(t || '').match(/\b(?:step|part|panel|stage|phase|round|day|week|lesson|module|tip|rule|move)\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
      if (m) return /^\d/.test(m[1]) ? parseInt(m[1], 10) : NUM[m[1].toLowerCase()];
    }
    return null;
  }
  // The slides really are a sequence: at least two carry step numbers, and the numbers rise in order.
  function isSequence(slides) {
    if (!Array.isArray(slides)) return false;
    const nums = slides.map(s => stepNumber(s)).filter(n => n !== null);
    return nums.length >= 2 && nums.every((n, k) => k === 0 || n > nums[k - 1]);
  }
  const words = s => String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[‘’ʼ']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // A quotation is allowed only when the slide's own headline or body appears word for word in a cue it cites.
  function quoteField(slide, pack) {
    if (!slide || !pack || !Array.isArray(pack.cues) || !Array.isArray(slide.evidence_ids)) return null;
    const cited = pack.cues.filter(c => slide.evidence_ids.includes(c.id)).map(c => ' ' + words(c.text) + ' ');
    for (const field of ['body', 'headline']) {
      const w = words(slide[field]);
      if (w.split(' ').length >= 4 && cited.some(c => c.includes(' ' + w + ' '))) return field;
    }
    return null;
  }
  // A checklist is the body's own sentences, one per line: two to four of them, each short.
  function checklistItems(body) {
    const items = String(body == null ? '' : body).split(/\n+|(?<=[.!?;])\s+/).map(s => s.trim()).filter(Boolean);
    return items.length >= 2 && items.length <= 4 && items.every(s => s.length <= 90) ? items : null;
  }
  const REASONS = {
    step: 'Step needs a numbered label, such as Step 2 or Panel two, on at least two slides in order.',
    quote: 'Quote needs the headline or body to appear word for word in a cue the slide cites.',
    checklist: 'Checklist needs a body of two to four short sentences.',
    closing: 'Closing is for the last slide.'
  };
  function layoutOptions(slide, i, total, slides, pack) {
    const ok = {
      statement: true,
      step: stepNumber(slide) !== null && isSequence(slides),
      quote: quoteField(slide, pack) !== null,
      checklist: checklistItems(slide && slide.body) !== null,
      closing: total > 1 && i === total - 1
    };
    return LAYOUTS.map(l => ({id: l.id, label: l.label, allowed: ok[l.id], reason: ok[l.id] ? '' : REASONS[l.id]}));
  }
  function autoLayout(slide, i, total, slides, pack) {
    const opts = Object.fromEntries(layoutOptions(slide, i, total, slides, pack).map(o => [o.id, o.allowed]));
    if (opts.closing) return 'closing';
    if (i === 0) return 'statement';
    if (opts.step) return 'step';
    if (opts.quote) return 'quote';
    const items = checklistItems(slide && slide.body);
    if (items && items.length >= 3) return 'checklist';
    return 'statement';
  }
  // A requested layout the slide cannot honestly use falls back to Statement, with the reason.
  function plan(slide, i, total, slides, pack, requested) {
    const opts = layoutOptions(slide, i, total, slides, pack);
    const want = requested || autoLayout(slide, i, total, slides, pack);
    const o = opts.find(x => x.id === want);
    const layout = o && o.allowed ? want : 'statement';
    return {layout, requested: want, fallback: layout !== want ? o ? o.reason : 'Unknown layout.' : '', auto: !requested,
      step: layout === 'step' ? stepNumber(slide) : null, quote: layout === 'quote' ? quoteField(slide, pack) : null,
      items: layout === 'checklist' ? checklistItems(slide.body) : null};
  }

  /* ---------- drawing ---------- */
  function wrap(ctx, text, maxWidth) {
    const lines = []; let current = ''; lines.broke = false;
    for (const token of String(text).split(/\s+/).filter(Boolean)) {
      let rest = token;
      while (rest) {
        const trial = current ? current + ' ' + rest : rest;
        if (ctx.measureText(trial).width <= maxWidth) { current = trial; rest = ''; break; }
        if (current) { lines.push(current); current = ''; continue; }
        let n = 1;
        while (n < rest.length && ctx.measureText(rest.slice(0, n + 1)).width <= maxWidth) n++;
        lines.push(rest.slice(0, n)); rest = rest.slice(n); lines.broke = true;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
  // Largest size at which the text fits the line budget without splitting a word. A word is split
  // only at the smallest size, and only when it is longer than a whole line.
  const font = (weight, size) => weight + ' ' + size + 'px ' + SANS;
  function fit(ctx, text, maxWidth, maxLines, sizes, weight) {
    let lines = [], size = sizes[sizes.length - 1];
    for (const s of sizes) { ctx.font = font(weight, s); lines = wrap(ctx, text, maxWidth); size = s; if (lines.length <= maxLines && !lines.broke) break; }
    let clipped = false;
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines); clipped = true;
      let last = lines[maxLines - 1];
      while (last.length && ctx.measureText(last + '...').width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '...';
    }
    return {lines, size, clipped};
  }
  // Every line is recorded with its colour and what it sits on, so tests can check contrast and bounds,
  // and the PDF text layer and the text alternative always match the artwork.
  function put(ctx, out, lines, x, y, size, weight, color, bg, lineHeight, align) {
    ctx.font = font(weight, size); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      const width = ctx.measureText(line).width, left = align === 'right' ? x - width : x, base = y + i * lineHeight;
      ctx.fillText(line, left, base);
      out.runs.push({text: line, x: Math.round(left), y: Math.round(base), size, weight, width: Math.round(width), color, bg});
    });
    return y + lines.length * lineHeight;
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function shape(ctx, out, kind, x, y, w, h, color, bg, r) {
    ctx.fillStyle = color;
    if (r) { roundRect(ctx, x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h);
    out.shapes.push({kind, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color, bg});
  }
  // A tick drawn as a stroked path, not a character.
  function tick(ctx, out, x, y, s, color, bg) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(6, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s * 0.55); ctx.lineTo(x + s * 0.4, y + s * 0.85); ctx.lineTo(x + s * 0.95, y + s * 0.15); ctx.stroke();
    out.shapes.push({kind: 'tick', x: Math.round(x), y: Math.round(y), w: Math.round(s), h: Math.round(s), color, bg});
  }
  // An opening quotation mark built from two circles with tails, not a character.
  function quoteMark(ctx, out, x, y, s, color, bg) {
    ctx.fillStyle = color;
    for (const dx of [0, s * 0.62]) {
      const cx = x + dx + s * 0.22, cy = y + s * 0.62, r = s * 0.22;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx - r, y + s * 0.08, cx + r * 0.9, y); ctx.lineTo(cx + r * 0.95, y + s * 0.14);
      ctx.quadraticCurveTo(cx - r * 0.1, y + s * 0.22, cx + r * 0.2, cy - r * 0.6); ctx.closePath(); ctx.fill();
    }
    out.shapes.push({kind: 'quote', x: Math.round(x), y: Math.round(y), w: Math.round(s * 1.1), h: Math.round(s * 0.84), color, bg});
  }
  // Draws an image to fill a box, cropping the overflow from the middle.
  function cover(ctx, img, x, y, w, h) {
    const iw = img.width, ih = img.height, scale = Math.max(w / iw, h / ih), sw = w / scale, sh = h / scale;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }
  // Joint fit: the headline steps down a size until the body also fits in the room left.
  function fitPair(ctx, head, body, inner, room, headSizes, headLines, bodySizes, gap, headFirst) {
    // First try to keep the body at a comfortable size (46 or larger) and shrink the headline instead.
    // On a cover over a photo the headline comes first, so this step is skipped there.
    const comfortable = headFirst ? [] : bodySizes.filter(s => s >= 46);
    if (comfortable.length && comfortable.length < bodySizes.length) {
      for (const hs of headSizes) {
        const h = fit(ctx, head, inner, headLines, [hs], 800);
        if (h.clipped || h.lines.broke) continue;
        const headH = h.size * h.lines.length;
        for (const bs of comfortable) {
          const c = fit(ctx, body, inner, 99, [bs], 500), lh = Math.round(bs * 1.36);
          if (headH + gap + c.lines.length * lh <= room) return {h, b: c, bl: lh, clipped: false};
        }
      }
    }
    let h, b, bl, clipped = false;
    for (let k = 0; k < headSizes.length; k++) {
      h = fit(ctx, head, inner, headLines, [headSizes[k]], 800);
      if (h.lines.broke && k < headSizes.length - 1) continue;
      const headH = h.size + (h.lines.length - 1) * h.size;
      b = null;
      for (const bs of bodySizes) {
        const c = fit(ctx, body, inner, 99, [bs], 500), lh = Math.round(bs * 1.36);
        if (headH + gap + c.lines.length * lh <= room) { b = c; bl = lh; break; }
      }
      if (b && !h.clipped) return {h, b, bl, clipped: false};
      if (k === headSizes.length - 1) {
        clipped = h.clipped;
        const bs = bodySizes[bodySizes.length - 1]; bl = Math.round(bs * 1.36);
        if (!b) { b = fit(ctx, body, inner, Math.max(1, Math.floor((room - headH - gap) / bl)), [bs], 500); clipped = clipped || b.clipped; }
      }
    }
    return {h, b, bl, clipped};
  }

  // opts: {theme | palette, layout (requested), size, brand, cta, showSources, slides, pack, logo, photo}
  function renderSlide(canvas, slide, i, total, opts) {
    const o = opts || {}, sz = SIZES[o.size] || SIZES.portrait, H = sz.h, inner = W - M * 2;
    const out = {runs: [], shapes: []};
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const p = plan(slide, i, total, o.slides, o.pack, o.layout);
    const result = () => Object.assign(out.runs, {shapes: out.shapes, layout: p.layout, requested: p.requested, fallback: p.fallback, size: o.size === 'story' ? 'story' : 'portrait', clipped: out.clipped || false});
    if (!ctx) return result();
    const base = o.palette || palette(o.theme, o.brandColour);
    const photo = i === 0 && o.photo ? o.photo : null;
    // The cover and the closing slide sit on the accent colour, so the set has clear ends.
    const inverted = !photo && (p.layout === 'closing' || (i === 0 && total > 1 && p.layout === 'statement'));
    const fill = base.cover || base.accent, on = base.onCover || base.onAccent;
    const t = inverted ? {bg: fill, ink: on, soft: on, accent: on, mark: on} : base;
    const head = String(slide.headline || '').trim(), body = String(slide.body || '').trim(), label = String(slide.eyebrow || '').trim();
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
    let top = sz.top;
    if (photo) {
      // Cover photo: fills the slide; a solid panel carries all text, so contrast never depends on the picture.
      cover(ctx, photo, 0, 0, W, H);
      out.shapes.push({kind: 'photo', x: 0, y: 0, w: W, h: H});
      const panelTop = Math.round(H * 0.42);
      shape(ctx, out, 'panel', 0, panelTop, W, H - panelTop, t.bg, null, 0);
      shape(ctx, out, 'panel', M - 28, sz.run - 52, inner + 56, 104, t.bg, null, 18);
      top = panelTop + 80;
    }
    // Running head: the slide's label on the left, its place in the set on the right, a progress bar under both.
    const count = (i + 1) + ' / ' + total;
    ctx.font = font(700, 30); const countWidth = ctx.measureText(count).width;
    if (label) put(ctx, out, fit(ctx, label, inner - countWidth - 40, 1, [30], 700).lines, M, sz.run, 30, 700, t.soft, t.bg, 36);
    put(ctx, out, [count], W - M, sz.run, 30, 700, t.soft, t.bg, 36, 'right');
    const segGap = 8, seg = (inner - segGap * (total - 1)) / Math.max(1, total);
    for (let k = 0; k < total; k++) shape(ctx, out, 'progress', M + k * (seg + segGap), sz.run + (k === i ? 20 : 22), seg, k === i ? 8 : 4, k === i ? t.accent : t.soft, t.bg, 0);
    // Foot: the customer's logo and brand, and optionally where the slide's claims come from.
    let fx = M;
    if (o.logo && o.logo.width && o.logo.height) {
      const lh = 64, lw = Math.min(240, Math.round(lh * o.logo.width / o.logo.height)), lhh = Math.round(lw * o.logo.height / o.logo.width);
      ctx.drawImage(o.logo, M, sz.foot + 10 - lhh, lw, lhh);
      out.shapes.push({kind: 'logo', x: M, y: sz.foot + 10 - lhh, w: lw, h: lhh});
      fx = M + lw + 20;
    }
    const brand = String(o.brand || 'Your brand').slice(0, 90);
    const bf = fit(ctx, brand, inner * 0.56 - (fx - M), 1, [30, 26], 700);
    put(ctx, out, bf.lines, fx, sz.foot, bf.size, 700, t.ink, t.bg, 36);
    if (o.showSources && Array.isArray(slide.evidence_ids) && slide.evidence_ids.length) {
      put(ctx, out, fit(ctx, 'Source cues: ' + slide.evidence_ids.join(', '), inner * 0.4, 1, [24], 500).lines, W - M, sz.foot, 24, 500, t.soft, t.bg, 30, 'right');
    }
    const bottom = sz.footTop, story = o.size === 'story';
    // The call to action is drawn on the closing slide unless the headline already says it.
    const cta = p.layout === 'closing' && o.cta && !sameWords(head, o.cta) ? String(o.cta) : '';
    const reserve = cta ? 150 : 0;

    if (p.layout === 'step') {
      const n = String(p.step), ns = story ? 330 : 270;
      put(ctx, out, [n], M, top + Math.round(ns * 0.74), ns, 800, t.accent, t.bg, ns);
      const start = top + Math.round(ns * 0.74) + 70;
      const f = fitPair(ctx, head, body, inner, bottom - start, [112, 100, 88, 78, 68, 60, 52], 3, [54, 50, 46, 42, 38, 34], 80);
      put(ctx, out, f.h.lines, M, start + f.h.size, f.h.size, 800, t.ink, t.bg, f.h.size);
      const by = bottom - f.b.lines.length * f.bl + f.b.size;
      shape(ctx, out, 'mark', M, by - f.b.size - 34, 132, 12, t.mark, t.bg, 0);
      put(ctx, out, f.b.lines, M, by, f.b.size, 500, t.ink, t.bg, f.bl);
      out.clipped = f.clipped;
    } else if (p.layout === 'quote') {
      const quoted = p.quote === 'body' ? body : head, other = p.quote === 'body' ? head : body;
      quoteMark(ctx, out, M, top - 10, story ? 140 : 116, t.mark, t.bg);
      const start = top + (story ? 170 : 140);
      let q, s, sl, clipped = false;
      for (const qs of [148, 132, 120, 108, 96, 88, 78, 70, 62, 56, 50, 44]) {
        q = fit(ctx, quoted, inner, 9, [qs], 700);
        if (q.lines.broke && qs > 44) continue;
        const qh = q.size + (q.lines.length - 1) * Math.round(q.size * 1.12);
        s = null;
        for (const ss of [50, 46, 42, 38, 34, 30]) { const c = fit(ctx, other, inner, 4, [ss], 500); if (qh + 90 + c.lines.length * Math.round(ss * 1.36) <= bottom - start && !c.clipped) { s = c; sl = Math.round(ss * 1.36); break; } }
        if (s && !q.clipped) break;
        if (qs === 44) { clipped = q.clipped; if (!s) { s = fit(ctx, other, inner, 2, [30], 500); sl = Math.round(30 * 1.36); clipped = true; } }
      }
      put(ctx, out, q.lines, M, start + q.size, q.size, 700, t.ink, t.bg, Math.round(q.size * 1.12));
      const by = bottom - s.lines.length * sl + s.size;
      shape(ctx, out, 'mark', M, by - s.size - 30, 96, 8, t.mark, t.bg, 0);
      put(ctx, out, s.lines, M, by, s.size, 500, t.soft, t.bg, sl);
      out.clipped = clipped;
    } else if (p.layout === 'checklist') {
      const room = bottom - top;
      let h, items, ilh, isz, clipped = false;
      for (const hs of [120, 108, 96, 86, 76, 66, 58, 50]) {
        h = fit(ctx, head, inner, 3, [hs], 800);
        if (h.lines.broke && hs > 50) continue;
        const headH = h.size + (h.lines.length - 1) * h.size + 84;
        items = null;
        for (const is of [60, 54, 50, 46, 42, 38, 34, 30]) {
          const lh = Math.round(is * 1.3), fitted = p.items.map(it => fit(ctx, it, inner - 92, 3, [is], 500));
          const need = fitted.reduce((a, f) => a + f.lines.length * lh, 0) + (fitted.length - 1) * 30;
          if (headH + need <= room && fitted.every(f => !f.clipped)) { items = fitted; ilh = lh; isz = is; break; }
        }
        if (items && !h.clipped) break;
        if (hs === 50) { clipped = true; isz = 30; ilh = 39; items = p.items.map(it => fit(ctx, it, inner - 92, 1, [30], 500)); }
      }
      put(ctx, out, h.lines, M, top + h.size, h.size, 800, t.ink, t.bg, h.size);
      // Items sit on the same foot line as body text on the other slides.
      const listH = items.reduce((a, f) => a + f.lines.length * ilh, 0) + (items.length - 1) * 30;
      let y = Math.max(top + h.size * h.lines.length + 84, bottom - listH + isz);
      for (const f of items) {
        tick(ctx, out, M, y - isz * 0.9, Math.round(isz * 1.05), t.accent, t.bg);
        y = put(ctx, out, f.lines, M + 92, y, isz, 500, t.ink, t.bg, ilh) + 30;
      }
      out.clipped = clipped;
    } else {
      // Statement, cover and closing: headline at the top, body on a shared baseline at the foot.
      // The headline takes the largest size that still leaves room for the body, so the slide reads as full, not empty.
      const sizes = (story ? [184, 168] : []).concat([156, 144, 132, 120, 110, 100, 90, 80, 72, 64]);
      const f = fitPair(ctx, head, body, inner, bottom - reserve - top, sizes, 5, [54, 50, 46, 42, 38, 34], photo ? 64 : 96, Boolean(photo));
      put(ctx, out, f.h.lines, M, top + f.h.size, f.h.size, 800, t.ink, t.bg, f.h.size);
      const by = Math.max(top + f.h.size + (f.h.lines.length - 1) * f.h.size + 96 + f.b.size, bottom - reserve - f.b.lines.length * f.bl + f.b.size);
      shape(ctx, out, 'mark', M, by - f.b.size - 34, 132, 12, t.mark, t.bg, 0);
      put(ctx, out, f.b.lines, M, by, f.b.size, 500, t.ink, t.bg, f.bl);
      out.clipped = f.clipped;
      if (cta) {
        const c = fit(ctx, cta, inner - 72, 1, [40, 36, 32, 28], 700);
        ctx.font = font(700, c.size); const cw = ctx.measureText(c.lines[0]).width + 72;
        shape(ctx, out, 'cta', M, bottom - 112, cw, 88, t.ink, t.bg, 10);
        put(ctx, out, c.lines, M + 36, bottom - 54, c.size, 700, t.bg, t.ink, 44);
        out.clipped = out.clipped || c.clipped;
      }
    }
    return result();
  }
  const sameWords = (a, b) => { const x = words(a); return x.length > 0 && x === words(b); };

  return {W, M, SIZES, THEMES, LAYOUTS, SANS, normalizeHex, contrast, luminance, deriveTheme, palette, ensure,
    stepNumber, isSequence, quoteField, checklistItems, layoutOptions, autoLayout, plan, renderSlide};
});
