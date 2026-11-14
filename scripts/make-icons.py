"""Draws the extension icons (the Zwinkit bill mark on a green tile) as PNGs, no dependencies.
Same geometry as the Mark component (32-unit grid): rounded tile, a white bill with a torn bottom edge and three ruled lines. Supersampled for smooth edges."""
import struct, zlib, sys

TILE = (26, 115, 72)      # --accent (khata light)
PAPER = (255, 255, 255)
BILL = [(9, 7), (23, 7), (23, 25), (20.5, 23), (18, 25), (16, 23), (14, 25), (11.5, 23), (9, 25)]
LINES = [(12, 11.1, 20, 12.9), (12, 15.1, 20, 16.9), (12, 19.1, 17, 20.9)]  # x0, y0, x1, y1

def in_poly(x, y, poly):
    inside = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside

def sample(u, v):
    """colour and alpha of the artwork at a point of the 32x32 grid"""
    r = 8.0
    cx, cy = min(max(u, r), 32 - r), min(max(v, r), 32 - r)
    if (u - cx) ** 2 + (v - cy) ** 2 > r * r:
        return None
    if in_poly(u, v, BILL):
        if any(a <= u <= c and b <= v <= d for a, b, c, d in LINES):
            return TILE
        return PAPER
    return TILE

def png(size, ss=4):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0]; cov = 0
            for j in range(ss):
                for i in range(ss):
                    c = sample((x + (i + .5) / ss) * 32 / size, (y + (j + .5) / ss) * 32 / size)
                    if c: acc = [acc[k] + c[k] for k in range(3)]; cov += 1
            n = ss * ss
            row += bytes((acc[0] // cov, acc[1] // cov, acc[2] // cov, round(255 * cov / n)) if cov else (0, 0, 0, 0))
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

out = sys.argv[1]
for n in (16, 32, 48, 128):
    open(f"{out}/icon{n}.png", "wb").write(png(n))
print("wrote icons to", out)
