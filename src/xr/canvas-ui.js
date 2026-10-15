import * as THREE from 'three';

/*
 * In-headset UI. A CanvasPanel draws a list of widgets into a canvas, maps that canvas onto a
 * plane in the world and answers controller-ray hit tests. layoutSchema() turns the
 * customisation schema (the same one the desktop DOM panel renders) into drawable widgets, so
 * both surfaces always offer identical controls.
 *
 * Activation is "press and release on the same control", which makes accidental selections
 * (a brushed trigger while sweeping the ray) harmless.
 */

export const PANEL_W = 1280;
export const PANEL_H = 960;
const M = 40;

const COL = {
  bg: 'rgba(12,12,14,0.95)', edge: 'rgba(255,255,255,0.14)', text: '#f2eee8', muted: 'rgba(242,238,232,0.66)',
  faint: 'rgba(242,238,232,0.36)', line: 'rgba(242,238,232,0.2)', accent: '#c9a46a', amber: '#ffc27d', teal: '#5fe3d0',
  danger: '#ff6b5b', hover: 'rgba(242,238,232,0.14)', press: 'rgba(242,238,232,0.26)',
};
const SANS = '"Jost", system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';

// ------------------------------------------------------------------------ layout
function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function hslOf(hex) {
  const c = new THREE.Color(hex);
  const o = { h: 0, s: 0, l: 0 };
  c.getHSL(o, THREE.SRGBColorSpace);
  return o;
}
function hexOfHsl(h, s, l) {
  return `#${new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace)}`;
}

