import json
from PIL import Image
f=json.load(open('web/assets/fonts/rmn6_13.json'))
W=lambda s: sum(f['glyphs'][str(ord(c))]['w'] for c in s)
def render(s,x0,base):
    px=set(); x=x0
    for c in s:
        g=f['glyphs'][str(ord(c))]
        for r,row in enumerate(g['rows']):
            for i in range(g['w']):
                if row & (1<<(g['w']-1-i)): px.add((x+i, base-f['ascent']+r))
        x+=g['w']
    return px
menus={'31_about':(1,[' About Trust and Betrayal...']),
 '32_game':(56,[' Load Game',' Save Game',' Quit Game']),
 '33_opt':(108,[' Narrate Off',' *Long Delays',' Short Delays',' No Delays']),
 '30_chars':(171,[' All Characters ',' Vetvel ',' Kendra ',' Gardbore ']),
 '34_recall':(258,[' Recall Today '])}
for n,(L,items) in menus.items():
    im=Image.open('_dosref/shots/%s_open.png'%n).convert('RGB')
    ink=lambda x,y: im.getpixel((x,y))!=(im.getpixel((x,y)) if False else None) and sum(im.getpixel((x,y)))<600 and im.getpixel((x,y))!=(255,255,255)
    for k,t in enumerate(items):
        top=15+18*k; base=top+13
        best=None
        for cut in range(0,6):
            s=t[:len(t)-cut] if cut else t
            for x in range(L-3,L+15):
                px=render(s,x,base)
                if not px: continue
                sc=sum(1 for p in px if ink(*p))-2*sum(1 for p in px if not ink(*p))
                if best is None or sc>best[0]: best=(sc,x,repr(s),len(px))
        print(n,k+1,'x-L',best[1]-L,'text',best[2],'score',best[0],'/',best[3],'len',len(t),'8*len',8*len(t))
