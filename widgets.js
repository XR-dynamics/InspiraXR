/* =========================================================================
   InspiraXR — lightweight interactive demos (Canvas 2D, no dependencies)
   orrery · globe · gallery · timeline · scenario
   ========================================================================= */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;

export function fit(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr };
}

/* Runs fn(t, dt) every frame while the canvas is on screen. */
function run(canvas, fn) {
  let raf = 0, on = false, last = performance.now(), dead = false;
  const tick = now => {
    if (dead) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    fn(now / 1000, dt);
    raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(es => {
    on = es[0].isIntersecting;
    cancelAnimationFrame(raf);
    if (on && !reduce) { last = performance.now(); raf = requestAnimationFrame(tick); }
    else if (on) fn(performance.now() / 1000, 0);
  }, { rootMargin: "80px" });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { if (reduce || !on) fn(performance.now() / 1000, 0); });
  ro.observe(canvas);
  return () => { dead = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
}

/* ------------------------------------------------------------- ORRERY */
export const PLANETS = [
  { n: "Mercury", a: .17, p: .24, c: "#b9b2a8", r: 3.2, f: "The closest planet to the Sun. One orbit takes just 88 Earth days." },
  { n: "Venus", a: .25, p: .62, c: "#e5c892", r: 5, f: "The hottest planet, thanks to a dense carbon-dioxide atmosphere. One orbit takes about 225 days." },
  { n: "Earth", a: .34, p: 1, c: "#6fa8e8", r: 5.2, f: "The only world we know that supports life. One orbit takes 365.25 days." },
  { n: "Mars", a: .43, p: 1.88, c: "#d97a56", r: 4, f: "Home to Olympus Mons, the tallest volcano in the solar system. One orbit takes about 687 days." },
  { n: "Jupiter", a: .58, p: 11.86, c: "#d8b48c", r: 10, f: "The largest planet. Its Great Red Spot is a storm wider than Earth. One orbit takes almost 12 years." },
  { n: "Saturn", a: .73, p: 29.4, c: "#e8d7a8", r: 8.6, ring: true, f: "Famous for its rings of ice and rock. One orbit takes about 29 years." },
  { n: "Uranus", a: .86, p: 84, c: "#9fe0e0", r: 6.4, f: "Rotates on its side. One orbit takes 84 years." },
  { n: "Neptune", a: .97, p: 165, c: "#6a8cf0", r: 6.2, f: "The farthest planet. One orbit takes about 165 years." }
];

export function orrery(canvas, { interactive = false, onPick = () => {}, startIndex = 2 } = {}) {
  const ctx = canvas.getContext("2d");
  let sel = interactive ? startIndex : -1, hover = -1, pos = [], dragA = 0, mouse = null;
  const tilt = .36, ph = PLANETS.map((_, i) => i * 1.9 + .6);
  const stars = Array.from({ length: 90 }, () => [Math.random(), Math.random(), Math.random() * 1.1 + .2, Math.random()]);
  if (interactive) onPick(PLANETS[sel], sel);
  const draw = (t, dt) => {
    const { w, h, dpr } = fit(canvas); const cx = w / 2, cy = h / 2, R = Math.min(w * .47, h / tilt * .46);
    ctx.clearRect(0, 0, w, h);
    stars.forEach(s => { ctx.globalAlpha = .25 + .5 * (.5 + .5 * Math.sin(t * s[3] * 2 + s[0] * 9)); ctx.fillStyle = "#fff"; ctx.fillRect(s[0] * w, s[1] * h, s[2] * dpr, s[2] * dpr); });
    ctx.globalAlpha = 1;
    // sun glow
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .22);
    g.addColorStop(0, "rgba(255,236,190,1)"); g.addColorStop(.18, "rgba(255,206,130,.9)"); g.addColorStop(.5, "rgba(255,170,90,.18)"); g.addColorStop(1, "rgba(255,170,90,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * .22, 0, TAU); ctx.fill();
    // orbits
    PLANETS.forEach((p, i) => {
      ctx.beginPath(); ctx.ellipse(cx, cy, R * p.a, R * p.a * tilt, 0, 0, TAU);
      ctx.strokeStyle = i === sel ? "rgba(143,220,207,.7)" : "rgba(255,255,255,.12)"; ctx.lineWidth = (i === sel ? 1.6 : 1) * dpr; ctx.stroke();
    });
    // planets
    pos = PLANETS.map((p, i) => {
      if (!reduce) ph[i] += dt * TAU / (Math.pow(p.p, .62) * 15);
      const x = cx + Math.cos(ph[i]) * R * p.a, y = cy + Math.sin(ph[i]) * R * p.a * tilt;
      return { x, y, i, z: Math.sin(ph[i]) };
    });
    pos.slice().sort((a, b) => a.z - b.z).forEach(q => {
      const p = PLANETS[q.i], r = p.r * dpr * (1 + q.z * .12) * (w / (900 * dpr) + .55);
      if (p.ring) { ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 2.1, r * .7, -.3, 0, TAU); ctx.strokeStyle = "rgba(232,215,168,.7)"; ctx.lineWidth = 2 * dpr; ctx.stroke(); }
      const pg = ctx.createRadialGradient(q.x - r * .35, q.y - r * .35, r * .1, q.x, q.y, r);
      pg.addColorStop(0, "#fff"); pg.addColorStop(.25, p.c); pg.addColorStop(1, "#14161a");
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      if (q.i === sel || q.i === hover) {
        ctx.beginPath(); ctx.arc(q.x, q.y, r + 7 * dpr, 0, TAU); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
        ctx.font = `${12 * dpr}px Manrope, sans-serif`; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(p.n.toUpperCase(), q.x, q.y - r - 14 * dpr);
      }
    });
    if (interactive) { ctx.font = `${11 * dpr}px Manrope, sans-serif`; ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.textAlign = "left"; ctx.fillText("ORBIT SPEEDS NOT TO SCALE", 16 * dpr, h - 16 * dpr); }
  };
  const near = e => {
    const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
    const mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr; let best = -1, bd = 26 * dpr;
    pos.forEach(q => { const d = Math.hypot(q.x - mx, q.y - my); if (d < bd) { bd = d; best = q.i; } });
    return best;
  };
  if (interactive) {
    canvas.style.cursor = "pointer";
    canvas.addEventListener("pointermove", e => { hover = near(e); canvas.style.cursor = hover >= 0 ? "pointer" : "default"; if (reduce) draw(performance.now() / 1000, 0); });
    canvas.addEventListener("click", e => { const i = near(e); if (i >= 0) { sel = i; onPick(PLANETS[i], i); if (reduce) draw(0, 0); } });
  }
  const stop = run(canvas, draw);
  return { destroy: stop, select(i) { sel = i; onPick(PLANETS[i], i); } };
}

