import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { buildMaterials } from './materials/library.js';
import { Lighting } from './world/lighting.js';
import { buildWorld, ZONES } from './world/index.js';
import { Player } from './nav/player.js';
import { FloorPlan } from './ui/plan.js';
import { ROOMS, VIEWS, SELECTOR, roomAt } from './world/layout.js';
import { clamp, lerp, easeInOut } from './world/util.js';
import { WallSystem } from './custom/walls.js';
import { FurnitureSystem } from './custom/furniture.js';
import { Customiser } from './custom/customiser.js';
import { DomPanel } from './custom/panel-dom.js';
import { ENVIRONMENTS, ORIGINAL_ENVIRONMENT } from './custom/environment.js';
import { CUSTOMISE } from './custom/config.js';
import { XRManager } from './xr/xr.js';

const $ = (s) => document.querySelector(s);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const params = new URLSearchParams(location.search);

const canvas = $('#view');
const touch = window.matchMedia('(pointer: coarse)').matches;
// Phones and tablets get a lighter pipeline (no screen-space AO, smaller buffers).
const low = params.get('quality') === 'low' || (touch && params.get('quality') !== 'high');
const R = new Renderer(canvas, { low });
const renderer = R.renderer;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.05, 1500);

// Keep a natural horizontal field of view on portrait screens.
let userFov = 64;
function fitFov() {
  const a = window.innerWidth / window.innerHeight;
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(userFov) / 2) * Math.max(a, 1));
  camera.fov = a < 1 ? Math.min(90, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(Math.min(hfov, 1.25) / 2) / a))) : userFov;
}
fitFov();
window.addEventListener('resize', fitFov);

// Architectural "shift lens": keeps verticals straight while framing upward.
let lensShift = 0;
camera.userData.applyShift = () => {
  camera.projectionMatrix.elements[9] = lensShift;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
};

const setProgress = (p, label) => {
  $('#loader .bar span').style.width = `${Math.round(p * 100)}%`;
  if (label) $('#loader .status').textContent = label;
};

let world, lighting, player, plan, walls, furniture, custom, xr;
const clock = new THREE.Clock();
let mode = 'loading';

// Eye adaptation: like a photographer exposing each room, exposure eases
// toward a per-zone value as the visitor walks from space to space.
const ADAPT = {
  day: { main: 1, kitchen: 1.45, hall: 1.5, master: 1.3, masterBath: 1.25, bedroom: 1.4, bath: 1.45, outdoor: 0.78 },
  sunset: { main: 1, kitchen: 1.5, hall: 1.55, master: 1.35, masterBath: 1.3, bedroom: 1.45, bath: 1.5, outdoor: 0.85 },
  night: { main: 1, kitchen: 1.1, hall: 1.2, master: 1.15, masterBath: 1.1, bedroom: 1.15, bath: 1.15, outdoor: 1.25 },
  overcast: { main: 1, kitchen: 1.35, hall: 1.4, master: 1.25, masterBath: 1.2, bedroom: 1.3, bath: 1.35, outdoor: 0.9 },
  evening: { main: 1, kitchen: 1.3, hall: 1.4, master: 1.25, masterBath: 1.2, bedroom: 1.3, bath: 1.35, outdoor: 1.1 },
};
const ROOM_ZONE = { living: 'main', foyer: 'main', dining: 'main', kitchen: 'kitchen', hall: 'hall', master: 'master', masterBath: 'masterBath', bedroom: 'bedroom', bath: 'bath', terrace: 'outdoor' };
let adapt = 1;
let snapAdapt = false;
let time = 0;

// ---- intro choreography: a slow cinematic drift through the living room
const INTRO = [
  { pos: new THREE.Vector3(5.9, 1.42, 12.6), look: new THREE.Vector3(4.2, 1.85, 0.0), shift: 0.3 },
  { pos: new THREE.Vector3(6.6, 1.42, 11.0), look: new THREE.Vector3(3.2, 1.9, 0.0), shift: 0.3 },
];
const START = { pos: [6.0, 14.4], look: [4.6, 1.6, 4.0] };

