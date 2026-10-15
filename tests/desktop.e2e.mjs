/*
 * Desktop end-to-end test in a real (headless) browser: navigation still works, wall targeting and
 * the E-key panel flow, wall painting, the five environments, furniture, empty/restore/reset, and
 * persistence across a reload.
 *
 *   npm run dev            (in another terminal)
 *   npm run test:desktop
 */
import { launch, openApp, suite } from './lib.mjs';

const { browser, page, logs } = await launch({ width: 960, height: 600 });
const T = suite('Desktop');
const ev = (fn, arg) => page.evaluate(fn, arg);

await openApp(page, 'enter&still&reset');
page.setDefaultTimeout(45000);   // fail fast on a missing control instead of hanging
await ev(() => {
  const R = window.__residence;
  const V = R.camera.position.constructor;
  window.__d = {
    stand(x, z, yaw) { R.player.setPose(x, z, yaw, 0); R.step(2, 1 / 30, false); const d = new V(); R.camera.getWorldDirection(d); return R.custom.queryWall(R.camera.position.clone(), d); },
    free: (x, z) => R.world.nav.free(x, z, true),
  };
});

// ---- existing navigation / editing features still work
const nav = await ev(() => {
  const R = window.__residence;
  const p0 = [R.player.pos.x, R.player.pos.y];
  R.player.keys.add('KeyW'); R.step(60, 1 / 30, false); R.player.keys.clear();
  const moved = Math.hypot(R.player.pos.x - p0[0], R.player.pos.y - p0[1]);
  const items = R.world.interact.items.map((i) => i.kind).reduce((a, k) => ({ ...a, [k]: (a[k] || 0) + 1 }), {});
  return { moved, items, eye: R.camera.position.y, lightsToggle: typeof R.lighting.toggleRoom };
});
T.check('WASD walking still works', nav.moved > 1, `${nav.moved.toFixed(2)} m`);
T.check('doors, curtains, switches and finish-change interactions are still registered', nav.items.door >= 5 && nav.items.curtain >= 4 && nav.items.switch >= 8 && nav.items.material >= 3, JSON.stringify(nav.items));
T.check('eye height is 1.65 m', Math.abs(nav.eye - 1.65) < 0.05);

// ---- wall targeting
let t = await ev(() => { const q = window.__d.stand(16, -1.0, Math.PI); return q && { label: q.label, d: q.distance }; });
T.check('looking at a wall within 1.5 m targets that specific wall', t?.label === 'Kitchen · South wall', JSON.stringify(t));
t = await ev(() => { const q = window.__d.stand(16, -3.0, Math.PI); return q && q.label; });
T.check('no target beyond the proximity distance', !t);
t = await ev(() => { const q = window.__d.stand(16, 1.2, 0); return q && q.label; });
T.check('a wall is never targeted through another wall (hallway side, not kitchen side)', t === 'Hallway · North wall', t);
t = await ev(() => { const q = window.__d.stand(16, -1.0, Math.PI / 2); return q && q.label; });
T.check('looking along a wall (not at it) from a corner still resolves to the visible wall only', t === null || /wall$/.test(t), String(t));
const dist = await ev(() => { const R = window.__residence; R.config.proximity = 2.4; const q = window.__d.stand(16, -2.0, Math.PI); R.config.proximity = 1.5; return q && q.label; });
T.check('proximity distance is configurable', dist === 'Kitchen · South wall', String(dist));

// ---- E opens the panel for the targeted wall; prompt text; Escape closes
await ev(() => { window.__d.stand(16, -1.0, Math.PI); window.__residence.step(8, 1 / 30, false); });
const prompt = await ev(() => { const p = document.querySelector('#wall-prompt'); return { hidden: p.classList.contains('hidden'), text: p.textContent }; });
T.check('prompt reads "E — Customise" with the wall name', !prompt.hidden && /E\s*Customise/.test(prompt.text) && /Kitchen · South wall/.test(prompt.text), prompt.text.trim());
await page.keyboard.press('KeyE');
const open = await ev(() => { const R = window.__residence; return { open: R.custom.state.open, wall: R.custom.state.wallId, panel: !document.querySelector('#cust-panel').classList.contains('hidden'), promptHidden: document.querySelector('#wall-prompt').classList.contains('hidden') }; });
T.check('pressing E opens the panel for the targeted wall', open.open && open.panel && /:kitchen$/.test(open.wall) && open.promptHidden, JSON.stringify(open));
await ev(() => window.__residence.step(3, 1 / 30, false));
const lock = await ev((w) => { const R = window.__residence; R.player.setPose(4, 8, 0, 0); R.step(2, 1 / 30, false); return R.custom.state.wallId === w && R.walls.highlighted === w; }, open.wall);
T.check('wall stays fixed while the panel is open', lock);
await page.keyboard.down('KeyW'); await ev(() => window.__residence.step(30, 1 / 30, false)); await page.keyboard.up('KeyW');
const keysIgnored = await ev(() => { const R = window.__residence; return R.player.keys.size === 0; });
T.check('movement keys are ignored while the panel is open', keysIgnored);
await page.keyboard.press('Escape');
T.check('Escape closes the panel', !(await ev(() => window.__residence.custom.state.open)));
await page.keyboard.press('KeyE');
await ev(() => window.__residence.step(2, 1 / 30, false));
const pressedAgain = await ev(() => window.__residence.custom.state.open);
T.check('E does not open the panel when no wall is targeted', !pressedAgain);

