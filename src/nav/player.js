import * as THREE from 'three';
import { H } from '../world/layout.js';
import { clamp, lerp, easeInOut } from '../world/util.js';

/*
 * First-person visitor. Eye height 1.65 m, unhurried walking pace with soft
 * acceleration, subtle gait, smoothed look. Collides with walls, furniture
 * and closed doors (which open when you lean into them). Room selection and
 * floor clicks walk the visitor along an A* route — never teleporting.
 */

const WALK = 1.35;
const BRISK = 2.2;

export class Player {
  constructor(camera, nav, interactions) {
    this.camera = camera;
    this.nav = nav;
    this.interactions = interactions;
    this.pos = new THREE.Vector2(6.0, 15.2);
    this.vel = new THREE.Vector2();
    this.yaw = 0; this.pitch = 0;
    this.tYaw = 0; this.tPitch = 0;
    this.keys = new Set();
    this.enabled = false;
    this.bob = 0;
    this.bobAmp = 0;
    this.route = null;
    this.blockedTime = 0;
    this.onArrive = null;
    this.eye = H.eye;
    this.shift = 0;
    this.tShift = 0;
  }

  setPose(x, z, yaw, pitch = 0) {
    this.pos.set(x, z);
    this.yaw = this.tYaw = yaw;
    this.pitch = this.tPitch = pitch;
  }

  lookAt(x, y, z, immediate = false) {
    const dx = x - this.pos.x, dz = z - this.pos.y;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(y - this.eye, Math.hypot(dx, dz));
    this.tYaw = this.yaw + wrap(yaw - this.yaw);
    this.tPitch = pitch;
    if (immediate) { this.yaw = this.tYaw; this.pitch = this.tPitch; }
  }

  look(dx, dy) {
    this.tYaw -= dx * 0.0032;
    this.tPitch = clamp(this.tPitch - dy * 0.0028, -1.1, 1.1);
    if (this.route) this.route.manualLook = true;
  }

