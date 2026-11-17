/* InspiraXR brochure: realistic page-turn reader (StPageFlip, MIT, vendored in assets/vendor).
   Pages are images in assets/img/brochure/p1..p8.webp. Two-page spread on wide screens, single page on narrow ones.
   Drag a page corner, click a page, swipe, or use the arrows / keyboard. */
const N = 8;
const SRC = i => `assets/img/brochure/p${i + 1}.webp`;
const ES = {
  chap: ["Portada", "Por qué inmersivo", "Los problemas que resolvemos", "Experiencias", "De los planos a la experiencia", "Yates", "Contacto"],
  page: (a, b) => b ? `Páginas ${a}–${b} de ${N}` : `Página ${a} de ${N}`,
};
const EN = {
  chap: ["Cover", "Why immersive", "The problems we solve", "Experiences", "Plans to experience", "Yacht use case", "Contact"],
  page: (a, b) => b ? `Pages ${a}–${b} of ${N}` : `Page ${a} of ${N}`,
};
const CHAP_PAGE = [0, 1, 2, 4, 5, 6, 7];   // first page index of each chapter
const HOT = 2;                              // chapter to highlight (the pain points)
const L = () => (document.documentElement.lang === "es" ? ES : EN);

const bk = document.getElementById("bk"), book = document.getElementById("bkBook"), stage = document.getElementById("bkStage");
const chap = document.getElementById("bkChap"), count = document.getElementById("bkCount");
const prev = document.getElementById("bkPrev"), next = document.getElementById("bkNext"), closeBtn = document.getElementById("bkClose");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let pf = null, cur = 0, opener = null, libP = null, mode = "";

function lib() {
  if (window.St) return Promise.resolve();
  return libP || (libP = new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = "assets/vendor/page-flip.browser.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  }));
}
function dims() {
  const bar = bk.querySelector(".bk-bar").offsetHeight, foot = bk.querySelector(".bk-foot").offsetHeight;
  const availH = innerHeight - bar - foot - 24, availW = innerWidth - (innerWidth < 600 ? 24 : 80);
  const spread = innerWidth > 820 && innerWidth / innerHeight > 1.05, r = 794 / 1123, cols = spread ? 2 : 1;
  const ph = Math.max(200, Math.min(availH, availW / (cols * r)));
  return { spread, pw: ph * r, ph };
}
function build(startPage) {
  if (pf) { try { pf.destroy(); } catch (_) {} pf = null; }
  book.innerHTML = "";
  const d = dims(); mode = d.spread ? "spread" : "single";
  const w = Math.round(d.pw * (d.spread ? 2 : 1)), h = Math.round(d.ph);
  book.style.setProperty("--bw", w + "px"); book.style.setProperty("--bh", h + "px");
  const host = document.createElement("div"); book.appendChild(host);
  for (let i = 0; i < N; i++) {
    const pg = document.createElement("div");
    pg.className = "bk-pg" + (i % 2 ? "" : " r");
    if (i === 0 || i === N - 1) pg.dataset.density = "hard";
    const im = new Image(); im.alt = `Page ${i + 1}`; im.draggable = false; im.src = SRC(i); pg.appendChild(im); host.appendChild(pg);
  }
  pf = new St.PageFlip(host, {
    width: 794, height: 1123, size: "stretch",
    minWidth: d.spread ? 100 : Math.round(d.pw) + 1, maxWidth: 2400, minHeight: 100, maxHeight: 3400,
    showCover: true, usePortrait: true, startPage: startPage || 0, drawShadow: true, maxShadowOpacity: 0.55,
    flippingTime: reduce ? 30 : 1100, swipeDistance: 25, mobileScrollSupport: false, clickEventForward: false, useMouseEvents: true,
  });
  pf.loadFromHTML([...host.querySelectorAll(".bk-pg")]);
  cur = pf.getCurrentPageIndex();
  pf.on("flip", e => { cur = e.data; ui(); });
  pf.on("changeOrientation", () => ui());
  ui();
}
function visible() {
  const portrait = pf && pf.getOrientation() === "portrait";
  if (portrait) return [cur];
  if (cur === 0) return [0];
  if (cur >= N - 1) return [N - 1];
  return [cur, cur + 1];
}
function ui() {
  const v = visible();
  count.textContent = L().page(v[0] + 1, v[1] !== undefined ? v[1] + 1 : 0);
  prev.disabled = cur === 0; next.disabled = v[v.length - 1] >= N - 1;
  [...chap.children].forEach((b, i) => {
    const a = CHAP_PAGE[i], z = (CHAP_PAGE[i + 1] ?? N) - 1, on = v.some(p => p >= a && p <= z);
    b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
  });
}
function chapters() {
  chap.innerHTML = "";
  L().chap.forEach((name, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "bk-tab" + (i === HOT ? " hot" : ""); b.textContent = name; b.setAttribute("role", "tab");
    b.addEventListener("click", () => { if (pf) pf.flip(CHAP_PAGE[i]); });
    chap.appendChild(b);
  });
}
async function open(from) {
  opener = from || document.activeElement; chapters();
  bk.hidden = false; document.documentElement.style.overflow = "hidden";
  closeBtn.focus({ preventScroll: true });
  if (location.hash !== "#brochure") history.replaceState(null, "", "#brochure");
  try { await lib(); } catch (_) { return; }
  if (bk.hidden) return;
  build(0);
  requestAnimationFrame(() => bk.classList.add("show"));
  // open the cover after a beat so the page turn is seen
  setTimeout(() => { if (!bk.hidden && pf && cur === 0) pf.flipNext(); }, reduce ? 0 : 900);
}
function close() {
  bk.classList.remove("show"); document.documentElement.style.overflow = "";
  setTimeout(() => { bk.hidden = true; if (pf) { try { pf.destroy(); } catch (_) {} pf = null; book.innerHTML = ""; } }, 400);
  if (location.hash === "#brochure") history.replaceState(null, "", location.pathname + location.search);
  if (opener && opener.focus) opener.focus({ preventScroll: true });
}
document.addEventListener("click", e => { const t = e.target.closest("[data-brochure]"); if (t) { e.preventDefault(); open(t); } });
closeBtn.addEventListener("click", close);
next.addEventListener("click", () => pf && pf.flipNext());
prev.addEventListener("click", () => pf && pf.flipPrev());
addEventListener("keydown", e => {
  if (bk.hidden) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowRight" || e.key === "PageDown") pf && pf.flipNext();
  else if (e.key === "ArrowLeft" || e.key === "PageUp") pf && pf.flipPrev();
});
let rt; addEventListener("resize", () => { if (bk.hidden || !pf) return; clearTimeout(rt); rt = setTimeout(() => build(cur), 150); });
new MutationObserver(() => { if (!bk.hidden) { chapters(); ui(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
const hash = () => { if (location.hash === "#brochure" && bk.hidden) open(null); };
addEventListener("hashchange", hash); addEventListener("DOMContentLoaded", hash); if (document.readyState !== "loading") hash();
