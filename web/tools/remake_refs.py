"""Exports the original art, upscaled with hard pixels, as references for redrawing (img2img / style refs).

  python tools/remake_refs.py   ->  ../remake_art/refs/{portraits,expressions,icons}/

The redrawn files go to web/assets/remake/ (see docs/remake/ART_BRIEF.md for names and sizes).
"""
import json, re
from pathlib import Path
from PIL import Image

WEB = Path(__file__).resolve().parent.parent
OUT = WEB.parent / 'remake_art' / 'refs'
A = WEB / 'assets'

# eeyal dictionary order -> icon numbers (same list as src/modern/library.js)
DICT_ICONS = [int(n) for n in re.search(r'DICT_ICONS = \[([^\]]+)\]', (WEB / 'src/modern/library.js').read_text(encoding='utf8')).group(1).split(',')]
names = {}
manual = json.loads((A / 'library/manual.json').read_text(encoding='utf8'))
rows = next(b['dict'] for s in manual['sections'] for b in s['blocks'] if 'dict' in b)
for n, (word, _) in zip(DICT_ICONS, rows): names[n] = word
for k, v in re.findall(r'(\w+): (\d+)', (WEB / 'src/engine/constants.js').read_text().split('export const W = {')[1].split('};')[0]):
    names.setdefault(int(v), k)
for i in range(1, 8): names.setdefault(56 + i, f'house of {names.get(i, i)}')
for j, a in enumerate(['tanaga', 'katsin', 'shial'], 1): names.setdefault(65 + j, f'aura {a}')
names.setdefault(103, 'unknown count')
for n in range(0, 9): names.setdefault(104 + n, f'count {n}')
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def save(im, path, scale):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.resize((im.width * scale, im.height * scale), Image.NEAREST).save(path)


for p in sorted((A / 'portraits').glob('*.png')):
    save(Image.open(p).convert('RGB'), OUT / 'portraits' / p.name, 8)
for p in sorted((A / 'faces').glob('*.png')):
    save(Image.open(p).convert('RGB'), OUT / 'expressions' / p.name, 4)
sheet = Image.open(A / 'wordicons.png').convert('RGB')
blank = 0
for n in range(1, 129):
    cell = sheet.crop((((n - 1) % 16) * 32, ((n - 1) // 16) * 32, ((n - 1) % 16) * 32 + 32, ((n - 1) // 16) * 32 + 32))
    if len(cell.getcolors(1024)) <= 1: blank += 1; continue  # unused slot
    save(cell, OUT / 'icons' / f'{n:03}-{slug(names.get(n, "unnamed"))}.png', 8)
save(Image.open(A / 'logo.png').convert('RGB'), OUT / 'logo.png', 2)
print('refs written to', OUT, f'({128 - blank} icons)')
