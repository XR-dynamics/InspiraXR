/* =========================================================================
   InspiraXR — site logic
   Edit CONFIG, CATEGORIES, PROJECTS below to update the site content.
   ========================================================================= */
import { orrery, globe, PLANETS, DESTINATIONS, WONDERS, gallery, timeline, scenario } from "./widgets.js";

/* ------------------------------------------------------------------ CONFIG */
const CONFIG = {
  // Contact form: set this to your form backend URL (Formspree, Getform, Basin, your own API…).
  // It receives a JSON POST: { name, email, organization, category, message }.
  // While empty, the form opens the visitor's email app instead and says so.
  formEndpoint: "",
  contactEmail: "techlead@iverseai.com"
};

/* -------------------------------------------------------------- CATEGORIES
   image: path under assets/img  |  art: "orrery" | "globe" (live canvas artwork)
   Replace any image with your own render by dropping a file at the same path. */
const CATEGORIES = [
  { id: "architecture", no: "01", name: "Architecture & Design", short: "Experience design before it becomes reality.", image: "assets/img/cat-architecture.webp",
    headline: "Experience Design Before It Becomes Reality.",
    desc: "Transform architectural concepts into immersive environments where clients can explore, interact with, and experience spaces before construction begins.",
    services: ["Immersive architectural walkthroughs", "Interactive interior design visualization", "Real-time material and texture customization", "Virtual design reviews", "Architectural concept presentations", "Interactive building visualization", "VR and MR design experiences", "3D spatial visualization"],
    demo: "architecture", demoTitle: "Blueprint to built, in one drag", demoText: "Slide between the flat blueprint and the finished 3D layout, then change the finishes live in the finish explorer." },
  { id: "real-estate", no: "02", name: "Real Estate & Property", short: "Explore tomorrow's spaces, today.", image: "assets/img/cat-realestate.webp",
    headline: "Explore Tomorrow's Spaces, Today.",
    desc: "Experience properties before they are built. InspiraXR helps developers, agencies, and buyers explore residential and commercial environments through interactive immersive property experiences.",
    services: ["Virtual property tours", "Off-plan real estate visualization", "Interactive apartment walkthroughs", "Residential development experiences", "Commercial property visualization", "Virtual property showrooms", "Interactive floor plans", "Real-time property customization"],
    demo: "property", demoTitle: "Virtual property explorer", demoText: "Move through the four stages a buyer sees: plan, layout, walkthrough and personalization." },
  { id: "museums", no: "03", name: "Museums & Cultural Heritage", short: "Bringing history, art and culture to life.", image: "assets/img/cat-museums.webp", pos: "100% 50%",
    headline: "Bringing History, Art, and Culture to Life.",
    desc: "Transform museums and cultural spaces into immersive journeys where visitors can explore history, interact with digital exhibits, and experience stories beyond traditional displays.",
    services: ["Immersive museum exhibitions", "Virtual museums and galleries", "Historical environment reconstruction", "Interactive cultural storytelling", "Digital heritage preservation experiences", "AR-enhanced exhibitions", "Interactive historical artifacts", "Immersive educational installations"],
    demo: "museum", demoTitle: "Interactive museum showcase", demoText: "Select an object, rotate it in 3D and read its context. These are procedurally modelled study objects, shown as a demonstration of the format." },
  { id: "education", no: "04", name: "Education & Training", short: "Learning beyond the classroom.", art: "orrery",
    headline: "Learning Beyond the Classroom.",
    desc: "Transform traditional learning into engaging immersive experiences that allow students and professionals to explore, interact, practice, and understand complex concepts through experiential learning.",
    services: ["Immersive virtual classrooms", "Interactive 3D educational content", "Virtual science and history lessons", "Educational VR experiences", "Virtual field trips", "Collaborative learning environments", "Professional soft-skills training", "Interactive onboarding and learning experiences", "Educational simulations", "Immersive learning laboratories"],
    demo: "education", demoTitle: "Interactive classroom demonstration", demoText: "Choose a lesson. Every one of these is a working demonstration, not a picture of one." },
  { id: "tourism", no: "05", name: "Tourism & Hospitality", short: "Discover places beyond boundaries.", art: "globe",
    headline: "Discover Places Beyond Boundaries.",
    desc: "Enable travelers and guests to experience destinations, cultural landmarks, hotels, and resorts through immersive digital journeys before arriving in person.",
    services: ["Virtual tourism experiences", "Interactive destination previews", "Hotel and resort walkthroughs", "Virtual heritage tours", "Immersive travel storytelling", "Interactive city exploration", "Hospitality visualization", "Virtual event venue tours"],
    demo: "tourism", demoTitle: "Interactive destination explorer", demoText: "Spin the globe and select a destination for its context. Full projects add panoramic views and clickable landmarks." },
  { id: "entertainment", no: "06", name: "Entertainment & Immersive Experiences", short: "Step inside the extraordinary.", image: "assets/img/cat-entertainment.webp", pos: "100% 50%",
    headline: "Step Inside the Extraordinary.",
    desc: "Create memorable interactive worlds that transform storytelling, exhibitions, events, and entertainment into experiences audiences can explore and influence.",
    services: ["Immersive digital exhibitions", "Interactive art installations", "Location-based immersive experiences", "Virtual entertainment environments", "Interactive storytelling", "Immersive brand activations", "Virtual events and exhibitions", "Mixed-reality experiences", "Interactive projection experiences"],
    demo: "entertainment", demoTitle: "Cinematic gallery", demoText: "Full-screen visuals with slow motion and soft transitions between scenes." }
];

