#!/usr/bin/env python3
"""Convert original Trust & Betrayal (DOS) files into web assets.

usage: python extract.py [game_dir]   (default: ../trust-and-betrayal-the-legacy-of-siboot relative to web/)
Writes to web/assets/.  Spec of every format: _ref/dos_src/UI.notes.md
"""
import json, struct, sys
from pathlib import Path
from PIL import Image

WEB = Path(__file__).resolve().parent.parent
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else WEB.parent / 'trust-and-betrayal-the-legacy-of-siboot'
OUT = WEB / 'assets'

# DOS portrait file order = OVL_3F6 name table DS:0x962 (index = first word of each file)
CHARS = ['vetvel', 'kendra', 'gardbore', 'wiki', 'locksher', 'zubi', 'skord', 'chris']


def rd(name):
    return (GAME / name).read_bytes()


def getimage(b, o):
    """Turbo Pascal / BGI GetImage block -> (w, h, [palette index per pixel]).
    Per row 4 planes of ceil(w/8) bytes; first plane stored = bit 0 of the palette index."""
    w, h = struct.unpack_from('<HH', b, o)
    w, h, bpr, o = w + 1, h + 1, (w + 8) // 8, o + 4
    px = []
    for _ in range(h):
        pl = [b[o + k * bpr:o + (k + 1) * bpr] for k in range(4)]
        o += 4 * bpr
        for x in range(w):
            m, byte = 0x80 >> (x & 7), x >> 3
            px.append(sum(1 << k for k in range(4) if pl[k][byte] & m))
    return w, h, px


def pal48(b, o, n=16):
    """8-bit RGB triples as the VGA shows them: game does SetRGBPalette(v shr 2) into the 6-bit DAC;
    6->8 bit expansion (c<<2 | c>>4) matches DOSBox."""
    return [[(v >> 2 << 2) | (v >> 6) for v in b[o + 3 * i:o + 3 * i + 3]] for i in range(n)]


def png(path, w, h, px, pal):
    im = Image.new('P', (w, h))
    im.putpalette([c for rgb in pal for c in rgb] + [0] * (768 - 3 * len(pal)))
    im.putdata(px)
    im.save(OUT / path)
    return path


