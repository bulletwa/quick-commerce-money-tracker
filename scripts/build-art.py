"""Builds public/img/3d/*.png from Microsoft Fluent UI Emoji (MIT, https://github.com/microsoft/fluentui-emoji).
Usage: python3 scripts/build-art.py <path to a (sparse) clone of fluentui-emoji> <names file, one folder name per line>
Each emoji's 3D PNG (256 px) is resized to 144 px and palette-quantised; files are named by slug (lower-case, hyphens)."""
import os, re, sys
from PIL import Image

repo, names = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public/img/3d")
os.makedirs(out, exist_ok=True)
total = 0
for line in open(names):
    n = line.strip()
    if not n: continue
    d = os.path.join(repo, "assets", n, "3D")
    if not os.path.isdir(d):
        print("missing:", n); continue
    src = os.path.join(d, os.listdir(d)[0])
    im = Image.open(src).convert("RGBA").resize((144, 144), Image.LANCZOS)
    im = im.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    slug = re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
    path = os.path.join(out, slug + ".png")
    im.save(path, optimize=True)
    total += os.path.getsize(path)
print(f"wrote {len(os.listdir(out))} images, {total // 1024} KB")