/* ---------------------------------------------------------------- PROJECTS
   Clearly labelled demonstration concepts until real client work is supplied. */
const PROJECTS = [
  { id: "p1", t: "Twilight Villa", cat: "real-estate", img: "assets/img/cat-realestate.webp", d: "A coastal villa experienced at dusk, from the terrace to the pool.", tech: ["VR walkthrough", "Real-time lighting", "Unreal Engine"] },
  { id: "p2", t: "Villa Model, Day to Night", cat: "real-estate", img: "assets/img/villa.webp", d: "A contemporary two-storey villa shown as a presentation model with evening lighting.", tech: ["Real-time visualization", "Interactive 3D", "Web viewer"] },
  { id: "p3", t: "Immersive Architectural Vision", cat: "architecture", img: "assets/img/cat-architecture.webp", d: "Holding a design in your hands before a single wall exists.", tech: ["Mixed reality", "Hand tracking", "3D spatial visualization"] },
  { id: "p4", t: "Sofa Selection in VR", cat: "architecture", img: "assets/img/sofa-vr.webp", d: "A spatial catalogue of furniture and finishes, applied to the room in real time.", tech: ["VR interface", "Live customization", "Hand tracking"] },
  { id: "p5", t: "Cultural Showcase", cat: "museums", img: "assets/img/cat-museums.webp", d: "Digital layers on top of a physical exhibition: objects, stories and context.", tech: ["AR-enhanced exhibition", "Interactive storytelling"] },
  { id: "p6", t: "Orrery: Solar System", cat: "education", art: "orrery", d: "An interactive model of the planets. Select one to learn how long its year is.", tech: ["Interactive 3D", "Web experience"] },
  { id: "p7", t: "Destination Globe", cat: "tourism", art: "globe", d: "A destination explorer with selectable landmarks and context.", tech: ["Interactive 3D", "Web experience"] },
  { id: "p8", t: "Digital Worlds", cat: "entertainment", img: "assets/img/cat-entertainment.webp", d: "A branded immersive world for launches, exhibitions and events.", tech: ["Immersive installation", "Real-time visuals", "Mixed reality"] }
];
const FILTERS = [["all", "All Projects"], ["architecture", "Architecture"], ["real-estate", "Real Estate"], ["museums", "Museums"], ["education", "Education"], ["tourism", "Tourism"], ["entertainment", "Entertainment"]];