def sheet(path, imgs, cols, pal):
    w, h = imgs[0][0], imgs[0][1]
    rows = (len(imgs) + cols - 1) // cols
    canvas = [0] * (w * cols * h * rows)
    W = w * cols
    for n, (_, _, px) in enumerate(imgs):
        ox, oy = (n % cols) * w, (n // cols) * h
        for y in range(h):
            canvas[(oy + y) * W + ox:(oy + y) * W + ox + w] = px[y * w:(y + 1) * w]
    return png(path, W, h * rows, canvas, pal)


def font(name):
    """GEM-style .@ font: 0x54-byte header, char offset table, one bitmap strike."""
    b = rd(name)
    first, last = struct.unpack_from('<HH', b, 0x24)
    ascent, descent = struct.unpack_from('<H', b, 0x2A)[0], struct.unpack_from('<H', b, 0x2E)[0]
    offtab, data = struct.unpack_from('<II', b, 0x48)
    fw, fh = struct.unpack_from('<HH', b, 0x50)
    offs = struct.unpack_from('<%dH' % (last - first + 2), b, offtab)
    glyphs = {}
    for c in range(first, last + 1):
        x0, x1 = offs[c - first], offs[c - first + 1]
        rows = []
        for y in range(fh):
            r = 0
            for x in range(x0, x1):
                r = (r << 1) | ((b[data + y * fw + (x >> 3)] >> (7 - (x & 7))) & 1)
            rows.append(r)
        glyphs[str(c)] = {'w': x1 - x0, 'rows': rows}
    return {'name': name, 'first': first, 'last': last, 'height': fh, 'ascent': ascent,
            'descent': descent, 'maxWidth': struct.unpack_from('<H', b, 0x34)[0],
            'rowFormat': 'int per row, MSB = leftmost pixel, bit (w-1-x) is pixel x',
            'glyphs': glyphs}


def bgi_small_font():
    """Width table of Borland LITT.CHR (linked into SIBOOT.OVR) - used by the menu code for centering."""
    ovr = rd('SIBOOT.OVR')
    o = ovr.find(b'PK\x08\x08BGI Small font')
    c = ovr[o:]
    hs = struct.unpack_from('<H', c, c.find(b'\x1a') + 1)[0]
    n, first = struct.unpack_from('<H', c, hs + 1)[0], c[hs + 4]
    cap, base, dec = struct.unpack_from('bbb', c, hs + 8)
    widths = list(c[hs + 16 + 2 * n:hs + 16 + 3 * n])
    return {'name': 'BGI LITT.CHR', 'first': first, 'widths': widths,
            'orgToCap': cap, 'orgToBase': base, 'orgToDec': dec}


def cursor():
    exe = rd('SIBOOT.EXE')
    hdr = struct.unpack_from('<14H', exe)
    img = exe[hdr[4] * 16:]
    ds = 0x121D * 16                       # TP data segment (SEG_10ED:0000 mov dx,121Dh)
    w = struct.unpack_from('<34H', img, ds + 0x104A)
    return {'hotspot': [w[32], w[33]], 'and': list(w[:16]), 'xor': list(w[16:32]),
            'note': 'int33 fn9 graphics cursor: pixel=(screen AND and) XOR xor; xor-bit => VRAM 15 (black), and=0&xor=0 => VRAM 0 (white)'}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'faces').mkdir(exist_ok=True)
    (OUT / 'portraits').mkdir(exist_ok=True)
    (OUT / 'fonts').mkdir(exist_ok=True)
    man = {'source': str(GAME), 'screen': [640, 480]}

    wi = rd('WORDICON.DTA')
    main_pal = pal48(wi, 0)
    man['palettes'] = {'main': main_pal}
    icons = [getimage(wi, 48 + 518 * i) for i in range(128)]
    wt = rd('WORDTEXT.DTA')
    texts = [getimage(wt, 518 * i) for i in range(128)]
    man['wordIcons'] = {'file': sheet('wordicons.png', icons, 16, main_pal), 'cell': [32, 32], 'cols': 16,
                        'count': 128, 'index': 'word n (1..128) at cell n-1', 'palette': 'main'}
    man['wordText'] = {'file': sheet('wordtext.png', texts, 16, main_pal), 'cell': [32, 32], 'cols': 16,
                       'count': 128, 'index': 'word n (1..128) at cell n-1', 'palette': 'main'}

    faces = []
    for n in range(1, 35):
        b = rd('EFACE%02d.DTA' % n)
        faces.append(getimage(b, 2))
        png('faces/eface%02d.png' % n, *faces[-1], main_pal)
    man['emotionFaces'] = {'sheet': sheet('efaces.png', faces, 8, main_pal), 'cell': [96, 96], 'cols': 8,
                           'files': ['faces/eface%02d.png' % n for n in range(1, 35)],
                           'palette': 'main', 'draw': 'FillRect(FaceRect, white) then PutImage NormalPut at FaceRect.topLeft'}

    man['portraits'] = {}
    for fname in CHARS:
        b = rd(fname.upper() + '.DTA')
        idx = struct.unpack_from('<H', b)[0]
        pal = pal48(b, 0x3208)
        man['palettes']['portrait_' + fname] = pal
        man['portraits'][fname] = {'file': png('portraits/%s.png' % fname, *getimage(b, 2), pal),
                                   'index': idx, 'size': [158, 158], 'palette': 'portrait_' + fname,
                                   'note': 'drawing it reprograms DAC entries 0..15 with this palette (whole screen changes)'}

    lg = rd('LOGO.DTA')
    logo_pal = pal48(lg, 0, 16)
    ncol = struct.unpack_from('<H', lg, 0x30)[0]
    man['palettes']['logo'] = logo_pal
    man['logo'] = {'file': png('logo.png', *getimage(lg, 0x32), logo_pal), 'size': [512, 200], 'pos': [64, 130],
                   'palette': 'logo', 'paletteEntriesSet': ncol, 'note': 'SetPalette entries 0..%d only' % (ncol - 1)}

    fr = rd('FRAME.DTA')  # no leading word; uses only entries 9..15, which are identical in every portrait palette
    man['frame'] = {'file': png('frame.png', *getimage(fr, 0), man['palettes']['portrait_chris']), 'size': [247, 247],
                    'palette': 'portrait_* (entries 9..15)', 'hole': [45, 45, 201, 202],
                    'note': 'never loaded by the DOS code (victory screen allocates 0x77AA bytes = its size, then does not use it)'}

    man['fonts'] = {}
    for f in ['RMN6_13.@', 'RMN6_19.@', 'RMN4_08.@', 'SS2_14.@']:
        js = font(f)
        key = f.split('.')[0].lower()
        (OUT / 'fonts' / (key + '.json')).write_text(json.dumps(js, separators=(',', ':')))
        man['fonts'][key] = 'fonts/%s.json' % key
    (OUT / 'fonts' / 'bgi_small.json').write_text(json.dumps(bgi_small_font()))
    man['fonts']['bgi_small_metrics'] = 'fonts/bgi_small.json'
    man['fontUse'] = {'rmn6_13': 'all game text, menus, dialogs', 'rmn6_19': 'victory screen (OVL_3BD)',
                      'rmn4_08': 'unused', 'ss2_14': 'unused',
                      'bgi_small_metrics': 'only TextWidth/TextHeight used for menu-title/menu-item centering & dialog vertical centering'}

    # text resources (copied from the user's game folder; CR line endings kept as in the originals)
    (OUT / 'text').mkdir(exist_ok=True)
    man['text'] = {'strings': 'text/strings.txt', 'stories': {}, 'dossiers': {}, 'menus': 'text/siboot.mnu',
                   'dialogs': {'quit': 'text/quit.dia'}}
    copies = [('STRINGS.TXT', 'strings.txt'), ('SIBOOT.MNU', 'siboot.mnu'), ('QUIT.DIA', 'quit.dia')]
    for n in range(1, 45):
        copies.append(('STORY%d' % n, 'story%d.txt' % n))
        man['text']['stories'][n] = 'text/story%d.txt' % n
    for i, fname in enumerate(CHARS, 1):
        stem = 'SKORD' if fname == 'skord' else fname.upper()
        copies.append((stem + '.TXT', 'dossier%d.txt' % i))
        man['text']['dossiers'][i] = 'text/dossier%d.txt' % i
    for src, dst in copies:
        (OUT / 'text' / dst).write_bytes(rd(src))
    # icon-language connection tables: 2 x 128 rows x 129 bytes (0/1). Table 1 = main chain.
    (OUT / 'connect.bin').write_bytes(rd('CONNECT.DTA'))

    man['cursor'] = cursor()
    man['patterns'] = {'white': [0] * 8, 'black': [255] * 8, 'gray': [0xAA, 0x55] * 4,
                       'ltGray': [0xAA, 0x55] * 4, 'dkGray': [0xAA, 0x55] * 4,
                       'connector': 'gray (GetIndPattern always returns gray)',
                       'note': 'row = y mod 8 (screen-absolute), bit 7 = x mod 8 == 0; 1-bit = current colour, 0-bit = VRAM 0'}
    man['vgaColour'] = {'palettes': 'DAC-exact (file value shr 2, expanded c<<2|c>>4)',
                      'rule': 'BGI colour/VRAM value c shows palette entry bitrev4(c); image pixel value v = palette entry v',
                        'bitrev4': [int('{:04b}'.format(i)[::-1], 2) for i in range(16)]}
    (OUT / 'manifest.json').write_text(json.dumps(man, indent=1))
    # Cyrillic glyphs for the localisation are added on top of the converted fonts
    import subprocess, sys
    subprocess.run([sys.executable, str(Path(__file__).with_name('cyrillic_fonts.py'))], check=True)
    print('wrote', OUT)


def selfcheck():
    # 2x1 image: pixel0 = index 1 (plane0 bit), pixel1 = index 8 (plane3 bit)
    blk = struct.pack('<HH', 1, 0) + bytes([0x80, 0, 0, 0x40])
    assert getimage(blk, 0) == (2, 1, [1, 8])


if __name__ == '__main__':
    selfcheck()
    main()