async function init() {
  setProgress(0.04, 'Preparing materials');
  await nextFrame();
  const M = await bakeMaterials();
  setProgress(0.62, 'Building the residence');
  await nextFrame();
  lighting = new Lighting(renderer, scene);
  world = buildWorld({ scene, M, lighting });
  world.toast = toast;
  lighting.setupProbes(ZONES, world.zoneMaterials);
  setupCustomisation();
  setProgress(0.75, 'Lighting the interiors');
  await nextFrame();
  R.setup(scene, camera);
  if (low) { lighting.sun.shadow.mapSize.set(2048, 2048); }
  if (touch) $('#hint').innerHTML = 'Drag to look &nbsp;·&nbsp; Tap the floor to walk &nbsp;·&nbsp; Tap doors, curtains &amp; switches';
  if (params.has('reset')) custom.clearSaved();
  const saved = params.has('reset') ? null : custom.restore();
  const startMode = ENVIRONMENTS.some((e) => e.id === params.get('mode')) ? params.get('mode') : (saved || ORIGINAL_ENVIRONMENT);
  custom.environment = startMode;
  lighting.setMode(startMode, true);
  lighting.update(10, 0);
  for (const r of lighting.rooms.values()) { r.level = r.on ? 1 : 0; }
  lighting.update(0.001, 0);
  bakeEnv();
  player = new Player(camera, world.nav, world.interact);
  setProgress(0.88, 'Composing the view');
  await nextFrame();
  try { await renderer.compileAsync(scene, camera); } catch { /* older drivers */ }
  setIntroPose(0);
  R.render(0);
  setProgress(1, 'Welcome');
  setupUI();
  setupCustomUI();
  setupXR();
  await nextFrame();
  $('#loader').classList.add('hidden');
  if (params.has('enter')) enter(true);
  else { $('#intro').classList.remove('hidden'); mode = 'intro'; }
  if (mode === 'loading') mode = 'intro';
  loop();
}

async function bakeMaterials() {
  // Bake on the GPU with periodic yields so the progress bar stays alive.
  let last = performance.now();
  const M = buildMaterials(renderer, (p) => {
    setProgress(0.04 + p * 0.56);
    if (performance.now() - last > 60) last = performance.now();
  });
  await nextFrame();
  return M;
}

function bakeEnv(zones = null) {
  // overlays, outlines and VR widgets must never leak into the reflection probes
  const hide = [world.glassMesh, ...world.mirrors, walls.overlay, furniture.outline];
  if (floorRing) hide.push(floorRing);
  if (xr?.ui) hide.push(...xr.ui.panels.map((p) => p.mesh), xr.arc, xr.dest);
  for (const c of xr?.controllers || []) hide.push(c.reticle);
  lighting.bakeEnvironment(hide, zones);
}

function setIntroPose(t) {
  const k = easeInOut(clamp(t, 0, 1));
  const a = INTRO[0], b = INTRO[1];
  camera.position.lerpVectors(a.pos, b.pos, k);
  const look = new THREE.Vector3().lerpVectors(a.look, b.look, k);
  camera.lookAt(look.x, camera.position.y, look.z);
  lensShift = lerp(a.shift, b.shift, k);
  camera.updateProjectionMatrix();
  camera.userData.applyShift();
}

// --------------------------------------------------------- customisation
function setupCustomisation() {
  walls = new WallSystem({ scene, faceDefs: world.faceDefs, faceRanges: world.faceRanges });
  furniture = new FurnitureSystem({
    scene, items: world.items, nav: world.nav,
    onChange: () => { renderer.shadowMap.needsUpdate = true; },
  });
  custom = new Customiser({
    camera, world, lighting, walls, furniture,
    getRoom: () => (player ? roomAt(player.pos.x, player.pos.y) : null),
    getHead: (v) => (xr?.presenting ? xr._headWorld(v) : v.copy(camera.position)),
    toast: (t) => toast(t),
  });
  // everything that can stand in front of a wall: static architecture, doors, curtains, switches
  const staticOccluders = world.staticMeshes.filter((m) => !m.userData.faceRanges);
  custom.occluderExtras = () => [...staticOccluders, ...world.interact.targets];
  custom.on('environment', (id) => markTod(id));
}

