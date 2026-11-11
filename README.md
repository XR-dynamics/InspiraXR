# InspiraXR website

A static, no-build website for GitHub Pages: plain HTML, CSS and JavaScript modules. Three.js is bundled locally in `assets/vendor/three` and the fonts are self-hosted, so the site makes no third-party requests.

## Run locally
Browsers block ES modules on `file://`, so serve the folder:

    python3 -m http.server 8000
    # open http://localhost:8000

There is no install and no build step.

## Deploy to GitHub Pages
1. Create a repository (e.g. `inspiraxr`) and push these files to the root of the `main` branch.
2. Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. The site appears at `https://<user>.github.io/<repo>/`. All paths are relative, so project sites work.
4. Custom domain: add a `CNAME` file containing the domain, then set the same domain in Pages settings.

Keep the repository private, or leave Pages unpublished, until the site has been approved.

## Edit content
Everything editable is at the top of `main.js`:
- `CONFIG`: contact email and the form endpoint.
- `CATEGORIES`: the six experiences (headline, description, services, demo).
- `PROJECTS`: the portfolio. These are labelled as demonstration concepts. Add real client work only when it exists.
- `FILM`, `TECH`, `APPROACH`: the film strip, technology and approach sections.

Page copy (hero, intro, about, contact details) is in `index.html`. Colours, type and spacing are CSS variables at the top of `style.css`.

## Contact form
Set `CONFIG.formEndpoint` in `main.js` to a form backend (Formspree, Getform, Basin, your own API). The form sends a JSON POST: `{ name, email, organization, category, message }`. While the endpoint is empty, the form says so honestly and opens the visitor's email app addressed to `CONFIG.contactEmail`. It never claims a message was sent when it was not.

## Replace media
Files keep their paths, so replacing a file is enough:

| File | Used for |
|---|---|
| `assets/video/hero.mp4`, `hero-720.mp4` | Hero video (and mobile version) |
| `assets/img/hero-poster.jpg` | Hero poster / reduced-motion frame |
| `assets/img/cat-*.webp` | Category cards and page headers |
| `assets/img/step-01..04.webp` | Blueprint, layout, walkthrough, personalize |
| `assets/img/sb-1..8.webp` | Film strip frames |
| `assets/img/og.jpg` | Social share image (1200x630) |

Education and Tourism use live canvas artwork (solar system, globe) until real renders are supplied. To use an image instead, set `image:` on that category in `main.js`.

The header logo is an inline SVG wordmark (`<symbol id="mark">` in `index.html`). Swap in the real logo there.

## Performance and accessibility
- Three.js demos load only when scrolled into view, and pause when off screen.
- `prefers-reduced-motion` stops the hero video, auto-rotation and reveal animations.
- Keyboard accessible menu, filters, sliders, dialogs; Esc closes overlays.

## Structure
    index.html   page markup
    style.css    all styling
    main.js      content data, routing, UI behaviour
    widgets.js   canvas demos (orrery, globe, timeline, scenario, gallery)
    three-demos.js  Three.js finish explorer and museum viewer (lazy loaded)
    assets/      video, images, fonts, vendor/three
