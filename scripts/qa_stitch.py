#!/usr/bin/env python3
"""Stitch chunked Playwright captures (from qa_shots.mjs) into one tall PNG and slice it for review."""
import json, sys
from pathlib import Path
from PIL import Image
out = Path(sys.argv[1]); slice_h = int(sys.argv[2]) if len(sys.argv) > 2 else 2600
for meta_path in sorted(out.glob("*.chunks/meta.json")):
    name = meta_path.parent.name.replace(".chunks", "")
    meta = json.loads(meta_path.read_text())
    W, total = meta["width"], meta["total"]
    sheet = Image.new("RGB", (W, total), "white")
    for i, c in enumerate(meta["chunks"]):
        img = Image.open(meta_path.parent / f"{i:03d}.png")
        src_y = img.height - c["h"]          # last chunk cannot scroll further: take its bottom part
        sheet.paste(img.crop((0, src_y, W, img.height)), (0, c["y"]))
    sheet.save(out / f"{name}.png")
    n = 0
    for y in range(0, total, slice_h):
        sheet.crop((0, y, W, min(y + slice_h, total))).save(out / f"{name}-{n:02d}.png"); n += 1
    print(f"{name}: {W}x{total}, {n} slices")
