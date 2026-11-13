/* =========================================================================
   InspiraXR — site logic
   Edit CONFIG, CATEGORIES, PROJECTS below to update the site content.
   ========================================================================= */

/* ------------------------------------------------------------------ CONFIG */
const CONFIG = {
  // Contact form: set this to your form backend URL (Formspree, Getform, Basin, your own API…).
  // It receives a JSON POST: { name, email, organization, category, message }.
  // While empty, the form opens the visitor's email app instead and says so.
  formEndpoint: "",
  contactEmail: "techlead@iverseai.com"
};

/* -------------------------------------------------------------- CATEGORIES
   Replace any image by dropping a new file at the same path in assets/img. */
const CATEGORIES = [
  { id: "architecture", no: "01", name: "Architecture & Design", short: "Experience design before it becomes reality.", image: "assets/img/cat-architecture.webp",
    headline: "Experience Design Before It Becomes Reality.",
    desc: "Transform architectural concepts into immersive environments where clients can explore, interact with, and experience spaces before construction begins.",
    services: ["Immersive architectural walkthroughs", "Interactive interior design visualization", "Real-time material and texture customization", "Virtual design reviews", "Architectural concept presentations", "Interactive building visualization", "VR and MR design experiences", "3D spatial visualization"] },
  { id: "real-estate", no: "02", name: "Real Estate & Property", short: "Explore tomorrow's spaces, today.", image: "assets/img/cat-realestate.webp",
    headline: "Explore Tomorrow's Spaces, Today.",
    desc: "Experience properties before they are built. InspiraXR helps developers, agencies, and buyers explore residential and commercial environments through interactive immersive property experiences.",
    services: ["Virtual property tours", "Off-plan real estate visualization", "Interactive apartment walkthroughs", "Residential development experiences", "Commercial property visualization", "Virtual property showrooms", "Interactive floor plans", "Real-time property customization"] },
  { id: "museums", no: "03", name: "Museums & Cultural Heritage", short: "Bringing history, art and culture to life.", image: "assets/img/cat-museums.webp",
    headline: "Bringing History, Art, and Culture to Life.",
    desc: "Transform museums and cultural spaces into immersive journeys where visitors can explore history, interact with digital exhibits, and experience stories beyond traditional displays.",
    services: ["Immersive museum exhibitions", "Virtual museums and galleries", "Historical environment reconstruction", "Interactive cultural storytelling", "Digital heritage preservation experiences", "AR-enhanced exhibitions", "Interactive historical artifacts", "Immersive educational installations"] },
  { id: "education", no: "04", name: "Education & Training", short: "Learning beyond the classroom.", image: "assets/img/cat-education.webp",
    headline: "Learning Beyond the Classroom.",
    desc: "Transform traditional learning into engaging immersive experiences that allow students and professionals to explore, interact, practice, and understand complex concepts through experiential learning.",
    services: ["Immersive virtual classrooms", "Interactive 3D educational content", "Virtual science and history lessons", "Educational VR experiences", "Virtual field trips", "Collaborative learning environments", "Professional soft-skills training", "Interactive onboarding and learning experiences", "Educational simulations", "Immersive learning laboratories"] },
  { id: "tourism", no: "05", name: "Tourism & Hospitality", short: "Discover places beyond boundaries.", image: "assets/img/cat-tourism.webp",
    headline: "Discover Places Beyond Boundaries.",
    desc: "Enable travelers and guests to experience destinations, cultural landmarks, hotels, and resorts through immersive digital journeys before arriving in person.",
    services: ["Virtual tourism experiences", "Interactive destination previews", "Hotel and resort walkthroughs", "Virtual heritage tours", "Immersive travel storytelling", "Interactive city exploration", "Hospitality visualization", "Virtual event venue tours"] },
  { id: "entertainment", no: "06", name: "Entertainment & Immersive Experiences", short: "Step inside the extraordinary.", image: "assets/img/cat-entertainment.webp",
    headline: "Step Inside the Extraordinary.",
    desc: "Create memorable interactive worlds that transform storytelling, exhibitions, events, and entertainment into experiences audiences can explore and influence.",
    services: ["Immersive digital exhibitions", "Interactive art installations", "Location-based immersive experiences", "Virtual entertainment environments", "Interactive storytelling", "Immersive brand activations", "Virtual events and exhibitions", "Mixed-reality experiences", "Interactive projection experiences"] }
];

