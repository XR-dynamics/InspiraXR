/* InspiraXR brochure: page-flip reader. Pages are images in assets/img/brochure/p1..p8.webp.
   Two-page spread on wide screens, single page on narrow ones. */
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
let mode = "", cur = 0, leaves = [], opener = null, loaded = false;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function leafCount() { return mode === "spread" ? N / 2 : N; }
function pageToCur(idx) { return mode === "spread" ? Math.ceil(idx / 2) : idx; }
function curToPage() { return mode === "spread" ? Math.max(0, cur * 2 - 1) : cur; }   // first visible page index

function build() {
  const want = innerWidth > 820 && innerWidth / innerHeight > 1.05 ? "spread" : "single";
  if (want !== mode) {
    const idx = mode ? curToPage() : 0;
    mode = want; book.className = "bk-book " + mode; book.innerHTML = ""; leaves = [];
    const n = leafCount();
    for (let i = 0; i < n; i++) {
      const leaf = document.createElement("div"); leaf.className = "bk-leaf";
      const f = (src, cls, alt) => { const d = document.createElement("div"); d.className = "bk-face " + cls; if (src) { const im = new Image(); im.alt = alt; im.draggable = false; im.decoding = "async"; im.src = src; d.appendChild(im); } return d; };
      if (mode === "spread") { leaf.append(f(SRC(i * 2), "front", `Page ${i * 2 + 1}`), f(SRC(i * 2 + 1), "back", `Page ${i * 2 + 2}`)); }
      else leaf.append(f(SRC(i), "front", `Page ${i + 1}`), f("", "back", ""));
      book.appendChild(leaf); leaves.push(leaf);
    }
    cur = pageToCur(idx);
  }
  size(); paint(false);
}
function size() {
  const bar = bk.querySelector(".bk-bar").offsetHeight, foot = bk.querySelector(".bk-foot").offsetHeight;
  const availH = innerHeight - bar - foot - 24, availW = innerWidth - (innerWidth < 600 ? 24 : 80);
  const r = 794 / 1123, cols = mode === "spread" ? 2 : 1;
  let ph = Math.min(availH, availW / (cols * r)); ph = Math.max(ph, 200);
  book.style.setProperty("--bh", ph + "px"); book.style.setProperty("--bw", ph * r * cols + "px");
}
function paint(animate) {
  const n = leaves.length;
  leaves.forEach((lf, i) => {
    const flipped = i < cur;
    lf.classList.toggle("flip", flipped);
    lf.style.zIndex = flipped ? i : n - i;
  });
  if (mode === "spread") book.style.transform = cur === 0 ? "translateX(-25%)" : cur === n ? "translateX(25%)" : "translateX(0)";
  else book.style.transform = "none";
  const first = curToPage();
  const showTwo = mode === "spread" && cur > 0 && cur < n;
  count.textContent = L().page(first + 1, showTwo ? first + 2 : 0);
  prev.disabled = cur === 0; next.disabled = cur === n;
  marks();
}
function marks() {
  const n = leaves.length, first = curToPage(), vis = mode === "spread" ? (cur === 0 ? [0] : cur === n ? [N - 1] : [first, first + 1]) : [first];
  [...chap.children].forEach((b, i) => {
    const a = CHAP_PAGE[i], z = (CHAP_PAGE[i + 1] ?? N) - 1, on = vis.some(p => p >= a && p <= z);
    b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
  });
}
function turn(to) {
  const n = leaves.length; to = Math.max(0, Math.min(n, to)); if (to === cur) return;
  const lo = Math.min(cur, to), hi = Math.max(cur, to);
  for (let i = lo; i < hi; i++) { const lf = leaves[i]; lf.classList.add("turn"); lf.style.zIndex = 200; setTimeout(() => lf.classList.remove("turn"), reduce ? 20 : 950); }
  const dir = to > cur ? 1 : -1; cur = to;
  // restore stacking order once the leaf has landed
  setTimeout(() => paint(false), reduce ? 20 : 920);
  // start the flip now (without resetting z-index immediately)
  leaves.forEach((lf, i) => lf.classList.toggle("flip", i < cur));
  const nn = leaves.length;
  if (mode === "spread") book.style.transform = cur === 0 ? "translateX(-25%)" : cur === nn ? "translateX(25%)" : "translateX(0)";
  const first = curToPage(), showTwo = mode === "spread" && cur > 0 && cur < nn;
  count.textContent = L().page(first + 1, showTwo ? first + 2 : 0);
  prev.disabled = cur === 0; next.disabled = cur === nn;
  marks(); void dir;
}
function chapters() {
  chap.innerHTML = "";
  L().chap.forEach((name, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "bk-tab" + (i === HOT ? " hot" : ""); b.textContent = name; b.setAttribute("role", "tab");
    b.addEventListener("click", () => turn(pageToCur(CHAP_PAGE[i])));
    chap.appendChild(b);
  });
}
function open(from) {
  opener = from || document.activeElement; chapters();
  if (!loaded) { loaded = true; }
  bk.hidden = false; build(); cur = 0; paint(false);
  requestAnimationFrame(() => bk.classList.add("show"));
  document.documentElement.style.overflow = "hidden";
  closeBtn.focus({ preventScroll: true });
  if (location.hash !== "#brochure") history.replaceState(null, "", "#brochure");
  // open the book on the first spread after a beat, so the page turn is seen
  setTimeout(() => { if (!bk.hidden && cur === 0) turn(1); }, reduce ? 0 : 700);
}
function close() {
  bk.classList.remove("show"); document.documentElement.style.overflow = "";
  setTimeout(() => { bk.hidden = true; }, 400);
  if (location.hash === "#brochure") history.replaceState(null, "", location.pathname + location.search);
  if (opener && opener.focus) opener.focus({ preventScroll: true });
}
document.addEventListener("click", e => { const t = e.target.closest("[data-brochure]"); if (t) { e.preventDefault(); open(t); } });
closeBtn.addEventListener("click", close);
next.addEventListener("click", () => turn(cur + 1));
prev.addEventListener("click", () => turn(cur - 1));
addEventListener("keydown", e => {
  if (bk.hidden) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowRight" || e.key === "PageDown") turn(cur + 1);
  else if (e.key === "ArrowLeft" || e.key === "PageUp") turn(cur - 1);
});
// click left/right half of the book, or swipe
let sx = null, sy = 0;
stage.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
stage.addEventListener("pointerup", e => {
  if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { turn(cur + (dx < 0 ? 1 : -1)); return; }
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
    const r = book.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right) return;
    const mid = mode === "spread" ? r.left + r.width / 2 : r.left + r.width * 0.5;
    turn(cur + (e.clientX > mid ? 1 : -1));
  }
});
stage.addEventListener("pointercancel", () => { sx = null; });
let rt; addEventListener("resize", () => { if (bk.hidden) return; clearTimeout(rt); rt = setTimeout(build, 120); });
// language switch while open
new MutationObserver(() => { if (!bk.hidden) { chapters(); paint(false); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
// deep link
const hash = () => { if (location.hash === "#brochure" && bk.hidden) open(null); };
addEventListener("hashchange", hash); addEventListener("DOMContentLoaded", hash); if (document.readyState !== "loading") hash();