/* -------------------------------------------------------------- GLOBE */
export const DESTINATIONS = [
  { n: "Marbella", la: 36.51, lo: -4.88, f: "A resort city on Spain's Costa del Sol, known for its old town, marinas and beaches." },
  { n: "Granada", la: 37.18, lo: -3.6, f: "Home of the Alhambra, the hilltop palace-fortress of the Nasrid dynasty." },
  { n: "Barcelona", la: 41.39, lo: 2.17, f: "Gaudí's Sagrada Família, the Gothic Quarter and a long Mediterranean waterfront." },
  { n: "Lisbon", la: 38.72, lo: -9.14, f: "A city of seven hills, yellow trams and the old Alfama district above the Tagus." },
  { n: "Rome", la: 41.9, lo: 12.5, f: "Two thousand years of layered history, from the Colosseum to Baroque fountains." },
  { n: "Athens", la: 37.98, lo: 23.73, f: "The Acropolis and the Parthenon watch over one of Europe's oldest cities." },
  { n: "Marrakech", la: 31.63, lo: -7.99, f: "A walled medina, spice-scented souks and the Jemaa el-Fnaa square." },
  { n: "Istanbul", la: 41.01, lo: 28.98, f: "A city on two continents, with Hagia Sophia and the Bosphorus at its heart." }
];
export const WONDERS = [
  { n: "Sahara", la: 23, lo: 12, f: "The largest hot desert on Earth, spanning much of North Africa." },
  { n: "Amazon Basin", la: -4, lo: -62, f: "The world's largest tropical rainforest, home to a huge share of Earth's species." },
  { n: "Himalayas", la: 28, lo: 86.9, f: "Home to Mount Everest, about 8,849 metres above sea level." },
  { n: "Great Barrier Reef", la: -18.3, lo: 147.7, f: "The largest coral reef system in the world, off the coast of Queensland, Australia." },
  { n: "Alps", la: 46.5, lo: 9.5, f: "Europe's great mountain range, stretching across eight countries." },
  { n: "Nile", la: 27, lo: 31, f: "One of the longest rivers in the world, the lifeline of ancient Egypt." },
  { n: "Patagonia", la: -49, lo: -72.5, f: "A remote region at the southern tip of South America, with glaciers and steppe." }
];

