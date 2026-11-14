"""Draws the extension icons (indigo rounded square with a white bar chart) as PNGs, no dependencies."""
import struct, zlib, sys

def png(size):
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    r = size * 0.22
    def inside(x, y):  # rounded square
        cx = min(max(x, r), size - r); cy = min(max(y, r), size - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    s = size / 128
    bars = [(28, 70, 46, 100), (54, 48, 72, 100), (80, 28, 98, 100)]  # (x0, y0, x1, y1) in 128 space
    for y in range(size):
        for x in range(size):
            if not inside(x + 0.5, y + 0.5): continue
            px[y][x] = (79, 70, 229, 255)
            for x0, y0, x1, y1 in bars:
                if x0 * s <= x < x1 * s and y0 * s <= y < y1 * s: px[y][x] = (255, 255, 255, 255)
            if 20 * s <= x < 106 * s and 104 * s <= y < 110 * s: px[y][x] = (255, 255, 255, 255)
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in px)
    def chunk(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

out = sys.argv[1]
for n in (16, 32, 48, 128):
    open(f"{out}/icon{n}.png", "wb").write(png(n))