const FILM = [
  ["00:00", "The headset", "assets/img/sb-1.webp", "A premium VR headset resting on a black marble plinth."],
  ["00:01", "She picks it up", "assets/img/sb-2.webp", "A woman reaches for the headset."],
  ["00:02", "She wears it", "assets/img/sb-3.webp", "A woman puts on the headset."],
  ["00:04", "Blueprint appears", "assets/img/sb-4.webp", "A glowing blueprint of a villa appears between her hands."],
  ["00:05", "It transforms to a villa", "assets/img/sb-5.webp", "The wireframe fills in and becomes a photorealistic villa with a pool."],
  ["00:06", "Explore the interior", "assets/img/sb-6.webp", "She walks into the living room at full scale."],
  ["00:07", "Interact and change material", "assets/img/sb-7.webp", "She touches a wood swatch and the wall changes finish."],
  ["00:08", "The final villa experience", "assets/img/sb-8.webp", "The finished living room at sunset, overlooking the sea."]
];
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
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const catById = id => CATEGORIES.find(c => c.id === id);
const arrow = `<svg width="20" height="20"><use href="#arrow"/></svg>`;

/* ----------------------------------------------------------- scroll reveal */
const rvIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); rvIO.unobserve(e.target); } }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
const observe = root => $$(".rv:not(.in)", root).forEach((el, i) => { if (!el.style.getPropertyValue("--d") && !el.closest(".cat-grid,.proj-grid,.tech-grid,.steps,.approach,.film-track")) el.style.setProperty("--d", Math.min(i * .06, .3) + "s"); rvIO.observe(el); });

