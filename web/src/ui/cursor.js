// Mouse cursor from the original int33 AND/XOR masks (Mac-style arrow), applied as a CSS cursor
// scaled to the canvas size so it matches the 640x480 pixel grid.

export function installCursor(canvas, cur) {
  if (!cur) return;
  const apply = () => {
    const scale = Math.max(1, Math.round(canvas.getBoundingClientRect().width / 640));
    const c = document.createElement('canvas');
    c.width = c.height = 16 * scale;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const bit = 0x8000 >> x, a = cur.and[y] & bit, xo = cur.xor[y] & bit;
      if (a && !xo) continue; // transparent
      ctx.fillStyle = xo ? '#000' : '#fff';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    canvas.style.cursor = `url(${c.toDataURL()}) ${cur.hotspot[0]} ${cur.hotspot[1]}, default`;
  };
  apply();
  window.addEventListener('resize', apply);
}