/* ---------------------------------------------------------------- PROJECTS
   Clearly labelled demonstration concepts until real client work is supplied. */
const PROJECTS = [
  { id: "p1", t: "Cantilevered Retreat at Dusk", cat: "architecture", img: "assets/img/cat-architecture.webp", d: "A glass and walnut pavilion above an infinity pool, explored at blue hour.", tech: ["VR walkthrough", "Real-time lighting", "Unreal Engine"] },
  { id: "p2", t: "Wireframe to Walkthrough", cat: "architecture", img: "assets/img/proj-wireframe.webp", d: "A design review that starts as a line drawing and ends inside the space.", tech: ["Mixed reality", "3D spatial visualization", "Design review"] },
  { id: "p3", t: "Penthouse at Sunset", cat: "real-estate", img: "assets/img/cat-realestate.webp", d: "A skyline penthouse shown to buyers before it is built.", tech: ["Off-plan visualization", "VR property tour", "Real-time customization"] },
  { id: "p4", t: "Concrete & Walnut Residence", cat: "real-estate", img: "assets/img/concrete-walnut.webp", d: "A double-height living space with a floating staircase, finished and ready to walk through.", tech: ["Interactive 3D", "Material swapping", "Web viewer"] },
  { id: "p5", t: "Stone Wonders Gallery", cat: "museums", img: "assets/img/cat-museums.webp", d: "Ancient artefacts and projected landscapes in a single immersive hall.", tech: ["AR-enhanced exhibition", "Interactive storytelling"] },
  { id: "p6", t: "Classroom of the Future", cat: "education", img: "assets/img/cat-education.webp", d: "A classroom where a hologram of the Earth becomes the lesson.", tech: ["Virtual classroom", "Mixed reality", "Collaborative learning"] },
  { id: "p7", t: "Coastal Sunset Retreat", cat: "tourism", img: "assets/img/cat-tourism.webp", d: "A hotel terrace and infinity pool previewed before the guest arrives.", tech: ["Destination preview", "Hospitality visualization", "VR"] },
  { id: "p8", t: "Blue Wave Exhibition Hall", cat: "entertainment", img: "assets/img/cat-entertainment.webp", d: "A curved immersive hall where light and visitors share the floor.", tech: ["Immersive installation", "Real-time visuals", "Projection"] }
];
const FILTERS = [["all", "All Projects"], ["architecture", "Architecture"], ["real-estate", "Real Estate"], ["museums", "Museums"], ["education", "Education"], ["tourism", "Tourism"], ["entertainment", "Entertainment"]];

const TECH = [
  ["Virtual Reality (VR)", "Fully immersive digital environments."],
  ["Augmented Reality (AR)", "Digital content integrated into the physical world."],
  ["Mixed Reality (MR)", "Interactive experiences connecting physical and digital spaces."],
  ["Interactive 3D & Web Experiences", "Immersive content accessible through modern web browsers."],
  ["Real-Time Visualization", "Responsive environments with realistic materials, lighting and interaction."],
  ["Spatial Interaction", "Natural interaction through gestures, hand tracking and intuitive controls."]
];
const APPROACH = [["Discover", "Understand the vision, audience and experience goals."], ["Design", "Develop the visual and interactive concept."], ["Create", "Build the immersive environment."], ["Experience", "Deliver engaging interactive experiences."]];

/* =========================================================================== */
import { ES } from "./i18n.js";
let LANG = "en";                                   // English is the default; the visitor's choice is remembered
try { if (localStorage.getItem("ixr-lang") === "es") LANG = "es"; } catch (_) {}
const t = s => (LANG === "es" && ES[s] !== undefined) ? ES[s] : s;
let booted = false;
const rvc = () => booted ? "rv in rdy" : "rv";        // after boot, re-rendered cards appear without replaying the reveal
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
const catById = id => CATEGORIES.find(c => c.id === id);
const arrow = `<svg width="20" height="20"><use href="#arrow"/></svg>`;

