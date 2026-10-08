# InspiraXR — The Glass Residence

An immersive, photorealistic walkthrough of a contemporary luxury residence, built for the web with Three.js.
The visitor walks through one continuous house: entrance, double-height living room, dining, kitchen,
hallway, two bedroom suites, bathrooms and the pool terrace. There are no scene changes and no teleporting.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/
```

You need a desktop browser with WebGL2 and a dedicated or recent integrated GPU. Resolution adapts
automatically to keep the frame rate smooth.

## Controls

| Action | Input |
| --- | --- |
| Look around | Drag with the mouse or a finger. The arrow keys turn left and right. |
| Walk | `W` `A` `S` `D` / `↑` `↓`. Hold `Shift` for a brisk pace. |
| Walk to a spot | Click the floor. |
| Go to a room | Use the room selector at the bottom, or the floor plan (`P`). |
| Doors, curtains, light switches, fireplace | Click them. Walking into a closed door also opens it. |
| Lights in the current room | `L` |
| Day / Sunset / Night | Top-right selector, or `1` `2` `3` |
| Change finishes | Click the sofa (bouclé colours) or the kitchen island (marble). |
| Lens | Mouse wheel (40°–75° field of view) |

## How it is made

There are no downloaded models or textures. Everything is generated at load time:

- **Procedural PBR materials** (`src/materials`). Albedo, normal and roughness maps for honed limestone,
  walnut veneer, Grigio and Calacatta marble, oak planks, bouclé, linen, wool, teak decking and more are
  baked on the GPU from tileable noise. Each one has subtle imperfections: tile lippage, smudges, pores
  and seams.
- **Architecture from one plan** (`src/world/layout.js`). Rooms, walls, openings, doors and the curtain
  wall are defined once. The 3D shell, the collision grid and the floor-plan overlay are all built from
  this data, so they always agree.
- **Lighting.** An atmospheric sky, a sun with 4K soft shadows, and per-room light probes captured from
  inside the house with box-projected (parallax-corrected) reflections. Real spot and point lights are
  grouped per room and fade in and out.
- **Camera post-processing.** HDR with 4× MSAA, ground-truth ambient occlusion, gentle bloom, ACES tone
  mapping, a photographic vignette and fine grain. The intro uses an architectural shift lens to keep
  vertical lines straight.
- **Navigation** (`src/nav`). A 10 cm walkability grid handles collision with walls and furniture, and
  A* plans every route. The camera stays at a natural eye height of 1.65 m with soft acceleration and a
  subtle gait.

## Debug parameters

- `?enter`: skip the intro screen.
- `?mode=day|sunset|night`: choose the starting light.
- `?still`: render only on demand through `window.__residence.step()`. This is useful for automated
  captures.