export function globe(canvas, { pins = DESTINATIONS, interactive = false, onPick = () => {}, arcs = true, startIndex = 0 } = {}) {
  const ctx = canvas.getContext("2d");
  let rot = -.1 - pins[startIndex].lo * Math.PI / 180 + 0, tiltX = .45, sel = interactive ? startIndex : -1, hover = -1, drag = null, vis = [], idle = 0;
  const target = { rot };
  if (interactive) { rot = target.rot = -pins[sel].lo * Math.PI / 180; onPick(pins[sel], sel); }
  const P = (la, lo, R, cx, cy) => {
    const a = la * Math.PI / 180, b = lo * Math.PI / 180 + rot;
    let x = Math.cos(a) * Math.sin(b), y = Math.sin(a), z = Math.cos(a) * Math.cos(b);
    const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX), z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
    return { x: cx + x * R, y: cy - y2 * R, z: z2 };
  };
  const draw = (t, dt) => {
    const { w, h, dpr } = fit(canvas); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .38;
    ctx.clearRect(0, 0, w, h);
    if (!interactive && !reduce) rot += dt * .12;
    if (interactive && !drag) { let d = target.rot - rot; d = Math.atan2(Math.sin(d), Math.cos(d)); rot += d * Math.min(1, dt * 4); }
    const g = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R * 1.05);
    g.addColorStop(0, "rgba(40,70,92,.55)"); g.addColorStop(1, "rgba(8,12,16,.9)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(143,220,207,.35)"; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
    ctx.lineWidth = 1 * dpr;
    for (let la = -60; la <= 60; la += 20) line(i => P(la, i * 6 - 180, R, cx, cy), 61);
    for (let lo = -180; lo < 180; lo += 20) line(i => P(i * 3 - 90, lo, R, cx, cy), 61);
    function line(fn, n) {
      let prev = null;
      for (let i = 0; i < n; i++) {
        const p = fn(i);
        if (prev && p.z > 0 && prev.z > 0) { ctx.strokeStyle = `rgba(134,180,240,${.1 + .22 * p.z})`; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
        prev = p;
      }
    }
    // arcs between pins
    if (arcs) {
      const ph = (t * .25) % 1;
      for (let i = 0; i < pins.length; i++) {
        const A = pins[i], B = pins[(i + 1) % pins.length]; let prev = null;
        for (let k = 0; k <= 24; k++) {
          const u = k / 24, la = A.la + (B.la - A.la) * u, lo = A.lo + (B.lo - A.lo) * u, lift = 1 + .09 * Math.sin(Math.PI * u);
          const q = P(la, lo, R * lift, cx, cy);
          if (prev && q.z > 0 && prev.z > 0) { ctx.strokeStyle = `rgba(143,220,207,${.18 + .5 * Math.max(0, 1 - Math.abs(u - ph) * 4)})`; ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
          prev = q;
        }
      }
    }
    vis = [];
    pins.forEach((d, i) => {
      const q = P(d.la, d.lo, R, cx, cy); if (q.z <= .02) return; vis.push({ ...q, i });
      const on = i === sel || i === hover, r = (on ? 6 : 3.6) * dpr;
      const pulse = reduce ? 0 : (t * .8 + i * .3) % 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, r + pulse * 14 * dpr, 0, TAU); ctx.strokeStyle = `rgba(226,203,163,${.5 * (1 - pulse)})`; ctx.stroke();
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fillStyle = on ? "#fff" : "#e2cba3"; ctx.fill();
      if (on && interactive) { ctx.font = `${(on ? 13 : 11) * dpr}px Manrope, sans-serif`; ctx.fillStyle = on ? "#fff" : "rgba(255,255,255,.7)"; ctx.textAlign = "left"; ctx.fillText(d.n, q.x + 11 * dpr, q.y + 4 * dpr); }
    });
  };
  const near = e => {
    const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width, mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr; let best = -1, bd = 24 * dpr;
    vis.forEach(q => { const d = Math.hypot(q.x - mx, q.y - my); if (d < bd) { bd = d; best = q.i; } }); return best;
  };
  if (interactive) {
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, rot, moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
    canvas.addEventListener("pointermove", e => {
      if (drag) { const dx = e.clientX - drag.x; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(e.clientY - drag.y)); rot = drag.rot + dx * .008; target.rot = rot; tiltX = Math.max(.1, Math.min(.9, tiltX + (e.clientY - drag.y) * .0004)); if (reduce) draw(0, 0); }
      else { hover = near(e); if (reduce) draw(0, 0); }
    });
    const up = e => { if (drag && drag.moved < 5) { const i = near(e); if (i >= 0) pick(i); } drag = null; canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => { drag = null; });
  }
  function pick(i) { sel = i; target.rot = -pins[i].lo * Math.PI / 180; idle = 4; onPick(pins[i], i); if (reduce) { rot = target.rot; draw(0, 0); } }
  const stop = run(canvas, draw);
  return { destroy: stop, select: pick };
}