/* ------------------------------------------------------------------ header */
const header = $("#siteHeader");
const onScroll = () => header.classList.toggle("solid", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const nav = $("#nav"), burger = $("#burger"), menu = $("#expMenu"), expBtn = $("#expBtn");
menu.innerHTML = CATEGORIES.map(c => `<a role="menuitem" href="#/experience/${c.id}"><i>${c.no}</i>${c.name}</a>`).join("");
const setMenu = o => { menu.classList.toggle("open", o); expBtn.setAttribute("aria-expanded", String(o)); };
expBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
const hm = $(".has-menu");
if (matchMedia("(hover:hover) and (min-width:901px)").matches) { hm.addEventListener("mouseenter", () => setMenu(true)); hm.addEventListener("mouseleave", () => setMenu(false)); }
document.addEventListener("click", e => { if (!hm.contains(e.target)) setMenu(false); });
const setNav = o => { nav.classList.toggle("open", o); burger.setAttribute("aria-expanded", String(o)); burger.setAttribute("aria-label", o ? "Close menu" : "Open menu"); document.body.style.overflow = o ? "hidden" : ""; if (o) setMenu(false); };
burger.addEventListener("click", () => setNav(!nav.classList.contains("open")));
nav.addEventListener("click", e => { if (e.target.closest("a")) setNav(false); });
addEventListener("keydown", e => { if (e.key === "Escape") { setMenu(false); setNav(false); } });

/* -------------------------------------------------------------------- hero */
const hv = $("#heroVideo");
if (reduce) { hv.removeAttribute("autoplay"); hv.pause(); } else {
  hv.play().catch(() => {});
  new IntersectionObserver(es => { es[0].isIntersecting ? hv.play().catch(() => {}) : hv.pause(); }).observe(hv);
  let tick = false;
  addEventListener("scroll", () => { if (tick || scrollY > innerHeight) return; tick = true; requestAnimationFrame(() => { hv.style.transform = `scale(1.04) translateY(${scrollY * .1}px)`; tick = false; }); }, { passive: true });
}

/* ------------------------------------------------------------ art helpers */
const live = [];                               // card/project artworks (never destroyed)
function mountArt(host, kind, opts = {}) {
  const c = document.createElement("canvas"); c.setAttribute("aria-hidden", "true"); host.append(c);
  return kind === "orrery" ? orrery(c, opts) : globe(c, { arcs: true, ...opts });
}

/* -------------------------------------------------------- experiences grid */
$("#catGrid").innerHTML = CATEGORIES.map(c => `
  <button class="cat rv" data-id="${c.id}" aria-label="${c.name}. ${c.short}">
    <div class="media">${c.image ? `<img src="${c.image}" alt="" loading="lazy" style="object-position:${c.pos||"center"}">` : ""}</div>
    <span class="cat-tag">${c.art ? "Interactive demo" : "Experience"}</span>
    <span class="cat-go">${arrow}</span>
    <div class="cat-in"><span class="cat-no">${c.no}</span><h3>${c.name}</h3><p>${c.short}</p></div>
  </button>`).join("");
$$("#catGrid .cat").forEach(b => {
  const c = catById(b.dataset.id); if (c.art) live.push(mountArt($(".media", b), c.art));
  b.addEventListener("click", () => { try { history.replaceState(null, "", `#/experience/${c.id}`); } catch (_) {} openSheet(c.id); });
});

/* -------------------------------------------------------------------- steps */
/* (static markup) */

/* ------------------------------------------------------------ compare slider */
function makeCompare(box) {
  const r = $(".cmp-range", box); const set = v => box.style.setProperty("--pos", v + "%");
  r.addEventListener("input", () => set(r.value)); set(r.value);
  if (!reduce && !box.dataset.played) {
    box.dataset.played = "1";
    new IntersectionObserver((es, o) => { if (!es[0].isIntersecting) return; o.disconnect(); let t0; const step = n => { t0 ??= n; const k = Math.min((n - t0) / 1600, 1), v = 50 + 22 * Math.sin(k * Math.PI * 2) * (1 - k); r.value = v; set(v); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, { threshold: .6 }).observe(box);
  }
}
makeCompare($("#compare-box"));

/* ---------------------------------------------------------------- film strip */
$("#filmTrack").innerHTML = FILM.map(([t, cap, src, alt], i) => `
  <figure class="frame rv" style="--d:${(i % 4) * .06}s"><div class="frame-img"><img src="${src}" alt="${alt}" loading="lazy"></div><figcaption><b>${t}</b>${cap}</figcaption></figure>`).join("");

/* --------------------------------------------------------------------- tech */
$("#techGrid").innerHTML = TECH.map(([h, p], i) => `<div class="tc rv" style="--d:${(i % 3) * .08}s"><i>0${i + 1}</i><h3>${h}</h3><p>${p}</p></div>`).join("");
$("#approach").innerHTML = `<p class="approach-title rv">Imagine. Design. Experience.</p>` + APPROACH.map(([h, p], i) => `<div class="ap rv" style="--d:${i * .08}s"><i>0${i + 1}</i><h3>${h}</h3><p>${p}</p></div>`).join("");

/* ----------------------------------------------------------------- projects */
const chips = $("#chips"), grid = $("#projGrid");
chips.innerHTML = FILTERS.map(([k, l], i) => `<button class="chip" role="tab" data-k="${k}" aria-selected="${i === 0}">${l}</button>`).join("");
const projArt = [];
function renderProjects(k) {
  projArt.splice(0).forEach(a => a.destroy());
  const list = PROJECTS.filter(p => k === "all" || p.cat === k);
  grid.innerHTML = list.map((p, i) => `
    <button class="proj" style="animation-delay:${i * .05}s" data-id="${p.id}" aria-label="${p.t}, ${catById(p.cat).name}. Open preview.">
      <div class="media">${p.img ? `<img src="${p.img}" alt="" loading="lazy" style="object-position:${catById(p.cat).pos||"center"}">` : ""}</div>
      <div class="proj-in"><small>${catById(p.cat).name}</small><h3>${p.t}</h3><p>${p.d}</p></div></button>`).join("");
  $$(".proj", grid).forEach(b => { const p = PROJECTS.find(x => x.id === b.dataset.id); if (p.art) projArt.push(mountArt($(".media", b), p.art)); b.addEventListener("click", () => openLightbox(p)); });
}
chips.addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; $$(".chip", chips).forEach(x => x.setAttribute("aria-selected", String(x === b))); renderProjects(b.dataset.k); });
renderProjects("all");

/* ----------------------------------------------------------------- lightbox */
const lb = $("#lightbox"), lbIn = $("#lbIn"); let lbArt = null, lbFocus = null;
function openLightbox(p) {
  lbFocus = document.activeElement;
  lbIn.innerHTML = `<div class="lb-media">${p.img ? `<img src="${p.img}" alt="${p.t}">` : `<canvas style="aspect-ratio:16/10;width:100%;background:radial-gradient(100% 100% at 50% 0,#171b20,#0a0c0e)"></canvas>`}</div>
    <div class="lb-copy"><small>${catById(p.cat).name}</small><h3>${p.t}</h3><p>${p.d}</p><div class="pills">${p.tech.map(t => `<span class="pill">${t}</span>`).join("")}</div>
    <p class="fine">Demonstration concept created by InspiraXR. Not a completed commercial project.</p>
    <p style="margin-top:22px"><a class="btn solid" href="#/experience/${p.cat}" id="lbMore">View ${catById(p.cat).name} ${arrow}</a></p></div>`;
  if (p.art) lbArt = (p.art === "orrery" ? orrery : globe)($("canvas", lbIn), { interactive: true, onPick: () => {} });
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add("show")); document.body.style.overflow = "hidden"; $("#lbClose").focus();
  $("#lbMore").addEventListener("click", closeLightbox);
}
function closeLightbox() { if (lb.hidden) return; lb.classList.remove("show"); lbArt && lbArt.destroy(); lbArt = null; setTimeout(() => { lb.hidden = true; lbIn.innerHTML = ""; }, 300); if ($("#sheet").hidden) document.body.style.overflow = ""; lbFocus && lbFocus.focus && lbFocus.focus(); }
$("#lbClose").addEventListener("click", closeLightbox);
lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