/** Turn a schema into drawable, hit-testable items. `measure` is a 2D context used for text wrapping. */
export function layoutSchema(schema, measure, handlers) {
  const items = [];
  const push = (it) => { items.push(it); return it; };
  push({ t: 'title', x: M, y: 74, text: schema.title });
  push({ t: 'sub', x: M, y: 118, text: schema.subtitle });
  push({ t: 'button', key: 'close', rect: [PANEL_W - M - 210, 28, 210, 74], label: 'Close', kind: 'ghost', onClick: handlers.onClose });

  const tabW = (PANEL_W - M * 2) / schema.tabs.length;
  schema.tabs.forEach((tab, i) => push({
    t: 'tab', key: `tab.${tab.id}`, rect: [M + i * tabW, 150, tabW, 72], label: tab.label, on: tab.id === schema.tab,
    onClick: () => handlers.onTab(tab.id),
  }));

  let y = 252;
  measure.font = `300 30px ${SANS}`;
  schema.body.forEach((w, wi) => {
    const k = (s) => `w${wi}.${s}`;
    switch (w.t) {
      case 'heading':
        push({ t: 'heading', x: M, y: y + 34, text: w.text });
        y += 66;
        break;
      case 'text': {
        measure.font = `300 30px ${SANS}`;
        const lines = wrap(measure, w.text, PANEL_W - M * 2);
        lines.forEach((ln, i) => push({ t: 'text', x: M, y: y + 28 + i * 40, text: ln, style: w.style }));
        y += lines.length * 40 + 16;
        break;
      }
      case 'swatches': {
        const n = w.items.length;
        const size = Math.min(96, Math.floor((PANEL_W - M * 2 - (n - 1) * 14) / n));
        w.items.forEach((it, i) => push({
          t: 'swatch', key: k(`s${i}`), rect: [M + i * (size + 14), y, size, size], color: it.color, on: it.id === w.value,
          label: it.label, onClick: () => w.onPick(it.id),
        }));
        y += size + 28;
        break;
      }
      case 'color': {
        const hsl = hslOf(w.hex);
        const rows = [
          ['Hue', hsl.h, (v) => hexOfHsl(v, Math.max(hsl.s, 0.05), hsl.l || 0.5), 'hue'],
          ['Saturation', hsl.s, (v) => hexOfHsl(hsl.h, v, hsl.l), 'sat'],
          ['Lightness', hsl.l, (v) => hexOfHsl(hsl.h, hsl.s, v), 'lum'],
        ];
        rows.forEach(([label, value, make, kind], i) => {
          const ry = y + i * 74;
          push({ t: 'text', x: M, y: ry + 44, text: label, style: 'muted' });
          push({
            t: 'slider', key: k(`sl${i}`), rect: [M + 250, ry + 8, PANEL_W - M * 2 - 250 - 150, 56], value, kind, hsl,
            onChange: (v, commit) => w.onChange(make(v), commit),
          });
        });
        push({ t: 'chip', rect: [PANEL_W - M - 120, y + 8, 120, 56], color: w.hex });
        y += 3 * 74 + 14;
        break;
      }
      case 'buttons': {
        const n = w.items.length;
        const gap = 20;
        const bw = (PANEL_W - M * 2 - gap * (n - 1)) / n;
        w.items.forEach((it, i) => push({
          t: 'button', key: k(`b${i}`), rect: [M + i * (bw + gap), y, bw, 80], label: it.label, kind: it.kind, disabled: it.disabled,
          onClick: it.onClick,
        }));
        y += 80 + 22;
        break;
      }
      case 'presets':
        w.items.forEach((it, i) => push({
          t: 'preset', key: k(`p${i}`), rect: [M, y + i * 92, PANEL_W - M * 2, 82], name: it.name, swatch: it.swatch, on: it.id === w.value,
          onClick: () => w.onPick(it.id),
        }));
        y += w.items.length * 92 + 14;
        break;
      case 'toggle':
        push({ t: 'toggle', key: k('t'), rect: [M, y, PANEL_W - M * 2, 74], label: w.label, on: !!w.value, onClick: w.onChange });
        y += 74 + 14;
        break;
      case 'list':
        w.items.forEach((it, i) => push({
          t: 'button', key: k(`l${i}`), rect: [M + (i % 2) * ((PANEL_W - M * 2) / 2 + 10), y + Math.floor(i / 2) * 84, (PANEL_W - M * 2) / 2 - 10, 72],
          label: it.label, kind: 'list', onClick: () => w.onPick(it.id),
        }));
        y += Math.ceil(w.items.length / 2) * 84 + 8;
        break;
      case 'dialog': {
        const x0 = M, w0 = PANEL_W - M * 2;
        measure.font = `300 32px ${SANS}`;
        const lines = wrap(measure, w.text, w0 - 80);
        const h = 150 + lines.length * 44 + 110;
        push({ t: 'card', rect: [x0, y, w0, h] });
        push({ t: 'heading', x: x0 + 40, y: y + 80, text: w.title });
        lines.forEach((ln, i) => push({ t: 'text', x: x0 + 40, y: y + 140 + i * 44, text: ln, style: 'normal', big: true }));
        const n = w.buttons.length, gap = 24, bw = (w0 - 80 - gap * (n - 1)) / n;
        w.buttons.forEach((it, i) => push({
          t: 'button', key: k(`d${i}`), rect: [x0 + 40 + i * (bw + gap), y + h - 108, bw, 84], label: it.label, kind: it.kind, onClick: it.onClick,
        }));
        y += h + 20;
        break;
      }
      default: break;
    }
  });
  if (schema.note) push({ t: 'note', x: M, y: PANEL_H - 30, text: schema.note });
  return items;
}

// ---------------------------------------------------------------------- drawing
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spaced(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; }