  /** Walk along an A* route to (x,z), optionally looking at `look` on arrival. */
  walkTo(x, z, look = null, onArrive = null) {
    const path = this.nav.findPath(this.pos.x, this.pos.y, x, z);
    if (!path || path.length < 2) {
      if (look) this.lookAt(look[0], look[1], look[2]);
      onArrive?.();
      return false;
    }
    path[0] = [this.pos.x, this.pos.y];
    const pts = path.map(([a, b]) => new THREE.Vector2(a, b));
    let len = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) { len += pts[i].distanceTo(pts[i - 1]); cum.push(len); }
    const speed = clamp(len / 6.5, 1.25, 3.0);
    this.route = { pts, cum, len, s: 0, speed, look, manualLook: false, t: 0 };
    this.onArrive = onArrive;
    return true;
  }

  cancelRoute() { this.route = null; }

  _pointAt(route, s) {
    const { pts, cum } = route;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = clamp((s - cum[i - 1]) / seg, 0, 1);
    return new THREE.Vector2().lerpVectors(pts[i - 1], pts[i], t);
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const turn = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    if (turn) this.tYaw -= turn * dt * 1.1;
    if ((fwd || str) && this.route) this.route = null;

    let moving = 0;
    if (this.route) {
      moving = this._followRoute(dt);
    } else {
      const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? BRISK : WALK;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const want = new THREE.Vector2(-sin * fwd + cos * str, -cos * fwd - sin * str);
      if (want.lengthSq() > 1) want.normalize();
      want.multiplyScalar(speed);
      const a = 1 - Math.exp(-dt * (want.lengthSq() > 0 ? 3.2 : 5.0));
      this.vel.lerp(want, a);
      if (this.vel.lengthSq() < 1e-6) this.vel.set(0, 0);
      const step = this.vel.clone().multiplyScalar(dt);
      const moved = this._move(step);
      if (!moved && want.lengthSq() > 0) {
        this.blockedTime += dt;
        const ahead = this.pos.clone().addScaledVector(want.clone().normalize(), 0.35);
        const door = this.nav.doorAt(ahead.x, ahead.y);
        if (door >= 0 && this.blockedTime > 0.25) {
          this.interactions.doorByNav(door)?.set(true);
          this.blockedTime = 0;
        }
      } else this.blockedTime = 0;
      moving = this.vel.length();
    }

    // smoothed look
    const la = 1 - Math.exp(-dt * 7.5);
    this.yaw = lerp(this.yaw, this.tYaw, la);
    this.pitch = lerp(this.pitch, this.tPitch, la);
    this.shift = lerp(this.shift, this.tShift, 1 - Math.exp(-dt * 2.5));

    // gentle gait
    this.bobAmp = lerp(this.bobAmp, clamp(moving / WALK, 0, 1.4), 1 - Math.exp(-dt * 4));
    this.bob += dt * moving * 5.6;
    const by = Math.sin(this.bob) * 0.011 * this.bobAmp;
    const bx = Math.cos(this.bob * 0.5) * 0.006 * this.bobAmp;

    const cam = this.camera;
    cam.position.set(this.pos.x + Math.cos(this.yaw) * bx, this.eye + by, this.pos.y - Math.sin(this.yaw) * bx);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Move with wall sliding; returns true when the body actually advanced. */
  _move(step) {
    const nav = this.nav;
    const eps = 1e-5;
    const nx = this.pos.x + step.x, nz = this.pos.y + step.y;
    // never trap the visitor if they somehow start inside an obstacle
    if (!nav.free(this.pos.x, this.pos.y)) { this.pos.set(nx, nz); return true; }
    if (nav.free(nx, nz)) { this.pos.set(nx, nz); return step.lengthSq() > eps * eps; }
    if (Math.abs(step.x) > eps && nav.free(nx, this.pos.y)) { this.pos.x = nx; this.vel.y *= 0.5; return true; }
    if (Math.abs(step.y) > eps && nav.free(this.pos.x, nz)) { this.pos.y = nz; this.vel.x *= 0.5; return true; }
    this.vel.multiplyScalar(0.3);
    return false;
  }

  _followRoute(dt) {
    const r = this.route;
    r.t += dt;
    // ease in over the first metre and out over the last 1.6 m
    const remain = r.len - r.s;
    const accel = clamp(r.t / 1.1, 0, 1);
    const decel = clamp(remain / 1.6, 0.12, 1);
    const v = r.speed * easeInOut(accel) * Math.sqrt(decel);
    r.s = Math.min(r.len, r.s + v * dt);
    const p = this._pointAt(r, r.s);
    // open doors on the way
    for (let ahead = 0.3; ahead <= 3.2; ahead += 0.3) {
      const q = this._pointAt(r, Math.min(r.len, r.s + ahead));
      const d = this.nav.doorAt(q.x, q.y);
      if (d >= 0) this.interactions.doorByNav(d)?.set(true);
    }
    // never pass through a door that is still swinging open
    const blocking = this.nav.doorAt(p.x, p.y);
    if (blocking < 0 || this.nav.free(p.x, p.y)) this.pos.copy(p);
    else r.s = Math.max(0, r.s - v * dt);
    if (!r.manualLook) {
      const la = this._pointAt(r, Math.min(r.len, r.s + 1.4));
      const dir = la.clone().sub(this.pos);
      if (remain < 2.2 && r.look) {
        this.lookAt(r.look[0], r.look[1], r.look[2]);
      } else if (dir.lengthSq() > 0.01) {
        const yaw = Math.atan2(-dir.x, -dir.y);
        this.tYaw = this.yaw + wrap(yaw - this.yaw);
        this.tPitch = lerp(this.tPitch, -0.04, 0.05);
      }
    }
    if (r.s >= r.len - 1e-3) {
      this.route = null;
      if (r.look && !r.manualLook) this.lookAt(r.look[0], r.look[1], r.look[2]);
      const cb = this.onArrive; this.onArrive = null; cb?.();
    }
    return v;
  }
}

export function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
