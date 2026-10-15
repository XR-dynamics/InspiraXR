/*
 * Headset-path test for the apartment layout, using Meta's IWER runtime to emulate a Quest 3.
 * It enters a real WebXR session in the apartment and checks the VR controls that are new for it:
 * the wrist toolbar (Home / Blueprint / Customise / Exit), the Home panel in the headset, the blueprint
 * view rendering stereo, and that teleporting still cannot pass a wall. EMULATION only: it cannot
 * judge comfort, tracking, frame rate or the real controller models.
 *
 *   npm run dev            (in another terminal)
 *   npm run test:xr:apartment
 */
import { launch, openApp, suite } from './lib.mjs';

const OUT = process.env.OUT_DIR || '/tmp';
const { browser, page, logs } = await launch({ width: 480, height: 300, xr: true });
const T = suite('Apartment in an emulated Quest 3');
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---------------------------------------------------------------- in-page helpers
await openApp(page, 'home=apartment&enter&reset');
await ev(() => {
  const R = window.__residence;
  const V = R.camera.position.constructor, Q = R.camera.quaternion.constructor;
  const H = (window.__h = {});
  H.V = V;
  H.head = () => R.xr._headWorld(new V());
  H.rigInv = () => R.xr.rig.matrixWorld.clone().invert();
  // Point a controller's ray at a world position, from a natural spot beside the body.
  H.aim = (hand, p, from = null) => {
    const x = R.xr, head = H.head();
    const f = x._headForward(new V()); f.y = 0; f.normalize();
    const right = new V(-f.z, 0, f.x);
    const o = from ? new V(...from) : head.clone().addScaledVector(right, hand === 'right' ? 0.22 : -0.22).add(new V(0, -0.38, 0)).addScaledVector(f, 0.2);
    const d = new V(p.x - o.x, p.y - o.y, p.z - o.z).normalize();
    const qw = new Q().setFromUnitVectors(new V(0, 0, -1), d);
    const lp = o.clone().applyMatrix4(H.rigInv());
    const ql = x.rig.quaternion.clone().invert().multiply(qw);
    const c = window.__xrDevice.controllers[hand];
    c.position.set(lp.x, lp.y, lp.z); c.quaternion.set(ql.x, ql.y, ql.z, ql.w);
  };
  // Where a panel pixel is in the world.
  H.panelPoint = (panel, px, py) => {
    const g = panel.mesh.geometry.parameters;
    return panel.mesh.localToWorld(new V((px / panel.px[0] - 0.5) * g.width, (0.5 - py / panel.px[1]) * g.height, 0));
  };
  // Hold a controller at a world position, pointing straight ahead (like a hand resting at chest height).
  H.hold = (hand, p) => {
    const lp = new V(p.x, p.y, p.z).applyMatrix4(H.rigInv()), q = R.xr.rig.quaternion.clone().invert();
    const c = window.__xrDevice.controllers[hand];
    c.position.set(lp.x, lp.y, lp.z); c.quaternion.set(q.x, q.y, q.z, q.w);
  };
  H.item = (panel, pred) => panel.items.find(pred);
  H.center = (it) => [it.rect[0] + it.rect[2] / 2, it.rect[1] + it.rect[3] / 2];
  H.frame = () => R.xr.frame || 0;
});
const frames = async (n) => { const f0 = await ev(() => window.__h.frame()); await page.waitForFunction((t) => window.__h.frame() >= t, f0 + n, { timeout: 600000 }); };
const press = async (hand, id = 'trigger', n = 2) => { await ev(([h, i]) => window.__xrDevice.controllers[h].updateButtonValue(i, 1), [hand, id]); await frames(n); await ev(([h, i]) => window.__xrDevice.controllers[h].updateButtonValue(i, 0), [hand, id]); await frames(2); };
const stick = (hand, x, y) => ev(([h, a, b]) => window.__xrDevice.controllers[h].updateAxes('thumbstick', a, b), [hand, x, y]);
const settle = async (hand, point) => { await ev(([h, p]) => window.__h.aim(h, p), [hand, point]); await frames(2); };
/** Aim the right ray at a panel widget and pull the trigger. */
const clickWidget = async (panelName, pred, label) => {
  const pt = await ev(([pn, src]) => {
    const R = window.__residence, panel = R.xr.ui[pn];
    const it = panel.items.find(new Function('it', `return (${src})`));
    if (!it) return null;
    const [cx, cy] = window.__h.center(it); const w = window.__h.panelPoint(panel, cx, cy);
    window.__h.aim('right', w);
    return { x: w.x, y: w.y, z: w.z };
  }, [panelName, pred]);
  if (!pt) { T.check(`widget found: ${label}`, false); return false; }
  await frames(2);
  await press('right');
  return true;
};
const snap = async (name) => { try { await page.screenshot({ path: `${OUT}/${name}.png` }); } catch { /* ignore */ } };

// ------------------------------------------------------------------ enter VR
T.check('VR button reports "supported"', (await ev(() => document.querySelector('#vr-btn').dataset.state)) === 'supported');
await page.click('#vr-btn');
await page.waitForFunction(() => window.__residence.xr.presenting, null, { timeout: 180000 });
await frames(3);
const s1 = await ev(() => {
  const R = window.__residence, x = R.xr, h = window.__h.head();
  return { layout: document.body.dataset.layout, views: R.renderer.xr.getCamera().cameras.length, head: [h.x, h.y, h.z], rigY: x.rig.position.y, inside: !!R.layoutRoom?.(h.x, h.z) };
});
T.check('the apartment is the scene in the headset, rendered in stereo', s1.layout === 'apartment' && s1.views === 2);
T.check('eye height is not added twice (head 1.6 m, rig at the floor)', Math.abs(s1.head[1] - 1.6) < 0.03 && Math.abs(s1.rigY) < 1e-6);
T.check('the visitor starts inside the apartment', s1.head[0] > 0.3 && s1.head[0] < 10.5 && s1.head[2] < -0.3 && s1.head[2] > -8.4, `(${s1.head[0].toFixed(2)}, ${s1.head[2].toFixed(2)})`);
await snap('apt-xr-01-start');

