#!/usr/bin/env python3
"""Exports every translatable unit of the original game into assets/i18n/en/*.json.

  python tools/i18n_export.py

These files are the *source* for translators (generated from the original game files that
extract.py copied into assets/text/). A translation is a folder assets/i18n/<lang>/ with the same
files and keys; see docs/i18n/README.md. Original placeholder characters are converted to the
{token} syntax used by all translations:
  narration:  & or % -> {name}   # -> {him}
  stories:    % -> {name}  ~ -> you  @ -> {he}  # -> {hers}  $ -> {him}  ^ -> {his}
              & -> {species}  = -> {myFiance}  ] -> {fiance}
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TXT = ROOT / 'assets' / 'text'
OUT = ROOT / 'assets' / 'i18n' / 'en'
BS = chr(92)

STORY_TOKENS = {'%': '{name}', '@': '{he}', '#': '{hers}', '$': '{him}', '^': '{his}', '&': '{species}',
                '=': '{myFiance}', ']': '{fiance}'}


def rd(name):
    return (TXT / name).read_bytes().decode('latin-1')


def story_tokens(s):
    return ''.join(STORY_TOKENS.get(c, c) for c in s).replace('~', 'you')


def split_story(raw):
    """-> {text, options:[{title, results:[...]}]} + the skeleton needed to rebuild it."""
    i = raw.index(BS)
    text = raw[:i]
    j = raw.index(BS, i + 1)          # K/L parameter section ends at the 2nd backslash
    k = j + 1
    options = []
    for _ in range(4):
        k = raw.index('\r', k) if raw[k] == '\r' else k
        k += 1                         # after the CR that follows the previous backslash
        e = raw.index('\r', k)
        title = raw[k:e]
        end = raw.index(BS, e)
        body = raw[e:end]
        results = []
        for line in body.split('\r'):
            p = line.find('P')
            if p >= 0 and line.strip():
                results.append(line[p + 1:])
        options.append({'title': title, 'results': results})
        k = end + 1
    return text, options


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'stories').mkdir(exist_ok=True)
    # 72 narration messages (STRINGS.TXT: first line "#301", empty lines skipped by the game)
    lines = [l for l in rd('strings.txt').replace('\r\n', '\n').replace('\r', '\n').split('\n')[1:] if l.strip()]
    narr = {}
    for n, l in enumerate(lines[:72], 1):
        narr[str(n)] = l.replace('&', '{name}').replace('%', '{name}').replace('#', '{him}')
    (OUT / 'narration.json').write_text(json.dumps(narr, ensure_ascii=False, indent=1), encoding='utf-8')
    # stories
    for n in range(1, 45):
        text, options = split_story(rd(f'story{n}.txt'))
        doc = {'text': story_tokens(text), 'options': [
            {'title': story_tokens(o['title']), 'results': [story_tokens(r) for r in o['results']]} for o in options]}
        (OUT / 'stories' / f'story{n}.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    # dossiers
    doss = {str(i): rd(f'dossier{i}.txt').replace('\r\n', ' ').replace('\r', ' ').strip() for i in range(1, 9)}
    (OUT / 'dossiers.json').write_text(json.dumps(doss, ensure_ascii=False, indent=1), encoding='utf-8')
    # menus (titles + items, shortcut letters kept separately)
    menus = []
    for raw in rd('siboot.mnu').replace('\r\n', '\n').split('\n'):
        if not raw.strip() or raw.strip() == '\x1a':
            continue
        if raw[0] != '\t':
            menus.append({'title': raw.strip(), 'items': []})
        else:
            t = raw[1:]
            m = re.search(r'/(\w)', t)
            menus[-1]['items'].append({'text': re.sub(r'\s*/\w', '', t).strip(), 'key': m.group(1) if m else None})
    (OUT / 'menus.json').write_text(json.dumps(menus, ensure_ascii=False, indent=1), encoding='utf-8')
    # quit dialog texts
    dia = re.findall(r'title="([^"]*)"', rd('quit.dia'), re.I)
    (OUT / 'dialogs.json').write_text(json.dumps({'quit': dia}, ensure_ascii=False, indent=1), encoding='utf-8')
    print('exported to', OUT)


if __name__ == '__main__':
    main()
