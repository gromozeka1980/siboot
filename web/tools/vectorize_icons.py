"""Vectorises the original 32x32 eeyal icons into smooth SVGs (potrace per colour layer), keeping Crawford's drawings.

  pip install potracer numpy
  python tools/vectorize_icons.py      ->  assets/remake/iconsvg/<n>.svg  (+ manifest entries via remake_art.py manifest)

Each colour of an icon is traced separately and stacked: background, fills by area (largest first), black last, so the
black outlines cover the seams between smoothed fills.
"""
from pathlib import Path
import numpy as np
import potrace
from PIL import Image

WEB = Path(__file__).resolve().parent.parent
OUT = WEB / 'assets' / 'remake' / 'iconsvg'
SHEET = Image.open(WEB / 'assets' / 'wordicons.png').convert('RGB')


def path_d(curves):
    d = []
    for c in curves:
        p = c.start_point
        d.append(f'M{p.x:.2f} {p.y:.2f}')
        for s in c.segments:
            if s.is_corner: d.append(f'L{s.c.x:.2f} {s.c.y:.2f}L{s.end_point.x:.2f} {s.end_point.y:.2f}')
            else: d.append(f'C{s.c1.x:.2f} {s.c1.y:.2f} {s.c2.x:.2f} {s.c2.y:.2f} {s.end_point.x:.2f} {s.end_point.y:.2f}')
        d.append('Z')
    return ''.join(d)


def flatten_dither(px):
    """Checkerboard areas (pixel-art shading, at least 3x3) become one solid in-between colour, which traces cleanly.
    Smaller alternations are real details (diagonal lines, eyes) and stay."""
    out = px.copy()
    h, w, _ = px.shape
    for y in range(h - 2):
        for x in range(w - 2):
            a, b = px[y, x], px[y, x + 1]
            if (a == b).all(): continue
            win = px[y:y + 3, x:x + 3]
            if all((win[i, j] == (a if (i + j) % 2 == 0 else b)).all() for i in range(3) for j in range(3)):
                out[y:y + 3, x:x + 3] = ((a.astype(int) + b) // 2).astype(np.uint8)
    return out


def scale2x(m):
    """EPX/Scale2x on a boolean mask: doubles resolution, rounds diagonals, keeps 1-px lines."""
    p = np.pad(m, 1, mode='edge')
    A, B, C, D, P = p[:-2, 1:-1], p[1:-1, :-2], p[1:-1, 2:], p[2:, 1:-1], p[1:-1, 1:-1]
    e0 = np.where((A == B) & (A != C) & (B != D), A, P); e1 = np.where((A == C) & (A != B) & (C != D), C, P)
    e2 = np.where((B == D) & (B != A) & (D != C), B, P); e3 = np.where((C == D) & (C != A) & (D != B), D, P)
    out = np.empty((m.shape[0] * 2, m.shape[1] * 2), bool)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = e0, e1, e2, e3
    return out


def vectorise(cell, smooth=1.0):
    raw = np.array(cell)
    px = flatten_dither(raw)
    # flattened shading that reaches the icon's edge is a background pattern, not part of the drawing: paint it as background
    cols, cnts = np.unique(raw.reshape(-1, 3), axis=0, return_counts=True)
    bgc = cols[np.argmax(cnts)]
    todo = np.any(px != raw, axis=2)
    h, w = todo.shape
    while todo.any():
        y0, x0 = map(int, np.argwhere(todo)[0])
        comp, stack = [], [(y0, x0)]
        todo[y0, x0] = False
        while stack:
            y, x = stack.pop(); comp.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and todo[ny, nx]: todo[ny, nx] = False; stack.append((ny, nx))
        if len(comp) > 40 and any(min(y, x, h - 1 - y, w - 1 - x) <= 2 for y, x in comp):  # icons have a 1-px frame
            for y, x in comp: px[y, x] = bgc
    colours, counts = np.unique(px.reshape(-1, 3), axis=0, return_counts=True)
    if len(colours) <= 1: return None
    bg = tuple(colours[np.argmax(counts)])
    layers = []
    for col, n in sorted(zip(map(tuple, colours), counts), key=lambda t: -t[1]):
        if col == bg: continue
        mask = scale2x(scale2x(np.all(px == col, axis=2)))  # traced at 4x, drawn in a 32-unit viewBox
        curves = potrace.Bitmap(~mask).trace(  # potracer traces False pixels
            turdsize=0, alphamax=smooth, opticurve=True, opttolerance=0.2)
        layers.append((sum(int(v) for v in col) == 0, col, path_d(curves)))
    layers.sort(key=lambda l: l[0])  # black on top; stable sort keeps area order otherwise
    hexc = lambda c: '#%02x%02x%02x' % c
    body = ''.join(f'<path fill="{hexc(c)}" fill-rule="evenodd" d="{d}"/>' for _, c, d in layers)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="{hexc(bg)}"/>{body}</svg>'


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    n_done = 0
    for n in range(1, 129):
        x, y = ((n - 1) % 16) * 32, ((n - 1) // 16) * 32
        svg = vectorise(SHEET.crop((x, y, x + 32, y + 32)))
        if svg: (OUT / f'{n}.svg').write_text(svg, encoding='utf8'); n_done += 1
    print(n_done, 'icons ->', OUT)
