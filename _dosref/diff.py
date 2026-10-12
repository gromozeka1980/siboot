# usage: diff.py dos.png web.png out.png  -> prints mismatch count and bbox, writes a diff image
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 40 else 0)
n = sum(1 for v in d.getdata() if v)
print('mismatch', n, 'bbox', d.getbbox())
out = Image.blend(a, b, 0.5)
red = Image.new('RGB', a.size, (255, 0, 0))
out.paste(red, mask=d)
out.save(sys.argv[3])