// ---- DOM panel: swatch click paints exactly that wall
await ev(() => { window.__d.stand(16, -1.0, Math.PI); window.__residence.step(8, 1 / 30, false); });
await page.keyboard.press('KeyE');
await page.click('.cp-sw[title="Terracotta"]');
const painted = await ev(() => { const R = window.__residence; const id = R.custom.state.wallId; return { hex: R.walls.get(id).hex, others: [...R.walls.faces.values()].filter((f) => f.id !== id && f.hex).length }; });
T.check('colour swatch tints the selected wall only', painted.hex === '#b8694c' && painted.others === 0, JSON.stringify(painted));
await page.click('text=Apply to all walls');
T.check('"Apply to all walls" tints every interior wall', await ev(() => { const R = window.__residence; return [...R.walls.faces.values()].filter((f) => f.room).every((f) => f.hex === '#b8694c'); }));
await page.click('text=Restore original');
T.check('"Restore original" restores only the selected wall', await ev(() => { const R = window.__residence; const id = R.custom.state.wallId; return R.walls.get(id).hex === null && [...R.walls.faces.values()].filter((f) => f.room && f.hex).length === R.walls.interiorIds().length - 1; }));
// ---- environments through the panel
await page.click('.cp-tab:has-text("Light")');
for (const name of ['Bright Daylight', 'Warm Golden Hour', 'Overcast Soft Light', 'Evening Interior', 'Night Interior']) {
  await page.click(`.cp-preset:has-text("${name}")`);
  await ev(() => window.__residence.step(2, 1 / 30, false));
  const e = await ev(() => { const R = window.__residence; return { env: R.custom.environment, to: R.lighting.to && { sun: R.lighting.to.sunIntensity, exp: R.lighting.to.exposure, night: R.lighting.to.night, over: R.lighting.to.overcast } }; });
  T.check(`environment "${name}" selects and targets distinct lighting`, !!e.to, JSON.stringify(e));
}
// complete, visibly different presets (settled values)
const presets = await ev(() => {
  const R = window.__residence, out = {};
  for (const id of ['day', 'sunset', 'overcast', 'evening', 'night']) { R.custom.setEnvironment(id, true); R.step(2, 1 / 30, false); const s = R.lighting.state; out[id] = [s.sunIntensity, s.exposure, s.hemi, s.night, s.overcast, s.sun.y].map((n) => +n.toFixed(3)).join('|'); }
  return out;
});
T.check('five presets all settle to different light, sky and exposure', new Set(Object.values(presets)).size === 5, JSON.stringify(presets));
await page.click('text=Restore original');
T.check('original environment can be restored', (await ev(() => window.__residence.custom.environment)) === 'sunset');
await page.click('.cp-close');