let relockPointer = false;
function setupCustomUI() {
  new DomPanel($('#cust-panel'), custom);
  const prompt = $('#wall-prompt');
  const showPrompt = (t) => {
    const on = !!t && mode === 'walk' && !renderer.xr.isPresenting && !custom.state.open && !planOpen;
    prompt.classList.toggle('hidden', !on);
    if (t) prompt.querySelector('.wp-wall').textContent = t.label;
  };
  custom.on('target', showPrompt);
  // the prompt is also a button, so touch and mouse users are not forced to use the E key
  prompt.addEventListener('click', () => { if (custom.target) custom.open({ wallId: custom.target.id }); });
  custom.on('open', () => {
    prompt.classList.add('hidden');
    player.keys.clear();
    player.cancelRoute();
    // the panel needs a free cursor: release pointer lock if anything holds it (restored on close)
    if (document.pointerLockElement) { relockPointer = true; document.exitPointerLock(); }
    canvas.classList.toggle('furn-edit', custom.state.tab === 'furniture');
  });
  custom.on('close', () => {
    canvas.classList.remove('furn-edit', 'pointer');
    if (relockPointer) { relockPointer = false; try { canvas.requestPointerLock?.(); } catch { /* needs a user gesture */ } }
  });
  custom.on('schema', () => canvas.classList.toggle('furn-edit', custom.state.open && custom.state.tab === 'furniture'));
  $('#cust-btn').addEventListener('click', () => (custom.state.open ? custom.close() : custom.open({ wallId: custom.target?.id ?? null })));
}

function setupXR() {
  xr = new XRManager({
    renderer, scene, camera, player, nav: world.nav, world, custom, furniture,
    buttons: [$('#vr-btn'), $('#enter-vr')], message: $('#vr-msg'),
    hooks: {
      // entering from the intro or mid-flight must land the visitor inside the house, facing in
      beforeEnter: () => {
        togglePlan(false);
        if (mode === 'intro' || mode === 'loading') { enter(true); }
        else if (mode === 'transition') {
          mode = 'walk'; lensShift = 0; camera.updateProjectionMatrix(); camera.userData.applyShift();
          $('#hud').classList.remove('hidden');
        }
        player.cancelRoute();
        $('#cursor-label').classList.remove('on');
      },
      onStart: () => { snapAdapt = true; document.body.classList.add('in-xr'); },
      onEnd: () => { snapAdapt = true; document.body.classList.remove('in-xr'); fitFov(); renderer.shadowMap.needsUpdate = true; R.resize(); },
    },
  });
}

// ------------------------------------------------------------------ enter
let transition = null;
function enter(instant = false) {
  if (mode !== 'intro' && mode !== 'loading') return;
  $('#intro').classList.add('hidden');
  const from = { pos: camera.position.clone(), quat: camera.quaternion.clone(), shift: lensShift };
  player.setPose(START.pos[0], START.pos[1], 0);
  player.lookAt(...START.look, true);
  player.enabled = true;
  player.update(0.016);
  const to = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
  if (instant) {
    lensShift = 0; camera.updateProjectionMatrix(); camera.userData.applyShift();
    mode = 'walk';
    $('#hud').classList.remove('hidden');
    return;
  }
  mode = 'transition';
  transition = { t: 0, dur: 3.2, from, to };
  setTimeout(() => $('#hud').classList.remove('hidden'), 1800);
  setTimeout(() => $('#hint').style.opacity = '0', 12000);
}