/* ------------------------------------------------------------ GALLERY */
export function gallery(host, items) {
  host.innerHTML = `<div class="gal">${items.map((it, i) => `<img src="${it.src}" alt="${it.alt}" ${i ? 'loading="lazy"' : ""}>`).join("")}<div class="gal-cap"></div><div class="gal-dots">${items.map((_, i) => `<button aria-label="Show image ${i + 1}"></button>`).join("")}</div></div>`;
  const imgs = [...host.querySelectorAll("img")], dots = [...host.querySelectorAll(".gal-dots button")], cap = host.querySelector(".gal-cap");
  let i = 0, timer;
  const show = n => { i = n; imgs.forEach((m, k) => m.classList.toggle("on", k === n)); dots.forEach((d, k) => d.classList.toggle("on", k === n)); cap.textContent = items[n].cap; };
  dots.forEach((d, k) => d.addEventListener("click", () => { show(k); restart(); }));
  const restart = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => show((i + 1) % items.length), 5200); };
  show(0); restart();
  return { destroy() { clearInterval(timer); } };
}

/* ----------------------------------------------------------- TIMELINE */
export const ERAS = [
  { y: "c. 2560 BCE", t: "Ancient Egypt", d: "The Great Pyramid of Giza is raised for the pharaoh Khufu and stays the tallest human-made structure for nearly four thousand years." },
  { y: "438 BCE", t: "Classical Athens", d: "The Parthenon is completed on the Acropolis, a temple whose proportions are still studied by architects today." },
  { y: "80 CE", t: "Imperial Rome", d: "The Colosseum opens in Rome, an amphitheatre that could seat tens of thousands of spectators." },
  { y: "1238 – 1492", t: "Medieval Granada", d: "Under the Nasrid dynasty the Alhambra grows into a palace city of water, light and geometric ornament." },
  { y: "1436", t: "Renaissance Florence", d: "Brunelleschi's dome crowns Florence Cathedral, built without a full wooden support frame." },
  { y: "1889", t: "Paris, Industrial Age", d: "The Eiffel Tower opens for the World's Fair and becomes the tallest structure in the world." }
];
export function timeline(host) {
  host.innerHTML = `<div class="timeline"><div class="tl-card"><div><p class="demo-info"><span class="k" id="tlY"></span></p><h5 id="tlT" style="font-family:var(--serif);font-weight:500;font-size:clamp(30px,3.4vw,48px);line-height:1.05;margin:8px 0 0"></h5></div><p id="tlD" style="color:#b6bec4"></p></div>
  <input class="tl-range" type="range" min="0" max="${ERAS.length - 1}" step="1" value="0" aria-label="Choose an era"><div class="tl-eras">${ERAS.map(e => `<span>${e.t.split(",")[0].split(" ").slice(-1)[0]}</span>`).join("")}</div></div>`;
  const r = host.querySelector("input"), y = host.querySelector("#tlY"), t = host.querySelector("#tlT"), d = host.querySelector("#tlD");
  const set = () => { const e = ERAS[+r.value]; y.textContent = e.y; t.textContent = e.t; d.textContent = e.d; };
  r.addEventListener("input", set); set();
}

