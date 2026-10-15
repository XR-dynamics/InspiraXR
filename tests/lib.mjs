/*
 * Shared helpers for the browser tests. They drive the real app in headless Chromium (software
 * WebGL, so frames are slow but exact). For headset tests, Meta's IWER runtime emulates a Quest 3
 * and its Touch controllers through the genuine WebXR API surface.
 *
 *   APP_URL        app under test            (default http://localhost:5173/)
 *   CHROMIUM_PATH  Chromium/Chrome binary    (default: Playwright's own)
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP = process.env.APP_URL || 'http://localhost:5173/';

export async function launch({ width = 960, height = 600, xr = false } = {}) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.setDefaultTimeout(600000);
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  if (xr) {
    const iwer = fs.readFileSync(path.join(here, '../node_modules/iwer/build/iwer.min.js'), 'utf8');
    await page.addInitScript(`${iwer}
      ;(() => {
        const install = () => {
          const d = new IWER.XRDevice(IWER.metaQuest3);
          d.installRuntime({ forceInstall: true });
          d.position.set(0, 1.6, 0);          // standing head height above the floor
          window.__xrDevice = d;
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
      })();`);
  }
  return { browser, page, logs };
}

export async function openApp(page, query = '') {
  await page.goto(`${APP}?${query}`);
  await page.waitForFunction(() => document.querySelector('#loader')?.classList.contains('hidden'), null, { timeout: 900000 });
}

/** Tiny assertion collector so a run ends with an honest PASS/FAIL table. */
export function suite(name) {
  const rows = [];
  return {
    check(label, ok, detail = '') { rows.push({ label, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`); return !!ok; },
    note(text) { console.log(`      ${text}`); },
    done(logs = []) {
      const bad = rows.filter((r) => !r.ok);
      // Offline sandboxes cannot reach the font CDN or the controller-model CDN; those failures are
      // environmental. Every other console error or uncaught exception fails the run.
      const errs = logs.filter((l) => !/parallel_shader|ERR_TUNNEL_CONNECTION_FAILED|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_/.test(l));
      console.log(`\n${name}: ${rows.length - bad.length}/${rows.length} passed${errs.length ? `, ${errs.length} console error(s)` : ''}`);
      errs.slice(0, 8).forEach((l) => console.log(`  ${l}`));
      return bad.length === 0 && errs.length === 0;
    },
  };
}