function draw(ctx, items, state) {
  ctx.clearRect(0, 0, PANEL_W, PANEL_H);
  rr(ctx, 6, 6, PANEL_W - 12, PANEL_H - 12, 44);
  ctx.fillStyle = COL.bg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COL.edge; ctx.stroke();

  for (const it of items) {
    const hov = state.hoverSet?.has(it.key), prs = state.pressed === it.key;
    ctx.textBaseline = 'alphabetic';
    switch (it.t) {
      case 'title':
        ctx.fillStyle = COL.text; ctx.font = `300 66px ${SERIF}`; spaced(ctx, 0); ctx.fillText(it.text, it.x, it.y);
        break;
      case 'sub':
        ctx.fillStyle = COL.amber; ctx.font = `400 26px ${SANS}`; spaced(ctx, 4); ctx.fillText(String(it.text).toUpperCase(), it.x, it.y); spaced(ctx, 0);
        break;
      case 'heading':
        ctx.fillStyle = COL.text; ctx.font = `400 42px ${SERIF}`; spaced(ctx, 0); ctx.fillText(it.text, it.x, it.y);
        break;
      case 'text':
        ctx.fillStyle = it.style === 'accent' ? COL.teal : it.style === 'normal' ? COL.text : COL.muted;
        ctx.font = `300 ${it.big ? 32 : 30}px ${SANS}`; spaced(ctx, 0); ctx.fillText(it.text, it.x, it.y);
        break;
      case 'note':
        ctx.fillStyle = COL.accent; ctx.font = `italic 400 32px ${SERIF}`; spaced(ctx, 0); ctx.fillText(it.text, it.x, it.y);
        break;
      case 'tab': {
        const [x, y, w, h] = it.rect;
        if (hov) { rr(ctx, x + 6, y + 6, w - 12, h - 12, 16); ctx.fillStyle = COL.hover; ctx.fill(); }
        ctx.fillStyle = it.on ? COL.text : COL.faint; ctx.font = `400 27px ${SANS}`; spaced(ctx, 4); ctx.textAlign = 'center';
        ctx.fillText(it.label.toUpperCase(), x + w / 2 + 2, y + h / 2 + 10);
        ctx.textAlign = 'left'; spaced(ctx, 0);
        ctx.fillStyle = it.on ? COL.accent : COL.line; ctx.fillRect(x + 10, y + h - 4, w - 20, it.on ? 4 : 2);
        break;
      }
      case 'button': {
        const [x, y, w, h] = it.rect;
        rr(ctx, x, y, w, h, 20);
        const base = it.kind === 'primary' ? 'rgba(201,164,106,0.22)' : it.kind === 'danger' ? 'rgba(255,107,91,0.10)' : 'rgba(242,238,232,0.04)';
        ctx.fillStyle = it.disabled ? 'rgba(242,238,232,0.02)' : prs ? COL.press : hov ? COL.hover : base; ctx.fill();
        ctx.lineWidth = hov && !it.disabled ? 4 : 2;
        ctx.strokeStyle = it.disabled ? 'rgba(242,238,232,0.1)' : it.kind === 'danger' ? 'rgba(255,107,91,0.7)' : it.kind === 'primary' ? COL.accent : COL.line;
        ctx.stroke();
        ctx.fillStyle = it.disabled ? COL.faint : it.kind === 'danger' ? '#ffb3a8' : COL.text;
        ctx.font = `400 ${it.kind === 'list' ? 30 : 31}px ${SANS}`; ctx.textAlign = it.kind === 'list' ? 'left' : 'center';
        const tx = it.kind === 'list' ? x + 26 : x + w / 2;
        let label = it.label;
        while (ctx.measureText(label).width > w - 40 && label.length > 4) label = `${label.slice(0, -2)}…`;
        ctx.fillText(label, tx, y + h / 2 + 11); ctx.textAlign = 'left';
        break;
      }
      case 'swatch': {
        const [x, y, w] = it.rect;
        ctx.beginPath(); ctx.arc(x + w / 2, y + w / 2, w / 2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = it.color; ctx.fill();
        ctx.lineWidth = hov ? 6 : 3; ctx.strokeStyle = it.on ? '#fff' : hov ? COL.amber : 'rgba(255,255,255,0.28)'; ctx.stroke();
        if (it.on) { ctx.beginPath(); ctx.arc(x + w / 2, y + w / 2, w / 2 + 8, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); }
        if (hov) { ctx.fillStyle = COL.muted; ctx.font = `300 26px ${SANS}`; ctx.fillText(it.label, 40, y + w + 30); }
        break;
      }
      case 'slider': {
        const [x, y, w, h] = it.rect;
        rr(ctx, x, y + h / 2 - 14, w, 28, 14);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        if (it.kind === 'hue') for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, hexOfHsl(i / 12, 0.7, 0.55));
        else if (it.kind === 'sat') { g.addColorStop(0, hexOfHsl(it.hsl.h, 0, it.hsl.l)); g.addColorStop(1, hexOfHsl(it.hsl.h, 1, it.hsl.l)); }
        else { g.addColorStop(0, '#000'); g.addColorStop(0.5, hexOfHsl(it.hsl.h, it.hsl.s, 0.5)); g.addColorStop(1, '#fff'); }
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = COL.line; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + it.value * w, y + h / 2, hov || prs ? 30 : 26, 0, Math.PI * 2);
        ctx.fillStyle = '#f2eee8'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
        break;
      }
      case 'chip': {
        const [x, y, w, h] = it.rect;
        rr(ctx, x, y, w, h, 14); ctx.fillStyle = it.color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
        break;
      }
      case 'preset': {
        const [x, y, w, h] = it.rect;
        rr(ctx, x, y, w, h, 20);
        ctx.fillStyle = prs ? COL.press : hov ? COL.hover : it.on ? 'rgba(201,164,106,0.16)' : 'rgba(242,238,232,0.03)'; ctx.fill();
        ctx.lineWidth = it.on ? 4 : hov ? 4 : 2; ctx.strokeStyle = it.on ? COL.accent : hov ? COL.amber : COL.line; ctx.stroke();
        const g = ctx.createLinearGradient(0, y + 12, 0, y + h - 12);
        g.addColorStop(0, it.swatch[0]); g.addColorStop(0.58, it.swatch[1]); g.addColorStop(1, it.swatch[2]);
        rr(ctx, x + 18, y + 13, 130, h - 26, 12); ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = COL.text; ctx.font = `400 34px ${SANS}`; ctx.fillText(it.name, x + 176, y + h / 2 + 12);
        if (it.on) { ctx.fillStyle = COL.accent; ctx.font = `400 24px ${SANS}`; spaced(ctx, 3); ctx.textAlign = 'right'; ctx.fillText('ACTIVE', x + w - 30, y + h / 2 + 9); ctx.textAlign = 'left'; spaced(ctx, 0); }
        break;
      }
      case 'toggle': {
        const [x, y, w, h] = it.rect;
        rr(ctx, x, y, w, h, 20); ctx.fillStyle = hov ? COL.hover : 'rgba(242,238,232,0.03)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.line; ctx.stroke();
        rr(ctx, x + 24, y + h / 2 - 20, 84, 40, 20); ctx.fillStyle = it.on ? COL.accent : 'rgba(242,238,232,0.2)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x + 24 + (it.on ? 64 : 20), y + h / 2, 15, 0, Math.PI * 2); ctx.fillStyle = '#f2eee8'; ctx.fill();
        ctx.fillStyle = COL.text; ctx.font = `300 31px ${SANS}`; ctx.fillText(it.label, x + 134, y + h / 2 + 11);
        break;
      }
      case 'card': {
        const [x, y, w, h] = it.rect;
        rr(ctx, x, y, w, h, 28); ctx.fillStyle = 'rgba(255,107,91,0.07)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,107,91,0.5)'; ctx.stroke();
        break;
      }
      default: break;
    }
  }
}

