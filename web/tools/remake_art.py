"""Generates the remake art with the OpenAI Images API, with a hard spending cap.

  python tools/remake_art.py models                         image models available to the key
  python tools/remake_art.py run style-a style-b [--quality medium] [--n 1] [--style-ref FILE]
  python tools/remake_art.py pick vetvel remake_art/out/vetvel/1.png   -> web/assets/remake/...
  python tools/remake_art.py spent                           money spent so far (from API usage)

The key is read from OPENAI_API_KEY or from the file TB/.env (line OPENAI_API_KEY=sk-...). It is never printed.
Jobs and prompts: remake_art/jobs.json. Results: remake_art/out/<job>/<k>.png. Spend log: remake_art/spend.json.
"""
import argparse, base64, json, os, sys, time
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]          # TB/
ART = ROOT / 'remake_art'
REFS = ART / 'refs'
DEST = ROOT / 'web' / 'assets' / 'remake'
API = 'https://api.openai.com/v1'

# USD per 1M tokens (gpt-image-1 list prices); unknown models are priced the same and flagged as estimates.
PRICE = {'gpt-image-1': {'text_in': 5, 'image_in': 10, 'out': 40}}
# output tokens per image, used for the pre-call budget check
OUT_TOKENS = {('1024x1024', 'low'): 272, ('1024x1024', 'medium'): 1056, ('1024x1024', 'high'): 4160,
              ('1536x1024', 'low'): 408, ('1536x1024', 'medium'): 1584, ('1536x1024', 'high'): 6240}


def key():
    k = os.environ.get('OPENAI_API_KEY')
    env = ROOT / '.env'
    if not k and env.exists():
        for line in env.read_text(encoding='utf8').splitlines():
            if line.strip().startswith('OPENAI_API_KEY='): k = line.split('=', 1)[1].strip().strip('"\'')
    if not k: sys.exit('No key: put OPENAI_API_KEY=sk-... into ' + str(env))
    return k


def spend_log():
    p = ART / 'spend.json'
    return json.loads(p.read_text()) if p.exists() else []


def usd(model, usage):
    p = PRICE.get(model, PRICE['gpt-image-1'])
    d = usage.get('input_tokens_details', {})
    text_in = d.get('text_tokens', usage.get('input_tokens', 0) - d.get('image_tokens', 0))
    return (text_in * p['text_in'] + d.get('image_tokens', 0) * p['image_in'] + usage.get('output_tokens', 0) * p['out']) / 1e6


def post(H, job, prompt, refs, size, args):
    if refs and not job.get('raw'):  # raw prompts describe their own attachments
        prompt += ' The first image shows the character to redraw.' + (' Match the art style of the last image exactly.' if args.style_ref else '')
    if refs:
        files = [('image[]', (p.name, p.read_bytes(), 'image/webp' if p.suffix == '.webp' else 'image/png')) for p in refs]
        return requests.post(f'{API}/images/edits', headers=H, files=files, timeout=600,
                             data={'model': args.model, 'prompt': prompt, 'size': size, 'quality': args.quality, 'n': args.n})
    return requests.post(f'{API}/images/generations', headers=H, timeout=600,
                         json={'model': args.model, 'prompt': prompt, 'size': size, 'quality': args.quality, 'n': args.n})


