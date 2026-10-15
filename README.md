# InspiraXR — The Glass Residence and The Apartment

An immersive walkthrough of a contemporary luxury residence, built for the web with Three.js. The
visitor walks through one continuous house: entrance, double-height living room, dining, kitchen,
hallway, two bedroom suites, bathrooms and the pool terrace. There are no scene changes and no
teleporting between rooms on the desktop.

On top of that it now offers:

- **VR on Meta Quest** (WebXR `immersive-vr`), using the same scene, state and assets as the desktop.
- **Room customisation** from a contextual panel: wall colours, five lighting environments,
  furniture placement, and an Empty Room / Restore / Reset flow. It works on the desktop and in the headset.

## Two homes

The intro screen lets you choose between two homes; both share the same engine, walking, customisation, VR and tests.

| | The Glass Residence | The Apartment |
| --- | --- | --- |
| Open with | `/` or `/?home=residence` | `/?home=apartment` |
| Source | generated entirely in code (`src/world`) | **your plan, meshes and `scene.json`** (`assets/apartment`, packed into `public/apartment`) |
| Rooms | living, dining, kitchen, hall, two suites, two baths, terrace + pool | living, dining, kitchen, entrance, bedroom, study, bathroom, terrace |
| Setting | garden terrace | a plateau above the **sea** (no plants or trees anywhere) |
| Extra | | **Blueprint view** (neon-blue wireframe, desktop and VR), curtains moving in a breeze |

