# The Apartment

The apartment is built from the plan and assets you supplied. Nothing in the layout is invented: walls,
openings, doors, furniture, lights and cameras come from `scene.json`, and every mesh is one of your FBX files.

## Where things come from

| Piece | Source | Where it ends up |
| --- | --- | --- |
| 219 meshes | `assets/apartment/source/Meshes/*.fbx` | `public/apartment/pack.bin` (3 MB, 126k vertices) |
| Plan, materials, placements, doors, lights | `assets/apartment/source/scene.json` | `public/apartment/pack.json` |
| Textures | generated on the GPU at load time (`src/layouts/apartment/shaders.js`) | 2K albedo for the visible surfaces |
| Reference images | `assets/apartment/reference/` | not used at runtime |

Rebuild the pack after changing a mesh or the plan:

```bash
npm run build:apartment      # node tools/build-apartment-pack.mjs [--src dir] [--out dir]
```

`scene.json` uses x east, y north, z up (metres). The web scene uses x east, y up, z south, so a plan point
`(x, y, z)` becomes `(x, z, -y)`; yaw (degrees, counter-clockwise from above) maps to `rotation.y` unchanged.

## What was added on top of the plan

- **Materials.** All 73 plan materials are mapped to physically based surfaces: honed travertine floor, cream
  marble with gold veining, rosso/terracotta shower marble, dark onyx floor, graphic relief tile, rust ornamental
  wallpaper, woven cane, fluted and figured walnut, bouclé, linen, wool, brushed metals, glass. The plan's
  colours are kept; the surface detail is generated. The plan's own 512 px textures were not used.
- **Ocean.** The plan stands on a gravel plateau; beyond it a displaced rock cliff falls to an animated sea that
  reflects the sky and follows the time of day. There are no plants, trees or other objects outside.
- **Breeze.** Curtains and sheers sway in a vertex shader (head fixed to the rail, hem moving most, slow gusts).
  Cloth panels are regenerated as pleated, openable curtains from the plan's rail and drape extents.
- **Lights.** The plan's 86 lights are grouped per room and merged by position into a few real lights per room
  (lumens add up). Every visible fixture (downlights, cove strips, pendants, lamps, mirror halos) is also an emissive
  surface on its room's switch. Wall switches are placed at each room's door; the Home panel has the same buttons.
- **Blueprint view.** Every edge of every mesh becomes a camera-facing neon ribbon (width in metres, so it is
  correct in each eye of a headset), over a grid floor, with a scanning pulse and drifting streaks.
- **Movable furniture.** 38 pieces can be selected and moved; decor standing on a piece (plates, lamps, books,
  laptop) moves with it. Built-ins (kitchen, wardrobes, shelving, bathroom fixtures) stay put but block walking.

## Honest limits

- The furniture meshes are low-polygon (about 42k triangles for the whole apartment). They are as detailed as the
  files you supplied; better source models would look better. The green armchair mesh shows visible stepped bands.
- Lighting is a real-time approximation of the plan's 86 lights, not a one-to-one match to Unreal's lumen values.
  Intensities were tuned by eye in a software-rendered browser; expect to retune on real hardware.
- Textures are procedural. They imitate the materials on your moodboards (travertine, rosso marble, relief tile,
  wallpaper) but are not scans of them.
- Not measured on a physical Meta Quest: frame rate, comfort, controller models and text legibility need a device.
  See [QUEST-TESTING.md](QUEST-TESTING.md).
- The blueprint view is x-ray style (no hidden-line removal); lines fade with distance.

## Furnishing (empty shell → furnished)

The apartment is built from the plan's architecture only (walls, floors, doors, curtains, downlights). All furniture is added by
`src/layouts/apartment/furnish/*` from the moodboard, one module per room, using the small modelling kit in `furnish/kit.js`
(rounded boxes, lathe, fluted columns, bent panels). The sectional sofa is the model you supplied (`public/apartment/models/sofa.*`,
built by `tools/build-sofa.mjs`). The dining table has **four** cane-back chairs; the bathroom has a wall-hung toilet with concealed cistern.

Honest limits: the pieces are modelled in code, not downloaded - Poly Haven, Sketchfab and similar hosts are blocked from this build
environment, so no public meshes could be fetched. They are simpler than hand-sculpted assets. Replace any piece by editing its module,
or supply a GLB and load it in place of the generated geometry. Nothing here has been tested on a physical Quest; only the emulated
headset test (`npm run test:xr:apartment`) exists.