// ------------------------------------------------------------------ toolbar
await ev(() => { const x = window.__residence.xr; x.ui.toolbar.visible = true; const h = window.__h.head(), V = window.__h.V; const f = x._headForward(new V()); f.y = 0; f.normalize(); window.__h.hold('left', h.clone().addScaledVector(new V(-f.z, 0, f.x), -0.28).add(new V(0, -0.6, 0)).addScaledVector(f, 0.25)); });
await frames(3);
const keys = await ev(() => { window.__residence.xr.ui.toolbar.update(true); return window.__residence.xr.ui.toolbar.items.filter((i) => i.key).map((i) => i.key).join(','); });
T.check('the wrist toolbar offers Home, Blueprint, Customise and Exit VR', ['home', 'bp', 'cust', 'exit'].every((k) => keys.includes(k)), keys);

// blueprint on
await clickWidget('toolbar', "it.key === 'bp'", 'Blueprint button');
await frames(4);
const bpOn = await ev(() => ({ on: window.__residence.custom.home.blueprint.on(), body: document.body.classList.contains('blueprint'), views: window.__residence.renderer.xr.getCamera().cameras.length }));
T.check('pointing at Blueprint and pulling the trigger turns the blueprint view on', bpOn.on === true && bpOn.body && bpOn.views === 2);
await frames(6);
await snap('apt-xr-02-blueprint');
const loopOk = await ev(() => { const a = window.__residence.frameCount; return a; });
await frames(3);
T.check('the headset keeps rendering in the blueprint view', (await ev(() => window.__residence.frameCount)) > loopOk);
await clickWidget('toolbar', "it.key === 'bp'", 'Blueprint button (off)');
await frames(4);
T.check('and the trigger turns it off again', (await ev(() => window.__residence.custom.home.blueprint.on())) === false);

// ------------------------------------------------------------------ Home panel in the headset
await clickWidget('toolbar', "it.key === 'home'", 'Home button');
await frames(4);
const hp = await ev(() => { const R = window.__residence; return { open: R.custom.state.open, tab: R.custom.state.tab, shown: R.xr.ui.main.visible }; });
T.check('the Home button opens the world-space panel on the Home tab', hp.open && hp.tab === 'home' && hp.shown, JSON.stringify(hp));
await ev(() => { const x = window.__residence.xr; x._placeMain?.(); x.ui.main.update(true); });
await frames(2);
await snap('apt-xr-03-home');
await clickWidget('main', "it.label === 'All on'", 'All on');
await frames(4);
T.check('"All on" lights every room from inside the headset', await ev(() => window.__residence.custom.home.rooms().every((r) => r.on)));
await clickWidget('main', "it.label === 'All off'", 'All off');
await frames(4);
T.check('"All off" switches them off', await ev(() => window.__residence.custom.home.rooms().every((r) => !r.on)));
await ev(() => window.__residence.custom.close());
await frames(2);

// ------------------------------------------------------------------ a wall still stops the arc
await ev(() => { const x = window.__residence.xr; x._placeHead(3.5, -2.4, 0); });
await frames(2);
const wall = await ev(() => {
  const x = window.__residence.xr, c = x.controllers.find((k) => k.hand === 'right'), V = window.__h.V;
  const res = [];
  for (let deg = -2; deg >= -34; deg -= 2) {
    const q = new c.ctrl.quaternion.constructor().setFromEuler(new c.ctrl.rotation.constructor(deg * Math.PI / 180, Math.PI / 2, 0, 'YXZ'));
    c.origin = new V(3.4, 1.3, -2.4); c.dir = new V(0, 0, -1).applyQuaternion(q);   // aiming west, toward the bathroom
    x._aim(c);
    if (c.aimPoint.x > 0.5 && c.aimPoint.x < 2.3) res.push({ deg, x: +c.aimPoint.x.toFixed(2), valid: c.aimValid });
  }
  x.arc.visible = false; x.dest.visible = false;
  return res;
});
T.check('an arc that lands in the bathroom is rejected (wall between)', wall.length > 0 && wall.every((r) => !r.valid), `${wall.length} landings, valid=${wall.filter((r) => r.valid).length}`);

// ------------------------------------------------------------------ exit
// aim at Exit VR and pull the trigger; the session ends, so no further XR frames are awaited
await ev(() => { const x = window.__residence.xr, p = x.ui.toolbar; p.update(true); const it = p.items.find((i) => i.key === 'exit'); window.__h.aim('right', window.__h.panelPoint(p, ...window.__h.center(it))); });
await frames(2);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 1));
await frames(2);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 0));   // releasing activates Exit VR; no more XR frames follow
await page.waitForFunction(() => !window.__residence.xr.presenting, null, { timeout: 120000 });
const out = await ev(() => { const R = window.__residence; return { mode: R.mode, hud: getComputedStyle(document.querySelector('#hud')).visibility, bp: R.custom.home.blueprint.on(), eye: R.camera.position.y }; });
T.check('leaving VR restores the desktop view', out.mode === 'walk' && out.hud !== 'hidden' && out.bp === false && Math.abs(out.eye - 1.65) < 0.05, JSON.stringify(out));

const ok = T.done(logs);
await browser.close();
process.exit(ok ? 0 : 1);