/* ----------------------------------------------- split headings into words */
function splitWords(el) {
  let i = 0, last = null;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { frag.append(" "); return; }
        if (last && /^[.,;:!?…’”)]+$/.test(tok)) { last.append(tok); return; }   // keep punctuation glued to its word
        const w = document.createElement("span"), s = document.createElement("span");
        w.className = "w"; s.textContent = tok; s.style.setProperty("--i", i++); w.append(s); frag.append(w); last = s;
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
  });
  walk(el);
}
$$("[data-t]").forEach(el => { el.dataset.en = el.innerHTML.trim(); });
$$(".display").forEach(splitWords);

/* ----------------------------------------------------------- scroll reveal */
const rvIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target; el.classList.add("in"); rvIO.unobserve(el);
  const d = parseFloat(el.style.getPropertyValue("--d")) || 0;
  setTimeout(() => el.classList.add("rdy"), 1100 + d * 1000);
}), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
const observe = root => $$(".rv:not(.in)", root).forEach((el, i) => {
  if (!el.style.getPropertyValue("--d") && !el.closest(".cat-grid,.proj-grid,.tech-grid,.steps,.approach")) el.style.setProperty("--d", Math.min(i * .06, .3) + "s");
  rvIO.observe(el);
});

/* ------------------------------------------------------------------ header */
const header = $("#siteHeader");
const progress = $("#progress");
const onScroll = () => {
  header.classList.toggle("solid", scrollY > 40);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty("--p", max > 0 ? (scrollY / max).toFixed(4) : 0);
};
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const nav = $("#nav"), burger = $("#burger"), menu = $("#expMenu"), expBtn = $("#expBtn");
const ICONS = {
  "architecture": '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
  "real-estate": '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/>',
  "museums": '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/>',
  "education": '<path d="M2 9l10-5 10 5-10 5-10-5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
  "tourism": '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  "entertainment": '<path d="M12 3l2.300 5.700L20 11l-5.700 2.300L12 19l-2.300-5.700L4 11l5.700-2.300z"/>'
};
const ico = id => `<svg class="mi" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ""}</svg>`;
const renderMenu = () => {
  menu.innerHTML = `<div class="mm"><div class="mm-main"><h4>${t("Experiences")}</h4><div class="mm-grid">${
    CATEGORIES.map(c => `<a role="menuitem" href="#/experience/${c.id}">${ico(c.id)}<span>${t(c.name)}</span></a>`).join("")}</div></div>
    <div class="mm-side"><h4>${t("Explore")}</h4>
      <a role="menuitem" href="#projects">${t("All Projects")}</a>
      <a role="menuitem" href="#technology">${t("Technology")}</a>
      <a role="menuitem" href="#contact">${t("Start a project")}</a></div></div>`;
};
const setMenu = o => { menu.classList.toggle("open", o); expBtn.setAttribute("aria-expanded", String(o)); };
expBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
const hm = $(".has-menu");
if (matchMedia("(hover:hover) and (min-width:901px)").matches) { hm.addEventListener("mouseenter", () => setMenu(true)); hm.addEventListener("mouseleave", () => setMenu(false)); }
document.addEventListener("click", e => { if (!hm.contains(e.target)) setMenu(false); });
const setNav = o => { nav.classList.toggle("open", o); burger.setAttribute("aria-expanded", String(o)); burger.setAttribute("aria-label", t(o ? "Close menu" : "Open menu")); document.body.style.overflow = o ? "hidden" : ""; if (o) setMenu(false); };
burger.addEventListener("click", () => setNav(!nav.classList.contains("open")));
nav.addEventListener("click", e => { if (e.target.closest("a")) setNav(false); });
addEventListener("keydown", e => { if (e.key === "Escape") { setMenu(false); setNav(false); } });

/* -------------------------------------------------------------------- hero
   The story is driven by the video clock: logo first, then each line, so the
   words arrive as the film plays. Once shown, everything stays visible. */
