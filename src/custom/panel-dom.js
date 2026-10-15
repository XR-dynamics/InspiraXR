/*
 * Desktop renderer for the customisation schema (see Customiser.getSchema). Pure DOM, no
 * framework, matching the rest of the interface. Colour dragging does not re-render, so the
 * native picker keeps focus while its value streams in.
 */
const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class DomPanel {
  constructor(root, ctrl) {
    this.root = root;
    this.ctrl = ctrl;
    this.off = [
      ctrl.on('schema', () => this.render()),
      ctrl.on('open', () => this.show(true)),
      ctrl.on('close', () => this.show(false)),
    ];
    this.show(false);
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
    this.root.setAttribute('aria-hidden', String(!on));
    if (on) this.render();
  }

  dispose() { this.off.forEach((f) => f()); this.root.replaceChildren(); }

  render() {
    if (this.root.classList.contains('hidden')) return;
    const schema = this.ctrl.getSchema();
    const prev = this.root.querySelector('.cp-body');
    const scroll = prev ? prev.scrollTop : 0;

    const head = h('header', 'cp-head');
    const titles = h('div', 'cp-titles');
    titles.append(h('div', 'cp-title', schema.title), h('div', 'cp-sub', schema.subtitle));
    const close = h('button', 'cp-close', 'Close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close customise panel');
    close.addEventListener('click', () => this.ctrl.close());
    head.append(titles, close);

    const tabs = h('nav', 'cp-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const t of schema.tabs) {
      const b = h('button', `cp-tab${t.id === schema.tab ? ' on' : ''}`, t.label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.id === schema.tab));
      b.addEventListener('click', () => this.ctrl.setTab(t.id));
      tabs.append(b);
    }

    const body = h('div', 'cp-body');
    for (const w of schema.body) body.append(this.widget(w));
    if (schema.note) body.append(h('p', 'cp-note', schema.note));

    this.root.replaceChildren(head, tabs, body);
    body.scrollTop = scroll;
  }

  widget(w) {
    switch (w.t) {
      case 'heading': return h('h3', 'cp-h', w.text);
      case 'text': return h('p', `cp-t ${w.style || ''}`, w.text);
      case 'swatches': {
        const grid = h('div', 'cp-swatches');
        for (const it of w.items) {
          const b = h('button', `cp-sw${it.id === w.value ? ' on' : ''}`);
          b.type = 'button';
          b.style.background = it.color;
          b.title = it.label;
          b.setAttribute('aria-label', it.label);
          b.addEventListener('click', () => w.onPick(it.id));
          grid.append(b);
        }
        return grid;
      }
      case 'color': {
        const row = h('label', 'cp-color');
        const input = h('input');
        input.type = 'color';
        input.value = w.hex;
        input.addEventListener('input', () => { code.textContent = input.value; w.onChange(input.value, false); });
        input.addEventListener('change', () => w.onChange(input.value, true));
        const code = h('span', 'cp-hex', w.hex);
        row.append(h('span', null, 'Custom colour'), input, code);
        return row;
      }
      case 'buttons': {
        const row = h('div', 'cp-row');
        for (const it of w.items) {
          const b = h('button', `cp-btn ${it.kind || ''}`, it.label);
          b.type = 'button';
          b.disabled = !!it.disabled;
          b.addEventListener('click', it.onClick);
          row.append(b);
        }
        return row;
      }
      case 'presets': {
        const list = h('div', 'cp-presets');
        for (const it of w.items) {
          const b = h('button', `cp-preset${it.id === w.value ? ' on' : ''}`);
          b.type = 'button';
          const sw = h('span', 'cp-psw');
          sw.style.background = `linear-gradient(180deg, ${it.swatch[0]} 0%, ${it.swatch[1]} 58%, ${it.swatch[2]} 100%)`;
          b.append(sw, h('span', 'cp-pname', it.name));
          b.addEventListener('click', () => w.onPick(it.id));
          list.append(b);
        }
        return list;
      }
      case 'toggle': {
        const b = h('button', `cp-toggle${w.value ? ' on' : ''}`);
        b.type = 'button';
        b.setAttribute('role', 'switch');
        b.setAttribute('aria-checked', String(!!w.value));
        b.append(h('span', 'cp-knob'), h('span', null, w.label));
        b.addEventListener('click', w.onChange);
        return b;
      }
      case 'list': {
        const list = h('div', 'cp-list');
        for (const it of w.items) {
          const b = h('button', 'cp-item', it.label);
          b.type = 'button';
          b.addEventListener('click', () => w.onPick(it.id));
          list.append(b);
        }
        return list;
      }
      case 'dialog': {
        const d = h('div', 'cp-dialog');
        d.setAttribute('role', 'alertdialog');
        d.append(h('h3', 'cp-h', w.title), h('p', 'cp-t', w.text));
        const row = h('div', 'cp-row');
        for (const it of w.buttons) {
          const b = h('button', `cp-btn ${it.kind || ''}`, it.label);
          b.type = 'button';
          b.addEventListener('click', it.onClick);
          row.append(b);
        }
        d.append(row);
        return d;
      }
      default: return h('div');
    }
  }
}