def run(args):
    cfg = json.loads((ART / 'jobs.json').read_text(encoding='utf8'))
    log = spend_log()
    spent = sum(e['usd'] for e in log)
    H = {'Authorization': 'Bearer ' + key()}
    ids = [j for a in args.jobs for j in ([k for k in cfg['jobs'] if k.startswith(a[:-1])] if a.endswith('*') else [a])]
    for jid in ids:
        job = cfg['jobs'].get(jid) or sys.exit(f'unknown job {jid}; see remake_art/jobs.json')
        size = '1024x1024' if job['kind'] in ('portrait', 'expr', 'icon') else '1536x1024'
        estimate = args.n * (OUT_TOKENS[(size, args.quality)] * 40 + 3000 * 10) / 1e6
        if spent + estimate > args.budget:
            sys.exit(f'stop: spent ${spent:.2f}, next job ~${estimate:.2f} would pass the ${args.budget:.2f} cap')
        style = job.get('style', cfg['style'])
        tail = cfg['portraitTail'].format(bg=job.get('bg', '')) if job['kind'] == 'portrait' else cfg['placeTail'] if job['kind'] == 'place' else ''
        prompt = job['prompt'] if job.get('raw') else f"{job['prompt']} {tail}Style: {style}."
        refs = ([REFS / job['ref']] if job.get('ref') else []) + ([ROOT / job['refFile']] if job.get('refFile') else []) + [ROOT / f for f in job.get('refFiles', [])] \
            + ([ROOT / job['styleRef']] if job.get('styleRef') else []) + ([Path(args.style_ref)] if args.style_ref else [])
        if args.skip_done and (ART / 'out' / jid).exists() and any((ART / 'out' / jid).glob('*.png')):
            print(f'{jid}: already generated, skipped'); continue
        for attempt in range(5):  # long requests are sometimes reset by the server
            try: r = post(H, job, prompt, refs, size, args); break
            except requests.exceptions.RequestException as e:
                print(f'{jid}: connection error ({type(e).__name__}), retry {attempt + 1}/5'); time.sleep(15 * (attempt + 1))
        else:
            print(f'{jid}: giving up after 5 connection errors, skipped'); continue
        if r.status_code == 400 and 'moderation_blocked' in r.text:  # false positives happen; skip, rephrase later
            print(f'{jid}: blocked by moderation, skipped'); continue
        if r.status_code != 200: sys.exit(f'{jid}: API error {r.status_code}: {r.text[:500]}')
        res = r.json()
        cost = usd(args.model, res.get('usage', {}))
        spent += cost
        log = spend_log()  # re-read: several runs may log in parallel
        log.append({'job': jid, 'model': args.model, 'quality': args.quality, 'n': args.n, 'usage': res.get('usage'), 'usd': round(cost, 4), 'at': time.strftime('%Y-%m-%d %H:%M')})
        (ART / 'spend.json').write_text(json.dumps(log, indent=1))
        out = ART / 'out' / jid
        out.mkdir(parents=True, exist_ok=True)
        k = len(list(out.glob('*.png')))
        for d in res['data']:
            k += 1
            (out / f'{k}.png').write_bytes(base64.b64decode(d['b64_json']))
            print(f'{jid}: {out / f"{k}.png"}')
        print(f'{jid}: ${cost:.3f}{"" if args.model in PRICE else " (estimate)"}, total ${spent:.2f} of ${args.budget:.2f}')


def pick(args):
    cfg = json.loads((ART / 'jobs.json').read_text(encoding='utf8'))
    job = cfg['jobs'][args.job]
    im = Image.open(args.file).convert('RGB')
    if job['kind'] in ('expr', 'icon'):
        im = im.resize((512, 512) if job['kind'] == 'expr' else (256, 256), Image.LANCZOS)
    elif job['kind'] != 'portrait':  # 3:2 -> 16:9 centre crop, 1920x1080
        h = round(im.width * 9 / 16); top = (im.height - h) // 2
        im = im.crop((0, top, im.width, top + h)).resize((1920, 1080), Image.LANCZOS)
    dst = (DEST / job['out']).with_suffix('.webp')  # game art is WebP (PNG was 10x larger)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if job['kind'] == 'expr': im = im.resize((512, 512), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=82, method=6)
    print('saved', dst)
    write_manifest()


def write_manifest():
    """assets/remake/manifest.json: every redrawn file, so the game knows what exists without 404 probing."""
    files = sorted(f.relative_to(DEST).as_posix() for f in [*DEST.rglob('*.webp'), *DEST.rglob('*.png'), *DEST.rglob('*.svg')])
    (DEST / 'manifest.json').write_text(json.dumps(files, indent=0), encoding='utf8')