const hv = $("#heroVideo"), panel = $("#heroPanel"), sts = $$(".st", panel);
let shown = 0, vSeen = false; const T0 = performance.now();
const heroEl = $("#top"), ysteps = $$("#yachtPanel .yp-steps li"), YS = [8.76, 11.2, 13.5, 15.8, 18.0, 20.4];   // yacht film scene starts on the hero clock
let yIdx = -2;
function yacht(t, playing) {
  let i = -1;
  if (playing && t >= YS[0] && t < YS[5]) { i = 0; while (i < 4 && t >= YS[i + 1]) i++; }
  if (i === yIdx) return; yIdx = i;
  heroEl.classList.toggle("ph-y", i >= 0);
  ysteps.forEach((li, k) => { li.classList.toggle("on", k === i); li.classList.toggle("done", i >= 0 && k < i); });
}
function story() {
  const wall = (performance.now() - T0) / 1000;
  const playing = !hv.paused && hv.readyState >= 2 && hv.currentTime > 0.05;
  if (playing) vSeen = true;
  const t = playing ? hv.currentTime : (vSeen ? 0 : Math.max(0, wall - 2.2));   // fallback clock if video cannot play
  if (!panel.classList.contains("on") && (t >= .2 || wall > 3)) { panel.classList.add("on"); setTimeout(() => panel.classList.add("rdy"), 1300); }
  while (shown < sts.length && t >= +sts[shown].dataset.at) { sts[shown].classList.add("on"); shown++; }
  yacht(t, playing);
  requestAnimationFrame(story);
}
if (reduce) {
  hv.removeAttribute("autoplay"); hv.pause(); panel.classList.add("on", "rdy"); sts.forEach(s => s.classList.add("on")); shown = sts.length;
} else {
  hv.play().catch(() => {});
  requestAnimationFrame(story);
  new IntersectionObserver(es => { es[0].isIntersecting ? hv.play().catch(() => {}) : hv.pause(); }).observe(hv);
  const iv = $("#introVideo");
  if (iv) new IntersectionObserver(es => { es[0].isIntersecting ? iv.play().catch(() => {}) : iv.pause(); }, { rootMargin: "200px" }).observe(iv);
  let tick = false;
  addEventListener("scroll", () => { if (tick || scrollY > innerHeight) return; tick = true; requestAnimationFrame(() => { hv.style.transform = `scale(1.04) translateY(${scrollY * .1}px)`; tick = false; }); }, { passive: true });
}
if (fine && !reduce) {                       // gentle 3D tilt of the glass panel
  const hero = $("#top");
  hero.addEventListener("pointermove", e => {
    const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    panel.style.setProperty("--ry", (x * 5).toFixed(2) + "deg"); panel.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
    panel.style.setProperty("--px", (x * -10).toFixed(1) + "px"); panel.style.setProperty("--py", (y * -8).toFixed(1) + "px");
  });
  hero.addEventListener("pointerleave", () => ["--rx", "--ry", "--px", "--py"].forEach(v => panel.style.removeProperty(v)));
}

/* -------------------------------------------------------- experiences grid */
const renderCats = () => {
  $("#catGrid").innerHTML = CATEGORIES.map(c => `
  <button class="cat ${rvc()}" data-id="${c.id}" aria-label="${t(c.name)}. ${t(c.short)}">
    <div class="media"><img src="${c.image}" alt="" loading="lazy" width="1600" height="900"></div>
    <span class="cat-go">${arrow}</span>
    <div class="cat-in"><h3>${t(c.name)}</h3><p>${t(c.short)}</p></div>
  </button>`).join("");
  $$("#catGrid .cat").forEach(b => b.addEventListener("click", () => openCategory(b.dataset.id)));
};