// ------------------------------------------------------------------- UI
let currentRoom = null;
function setupUI() {
  $('#enter').addEventListener('click', () => enter());

  // room selector
  const nav = $('#rooms');
  SELECTOR.forEach(([key, label], i) => {
    if (i) { const s = document.createElement('span'); s.className = 'sep'; nav.appendChild(s); }
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.room = key;
    b.addEventListener('click', () => goToRoom(key));
    nav.appendChild(b);
  });

  // time of day
  document.querySelectorAll('#tod button').forEach((b) => {
    b.addEventListener('click', () => setTimeOfDay(b.dataset.mode));
  });
  markTod(lighting.mode);

  // floor plan
  plan = new FloorPlan($('#plan-svg'), (key) => { togglePlan(false); goToRoom(key); });
  $('#plan-btn').addEventListener('click', () => togglePlan());
  $('#plan-close').addEventListener('click', () => togglePlan(false));
  $('#plan').addEventListener('click', (e) => { if (e.target.id === 'plan') togglePlan(false); });

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (mode !== 'walk') { if (e.code === 'Enter' && mode === 'intro') enter(); return; }
    if (renderer.xr.isPresenting) return;
    if (e.code === 'Escape') {
      // innermost layer first: confirmation, then the customise panel, then the floor plan
      if (custom.state.dialog) custom.cancelDialog();
      else if (custom.state.open) custom.close();
      else if (planOpen) togglePlan(false);
      return;
    }
    if (custom.state.open) {
      // the panel owns the keyboard: no walking, no E, no stray shortcuts
      if (e.code === 'KeyR' && furniture.selected) { custom.rotate(e.shiftKey ? -1 : 1); e.preventDefault(); }
      return;
    }
    player.keys.add(e.code);
    if (e.code === 'KeyP') togglePlan();
    if (e.code === 'KeyL' && currentRoom) {
      const on = lighting.toggleRoom(currentRoom);
      toast(on ? 'Lights on' : 'Lights off');
    }
    if (planOpen) return;
    if (e.code === 'Digit1') setTimeOfDay('day');
    if (e.code === 'Digit2') setTimeOfDay('sunset');
    if (e.code === 'Digit3') setTimeOfDay('night');
    if (e.code === 'KeyE' && !e.repeat) {
      // a held key is ignored (!e.repeat), so the keyboard needs no activation cooldown
      if (custom.target) custom.open({ wallId: custom.target.id });
      else activateCenter();
    }
  });
  window.addEventListener('keyup', (e) => player.keys.delete(e.code));
  window.addEventListener('blur', () => player.keys.clear());

  setupPointer();
}