def job_for(f):
    """Job id that produced the redrawn file f (path relative to assets/remake)."""
    kind, *rest = f[:-4].split('/')
    if kind == 'icons': return f'icon-{int(rest[0]):03}'
    if kind == 'expressions': return f'expr-{rest[0]}-{rest[1]}'
    return rest[0]  # portraits/<who>, places/<name>


def review(args):
    """Redoes everything rejected in remake_art/review.json (written by web/remake/review.html).
    With a note: edits the current image as the note says. Without: draws a new variant from the original job."""
    taken = ART / f'review_done_{time.strftime("%Y%m%d_%H%M%S")}.json'
    (ART / 'review.json').rename(taken)  # take it at once: a new review may be sent while this one runs
    rv = json.loads(taken.read_text(encoding='utf8'))
    bad = {f: d.get('note', '').strip() for f, d in rv['decisions'].items() if d.get('v') == 'bad'}
    if not bad: return print('nothing rejected')
    cfg = json.loads((ART / 'jobs.json').read_text(encoding='utf8'))
    ids = []
    for f, note in bad.items():
        jid = job_for(f)
        base = cfg['jobs'][jid]
        if note:
            jid = jid + '@fix'
            cfg['jobs'][jid] = {'kind': base['kind'], 'refFile': f'web/assets/remake/{f}', 'out': base['out'], 'raw': True,
                'prompt': f'Edit the attached image: {note}. Keep everything else exactly as it is: the same composition, subject, '
                          'colours, background and painting style. No text.'}
        out = ART / 'out' / jid
        if out.exists():
            for old in out.glob('*.png'): old.unlink()
        ids.append(jid)
    (ART / 'jobs.json').write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding='utf8')
    run(argparse.Namespace(jobs=ids, n=1, quality=args.quality, model=args.model, budget=args.budget, style_ref=None, skip_done=False))
    done = json.loads((DEST / 'regenerated.json').read_text()) if (DEST / 'regenerated.json').exists() else {}
    for jid in ids:
        f = ART / 'out' / jid / '1.png'
        if f.exists():
            pick(argparse.Namespace(job=jid, file=f))
            done[cfg['jobs'][jid]['out']] = int(time.time() * 1000)
    (DEST / 'regenerated.json').write_text(json.dumps(done, indent=0))


def pickall(args):
    """Takes variant 1 (or --k) of every generated job whose id starts with the prefix."""
    cfg = json.loads((ART / 'jobs.json').read_text(encoding='utf8'))
    for jid in cfg['jobs']:
        f = ART / 'out' / jid / f'{args.k}.png'
        if jid.startswith(args.prefix) and f.exists(): pick(argparse.Namespace(job=jid, file=f))


# 10 expressions per character (the AI's 23 moods map onto these in src/modern/view.js)
EXPRESSIONS = {'neutral': 'a calm neutral expression', 'warm': 'a warm friendly smile', 'love': 'an affectionate, adoring look',
               'trust': 'an open, sincere, trusting look', 'suspicious': 'narrowed eyes, suspicious and distrustful',
               'afraid': 'frightened, eyes wide with fear', 'angry': 'furious, shouting in anger', 'contempt': 'a haughty, contemptuous sneer',
               'sorry': 'apologetic and pleading, sad eyes', 'curious': 'curious and questioning, head slightly tilted'}
# eyes and mouth anatomy stay as painted: the emotion shows only through lids, brows, ears and head tilt (else the creature changes)
EXPR_PROMPT = 'Repaint this exact character showing {how}, subtly and believably. Keep the eyes exactly as in the reference: the same shape, size, colour, pupils and highlights; keep the mouth or beak, teeth and jaw anatomy the same. Show the emotion only through eyelids, brow ridges, ears, the corners of the mouth and a slight tilt of the head. Keep everything else identical: species, colours, markings, pose, framing, lighting, plain background colour and painting style. Not grotesque, not cartoonish. No text.'
CHARS = ['vetvel', 'kendra', 'gardbore', 'wiki', 'locksher', 'zubi', 'skord']