/* ----------------------------------------------------------- SCENARIO */
export const SCENARIO = [
  { q: "A buyer says: “I can't tell if the living room is big enough.” What do you do?", o: [["Quote the floor area in square metres", 0, "Numbers rarely settle it. People judge space by feeling it, not by reading it."], ["Walk them to the sofa and let them turn around at full scale", 1, "Exactly. Standing in the room at true size answers the question without a word."], ["Send another render by email", 0, "A still is a good reminder, but it cannot show proportion or flow."]] },
  { q: "Halfway through, the client wants to see the walls in a darker stone.", o: [["Note it down and come back next week", 0, "That breaks the decision moment and the momentum with it."], ["Switch the finish live and compare both versions", 1, "Right. Live changes keep one conversation and one decision."], ["Explain why the original choice is better", 0, "Let them see it first. Opinions land better when the client has chosen."]] }
];
export function scenario(host) {
  let i = 0, score = 0;
  const show = () => {
    if (i >= SCENARIO.length) { host.innerHTML = `<div class="demo-info scn"><span class="k">Session complete</span><h5>${score} of ${SCENARIO.length} decisions on target</h5><p>Immersive training lets people practise real situations safely, then repeat them until they feel natural.</p><button class="pill" id="scnAgain">Run it again</button></div>`; host.querySelector("#scnAgain").onclick = () => { i = 0; score = 0; show(); }; return; }
    const s = SCENARIO[i];
    host.innerHTML = `<div class="demo-info scn"><span class="k">Scenario ${i + 1} of ${SCENARIO.length}</span><p class="q">${s.q}</p><div class="opts">${s.o.map((o, k) => `<button class="opt" data-k="${k}">${o[0]}</button>`).join("")}</div><p class="fb" aria-live="polite"></p></div>`;
    host.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
      const o = s.o[+b.dataset.k]; host.querySelectorAll(".opt").forEach(x => x.disabled = true);
      b.classList.add(o[1] ? "good" : "bad"); host.querySelector(".fb").textContent = o[2]; if (o[1]) score++;
      const n = document.createElement("button"); n.className = "pill"; n.textContent = i + 1 < SCENARIO.length ? "Next scenario →" : "See result →"; n.onclick = () => { i++; show(); }; host.querySelector(".scn").append(n);
    }));
  };
  show();
}