// ------------------------------------------------------------------------ panel
export class CanvasPanel {
  /**
   * @param {object} o
   * @param {[number, number]} o.meters  physical size of the plane in metres
   * @param {[number, number]} [o.px]    canvas size in pixels
   * @param {() => any[]} o.layout       returns the items for the current content
   * @param {THREE.WebGLRenderer} o.renderer
   */
  constructor({ meters, px = [PANEL_W, PANEL_H], layout, renderer, drawFn = draw }) {
    this.px = px;
    this.layoutFn = layout;
    this.drawFn = drawFn;
    this.canvas = document.createElement('canvas');
    this.canvas.width = px[0]; this.canvas.height = px[1];
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(meters[0], meters[1]),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, depthWrite: false }),
    );
    this.mesh.renderOrder = 30;
    this.mesh.visible = false;
    this.mesh.userData.noAO = true;
    this.mesh.userData.uiPanel = this;
    this.items = [];
    this.hover = new Map();     // owner -> key
    this.pressed = null;        // { owner, key, item }
    this.dirty = true;
    this.plane = new THREE.Plane();
    // redraw once fonts arrive so text never stays in the fallback face
    document.fonts?.load(`300 30px Jost`).then(() => { this.dirty = true; }).catch(() => {});
    document.fonts?.load(`300 30px "Cormorant Garamond"`).then(() => { this.dirty = true; }).catch(() => {});
  }

  get visible() { return this.mesh.visible; }
  set visible(v) { this.mesh.visible = v; if (v) this.dirty = true; }

  invalidate() { this.dirty = true; }

  /** Re-layout and redraw if anything changed. Call once per frame while visible. */
  update(force = false) {
    if (!this.mesh.visible || (!this.dirty && !force)) return;
    this.items = this.layoutFn(this.ctx);
    const hoverKeys = new Set(this.hover.values());
    this.drawFn(this.ctx, this.items, { hover: [...hoverKeys][0] ?? null, hoverSet: hoverKeys, pressed: this.pressed?.key ?? null });
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  /** Canvas pixel for a world point on the panel plane (extends past the edges so drags can overshoot). */
  pixelAt(worldPoint) {
    const p = this.mesh.worldToLocal(worldPoint.clone());
    const g = this.mesh.geometry.parameters;
    return [(p.x / g.width + 0.5) * this.px[0], (0.5 - p.y / g.height) * this.px[1]];
  }

  _hit(x, y) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.rect || !it.key) continue;
      const [rx, ry, rw, rh] = it.rect;
      const pad = it.t === 'slider' ? 22 : 0;
      if (x >= rx && x <= rx + rw && y >= ry - pad && y <= ry + rh + pad) return it;
    }
    return null;
  }

  /** Pointer moved over the panel (px = null when it left). Returns the item under it. */
  move(owner, px) {
    let it = null;
    if (px) it = this.pressed && this.pressed.owner === owner && this.pressed.item.t === 'slider' ? this.pressed.item : this._hit(px[0], px[1]);
    const key = it?.key ?? null;
    if (this.hover.get(owner) !== key) { if (key) this.hover.set(owner, key); else this.hover.delete(owner); this.dirty = true; }
    if (this.pressed && this.pressed.owner === owner && this.pressed.item.t === 'slider' && px) this._slide(this.pressed.item, px[0], false);
    return it && !it.disabled ? it : null;
  }

  _slide(it, x, commit) {
    if (this.pressed) this.pressed.lastX = x;
    const [rx, , rw] = it.rect;
    it.onChange(Math.max(0, Math.min(1, (x - rx) / rw)), commit);
    this.dirty = true;
  }

  down(owner, px) {
    const it = px ? this._hit(px[0], px[1]) : null;
    if (!it || it.disabled) return false;
    this.pressed = { owner, key: it.key, item: it };
    if (it.t === 'slider') this._slide(it, px[0], false);
    this.dirty = true;
    return true;
  }

  up(owner, px) {
    const p = this.pressed;
    if (!p || p.owner !== owner) return false;
    this.pressed = null;
    this.dirty = true;
    if (p.item.t === 'slider') { this._slide(p.item, px ? px[0] : p.lastX ?? p.item.rect[0], true); return true; }
    const it = px ? this._hit(px[0], px[1]) : null;
    if (it && it.key === p.key) it.onClick?.();
    return true;
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ----------------------------------------------------- small contextual panels
const SMALL_PX = [640, 200];

function drawSmall(ctx, items, state) {
  const CW = ctx.canvas.width, CH = ctx.canvas.height;
  ctx.clearRect(0, 0, CW, CH);
  for (const it of items) {
    const hov = state.hoverSet?.has(it.key), prs = state.pressed === it.key;
    if (it.t === 'plate') {
      rr(ctx, 4, 4, CW - 8, CH - 8, 56);
      ctx.fillStyle = 'rgba(12,12,14,0.92)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = it.edge; ctx.stroke();
    } else if (it.t === 'smallbutton') {
      const [x, y, w, h] = it.rect;
      rr(ctx, x, y, w, h, 40);
      ctx.fillStyle = prs ? COL.press : hov ? it.hoverFill : it.fill; ctx.fill();
      ctx.lineWidth = hov ? 6 : 3; ctx.strokeStyle = hov ? it.hoverEdge : it.edge; ctx.stroke();
      ctx.fillStyle = COL.text; ctx.textAlign = 'center';
      if (it.sub) {
        ctx.font = `400 50px ${SANS}`; spaced(ctx, 1); ctx.fillText(it.label, x + w / 2, y + h / 2 - 2);
        ctx.fillStyle = COL.muted; ctx.font = `300 30px ${SERIF}`; spaced(ctx, 0); ctx.fillText(it.sub, x + w / 2, y + h / 2 + 40);
      } else { ctx.font = `400 42px ${SANS}`; spaced(ctx, 1); ctx.fillText(it.label, x + w / 2, y + h / 2 + 15); }
      ctx.textAlign = 'left'; spaced(ctx, 0);
    }
  }
}

/** "Trigger — Customise" prompt that floats beside a targeted wall. */
export function makePrompt(renderer, getLabel, onActivate) {
  return new CanvasPanel({
    meters: [0.46, 0.144], px: SMALL_PX, renderer, drawFn: drawSmall,
    layout: () => [
      { t: 'plate', edge: 'rgba(255,194,125,0.55)' },
      { t: 'smallbutton', key: 'go', rect: [22, 22, SMALL_PX[0] - 44, SMALL_PX[1] - 44], label: 'Trigger — Customise', sub: getLabel(),
        fill: 'rgba(255,194,125,0.14)', hoverFill: 'rgba(255,194,125,0.3)', edge: 'rgba(255,194,125,0.5)', hoverEdge: '#ffc27d', onClick: onActivate },
    ],
  });
}

/** Always-available controller menu: Customise + Exit VR. Sits on top of the left controller. */
export function makeToolbar(renderer, { onHome, onBlueprint, blueprintOn = () => false, hasBlueprint = false, onCustomise, onExit }) {
  const TB = [640, 340];
  const quiet = { fill: 'rgba(242,238,232,0.06)', hoverFill: COL.hover, edge: COL.line, hoverEdge: COL.amber };
  const panel = new CanvasPanel({
    meters: [0.30, 0.159], px: TB, renderer, drawFn: drawSmall,
    layout: () => {
      const on = hasBlueprint && blueprintOn();
      const items = [
        { t: 'plate', edge: 'rgba(255,255,255,0.28)' },
        { t: 'smallbutton', key: 'home', rect: [18, 18, 296, 134], label: 'Home', ...quiet, onClick: onHome },
        hasBlueprint
          ? { t: 'smallbutton', key: 'bp', rect: [326, 18, 296, 134], label: on ? 'Blueprint: on' : 'Blueprint',
            fill: on ? 'rgba(40,160,255,0.28)' : 'rgba(40,160,255,0.08)', hoverFill: 'rgba(40,160,255,0.4)', edge: 'rgba(80,190,255,0.7)', hoverEdge: '#8fd8ff', onClick: onBlueprint }
          : { t: 'smallbutton', key: 'cust', rect: [326, 18, 296, 134], label: 'Customise', ...quiet, onClick: onCustomise },
        hasBlueprint ? { t: 'smallbutton', key: 'cust', rect: [18, 188, 296, 134], label: 'Customise', ...quiet, onClick: onCustomise } : null,
        { t: 'smallbutton', key: 'exit', rect: hasBlueprint ? [326, 188, 296, 134] : [18, 188, 604, 134], label: 'Exit VR', fill: 'rgba(255,107,91,0.14)', hoverFill: 'rgba(255,107,91,0.32)', edge: 'rgba(255,107,91,0.6)', hoverEdge: '#ff8f80', onClick: onExit },
      ];
      return items.filter(Boolean);
    },
  });
  // It rides on a hand-held controller, so it can be approached from any angle: keep it pointable
  // (and visible) from both sides rather than relying on one exact orientation.
  panel.mesh.material.side = THREE.DoubleSide;
  return panel;
}

/** The full customisation panel, drawn from the controller's schema. */
export function makeMainPanel(renderer, custom) {
  return new CanvasPanel({
    meters: [1.2, 0.9], renderer,
    layout: (ctx) => layoutSchema(custom.getSchema(), ctx, { onClose: () => custom.close(), onTab: (id) => custom.setTab(id) }),
  });
}