/* ----------------------------------------------- journey: video + 4 steps */
(function () {
  const sv = $("#stepsVideo"), items = $$("#steps .step"), bar = $("#stepsProg");
  const from = items.map(li => +li.dataset.from);
  items.forEach(li => li.insertAdjacentHTML("beforeend", '<b class="fill"></b>'));
  let raf = 0;
  const paint = () => {
    const d = sv.duration || 10, t = sv.currentTime; let a = 0;
    from.forEach((f, i) => { if (t >= f) a = i; });
    bar.style.transform = `scaleX(${Math.min(t / d, 1)})`;
    items.forEach((li, i) => { li.classList.toggle("active", i === a); li.style.setProperty("--f", i < a ? 1 : i > a ? 0 : Math.min((t - from[a]) / ((from[a + 1] ?? d) - from[a]), 1).toFixed(3)); });
    if (!sv.paused) raf = requestAnimationFrame(paint);
  };
  sv.addEventListener("play", () => { cancelAnimationFrame(raf); paint(); });
  sv.addEventListener("seeked", paint);
  items.forEach((li, i) => li.addEventListener("click", () => { sv.currentTime = from[i]; sv.play().catch(() => {}); }));
  if (reduce) { sv.controls = true; paint(); } else {
    new IntersectionObserver(es => { es[0].isIntersecting ? sv.play().catch(() => {}) : sv.pause(); }, { threshold: .35 }).observe(sv);
  }
  items[0].classList.add("active");
})();



/* --------------------------------------------------------------- tech/approach */
const renderTech = () => {
  $("#techGrid").innerHTML = TECH.map(([h, p], i) => `<div class="tc ${rvc()}" style="--d:${(i % 3) * .08}s"><i>0${i + 1}</i><h3>${t(h)}</h3><p>${t(p)}</p></div>`).join("");
  $("#approach").innerHTML = `<p class="approach-title ${rvc()}">${t("Imagine. Design. Experience.")}</p>` + APPROACH.map(([h, p], i) => `<div class="ap ${rvc()}" style="--d:${i * .08}s"><i>0${i + 1}</i><h3>${t(h)}</h3><p>${t(p)}</p></div>`).join("");
};

/* ----------------------------------------------------------------- projects */
const chips = $("#chips"), grid = $("#projGrid");
let curFilter = "all";
const renderChips = () => { chips.innerHTML = FILTERS.map(([k, l]) => `<button class="chip" role="tab" data-k="${k}" aria-selected="${k === curFilter}">${t(l)}</button>`).join(""); };
function renderProjects(k) {
  const list = PROJECTS.filter(p => k === "all" || p.cat === k);
  grid.innerHTML = list.map((p, i) => `
    <button class="proj" style="animation-delay:${i * .05}s" data-id="${p.id}" aria-label="${t(p.t)}, ${t(catById(p.cat).name)}. ${t("Open preview.")}">
      <div class="media"><img src="${p.img}" alt="" loading="lazy" width="1600" height="900"></div>
      <div class="proj-in"><small>${t(catById(p.cat).name)}</small><h3>${t(p.t)}</h3><p>${t(p.d)}</p></div></button>`).join("");
  $$(".proj", grid).forEach(b => { const p = PROJECTS.find(x => x.id === b.dataset.id); b.addEventListener("click", () => openLightbox(p)); });
}
chips.addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; $$(".chip", chips).forEach(x => x.setAttribute("aria-selected", String(x === b))); curFilter = b.dataset.k; renderProjects(curFilter); });

/* ----------------------------------------------------------------- lightbox */
const lb = $("#lightbox"), lbIn = $("#lbIn"); let lbFocus = null;
function openLightbox(p) {
  lbFocus = document.activeElement;
  lbIn.innerHTML = `<div class="lb-media"><img src="${p.img}" alt="${t(p.t)}"></div>
    <div class="lb-copy"><small>${t(catById(p.cat).name)}</small><h3>${t(p.t)}</h3><p>${t(p.d)}</p><div class="pills">${p.tech.map(x => `<span class="pill">${t(x)}</span>`).join("")}</div>
    <p class="fine">${t("Demonstration concept created by InspiraXR. Not a completed commercial project.")}</p>
    <p style="margin-top:22px"><a class="btn solid" href="#/experience/${p.cat}">${t("View")} ${t(catById(p.cat).name)} ${arrow}</a></p></div>`;
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add("show")); document.body.style.overflow = "hidden"; $("#lbClose").focus();
  $(".btn", lbIn).addEventListener("click", closeLightbox);
}
function closeLightbox() { if (lb.hidden) return; lb.classList.remove("show"); setTimeout(() => { lb.hidden = true; lbIn.innerHTML = ""; }, 300); if ($("#sheet").hidden) document.body.style.overflow = ""; lbFocus && lbFocus.focus && lbFocus.focus(); }
$("#lbClose").addEventListener("click", closeLightbox);
lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