Both get a **Home** panel (button with the bulb icon, or `H`; in VR the wrist toolbar's *Home*): lights per room
and all on/off, open/close curtains and sheers, breeze on/off, terrace door. The apartment adds the blueprint
toggle (`B`, the grid button, or *Blueprint* on the VR wrist toolbar). Details: [docs/APARTMENT.md](docs/APARTMENT.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
npm run preview    # serve the build
```

You need a desktop browser with WebGL2 and a dedicated or recent integrated GPU. Resolution adapts
automatically to keep the frame rate smooth.

## Desktop controls

| Action | Input |
| --- | --- |
| Look around | Drag with the mouse or a finger. The arrow keys turn left and right. |
| Walk | `W` `A` `S` `D` / `↑` `↓`. Hold `Shift` for a brisk pace. |
| Walk to a spot | Click the floor. |
| Go to a room | Room selector at the bottom, or the floor plan (`P`). |
| Doors, curtains, light switches, fireplace | Click them. Walking into a closed door also opens it. |
| Lights in the current room | `L` |
| Day / Sunset / Night | Top-right selector, or `1` `2` `3` |
| Change finishes | Click the sofa (bouclé colours) or the kitchen island (marble). |
| Lens | Mouse wheel (40°–75° field of view) |
| **Customise a wall** | Stand within 1.5 m of a wall and look at it: it is highlighted and **E — Customise** appears. Press `E` (or click the prompt). |
| Close the panel | **Close** button or `Esc`. |
| Rotate selected furniture | `R` (`Shift`+`R` the other way) |

While the panel is open, walking keys and click-to-walk are disabled (so nothing fights the panel),
and any pointer lock is released. Closing the panel returns control to navigation.

## Customise

Open it by looking at a wall and pressing `E`, or with the sliders icon in the top-right (then no wall is selected).

1. **Wall**: choose from 12 curated swatches or a custom colour; **Apply to all walls**;
   **Restore original**. Only the targeted wall face changes. The two sides of a partition, and
   walls in different rooms, are independent. The plaster texture and relief are kept; only the tint changes.
2. **Light**: Bright Daylight, Warm Golden Hour, Overcast Soft Light, Evening Interior, Night Interior,
   each with a preview swatch, plus **Restore original** (Warm Golden Hour).
3. **Furniture**: pick a piece from the nearby list or click it in the room (teal outline), then drag it
   along the floor, rotate it (buttons or `R`), nudge it, toggle grid snapping (25 cm / 15°),
   **Cancel**, **Reset piece**, **Done**. Pieces stay on the floor, cannot be placed through walls,
   into other furniture, into the pool, or across the indoor/outdoor boundary.
4. **Room**: **Empty room** (with confirmation, for the current room or the whole residence),
   **Restore furniture**, and **Reset room** (wall colours, layout and lighting).

Emptying hides only movable furniture and loose decor (including the existing potted plants). Walls,
floors, ceilings, doors, windows, curtains, built-ins (kitchen cabinetry and island, vanities, tub,
fireplace, TV wall), the garden and all lighting stay. Wall-hung pieces (nightstands, the hallway
console) and objects that sit on surfaces (hearth urn, island bowl, wall art) can be hidden but not moved.

Your design is saved in the browser (`localStorage`) and restored on reload. Add `?reset` to the URL to start clean.

## VR (Meta Quest)

The **Enter VR** button (headset icon, top-right) starts a WebXR `immersive-vr` session. It explains
what is wrong if WebXR is missing, the page is not HTTPS, no headset is reported, or the browser refuses.

| In the headset | Control |
| --- | --- |
| Look / move | Turn your head; walk physically within your play area |
| Travel | Push a thumbstick forward: a teal arc and ring appear (red when blocked); release to teleport |
| Turn | Thumbstick left/right: 30° snap turn |
| Point and select | Controller ray + **trigger** (activates on release) |
| Customise a wall | Point at a wall within 1.5 m: it highlights and **Trigger — Customise** appears beside it; point at that label and pull the trigger |
| Move furniture | Furniture tab → select a piece → **hold the grip** and move the controller; thumbstick rotates; release to place |
| Menu | Small toolbar on top of the left controller: **Customise** and **Exit VR**. `B` / `Y` also toggle the panel. |

The panel is a world-space object about 1.15 m in front of you, drawn from the same description as the desktop panel.

### Meta Quest over HTTPS

WebXR needs a secure context. See [docs/QUEST-TESTING.md](docs/QUEST-TESTING.md) for the options and a
full on-device checklist. In short:

- **USB**: `adb reverse tcp:5173 tcp:5173`, then open `http://localhost:5173` in the Quest Browser.
- **Tunnel**: `npm run dev` + `cloudflared tunnel --url http://localhost:5173` and open the `https://…` address.
- **Hosting**: `npm run build` and upload `dist/` to any HTTPS static host.

## How it is built

The Residence uses no downloaded models or textures: everything is generated at load time. The Apartment loads the supplied meshes and plan, and still generates every texture on the GPU at load time.

- `src/materials`: GPU-baked procedural PBR materials (stone, walnut, marble, oak, fabrics, …).
- `src/layouts`: one descriptor per home (rooms, views, zones, builders); `src/layouts/apartment` builds the apartment from the packed plan.
- `src/world`: the Residence plan (`layout.js`), architecture, rooms, lighting and interactions. The `Batcher`
  merges geometry for speed. Two additions make customisation possible: **furniture items**
  (`ctx.item(...)` groups, individually movable) and **wall faces** (ranges in the merged wall
  meshes with a per-vertex tint).
- `src/nav`: walkability grid and A* routing, plus the movable-furniture collision layer.
- `src/custom`: wall painting, furniture placement, the controller (`customiser.js`), and the
  desktop DOM panel. The panel is described once as data (`getSchema()`).
- `src/xr`: the WebXR manager and the in-headset canvas UI that renders the same schema.
- Rendering: one `WebGLRenderer`, one `setAnimationLoop`. On the desktop it goes through the
  post-processing composer (MSAA, GTAO, bloom, grade). In a VR session it renders directly to the headset.

### Debug parameters

`?enter` skips the intro · `?mode=day|sunset|overcast|evening|night` starting light · `?reset` ignores the
saved design · `?wallRange=2` wall proximity in metres · `?vrScale=0.8` lower headset resolution ·
`?quality=low|high` · `?still` render only on demand (used by the tests).

## Tests

```bash
npm run test:logic     # fast, pure Node: collision, placement rules, painting isolation, panel schema
npm run dev            # in another terminal, then:
npm run test:desktop   # real headless browser: navigation, targeting, E/Esc, painting, presets, furniture, reload
npm run test:xr        # real WebXR code path against Meta's IWER Quest 3 emulator
npm run test:apartment       # the apartment: rooms reachable, doors, walls, furniture, Home panel, breeze, ocean, blueprint
npm run test:xr:apartment    # the apartment in an emulated Quest 3: wrist toolbar, blueprint, Home panel, teleport rules
```

The browser tests use headless Chromium with software WebGL, so they are slow but exact. Set
`CHROMIUM_PATH` to use a specific browser, `APP_URL` to test a deployed build.

**What `test:xr` does not prove.** It emulates a headset and controllers through the real WebXR
API. It cannot show comfort, real tracking, controller-model appearance, text legibility at the
actual optics, or frame rate on a Quest. Use [docs/QUEST-TESTING.md](docs/QUEST-TESTING.md) for those.

## Known limitations

- VR has **not been run on a physical headset** by the author of this change.
- The scene is heavy for a mobile headset: roughly 390 draw calls and about 30 lights. Expect to lower
  `?vrScale` or to find the frame rate below the headset's refresh rate until it has been profiled on a device.
- No hand tracking (the app had none). Controllers only.
- Real-world walking cannot be blocked: you can physically walk your head through a virtual wall; only teleport and furniture placement are validated.
- Controller models are fetched from the WebXR input-profiles CDN; offline, the rays and toolbar still work but no controller model is drawn.
- Wall colour tints the painted plaster. Faces covered by walnut, slate or fluted cladding keep that finish, and
  door and window reveals keep the original plaster.
- Furniture reflections come from the room's light probe captured at load; moving a piece does not
  update the reflections other surfaces show of it.