// ---- furniture by mouse: select, drag, refuse bad drops
await ev(() => { window.__d.stand(13.2, -2.2, -1.22); window.__residence.step(2, 1 / 30, false); window.__residence.custom.open({ tab: 'furniture' }); window.__residence.step(2, 1 / 30, true); });   // face the bar stools
const screenOf = (id) => ev((i) => {
  const R = window.__residence, it = R.furniture.get(i); const v = it.group.position.clone(); v.y = 0.7; v.project(R.camera);   // the seat, not the empty space beside the stool's thin post
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}, id);
const p = await screenOf('kitchen-stool-2');
const before = await ev(() => { const it = window.__residence.furniture.get('kitchen-stool-2'); return [it.cur.x, it.cur.z]; });
await page.mouse.move(p.x, p.y); await page.mouse.down();
T.check('pressing on a piece selects it (teal outline, distinct from wall highlight)', await ev(() => window.__residence.furniture.selectedId === 'kitchen-stool-2'));
await page.mouse.move(p.x + 10, p.y + 40, { steps: 4 }); await page.mouse.move(p.x - 30, p.y + 120, { steps: 6 });
await page.mouse.up();
const after = await ev(() => { const it = window.__residence.furniture.get('kitchen-stool-2'); return { x: it.cur.x, z: it.cur.z, y: it.group.position.y }; });
T.check('dragging moves it along the floor (grounded)', Math.hypot(after.x - before[0], after.z - before[1]) > 0.1 && after.y === 0, `${Math.hypot(after.x - before[0], after.z - before[1]).toFixed(2)} m`);
await page.keyboard.press('KeyR');
T.check('R rotates the selected piece', Math.abs(await ev(() => window.__residence.furniture.selected.cur.ry)) > 0.2);
await page.click('.cp-btn:has-text("Cancel")');
T.check('Cancel returns it to where it stood when selected', await ev(([x, z]) => { const s = window.__residence.furniture.selected; return Math.hypot(s.cur.x - x, s.cur.z - z) < 1e-6 && s.cur.ry === 0; }, before));
await page.click('.cp-btn:has-text("Reset piece")');
T.check('Reset piece returns it home', await ev(() => { const s = window.__residence.furniture.selected; return Math.hypot(s.cur.x - s.home.x, s.cur.z - s.home.z) < 0.01; }));
await page.click('.cp-tab:has-text("Room")');
await page.click('.cp-btn:has-text("Empty Kitchen")');
T.check('Empty Room asks for confirmation', await ev(() => !!window.__residence.custom.state.dialog) && (await ev(() => window.__residence.furniture.countHidden())) === 0);
await page.click('.cp-btn:has-text("Empty room")');
const emp = await ev(() => { const R = window.__residence, F = R.furniture; return { hidden: F.countHidden(), stools: [1, 2, 3, 4].every((i) => F.get(`kitchen-stool-${i}`).hidden), chairs: F.get('dining-chair-1').hidden, walls: R.walls.faces.size, lights: R.lighting.rooms.size, doors: R.world.interact.doors.size }; });
T.check('Empty Room hides only the movable pieces in that room; structure and lighting remain', emp.stools && !emp.chairs && emp.walls > 40 && emp.lights > 8 && emp.doors >= 5, JSON.stringify(emp));
await page.click('.cp-btn:has-text("Restore furniture")');
T.check('Restore Furniture is reversible', (await ev(() => window.__residence.furniture.countHidden())) === 0);
// persistence across reload
await ev(() => { const R = window.__residence; R.custom.state.wallId = [...R.walls.faces.keys()].find((k) => R.walls.get(k).room); R.custom.paintSelected('#7b7d56', true); R.custom.setEnvironment('evening', true); R.furniture.select('living-pouf'); R.furniture.beginDrag('living-pouf'); R.furniture.dragTo(8.8, 10); R.furniture.endDrag(true); R.custom.changed(); window.__wall = R.custom.state.wallId; });
await page.waitForTimeout(700);
await openApp(page, 'enter&still');   // same app, no ?reset, so the saved design is loaded
const persisted = await ev(() => { const R = window.__residence; return { hex: [...R.walls.faces.values()].find((f) => f.hex)?.hex, env: R.custom.environment, mode: R.lighting.mode, pouf: [R.furniture.get('living-pouf').cur.x, R.furniture.get('living-pouf').cur.z] }; });
T.check('layout, wall colour and environment persist across reload', persisted.hex === '#7b7d56' && persisted.env === 'evening' && persisted.mode === 'evening' && Math.hypot(persisted.pouf[0] - 8.8, persisted.pouf[1] - 10) < 0.01, JSON.stringify(persisted));
await ev(() => { const R = window.__residence; R.custom.open({}); R.custom.setTab('room'); R.custom.askReset(); R.custom.confirmDialog(); });
const reset = await ev(() => { const R = window.__residence; return { mod: R.furniture.isModified(), painted: [...R.walls.faces.values()].filter((f) => f.hex).length, env: R.custom.environment }; });
T.check('Reset Room restores layout, materials and environment', !reset.mod && reset.painted === 0 && reset.env === 'sunset', JSON.stringify(reset));

await browser.close();
process.exit(T.done(logs) ? 0 : 1);