/* ------------------------------------------------------------ category sheet */
const sheet = $("#sheet"), body = $("#sheetBody"); let openId = null, lastFocus = null;
async function openCategory(id) {
  const c = catById(id); if (!c) return;
  try { history.replaceState(null, "", `#/experience/${id}`); } catch (_) {}
  openSheet(id);
}
function openSheet(id) {
  const c = catById(id); if (!c) return;
  if (openId === id && !sheet.hidden) return;
  openId = id; if (sheet.hidden) lastFocus = document.activeElement;
  const nx = CATEGORIES[(CATEGORIES.indexOf(c) + 1) % CATEGORIES.length];
  body.innerHTML = `
    <div class="sh-hero"><div class="media"><img src="${c.image}" alt=""></div>
      <div class="wrap sh-title"><p class="eyebrow">${c.no} · ${LANG === "es" ? "Experiencia" : "Experience"}</p><h1 id="sheetTitle">${t(c.name)}</h1></div></div>
    <div class="wrap sh-main"><div><p class="sh-head">${t(c.headline)}</p><p class="sh-desc">${t(c.desc)}</p>
      <div class="sh-cta"><button class="btn solid" id="shCta">${t("Discuss a project")} ${arrow}</button><a class="btn ghost" href="#projects" data-close>${t("See related work")}</a></div></div>
      <div class="sh-services"><h4>${t("Services")}</h4><ul>${c.services.map(s => `<li>${t(s)}</li>`).join("")}</ul></div></div>
    <div class="wrap sh-next-wrap"><button class="sh-next" id="shNext"><img src="${nx.image}" alt=""><div><small>${t("Next experience")}</small><h5>${t(nx.name)}</h5></div>${arrow}</button></div>`;
  sheet.hidden = false; sheet.scrollTop = 0; document.body.style.overflow = "hidden";
  requestAnimationFrame(() => sheet.classList.add("show"));
  $("#shCta").addEventListener("click", () => { $("#f-cat").value = c.id; closeSheet("#contact"); });
  $("#shNext").addEventListener("click", () => openCategory(nx.id));
  $$("[data-close]", body).forEach(a => a.addEventListener("click", e => { e.preventDefault(); closeSheet(a.getAttribute("href")); }));
  $("#sheetClose").focus({ preventScroll: true });
}
function closeSheet(to) {
  if (sheet.hidden) { if (to) location.hash = to; return; }
  sheet.classList.remove("show"); openId = null;
  setTimeout(() => { sheet.hidden = true; body.innerHTML = ""; }, 400);
  document.body.style.overflow = ""; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  const dest = to || "#experiences"; try { if (location.hash !== dest) history.replaceState(null, "", dest); } catch (_) {}
  const t = $(dest); t && t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
}
$("#sheetClose").addEventListener("click", () => closeSheet());
const step = d => { const i = CATEGORIES.findIndex(c => c.id === openId); openCategory(CATEGORIES[(i + d + CATEGORIES.length) % CATEGORIES.length].id); };
$("#sheetPrev").addEventListener("click", () => step(-1)); $("#sheetNext").addEventListener("click", () => step(1));
addEventListener("keydown", e => { if (sheet.hidden || !lb.hidden) return; if (e.key === "Escape") closeSheet(); if (e.key === "ArrowLeft" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) step(-1); if (e.key === "ArrowRight" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) step(1); });
function route() {
  const m = location.hash.match(/^#\/experience\/([\w-]+)/);
  if (m && catById(m[1])) { setNav(false); openSheet(m[1]); }
  else if (!sheet.hidden) { sheet.classList.remove("show"); openId = null; setTimeout(() => { sheet.hidden = true; body.innerHTML = ""; }, 400); document.body.style.overflow = ""; }
}
addEventListener("hashchange", route);
// Menu links open the page directly, so it also works where the URL hash cannot be edited (e.g. embedded previews)
document.addEventListener("click", e => { const a = e.target.closest('a[href^="#/experience/"]'); if (!a) return; const id = a.getAttribute("href").split("/").pop(); if (!catById(id)) return; e.preventDefault(); setNav(false); setMenu(false); openCategory(id); });

/* ------------------------------------------------------------------ contact */
const sel = $("#f-cat");
const renderSelect = () => { const v = sel.value; sel.innerHTML = `<option value="" disabled ${v ? "" : "selected"}>${t("Choose a category")}</option>` + CATEGORIES.map(c => `<option value="${c.id}">${t(c.name)}</option>`).join("") + `<option value="other">${t("Something else")}</option>`; if (v) sel.value = v; };
const form = $("#contactForm"), status = $("#formStatus");
const rules = { "f-name": v => v.trim().length > 1 || "Please tell us your name.", "f-email": v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email address.", "f-cat": v => !!v || "Please choose a category.", "f-msg": v => v.trim().length > 9 || "Please describe your project in a few words.", "f-ok": (v, el) => el.checked || "Please confirm so we can reply." };
function check(id) { const el = document.getElementById(id), ok = rules[id](el.value, el), msg = $(`.err[data-for="${id}"]`); const bad = ok !== true; msg.textContent = bad ? t(ok) : ""; el.closest(".field")?.classList.toggle("bad", bad); el.setAttribute("aria-invalid", String(bad)); return !bad; }
Object.keys(rules).forEach(id => { const el = document.getElementById(id); el.addEventListener("blur", () => check(id)); el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true") check(id); }); });
form.addEventListener("submit", async e => {
  e.preventDefault(); status.className = "form-status wide"; status.textContent = "";
  const bad = Object.keys(rules).filter(id => !check(id)); if (bad.length) { document.getElementById(bad[0]).focus(); return; }
  const d = Object.fromEntries(new FormData(form)); if (d.website) return;     // honeypot
  const data = { name: d.name, email: d.email, organization: d.organization || "", category: (catById(d.category)?.name) || "Other", message: d.message };
  if (CONFIG.formEndpoint) {
    const btn = $("button[type=submit]", form); btn.disabled = true; status.textContent = t("Sending…");
    try { const r = await fetch(CONFIG.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(r.status); status.className = "form-status wide ok"; status.textContent = t("Thank you. Your inquiry has been sent and we will reply soon."); form.reset(); }
    catch (err) { status.className = "form-status wide bad"; status.textContent = LANG === "es" ? `${t("Sorry, that did not send. Please email")} ${CONFIG.contactEmail}.` : `Sorry, that did not send. Please email ${CONFIG.contactEmail} directly.`; }
    btn.disabled = false;
  } else {
    // Honest fallback: no backend configured, so hand the message to the visitor's email app.
    const subject = encodeURIComponent(`InspiraXR inquiry: ${data.category}`);
    const text = encodeURIComponent(`Name: ${data.name}\nEmail: ${data.email}\nOrganization: ${data.organization}\nCategory: ${data.category}\n\n${data.message}`);
    status.className = "form-status wide warn"; status.textContent = `${t("The form is not connected to a server yet, so we opened your email app with the message ready to send to")} ${CONFIG.contactEmail}.`;
    location.href = `mailto:${CONFIG.contactEmail}?subject=${subject}&body=${text}`;
  }
});

/* ------------------------------------------------- pointer effects (desktop)
   Light follows the cursor across glass, cards tilt, buttons lean toward it. */
if (fine && !reduce) {
  const glow = $("#cursorGlow"), SPOT = ".glass,.tc,.ap,.form,.cat,.cat-in,.proj,.proj-in", TILT = ".cat,.proj", MAG = ".btn,.head-cta";
  let ev = null, queued = false, mag = null, tiltEl = null;
  const reset = (el, vars) => vars.forEach(v => el.style.removeProperty(v));
  const frame = () => {
    queued = false; const e = ev; if (!e) return;
    glow.style.setProperty("--cx", e.clientX + "px"); glow.style.setProperty("--cy", e.clientY + "px"); glow.classList.add("on");
    let el = e.target.closest?.(SPOT);
    while (el) { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", (e.clientX - r.left) + "px"); el.style.setProperty("--my", (e.clientY - r.top) + "px"); el = el.parentElement?.closest(SPOT); }
    const t = e.target.closest?.(TILT);
    if (tiltEl && tiltEl !== t) reset(tiltEl, ["--rx", "--ry"]);
    tiltEl = t;
    if (t && t.classList.contains("in") || t && t.classList.contains("proj")) { const r = t.getBoundingClientRect(); t.style.setProperty("--ry", (((e.clientX - r.left) / r.width - .5) * 12).toFixed(2) + "deg"); t.style.setProperty("--rx", ((.5 - (e.clientY - r.top) / r.height) * 12).toFixed(2) + "deg"); }
    const m = e.target.closest?.(MAG);
    if (mag && mag !== m) reset(mag, ["--tx", "--ty"]);
    mag = m;
    if (m) { const r = m.getBoundingClientRect(); m.style.setProperty("--tx", (((e.clientX - r.left) / r.width - .5) * 10).toFixed(1) + "px"); m.style.setProperty("--ty", (((e.clientY - r.top) / r.height - .5) * 8).toFixed(1) + "px"); }
  };
  document.addEventListener("pointermove", e => { ev = e; if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  document.addEventListener("pointerleave", () => { glow.classList.remove("on"); tiltEl && reset(tiltEl, ["--rx", "--ry"]); mag && reset(mag, ["--tx", "--ty"]); });
}

/* --------------------------------------------------------------------- boot */

/* ------------------------------------------------------------------ language */
const meta = { en: ["InspiraXR — The Next Dimension of Immersive Experience", "InspiraXR is an immersive experience studio. We turn spaces, stories and ideas into VR, AR, MR and interactive 3D experiences for architecture, real estate, museums, education, tourism and entertainment."],
               es: ["InspiraXR — La siguiente dimensión de la experiencia inmersiva", "InspiraXR es un estudio de experiencias inmersivas. Convertimos espacios, historias e ideas en experiencias de VR, AR, MR y 3D interactivo para arquitectura, inmobiliaria, museos, educación, turismo y entretenimiento."] };
function applyStatic() {
  document.documentElement.lang = LANG;
  document.title = meta[LANG][0];
  $('meta[name="description"]').content = meta[LANG][1];
  $$("[data-t]").forEach(el => {
    const en = el.dataset.en, out = LANG === "es" && ES[en] !== undefined ? ES[en] : en;
    if (el.innerHTML.trim() === out) return;
    el.innerHTML = out;
    if (el.classList.contains("display")) splitWords(el);
  });
  $$("[aria-label],[alt]").forEach(el => {
    for (const a of ["aria-label", "alt"]) {
      if (!el.hasAttribute(a) || el.closest(".cat,.proj")) continue;
      const k = "data-en-" + a;
      if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a));
      el.setAttribute(a, t(el.getAttribute(k)));
    }
  });
  burger.setAttribute("aria-label", t(burger.getAttribute("aria-expanded") === "true" ? "Close menu" : "Open menu"));
  $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === LANG)));
}
function renderAll() {
  renderMenu(); renderCats(); renderTech(); renderChips(); renderProjects(curFilter); renderSelect();
  applyStatic();
  if (!sheet.hidden && openId) { const id = openId; openId = null; const top = sheet.scrollTop; openSheet(id); sheet.scrollTop = top; }
  if (!lb.hidden) closeLightbox();
  observe(document);
}
$$(".lang button").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.lang === LANG) return;
  LANG = b.dataset.lang; try { localStorage.setItem("ixr-lang", LANG); } catch (_) {}
  renderAll();
}));
// animate the headline gradient only while a heading is on screen
const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle("live", e.isIntersecting)));
$$(".display,.hp-head,.approach-title").forEach(el => liveIO.observe(el));
new MutationObserver(() => $$(".approach-title:not(.lv)").forEach(el => { el.classList.add("lv"); liveIO.observe(el); })).observe($("#approach"), { childList: true });

renderAll(); booted = true; route();