/* --------------------------------------------------------------- 3D explorer */
let three = null; const loadThree = () => three ??= import("./three-demos.js");
(function () {
  const st = $("#expStage"), load = $("#expLoad");
  new IntersectionObserver(async (es, o) => {
    if (!es[0].isIntersecting) return; o.disconnect();
    try { const m = await loadThree(); m.mountExplorer({ canvas: $("#expCanvas"), controlsEl: $("#expControls"), loadEl: load }); }
    catch (err) { console.warn("[3D explorer]", err); load.textContent = "The 3D demo needs a browser with WebGL."; load.style.opacity = 1; }
  }, { rootMargin: "300px" }).observe(st);
})();

/* ------------------------------------------------------------ category sheet */
const sheet = $("#sheet"), body = $("#sheetBody"); let cleanups = [], openId = null, lastFocus = null;
function split(host, { stage = true } = {}) {
  host.innerHTML = `<div class="demo-split"><canvas class="stage" aria-label="Interactive demonstration"></canvas><div class="demo-info"><span class="k"></span><h5></h5><p></p><div class="pills"></div></div></div>`;
  const q = s => $(s, host); return { canvas: q("canvas"), set(k, h, p) { q(".k").textContent = k; q("h5").textContent = h; q("p").textContent = p; }, pills: q(".pills") };
}
function pills(host, items, onPick, sel = 0) {
  host.innerHTML = items.map((n, i) => `<button class="pill" aria-pressed="${i === sel}">${n}</button>`).join("");
  $$(".pill", host).forEach((b, i) => b.addEventListener("click", () => { $$(".pill", host).forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(i); }));
}
const demos = {
  architecture(host) {
    host.innerHTML = `<div style="padding:clamp(14px,2vw,26px)"><div class="compare" id="shCompare" style="--pos:50%;box-shadow:none"><img class="cmp-after" src="assets/img/step-02.webp" alt="3D layout" width="1536" height="1024"><div class="cmp-before"><img src="assets/img/step-01.webp" alt="Blueprint" width="1536" height="1024"></div><span class="cmp-tag l">Blueprint</span><span class="cmp-tag r">Layout</span><div class="cmp-handle" aria-hidden="true"><span><svg width="22" height="22" viewBox="0 0 24 24"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><input class="cmp-range" type="range" min="0" max="100" value="50" aria-label="Compare blueprint and 3D layout"></div>
      <p style="text-align:center;margin-top:20px"><a class="btn ghost" href="#explorer" data-close>Open the finish explorer ${arrow}</a></p></div>`;
    makeCompare($("#shCompare", host));
  },
  property(host) {
    const tabs = [["Blueprint", "assets/img/step-01.webp", "Start with the architect's plan: rooms, openings and the pool terrace, in plan view."], ["3D layout", "assets/img/step-02.webp", "The same plan as a cutaway model. Buyers understand room sizes and relationships at a glance."], ["Walkthrough", "assets/img/step-03.webp", "Step inside at true scale in VR and walk room to room, long before the building exists."], ["Personalize", "assets/img/step-04.webp", "Try furniture styles and finishes live, and see the result in the same session."]];
    host.innerHTML = `<div class="demo-tabs" id="pxTabs"></div><div class="demo-split"><div style="aspect-ratio:3/2;background:#000;position:relative"><img id="pxImg" src="${tabs[0][1]}" alt="" style="width:100%;height:100%;object-fit:cover"></div><div class="demo-info"><span class="k">Stage 1 of 4</span><h5>${tabs[0][0]}</h5><p>${tabs[0][2]}</p><p style="margin-top:auto"><a class="btn ghost" href="#explorer" data-close>Try day and night lighting ${arrow}</a></p></div></div>`;
    pills($("#pxTabs", host), tabs.map(t => t[0]), i => { $("#pxImg", host).src = tabs[i][1]; $(".k", host).textContent = `Stage ${i + 1} of 4`; $("h5", host).textContent = tabs[i][0]; $(".demo-info p", host).textContent = tabs[i][2]; });
  },
  async museum(host) {
    const s = split(host); s.canvas.style.cursor = "grab";
    const m = await loadThree();
    const v = m.mountMuseum({ canvas: s.canvas, onSelect: (a, i) => { s.set("Study object", a.n, `${a.role}. ${a.d} Material: ${a.mat}.`); $$(".pill", s.pills).forEach((x, k) => x.setAttribute("aria-pressed", String(k === i))); } });
    pills(s.pills, m.ARTIFACTS.map(a => a.n), i => v.select(i)); cleanups.push(v.destroy);
  },
  education(host) {
    host.innerHTML = `<div class="demo-tabs" id="edTabs"></div><div id="edBody"></div>`;
    const bodyEl = $("#edBody", host); let cur = null;
    const modes = {
      Science() { const s = split(bodyEl); const o = orrery(s.canvas, { interactive: true, onPick: p => s.set("Science · Solar system", p.n, p.f) }); cur = o.destroy; },
      Geography() { const s = split(bodyEl); const o = globe(s.canvas, { pins: WONDERS, interactive: true, arcs: false, onPick: p => s.set("Geography · World", p.n, p.f) }); cur = o.destroy; },
      History() { timeline(bodyEl); cur = null; },
      Training() { scenario(bodyEl); cur = null; }
    };
    const names = Object.keys(modes);
    const go = i => { cur && cur(); cur = null; bodyEl.innerHTML = ""; modes[names[i]](); };
    pills($("#edTabs", host), names, go); go(0); cleanups.push(() => cur && cur());
  },
  tourism(host) {
    const s = split(host);
    const g = globe(s.canvas, { pins: DESTINATIONS, interactive: true, onPick: p => { s.set("Destination", p.n, p.f); $$(".pill", s.pills).forEach(x => x.setAttribute("aria-pressed", String(x.textContent === p.n))); } });
    pills(s.pills, DESTINATIONS.map(d => d.n), i => g.select(i)); cleanups.push(g.destroy);
  },
  entertainment(host) {
    const g = gallery(host, [
      { src: "assets/img/cat-entertainment.webp", alt: "A crowd exploring a glowing immersive digital world", cap: "Digital worlds" },
      { src: "assets/img/sb-4.webp", alt: "A glowing blueprint hovering between two hands", cap: "From blueprint…" },
      { src: "assets/img/sb-5.webp", alt: "A wireframe villa becoming photorealistic", cap: "…to world" },
      { src: "assets/img/sb-8.webp", alt: "A luxury living room at sunset", cap: "Step inside" },
      { src: "assets/img/sofa-vr.webp", alt: "A woman using a floating interface in a dark lounge", cap: "Make it interactive" }]);
    cleanups.push(g.destroy);
  }
};

