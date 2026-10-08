import * as THREE from 'three';
import { DOORS, CURTAIN, H } from './layout.js';
import { roundedBox, projectUV, easeInOut, CLONES } from './util.js';

/*
 * Interactive elements: hinged + pivot doors, the lift-and-slide terrace door,
 * motorised curtains, wall light switches and material (finish) variants.
 * Everything animates with slow architectural easing.
 */

export class Interactions {
  constructor(ctx) {
    this.ctx = ctx;
    this.items = [];      // { object, label(), action() }
    this.targets = [];    // meshes for raycasting
    this.doors = new Map();
    this.anims = [];
  }

  add(object, def) {
    const item = { object, ...def };
    this.items.push(item);
    object.traverse((o) => { if (o.isMesh) { o.userData.interactive = item; this.targets.push(o); } });
    return item;
  }

  /** Material variant cycling on click. */
  material(meshes, key) {
    const { M } = this.ctx;
    const variants = M.variants[key];
    let idx = 0;
    const apply = () => {
      const v = variants[idx];
      if (key === 'sofa') [M.boucle, ...(CLONES.get(M.boucle) || [])].forEach((m) => m.color.set(v.color));
      if (key === 'island') {
        const t = M.textures[v.key];
        for (const mat of [this.ctx.islandMat, ...(CLONES.get(this.ctx.islandMat) || [])]) {
          mat.map = t.map; mat.normalMap = t.normal; mat.roughnessMap = t.orm; mat.needsUpdate = true;
        }
      }
      if (key === 'wood') { M.walnut.color.set(v.color); }
    };
    for (const m of meshes) {
      this.add(m, {
        label: () => `${variants[idx].name}  ·  change finish`,
        action: () => { idx = (idx + 1) % variants.length; apply(); this.ctx.toast?.(variants[idx].name); this.ctx.lighting.envDirty = true; },
        kind: 'material',
      });
    }
  }