function markTod(m) {
  document.querySelectorAll('#tod button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
}

function setTimeOfDay(m) {
  custom.setEnvironment(m);
  markTod(m);
}

function goToRoom(key) {
  const target = key === 'hall' ? { pos: [17, 1.2], look: [29, 1.6, 1.2] } : key === 'bath' ? { pos: [27.6, -1.4], look: [28, 1.2, -6] } : VIEWS[key];
  if (!target) return;
  player.walkTo(target.pos[0], target.pos[1], target.look);
  document.querySelectorAll('#rooms button').forEach((b) => b.classList.toggle('active', b.dataset.room === key));
  // the terrace door opens for you when heading outside
  const inside = roomAt(player.pos.x, player.pos.y) !== 'terrace';
  if ((key === 'terrace') === inside) world.interact.doors.get('slider').set(true);
}

let planOpen = false;
function togglePlan(force) {
  planOpen = force ?? !planOpen;
  $('#plan').classList.toggle('hidden', !planOpen);
}

let toastTimer = 0;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

// --------------------------------------------------------------- pointer
const raycaster = new THREE.Raycaster();
raycaster.layers.enableAll();
const ndc = new THREE.Vector2();
let floorRing;
let pointer = { x: 0, y: 0, inside: false };

function setupPointer() {
  floorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.2, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  floorRing.renderOrder = 10;
  scene.add(floorRing);

  let down = null;
  const touches = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'walk' || renderer.xr.isPresenting) return;
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t: performance.now(), furn: null };
    touches.set(e.pointerId, true);
    // with the furniture tab open, pressing on a piece selects it and starts carrying it
    if (custom.state.open && custom.state.tab === 'furniture') {
      const id = pickFurniture(e.clientX, e.clientY);
      if (id && furniture.items.get(id).movable) {
        if (custom.selectFurniture(id) || furniture.selectedId === id) {
          const it = furniture.selected;
          const f = floorPointRaw(e.clientX, e.clientY);
          if (furniture.beginDrag(id)) down.furn = { offX: f ? it.cur.x - f.x : 0, offZ: f ? it.cur.z - f.z : 0 };
        }
      }
    }
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    pointer = { x: e.clientX, y: e.clientY, inside: true };
    if (!down || mode !== 'walk') return;
    if (down.furn) {
      down.moved += Math.abs(e.clientX - down.lx) + Math.abs(e.clientY - down.ly);
      down.lx = e.clientX; down.ly = e.clientY;
      const f = floorPointRaw(e.clientX, e.clientY);
      if (f && down.moved > 4) furniture.dragTo(f.x + down.furn.offX, f.z + down.furn.offZ);
      return;
    }
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    down.lx = e.clientX; down.ly = e.clientY;
    down.moved += Math.abs(dx) + Math.abs(dy);
    if (down.moved > 6) {
      const s = e.pointerType === 'touch' ? 1.5 : 1;
      player.look(dx * s, dy * s);
    }
  });
  const up = (e) => {
    canvas.classList.remove('dragging');
    touches.delete(e.pointerId);
    if (!down) return;
    const click = down.moved <= 6 && performance.now() - down.t < 600;
    const carried = down.furn;
    down = null;
    if (carried) {
      if (!furniture.endDrag(true)) custom.say("Can't place it there \u2014 moved back");
      else custom.changed();
      return;
    }
    if (click && mode === 'walk') {
      if (custom.state.open) { if (custom.state.tab === 'furniture') furniture.deselect(), custom.emit('schema'); }
      else handleClick(e.clientX, e.clientY);
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
  canvas.addEventListener('wheel', (e) => {
    if (mode !== 'walk' || renderer.xr.isPresenting) return;
    userFov = clamp(userFov + Math.sign(e.deltaY) * 2, 40, 75);
    fitFov();
    camera.updateProjectionMatrix();
    camera.userData.applyShift();
  }, { passive: true });
}

function pick(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(world.interact.targets, false);
  for (const h of hits) {
    if (h.distance > 7.5) break;
    const item = h.object.userData.interactive;
    if (!item) continue;
    // line of sight to a point just in front of the surface (so a door or a
    // wall-mounted switch never occludes itself)
    const d = raycaster.ray.direction;
    const px = h.point.x - d.x * 0.4, pz = h.point.z - d.z * 0.4;
    if (world.nav.wallBetween(camera.position.x, camera.position.z, px, pz)) continue;
    return { item, point: h.point };
  }
  return null;
}

function floorPoint(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const d = raycaster.ray.direction;
  if (d.y > -0.02) return null;
  const t = (0 - raycaster.ray.origin.y) / d.y;
  const p = raycaster.ray.origin.clone().addScaledVector(d, t);
  if (t > 30) return null;
  if (world.nav.wallBetween(camera.position.x, camera.position.z, p.x, p.z)) return null;
  const k = world.nav.iz(p.z) * world.nav.w + world.nav.ix(p.x);
  if (!world.nav.walk[k]) return null;
  return p;
}

/** Floor point under the cursor with no walkability test (used to carry furniture). */
function floorPointRaw(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const d = raycaster.ray.direction;
  if (d.y > -0.02) return null;
  const t = -raycaster.ray.origin.y / d.y;
  return t > 40 ? null : raycaster.ray.origin.clone().addScaledVector(d, t);
}

function pickFurniture(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(furniture.pickMeshes(), false)[0];
  if (!hit || hit.distance > 14) return null;
  const d = raycaster.ray.direction;
  if (world.nav.wallBetween(camera.position.x, camera.position.z, hit.point.x - d.x * 0.3, hit.point.z - d.z * 0.3)) return null;
  return furniture.itemIdOf(hit.object);
}

function handleClick(cx, cy) {
  const hit = pick(cx, cy);
  if (hit) { hit.item.action(); updateHover(true); return; }
  const p = floorPoint(cx, cy);
  if (p) {
    player.walkTo(p.x, p.z, null);
    floorRing.position.set(p.x, 0.012, p.z);
    floorRing.material.opacity = 0.9;
    document.querySelectorAll('#rooms button').forEach((b) => b.classList.remove('active'));
  }
}

function activateCenter() {
  const hit = pick(window.innerWidth / 2, window.innerHeight / 2);
  if (hit) hit.item.action();
}

let hoverTick = 0;
function updateHover(force = false) {
  if (mode !== 'walk' || !pointer.inside || custom.state.open || renderer.xr.isPresenting) {
    $('#cursor-label').classList.remove('on');
    return;
  }
  if (!force && ++hoverTick % 3) return;
  const hit = pick(pointer.x, pointer.y);
  const lab = $('#cursor-label');
  if (hit) {
    lab.textContent = hit.item.label();
    lab.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 14}px)`;
    lab.classList.add('on');
    canvas.classList.add('pointer');
    floorRing.material.opacity = lerp(floorRing.material.opacity, 0, 0.3);
  } else {
    lab.classList.remove('on');
    canvas.classList.remove('pointer');
    const p = floorPoint(pointer.x, pointer.y);
    if (p && !player.route) {
      floorRing.position.set(p.x, 0.012, p.z);
      floorRing.material.opacity = lerp(floorRing.material.opacity, 0.45, 0.4);
    }
  }
}

// ------------------------------------------------------------------ loop
// One animation loop for everything: three.js runs it on requestAnimationFrame on the desktop and on
// the headset's own frame callback inside a VR session, so there is never a second render loop.
const still = params.has('still');
function loop() {
  if (still) return;
  renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 0.05)));
}

let targetTick = 0;
/** Desktop wall targeting: the crosshair (view centre) against walls within reach. */
function updateWallTarget() {
  if (mode !== 'walk' || renderer.xr.isPresenting) return;
  if (custom.state.open) return;
  if (planOpen) { custom.setTarget(null); return; }
  if (++targetTick % 3) return;
  const dir = camera.getWorldDirection(new THREE.Vector3());
  custom.setTarget(custom.queryWall(camera.position, dir));
}

let frameCount = 0;
function frame(dt, render = true) {
  time += dt;
  frameCount++;

  if (mode === 'intro') {
    setIntroPose((Math.sin(time * 0.045 - Math.PI / 2) + 1) / 2);
  } else if (mode === 'transition') {
    transition.t = Math.min(1, transition.t + dt / transition.dur);
    const k = easeInOut(transition.t);
    camera.position.lerpVectors(transition.from.pos, transition.to.pos, k);
    camera.quaternion.slerpQuaternions(transition.from.quat, transition.to.quat, k);
    lensShift = lerp(transition.from.shift, 0, k);
    camera.updateProjectionMatrix();
    camera.userData.applyShift();
    if (transition.t >= 1) {
      mode = 'walk';
      $('#cursor-label').classList.remove('on');
    }
  } else if (mode === 'walk') {
    player.update(dt);
    updateHover();
    updateWallTarget();
    floorRing.material.opacity = Math.max(0, floorRing.material.opacity - dt * (player.route ? 0.6 : 0.2));
    const room = roomAt(player.pos.x, player.pos.y);
    if (room !== currentRoom) {
      currentRoom = room;
      const label = $('#room-name .label');
      label.style.opacity = 0;
      setTimeout(() => { label.textContent = room ? ROOMS[room].name : ''; label.style.opacity = 1; }, 400);
    }
    if (planOpen) plan.update(player.pos.x, player.pos.y, player.yaw);
  }

  world.interact.update(dt);
  lighting.update(dt, time);
  const zone = mode === 'walk' ? ROOM_ZONE[roomAt(player.pos.x, player.pos.y)] || 'main' : 'main';
  const targetAdapt = ADAPT[lighting.mode]?.[zone] ?? 1;
  adapt = snapAdapt ? targetAdapt : lerp(adapt, targetAdapt, 1 - Math.exp(-dt * 1.4));
  snapAdapt = false;
  renderer.toneMappingExposure = lighting.baseExposure * adapt;
  R.grade.uniforms.tint.value.copy(lighting.state.tint);
  for (const fn of world.animated) fn(dt, time);
  if (lighting.envDirty) bakeEnv();
  else if (lighting.dirtyZones.size) bakeEnv([...lighting.dirtyZones]);
  const presenting = renderer.xr.isPresenting;
  if (presenting) xr.update(dt);
  walls.tick(time);
  if (mode === 'walk' && !still && !presenting) R.adapt(dt);
  if (lighting.t < 1 || world.interact.anims.length || furniture.drag || time < 1) renderer.shadowMap.needsUpdate = true;
  if (!render) return;
  // The post-processing composer cannot draw into a headset's framebuffer, so a VR session
  // renders the same scene straight to it; the desktop path is unchanged.
  if (presenting) renderer.render(scene, camera);
  else R.render(time);
}

init().catch((e) => {
  console.error(e);
  setProgress(1, 'This experience needs a WebGL2-capable browser.');
});

// exposed for debugging / automated captures
window.__residence = { get frameCount() { return frameCount; }, get mode() { return mode; }, snap: () => { snapAdapt = true; }, step: (n = 1, dt = 1 / 30, render = true) => { for (let i = 0; i < n; i++) frame(dt, render && i === n - 1); }, get player() { return player; }, get lighting() { return lighting; }, get world() { return world; }, get custom() { return custom; }, get furniture() { return furniture; }, get walls() { return walls; }, get xr() { return xr; }, config: CUSTOMISE, camera, renderer, setTimeOfDay, goToRoom, scene };
