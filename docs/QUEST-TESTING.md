# Testing on a physical Meta Quest

The automated headset tests (`npm run test:xr`) drive the real WebXR code path through Meta's IWER
emulator. They **cannot** tell you how the experience feels or performs on a headset. This is the
protocol for that. Tick each item on a real device and note the headset model and browser version.

## 1. Get the page onto the headset over trusted HTTPS

WebXR requires a *secure context*. Pick one:

| Option | Steps | Notes |
| --- | --- | --- |
| **A. USB reverse port (best for development)** | Enable Developer Mode on the Quest, connect USB, accept the debugging prompt, then run `adb reverse tcp:5173 tcp:5173` on the computer that runs `npm run dev`. In the Meta Quest Browser open `http://localhost:5173`. | `localhost` is a secure context, so no certificate is needed. Needs `adb` (Android platform-tools). |
| **B. Public HTTPS tunnel** | Run `npm run dev`, then `cloudflared tunnel --url http://localhost:5173` (or `ngrok http 5173`). Open the printed `https://…` address in the Quest Browser. | Trusted certificate. `vite.config.js` already allows `*.trycloudflare.com`, `*.ngrok-free.app`, `*.ngrok.app` and `*.loca.lt`. |
| **C. Static hosting** | `npm run build`, upload `dist/` to any HTTPS static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages). | Best for sharing. Use relative paths (already configured). |

Plain `http://192.168.x.x:5173` over Wi-Fi is **not** a secure context. The page loads, but the
**Enter VR** button explains this instead of starting a session.

## 2. Checklist

Record a result (pass / fail / note) for every line.

**Session**
- [ ] The *Enter VR* button reads as available (gold outline) in the Quest Browser.
- [ ] Pressing it starts an immersive session; the browser's VR permission prompt (if any) is accepted.
- [ ] Both eyes show the scene; no double vision; the horizon is level.
- [ ] You start inside the house, in the entrance hall, facing into the living room.
- [ ] Standing at your real height, the eye height feels natural (not too tall, not too short).
- [ ] Walking physically a few steps moves you smoothly; leaning and looking around is stable.

**Controllers and locomotion**
- [ ] Both controllers appear with a visible ray; the ray changes colour over interactive things.
- [ ] Push a thumbstick forward: a teal arc and a destination ring appear; releasing teleports you.
- [ ] Aim at a spot in another room through a wall: the arc/ring turn red and releasing does nothing.
- [ ] Aim onto a sofa or table: red, no teleport.
- [ ] Thumbstick left/right snaps the view by 30°.
- [ ] A short black fade on teleport is comfortable (no nausea).

**Wall interaction**
- [ ] Walk within about 1.5 m of a wall and point at it: it gets a subtle amber highlight and a
      *Trigger — Customise* label appears beside it.
- [ ] From farther away, nothing appears.
- [ ] Pointing at a wall through a doorway or across a room does not trigger it.
- [ ] Pulling the trigger while pointing at the label opens the panel **once** (no flicker, no double open).
- [ ] The panel is readable at arm's length (text sharp, not blurry or tiny).
- [ ] While it is open, pointing at other walls does not change the selected wall.

**Panel**
- [ ] Wall tab: swatches change the colour; the three colour sliders can be dragged; Apply to all
      walls and Restore original work.
- [ ] Light tab: all five presets change the light and the sky; Restore original works.
- [ ] Furniture tab: choose a piece from the list or point at it and pull the trigger; the teal
      outline appears; hold the grip and move the controller to carry it; release to place; the
      thumbstick rotates it while held.
- [ ] Dropping a piece into a wall or onto another piece is refused and it returns.
- [ ] Rotate, arrows, Snap, Cancel, Reset piece, Done all respond.
- [ ] Room tab: Empty prompts for confirmation, hides the furniture, Restore furniture brings it back,
      Reset room restores everything.
- [ ] Close button closes the panel.

**Exit and return**
- [ ] The small toolbar on top of the left controller shows *Customise* and *Exit VR*.
- [ ] *Exit VR* ends the session and the browser returns to the normal page.
- [ ] Wall colours, furniture positions and the lighting you changed are still applied on the page.
- [ ] Walking with the keyboard/mouse still works afterwards. Entering VR a second time works.

**Performance and comfort (record numbers)**
- [ ] Frame rate stays at the headset's refresh rate (72/90 Hz) while turning your head in the living room.
- [ ] Frame rate in the kitchen and the bedroom wing.
- [ ] Note any judder when the panel is open, or when a preset animates.
- [ ] If it drops, retry with `?vrScale=0.8` (lower resolution) and report the difference.

## 3. Reporting

Please include: headset model, Meta Quest Browser version, connection option used, and for each
failed item what happened. A screen recording from the headset helps for visual problems.

## The apartment (`/?home=apartment`)

Everything above applies. In addition, on a real headset please check and note:

1. **Frame rate.** The apartment has fewer meshes than the residence but 2K textures and a sea shader that covers the whole horizon. If it drops below 72 Hz, add `?vrScale=0.8`.
2. **Blueprint view.** Wrist toolbar -> *Blueprint*. Lines should be thin, bright and steady in both eyes, with no shimmer. If they look too thin, raise `uWidth` in `src/world/blueprint.js`; if the scene feels too busy, lower the number of streaks (`N`).
3. **Home panel.** Wrist toolbar -> *Home*. Point and pull the trigger: each room's light, *All on / All off*, curtains, sheers, breeze, terrace door. Check the text is legible at arm's length.
4. **Breeze.** Stand by the living-room window with the terrace door open: the sheers should billow into the room, hem first, with slow gusts. They must not flicker or tear.
5. **Sea.** Look at the horizon from the terrace: no visible seam between sea and sky, and no shimmering on the waves.
6. **Teleport.** Aim at the bathroom from the entrance: the marker must turn invalid (a wall is in between). Through an open door it should be valid.