async function openSheet(id) {
  const c = catById(id); if (!c) return;
  if (openId === id && !sheet.hidden) return;
  cleanups.splice(0).forEach(f => f && f()); openId = id;
  if (sheet.hidden) lastFocus = document.activeElement;
  body.innerHTML = `
    <div class="sh-hero"><div class="media" id="shMedia">${c.image ? `<img src="${c.image}" alt="">` : ""}</div>
      <div class="wrap sh-title"><p class="eyebrow">${c.no} · Experience</p><h1 id="sheetTitle">${c.name}</h1></div></div>
    <div class="wrap sh-main"><div><p class="sh-head">${c.headline}</p><p class="sh-desc">${c.desc}</p>
      <div class="sh-cta"><button class="btn solid" id="shCta">Discuss a project ${arrow}</button><a class="btn ghost" href="#projects" data-close>See related work</a></div></div>
      <div class="sh-services"><h4>Services</h4><ul>${c.services.map(s => `<li>${s}</li>`).join("")}</ul></div></div>
    <div class="wrap sh-demo"><div class="sh-demo-head"><h4>${c.demoTitle}</h4><p>${c.demoText}</p></div><div class="demo" id="demoHost"></div></div>`;
  if (c.art) { const a = mountArt($("#shMedia"), c.art); cleanups.push(a.destroy); }
  sheet.hidden = false; sheet.scrollTop = 0; document.body.style.overflow = "hidden";
  requestAnimationFrame(() => sheet.classList.add("show"));
  $("#shCta").addEventListener("click", () => { $("#f-cat").value = c.id; closeSheet("#contact"); });
  $$("[data-close]", body).forEach(a => a.addEventListener("click", e => { e.preventDefault(); closeSheet(a.getAttribute("href")); }));
  const host = $("#demoHost");
  try { await demos[c.demo](host); } catch (err) { console.warn("[demo]", err); host.innerHTML = `<p style="padding:30px;color:var(--mute)">This interactive demo needs a browser with WebGL.</p>`; }
  observe(body); $("#sheetClose").focus({ preventScroll: true });
}
function closeSheet(to) {
  if (sheet.hidden) { if (to) location.hash = to; return; }
  sheet.classList.remove("show"); openId = null; cleanups.splice(0).forEach(f => f && f());
  setTimeout(() => { sheet.hidden = true; body.innerHTML = ""; }, 400);
  document.body.style.overflow = ""; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  const dest = to || "#experiences"; if (location.hash !== dest) history.replaceState(null, "", dest);
  const t = $(dest); t && t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
}
$("#sheetClose").addEventListener("click", () => closeSheet());
const step = d => { const i = CATEGORIES.findIndex(c => c.id === openId), id = CATEGORIES[(i + d + CATEGORIES.length) % CATEGORIES.length].id; try { history.replaceState(null, "", `#/experience/${id}`); } catch (_) {} openSheet(id); };
$("#sheetPrev").addEventListener("click", () => step(-1)); $("#sheetNext").addEventListener("click", () => step(1));
addEventListener("keydown", e => { if (sheet.hidden || !lb.hidden) return; if (e.key === "Escape") closeSheet(); if (e.key === "ArrowLeft" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) step(-1); if (e.key === "ArrowRight" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) step(1); });
function route() {
  const m = location.hash.match(/^#\/experience\/([\w-]+)/);
  if (m && catById(m[1])) { setNav(false); openSheet(m[1]); }
  else if (!sheet.hidden) { sheet.classList.remove("show"); openId = null; cleanups.splice(0).forEach(f => f && f()); setTimeout(() => { sheet.hidden = true; body.innerHTML = ""; }, 400); document.body.style.overflow = ""; }
}
addEventListener("hashchange", route);
// Also open sheets directly, so it works where the URL hash is not editable (e.g. embedded previews)
document.addEventListener("click", e => { const a = e.target.closest('a[href^="#/experience/"]'); if (!a) return; const id = a.getAttribute("href").split("/").pop(); if (!catById(id)) return; e.preventDefault(); setNav(false); setMenu(false); try { history.replaceState(null, "", a.getAttribute("href")); } catch (_) {} openSheet(id); });

/* ------------------------------------------------------------------ contact */
const sel = $("#f-cat");
sel.innerHTML = `<option value="" disabled selected>Choose a category</option>` + CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("") + `<option value="other">Something else</option>`;
const form = $("#contactForm"), status = $("#formStatus");
const rules = { "f-name": v => v.trim().length > 1 || "Please tell us your name.", "f-email": v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email address.", "f-cat": v => !!v || "Please choose a category.", "f-msg": v => v.trim().length > 9 || "Please describe your project in a few words.", "f-ok": (v, el) => el.checked || "Please confirm so we can reply." };
function check(id) { const el = document.getElementById(id), ok = rules[id](el.value, el), msg = $(`.err[data-for="${id}"]`); const bad = ok !== true; msg.textContent = bad ? ok : ""; el.closest(".field")?.classList.toggle("bad", bad); el.setAttribute("aria-invalid", String(bad)); return !bad; }
Object.keys(rules).forEach(id => { const el = document.getElementById(id); el.addEventListener("blur", () => check(id)); el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true") check(id); }); });
form.addEventListener("submit", async e => {
  e.preventDefault(); status.className = "form-status wide"; status.textContent = "";
  const bad = Object.keys(rules).filter(id => !check(id)); if (bad.length) { document.getElementById(bad[0]).focus(); return; }
  const d = Object.fromEntries(new FormData(form)); if (d.website) return;     // honeypot
  const data = { name: d.name, email: d.email, organization: d.organization || "", category: (catById(d.category)?.name) || "Other", message: d.message };
  if (CONFIG.formEndpoint) {
    const btn = $("button[type=submit]", form); btn.disabled = true; status.textContent = "Sending…";
    try { const r = await fetch(CONFIG.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(r.status); status.className = "form-status wide ok"; status.textContent = "Thank you. Your inquiry has been sent and we will reply soon."; form.reset(); }
    catch (err) { status.className = "form-status wide bad"; status.textContent = `Sorry, that did not send. Please email ${CONFIG.contactEmail} directly.`; }
    btn.disabled = false;
  } else {
    // Honest fallback: no backend configured, so hand the message to the visitor's email app.
    const subject = encodeURIComponent(`InspiraXR inquiry: ${data.category}`);
    const text = encodeURIComponent(`Name: ${data.name}\nEmail: ${data.email}\nOrganization: ${data.organization}\nCategory: ${data.category}\n\n${data.message}`);
    status.className = "form-status wide warn"; status.textContent = `The form is not connected to a server yet, so we opened your email app with the message ready to send to ${CONFIG.contactEmail}.`;
    location.href = `mailto:${CONFIG.contactEmail}?subject=${subject}&body=${text}`;
  }
});

/* --------------------------------------------------------------------- boot */
observe(document); route();
