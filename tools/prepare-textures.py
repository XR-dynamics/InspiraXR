#!/usr/bin/env python3
"""
Prepares the supplied wallpaper / moodboard photographs as web textures (public/apartment/tex).

- Wallpapers and reliefs are sampled from swatches that do not tile; this makes them seamless by the
  classic offset-and-blend method (the seam is moved to the middle and cross-faded over a narrow band).
- Every output is a JPEG (or a PNG when it needs transparency), at most 2048 px on the long side.
Usage: python3 tools/prepare-textures.py
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'apartment', 'textures-src')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'apartment', 'tex')
os.makedirs(OUT, exist_ok=True)

def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')

def seamless(img, axes='xy', band=0.12, edge=0.06):
    """Make `img` tile along the given axes. `edge` of the image at each side keeps the shifted copy
    (continuous across the wrap); the middle keeps the original; `band` is the cross-fade width."""
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    def blend(a, axis):
        n = a.shape[axis]
        shifted = np.roll(a, n // 2, axis=axis)
        t = (np.arange(n) + 0.5) / n                     # 0..1 along the axis
        d = np.minimum(t, 1 - t)                         # distance to the nearest edge, 0..0.5
        m = np.clip((d - edge) / band, 0, 1)
        m = m * m * (3 - 2 * m)                          # smoothstep: 0 at the edges, 1 inside
        shape = [1, 1, 1]; shape[axis] = n
        m = m.reshape(shape)
        return shifted * (1 - m) + a * m
    if 'y' in axes: a = blend(a, 0)
    if 'x' in axes: a = blend(a, 1)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def save(img, name, q=90, maxside=2048):
    img = img.copy()
    if max(img.size) > maxside:
        s = maxside / max(img.size); img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, quality=q, subsampling=0) if name.endswith('.jpg') else img.save(path)
    print(f'{name:28s} {img.size}')

# ---- wallpapers and reliefs
save(seamless(load('arte_fpg_9330_aILxM5-full-pattern.jpg'), 'y'), 'crane_rust.jpg')
save(seamless(load('arte_fpg_9331_2HL4s2-full-pattern.jpg'), 'y'), 'crane_sage.jpg')
save(seamless(load('arte_fpg_9332_WUmClJ-full-pattern.jpg'), 'y'), 'crane_dark.jpg')
save(seamless(load('arte_fpg_9353_1lqkGH-full-pattern.jpg'), 'xy'), 'crane_blush.jpg')
save(seamless(load('media-library4tpNGp-full-pattern.jpg'), 'xy', band=0.10, edge=0.04), 'relief_green.jpg')
save(seamless(load('media-library2nEKcS-full-pattern.jpg'), 'xy', band=0.10, edge=0.04), 'relief_charcoal.jpg')

# ---- cane webbing: one clean period, with the open holes turned into transparency
c = load('85541-thumb-two-thirds.jpg')
w, h = c.size
c = c.crop((int(w * 0.10), int(h * 0.30), int(w * 0.10) + 440, int(h * 0.30) + 440))
c = seamless(c, 'xy', band=0.12, edge=0.05)
g = np.asarray(c.convert('L')).astype(np.float32) / 255
alpha = np.clip((g - 0.20) / 0.18, 0, 1)                 # black holes -> 0
rgba = np.dstack([np.asarray(c), (alpha * 255).astype(np.uint8)])
save(Image.fromarray(rgba, 'RGBA').resize((880, 880), Image.LANCZOS), 'cane.png')
# the cane without alpha (for flat wall panels backed by dark board)
save(c.resize((880, 880), Image.LANCZOS), 'cane_flat.jpg')

# ---- real material photographs from the moodboard
def upscale(img, k=3):
    img = img.resize((img.width * k, img.height * k), Image.LANCZOS)
    return img.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
rosso = load('moodboard-023.jpg')
save(seamless(upscale(rosso, 3), 'xy', band=0.14, edge=0.05), 'rosso_marble.jpg')
onyx = load('moodboard-027.jpg')
save(seamless(upscale(onyx, 2), 'xy', band=0.14, edge=0.05), 'onyx.jpg')
gc = load('moodboard-018.jpg')
save(seamless(upscale(gc, 3), 'xy', band=0.14, edge=0.05), 'grasscloth_stripe.jpg')
warm = load('moodboard-001.jpg')
warm = warm.crop((0, 0, warm.width, int(warm.height * 0.82)))        # drop the caption
save(seamless(upscale(warm, 3), 'xy', band=0.14, edge=0.05), 'grasscloth_weave.jpg')
rug = load('moodboard-017.jpg')
rug = rug.crop((int(rug.width * 0.06), int(rug.height * 0.06), int(rug.width * 0.94), int(rug.height * 0.94)))
save(seamless(upscale(rug, 2), 'xy', band=0.14, edge=0.05), 'rug_rust.jpg')
tray = load('moodboard-029.jpg')
save(seamless(tray.crop((int(tray.width * 0.28), int(tray.height * 0.25), int(tray.width * 0.62), int(tray.height * 0.85))).resize((900, 1200), Image.LANCZOS), 'xy', band=0.14, edge=0.05), 'microcement.jpg')
save(seamless(load('sofa-linen.jpg'), 'xy', band=0.10, edge=0.04), 'sofa_linen.jpg')
