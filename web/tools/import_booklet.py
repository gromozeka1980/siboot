"""Imports the original 1987 novella from the scanned booklet (Rules-and-Novella.pdf) into assets/library/novella.json.

  pip install pymupdf
  python tools/import_booklet.py [path/to/Rules-and-Novella.pdf]

Chapters are found by heading size (>= 15 pt); paragraphs by first-line indent or a short previous line; words broken
with a hyphen at the end of a line are joined; italic spans (eeyal speech) become <em>.
"""
import json, re, sys
from pathlib import Path
import pymupdf

WEB = Path(__file__).resolve().parent.parent
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else WEB.parent / 'Rules-and-Novella.pdf'
FIRST, LAST = 29, 72          # novella pages (1-based, inclusive)
FIX_TITLES = {'Sufupicank Inaugural Sermon': 'Sufupican’s Inaugural Sermon'}
FIX_TEXT = [(r'\by o u\b', 'you'), (r' {2,}', ' ')]


def lines_of(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            spans = [s for s in l['spans'] if s['text'].strip()]
            if not spans: continue
            text = ''
            for s in spans:
                t = s['text']
                if 'Italic' in s['font'] and t.strip(): t = f'<em>{t}</em>'
                text += t
            out.append({'x0': l['bbox'][0], 'x1': l['bbox'][2], 'y': l['bbox'][1], 'size': max(s['size'] for s in spans), 'text': text})
    return out


def plain(t): return re.sub(r'<[^>]+>|\s+', '', t)


def dedupe(lines):
    """Some pages carry two overlapping OCR text layers: of the lines at the same height that overlap horizontally,
    keep the longest one, and drop fragments whose text is contained in a kept line."""
    keep = []
    for l in sorted(lines, key=lambda l: -len(plain(l['text']))):
        clash = any(abs(k['y'] - l['y']) < 4 and min(k['x1'], l['x1']) - max(k['x0'], l['x0']) > 2 for k in keep)
        contained = any(len(plain(l['text'])) > 3 and plain(l['text']) in plain(k['text']) and abs(k['y'] - l['y']) < 30 for k in keep)
        if not clash and not contained: keep.append(l)
    return keep


def main():
    doc = pymupdf.open(PDF)
    chapters = []
    for pn in range(FIRST - 1, LAST):
        lines = dedupe([l for l in lines_of(doc[pn]) if not re.fullmatch(r'[\d ]+', plain(l['text']) or '0')])  # drop page numbers
        body = [l for l in lines if l['size'] < 13]
        if not body: continue
        xs0, xs1 = sorted(l['x0'] for l in body), sorted(l['x1'] for l in body)
        left, right = xs0[len(xs0) // 10], xs1[len(xs1) * 9 // 10]  # robust margins: stray marks must not move them
        heads = [l for l in lines if l['size'] >= 15 and len(l['text'].strip()) > 3]
        if heads:
            title = ' '.join(h['text'].strip() for h in sorted(heads, key=lambda h: (h['y'], h['x0'])))
            title = re.sub(r'\s+', ' ', title).replace('<em>', '').replace('</em>', '')
            chapters.append({'title': FIX_TITLES.get(title, title), 'paras': []})
        paras = chapters[-1]['paras']
        prev = None
        for l in sorted(body, key=lambda l: (round(l['y']), l['x0'])):
            t = l['text'].strip()
            new_para = prev is None and not paras or l['x0'] > left + 6 or (prev is not None and prev['x1'] < right - 40)
            if new_para or not paras: paras.append(t)
            elif paras[-1].endswith('-') and t[:1].islower(): paras[-1] = paras[-1][:-1] + t
            else: paras[-1] += ' ' + t
            prev = l
    for c in chapters:
        fixed = []
        for p in c['paras']:
            p = p.replace('</em> <em>', ' ').replace('</em><em>', '')
            for a, b in FIX_TEXT: p = re.sub(a, b, p)
            fixed.append(p)
        c['blocks'] = [{'p': p} for p in fixed if p]
        del c['paras']
    book = {'title': 'Trust & Betrayal: The Legacy of Siboot — a novella', 'author': 'Chris Crawford',
            'source': 'Rules and Novella booklet, Mindscape 1987', 'note': 'The novella that came in the box with the game (1987).',
            'parts': [{'title': '', 'chapters': chapters}]}
    out = WEB / 'assets' / 'library' / 'novella.json'
    out.write_text(json.dumps(book, ensure_ascii=False, indent=1), encoding='utf8')
    print(len(chapters), 'chapters,', sum(len(c['blocks']) for c in chapters), 'paragraphs ->', out)
    for c in chapters: print(f"  {c['title']}: {len(c['blocks'])} paragraphs, {sum(len(b['p']) for b in c['blocks'])} chars")


if __name__ == '__main__':
    main()
