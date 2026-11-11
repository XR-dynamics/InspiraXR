# InspiraXR website

Static site (plain HTML, CSS and ES-module JS). No build step, no dependencies.

## Structure
- `index.html`, `style.css`, `main.js`
- `assets/video/` hero.mp4 / hero-720.mp4 (hero), steps.mp4 / steps-720.mp4 (four-steps section)
- `assets/img/` cat-*.webp (six experiences), proj-wireframe.webp, hero-poster.jpg, steps-poster.jpg, logo files, og.jpg
- `assets/fonts/` self-hosted Manrope and Cormorant Garamond

## Run locally
`python3 -m http.server 8000` then open http://localhost:8000

## Contact form
Set `CONFIG.formEndpoint` in `main.js` (e.g. a Formspree URL). Until then it falls back to a mailto link.

## Publishing
Enable GitHub Pages (Settings → Pages → main / root) only when you approve a public launch.