  update(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t = Math.min(1, a.t + dt / a.dur);
      a.fn(easeInOut(a.t));
      if (a.t >= 1) { this.anims.splice(i, 1); a.done?.(); }
    }
  }

  animate(dur, fn, done) {
    this.anims.push({ t: 0, dur, fn, done });
  }

  // --------------------------------------------------------------- doors
  buildDoors() {
    const { M, scene, nav } = this.ctx;
    let navId = 0;
    nav.doorIsLeaf = (id) => id % 2 === 0;
    for (const d of DOORS) {
      const w = d.to - d.from;
      const th = d.pivot ? 0.08 : 0.05;
      const pivotOffset = d.pivot ? w * 0.22 : 0;
      const hingeAtTo = d.hingeAt === 'to';
      const hinge = d.pivot ? d.from + pivotOffset : (hingeAtTo ? d.to : d.from);
      const group = new THREE.Group();
      if (d.wall === 'x') group.position.set(hinge, 0, d.at);
      else group.position.set(d.at, 0, hinge);
      const leafMat = d.pivot ? M.walnutDark : M.walnut;
      const lw = w - 0.01;
      const leafGeo = roundedBox(lw, d.height - 0.012, th, 0.004, 2);
      projectUV(leafGeo);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.castShadow = true; leaf.receiveShadow = true;
      // leaf extends along local +x (or -x for hinges at 'to'); pivot doors straddle
      let cx = hingeAtTo ? -lw / 2 : lw / 2;
      if (d.pivot) cx = lw / 2 - pivotOffset;
      leaf.position.set(cx, (d.height - 0.012) / 2 + 0.006, 0);
      group.add(leaf);
      // pull handles on both faces near the free edge
      const free = d.pivot ? lw - pivotOffset - 0.18 : (hingeAtTo ? -lw + 0.09 : lw - 0.09);
      const hl = d.pivot ? 1.6 : 0.42;
      for (const s of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, hl, 16), d.pivot ? M.brass : M.blackAlu);
        bar.position.set(free, d.pivot ? 1.45 : 1.05, s * (th / 2 + 0.045));
        bar.castShadow = true;
        group.add(bar);
        for (const e of [-1, 1]) {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 8).rotateX(Math.PI / 2), bar.material);
          st.position.set(free, bar.position.y + e * hl * 0.38, s * (th / 2 + 0.022));
          group.add(st);
        }
      }
      if (d.wall === 'z') group.rotation.y = -Math.PI / 2;
      scene.add(group);

      // opening angle (see layout.js for the conventions)
      let openAngle;
      if (d.wall === 'x') openAngle = (hingeAtTo ? 1 : -1) * d.swing * (Math.PI / 2) * 0.96;
      else openAngle = (hingeAtTo ? -1 : 1) * d.swing * (Math.PI / 2) * 0.96;
      const baseRot = group.rotation.y;

      // nav regions: closed footprint, and the swept leaf when open
      const closedId = navId++, openId = navId++;
      const t = 0.14;
      if (d.wall === 'x') {
        nav.registerDoor(closedId, d.from, d.at - t, d.to, d.at + t);
        const lx0 = hingeAtTo ? d.to - 0.08 : d.from, lx1 = hingeAtTo ? d.to : d.from + 0.08;
        const z0 = d.swing > 0 ? d.at : d.at - w, z1 = d.swing > 0 ? d.at + w : d.at;
        if (!d.pivot) nav.registerDoor(openId, lx0, z0, lx1, z1);
      } else {
        nav.registerDoor(closedId, d.at - t, d.from, d.at + t, d.to);
        const lz0 = hingeAtTo ? d.to - 0.08 : d.from, lz1 = hingeAtTo ? d.to : d.from + 0.08;
        const x0 = d.swing > 0 ? d.at : d.at - w, x1 = d.swing > 0 ? d.at + w : d.at;
        if (!d.pivot) nav.registerDoor(openId, x0, lz0, x1, lz1);
      }
      nav.setDoorClosed(openId, false);

      const door = {
        id: d.id, open: false, group, closedId, openId, value: 0,
        center: d.wall === 'x' ? new THREE.Vector2((d.from + d.to) / 2, d.at) : new THREE.Vector2(d.at, (d.from + d.to) / 2),
      };
      door.set = (open) => {
        if (door.open === open) return;
        door.open = open;
        nav.setDoorClosed(closedId, !open);
        nav.setDoorClosed(openId, open);
        const from = door.value, to = open ? 1 : 0;
        this.animate(d.pivot ? 2.2 : 1.5, (k) => {
          door.value = from + (to - from) * k;
          group.rotation.y = baseRot + openAngle * door.value;
        });
        this.ctx.audio?.door?.();
      };
      this.doors.set(navId - 2, door);
      this.doors.set(d.id, door);
      this.add(group, {
        label: () => (door.open ? 'Close door' : 'Open door'),
        action: () => door.set(!door.open),
        kind: 'door',
      });
    }
    this.buildSlider(navId);
  }

  doorByNav(navId) {
    const id = navId % 2 === 0 ? navId : navId - 1;
    return this.doors.get(id);
  }

  /** Lift-and-slide glazed door to the terrace. */
  buildSlider(navId) {
    const { M, scene, nav } = this.ctx;
    const s = CURTAIN.slider;
    const w = s.moving[1] - s.moving[0];
    const h = s.height - 0.08;
    const group = new THREE.Group();
    group.position.set(-0.04, 0.06, (s.moving[0] + s.moving[1]) / 2);
    const f = 0.055;
    const fr = (x0, y0, z0, x1, y1, z1) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      const m = new THREE.Mesh(g, M.blackAlu);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.castShadow = true;
      group.add(m);
    };
    fr(-0.025, 0, -w / 2, 0.025, h, -w / 2 + f);
    fr(-0.025, 0, w / 2 - f, 0.025, h, w / 2);
    fr(-0.025, 0, -w / 2, 0.025, f, w / 2);
    fr(-0.025, h - f, -w / 2, 0.025, h, w / 2);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.01, h - 2 * f, w - 2 * f), M.glass);
    pane.position.set(0, h / 2, 0);
    pane.renderOrder = 3;
    group.add(pane);
    // slim vertical pull
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.025), M.blackAlu);
    pull.position.set(0.05, 1.1, w / 2 - 0.12);
    group.add(pull);
    scene.add(group);
    const id = navId;
    nav.registerDoor(id, -0.14, s.moving[0], 0.14, s.moving[1]);
    const z0 = group.position.z;
    const door = { id: 'slider', open: false, value: 0, closedId: id, center: new THREE.Vector2(0, z0) };
    door.set = (open) => {
      if (door.open === open) return;
      door.open = open;
      nav.setDoorClosed(id, !open);
      const from = door.value, to = open ? 1 : 0;
      this.animate(2.6, (k) => {
        door.value = from + (to - from) * k;
        group.position.z = z0 - door.value * (w - 0.12);
      });
    };
    this.doors.set(id, door);
    this.doors.set('slider', door);
    nav.doorIsLeaf = ((prev) => (i) => (i === id ? false : prev(i)))(nav.doorIsLeaf);
    this.add(group, {
      label: () => (door.open ? 'Close terrace door' : 'Open terrace door'),
      action: () => door.set(!door.open),
      kind: 'door',
    });
  }

  // ------------------------------------------------------------ curtains
  curtain({ axis, at, from, to, y0, y1, material, gather = 'both', open = 1, label = 'curtains' }) {
    const c = { value: open, open: open > 0.5, panels: [] };
    if (gather === 'both') {
      const mid = (from + to) / 2;
      c.panels.push(this._panel({ axis, at, from, to: mid, y0, y1, material, gather: 'from' }));
      c.panels.push(this._panel({ axis, at, from: mid, to, y0, y1, material, gather: 'to' }));
    } else {
      c.panels.push(this._panel({ axis, at, from, to, y0, y1, material, gather }));
    }
    const layout = () => c.panels.forEach((p) => p.layout(c.value));
    layout();
    c.set = (o) => {
      if (c.open === o) return;
      c.open = o;
      const start = c.value, target = o ? 1 : 0;
      this.animate(4.0, (k) => { c.value = start + (target - start) * k; layout(); });
    };
    for (const p of c.panels) {
      this.add(p.mesh, {
        label: () => (c.open ? `Close ${label}` : `Open ${label}`),
        action: () => c.set(!c.open),
        kind: 'curtain',
      });
    }
    return c;
  }

  /** One curtain panel that gathers toward its `from` or `to` end. */
  _panel({ axis, at, from, to, y0, y1, material, gather }) {
    const { scene } = this.ctx;
    const len = to - from;
    const pleat = 0.2;
    const cols = Math.max(32, Math.round((len / pleat) * 8));
    const rows = 12;
    const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
    const pos = geo.attributes.position;
    const rest = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      rest[i * 2] = pos.getX(i) + 0.5;
      rest[i * 2 + 1] = pos.getY(i) + 0.5;
    }
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, rest[i * 2] * len, rest[i * 2 + 1] * (y1 - y0));
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = material.opacity >= 1;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const g = 0.11; // gathered width as a fraction of the drawn width
    const layout = (o) => {
      for (let i = 0; i < pos.count; i++) {
        const u = rest[i * 2], v = rest[i * 2 + 1];
        const s = gather === 'from' ? u : 1 - u; // distance from the gathering end
        const d = s * len * (1 - o * (1 - g));
        const along = gather === 'from' ? d : len - d;
        const phase = ((s * len) / pleat) * Math.PI * 2;
        const amp = 0.035 + o * 0.06;
        const depth = Math.sin(phase) * amp * (0.92 + 0.08 * v) + Math.sin(v * 3.0 + u * 5.0) * 0.004;
        const y = y0 + v * (y1 - y0);
        if (axis === 'z') pos.setXYZ(i, at + depth, y, from + along);
        else pos.setXYZ(i, from + along, y, at + depth);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
    };
    return { mesh, layout };
  }

  // ------------------------------------------------------- light switches
  switchPlate(room, x, y, z, ry) {
    const { M, scene, lighting } = this.ctx;
    const g = new THREE.Group();
    const plate = new THREE.Mesh(roundedBox(0.09, 0.14, 0.012, 0.004, 2), M.brass);
    const key = new THREE.Mesh(roundedBox(0.045, 0.07, 0.01, 0.004, 2), M.blackAlu);
    key.position.z = 0.008;
    plate.castShadow = false;
    g.add(plate, key);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    scene.add(g);
    this.add(g, {
      label: () => (lighting.isOn(room) ? 'Lights off' : 'Lights on'),
      action: () => { lighting.toggleRoom(room); key.rotation.x = lighting.isOn(room) ? -0.15 : 0.15; },
      kind: 'switch',
    });
  }
}