def gen_jobs(_):
    """Adds the expression and icon jobs to jobs.json (prompts derived from the portraits and the eeyal dictionary)."""
    cfg = json.loads((ART / 'jobs.json').read_text(encoding='utf8'))
    for c in CHARS:
        for e, how in EXPRESSIONS.items():
            cfg['jobs'][f'expr-{c}-{e}'] = {'kind': 'expr', 'refFile': f'web/assets/remake/portraits/{c}.png', 'out': f'expressions/{c}/{e}.png',
                'prompt': EXPR_PROMPT.format(how=how)}
    import re
    man = json.loads((ROOT / 'web/assets/library/manual.json').read_text(encoding='utf8'))
    rows = next(b['dict'] for s in man['sections'] for b in s['blocks'] if 'dict' in b)
    lib = (ROOT / 'web/src/modern/library.js').read_text(encoding='utf8')
    order = [int(n) for n in re.search(r'DICT_ICONS = \[([^\]]+)\]', lib).group(1).split(',')]
    skip = set(range(1, 8)) | set(range(57, 64)) | set(range(104, 113)) | {66, 67, 68}  # drawn in code: portraits, houses, digits, auras
    for n, (word, meaning) in zip(order, rows):
        if n in skip: continue
        ref = next((REFS / 'icons').glob(f'{n:03}-*.png'))
        cfg['jobs'][f'icon-{n:03}'] = {'kind': 'icon', 'ref': f'icons/{ref.name}', 'out': f'icons/{n}.png',
            'prompt': f'A square game icon for the word "{word}" of an alien sign language ({meaning.strip()}). '
                      'Redraw the pictogram in the reference image (a tiny 32x32 pixel icon) as a clean, bold painted icon: keep its composition, '
                      'gesture and symbols, centred on a plain soft grey background, simple readable shapes that work at 40 pixels, '
                      'painterly gouache with crisp ink outlines, warm skin tones for hands and faces. No text, no letters, no border.'}
    (ART / 'jobs.json').write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding='utf8')
    print(len(cfg['jobs']), 'jobs')


def models(_):
    r = requests.get(f'{API}/models', headers={'Authorization': 'Bearer ' + key()}, timeout=60)
    if r.status_code != 200: sys.exit(f'API error {r.status_code}: {r.text[:300]}')
    print('\n'.join(sorted(m['id'] for m in r.json()['data'] if 'image' in m['id'] or 'dall' in m['id'])))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('run'); p.add_argument('jobs', nargs='+'); p.add_argument('--n', type=int, default=1)
    p.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    p.add_argument('--model', default='gpt-image-2'); p.add_argument('--budget', type=float, default=15.0)
    p.add_argument('--style-ref'); p.add_argument('--skip-done', action='store_true'); p.set_defaults(f=run)
    p = sub.add_parser('pick'); p.add_argument('job'); p.add_argument('file'); p.set_defaults(f=pick)
    p = sub.add_parser('pickall'); p.add_argument('prefix'); p.add_argument('--k', type=int, default=1); p.set_defaults(f=pickall)
    sub.add_parser('gen-jobs').set_defaults(f=gen_jobs)
    sub.add_parser('manifest').set_defaults(f=lambda _: write_manifest())
    p = sub.add_parser('review'); p.add_argument('--quality', default='medium'); p.add_argument('--model', default='gpt-image-2')
    p.add_argument('--budget', type=float, default=60.0); p.set_defaults(f=review)
    sub.add_parser('models').set_defaults(f=models)
    sub.add_parser('spent').set_defaults(f=lambda _: print(f'${sum(e["usd"] for e in spend_log()):.2f} in {len(spend_log())} calls'))
    a = ap.parse_args(); a.f(a)
