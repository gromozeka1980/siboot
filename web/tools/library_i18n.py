"""Translation workflow for the Library texts (the 1987 novella + rules).

  python tools/library_i18n.py split <lang> [chunks]   EN books -> assets/i18n/<lang>/library/work/src_NN.json
  python tools/library_i18n.py merge <lang>            work/tr_NN.json -> assets/i18n/<lang>/library/{novel,manual}.json
  python tools/library_i18n.py check <lang>            structure / tags / leftovers of the translated chunks

A chunk is {"items": [{"id", "title"?, "subtitle"?, "label"?, "note"?, "blocks"?}]}. Translators copy src_NN
to tr_NN and translate every string except ids and image blocks; block count and order must stay.
Ids: "book.manual" / "book.novella" (title, note), "sec.S" (rules section), "nv.C" (novella chapter).
"""
import copy, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'library'
load = lambda p: json.loads(Path(p).read_text(encoding='utf8'))
save = lambda p, d: (Path(p).parent.mkdir(parents=True, exist_ok=True), Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding='utf8'))


def items():
    """Translatable units in book order: (id, dict). Books: the rules (manual.json) and the 1987 novella (novella.json)."""
    manual, nv = load(SRC / 'manual.json'), load(SRC / 'novella.json')
    out = [('book.manual', {'title': manual['title'], 'note': manual['note']})]
    for si, s in enumerate(manual['sections']):
        out.append((f'sec.{si}', {'title': s['title'], 'blocks': s['blocks']}))
    out.append(('book.novella', {'title': nv['title'], 'note': nv['note']}))
    for ci, c in enumerate(nv['parts'][0]['chapters']):
        out.append((f'nv.{ci}', {'title': c['title'], 'blocks': c['blocks']}))
    return manual, nv, out


size = lambda d: len(json.dumps(d, ensure_ascii=False))


def split(lang, n):
    """Rules -> one chunk; novella -> n chunks of similar size. assets/i18n/<lang>/library/work/src_NN.json"""
    _, _, its = items()
    rules = [{'id': i, **d} for i, d in its if i.startswith(('sec.', 'book.manual'))]
    nv = [(i, d) for i, d in its if i.startswith(('nv.', 'book.novella'))]
    total, chunks, cur, acc = sum(size(d) for _, d in nv), [rules], [], 0
    for iid, d in nv:
        cur.append({'id': iid, **d}); acc += size(d)
        if acc >= total * len(chunks) / n and len(chunks) < n: chunks.append(cur); cur = []
    chunks.append(cur)
    work = ROOT / 'assets' / 'i18n' / lang / 'library' / 'work'
    for k, c in enumerate([c for c in chunks if c], 1):
        save(work / f'src_{k:02}.json', {'items': c})
        print(f'src_{k:02}.json: {len(c)} items, {sum(size(i) for i in c)} chars, {c[0]["id"]} .. {c[-1]["id"]}')


def translated(lang):
    tr = {}
    for f in sorted((ROOT / 'assets' / 'i18n' / lang / 'library' / 'work').glob('tr_*.json')):
        for it in load(f)['items']: tr[it['id']] = (it, f.name)
    return tr


CYR = re.compile('[А-Яа-яЁё]')


def check(lang):
    _, _, its = items()
    tr, errors, warns = translated(lang), [], []
    for iid, en in its:
        if iid not in tr: warns.append(f'{iid}: not translated'); continue
        t, f = tr[iid]
        where = f'{f} {iid}'
        for k in ('title', 'subtitle', 'label', 'note'):
            if en.get(k) and not t.get(k): errors.append(f'{where}: missing {k}')
        eb, tb = en.get('blocks', []), t.get('blocks', [])
        if len(eb) != len(tb): errors.append(f'{where}: {len(tb)} blocks, source has {len(eb)}'); continue
        for q, (a, b) in enumerate(zip(eb, tb)):
            w = f'{where} block {q}'
            if set(a) != set(b): errors.append(f'{w}: block type changed'); continue
            if 'img' in a and a != b: errors.append(f'{w}: image block must stay unchanged')
            if 'p' in a:
                if re.findall(r'</?\w+>', a['p']) != re.findall(r'</?\w+>', b['p']): errors.append(f'{w}: HTML tags differ')
                if len(a['p']) > 30 and not CYR.search(b['p']): warns.append(f'{w}: looks untranslated')
                r = len(b['p']) / max(1, len(a['p']))
                if len(a['p']) > 200 and not 0.7 < r < 1.8: warns.append(f'{w}: length ratio {r:.2f}')
            if 'dict' in a and len(a['dict']) != len(b['dict']): errors.append(f'{w}: dictionary has {len(b["dict"])} rows, source {len(a["dict"])}')
    for iid in tr:
        if iid not in dict(its): errors.append(f'{tr[iid][1]}: unknown id {iid}')
    for m in warns: print('warn ', m)
    for m in errors: print('ERROR', m)
    print(f'{lang} library: {len(errors)} error(s), {len(warns)} warning(s), {len(tr)}/{len(its)} items translated')
    return not errors


def merge(lang):
    manual, nv, _ = items()
    tr = {k: v[0] for k, v in translated(lang).items()}
    upd = lambda dst, iid: dst.update({k: v for k, v in tr.get(iid, {}).items() if k != 'id'})
    m, n = copy.deepcopy(manual), copy.deepcopy(nv)
    upd(m, 'book.manual'); upd(n, 'book.novella')
    for si, s in enumerate(m['sections']): upd(s, f'sec.{si}')
    for ci, c in enumerate(n['parts'][0]['chapters']): upd(c, f'nv.{ci}')
    out = ROOT / 'assets' / 'i18n' / lang / 'library'
    save(out / 'manual.json', m); save(out / 'novella.json', n)
    print('written', out / 'manual.json', out / 'novella.json')


if __name__ == '__main__':
    cmd, lang = sys.argv[1], sys.argv[2]
    if cmd == 'split': split(lang, int(sys.argv[3]) if len(sys.argv) > 3 else 5)
    elif cmd == 'check': sys.exit(0 if check(lang) else 1)
    elif cmd == 'merge': merge(lang)
