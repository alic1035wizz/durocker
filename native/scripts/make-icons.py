#!/usr/bin/env python3
"""Иконка 1024×1024 и сплэш 2732×2732 для @capacitor/assets из assets/avatar.png и assets/icon-512.png.
Запуск: python3 scripts/make-icons.py  (нужен Pillow)"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / 'resources'
OUT.mkdir(exist_ok=True)
BG = (15, 59, 44, 255)  # #0f3b2c — цвет стола

icon_src = Image.open(ROOT / 'assets' / 'icon-512.png').convert('RGBA')
icon = icon_src.resize((1024, 1024), Image.LANCZOS)
icon.save(OUT / 'icon-only.png'); icon.save(OUT / 'icon.png')
# adaptive-иконка Android: передний план — безопасная зона 66 %, фон — цвет стола
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
s = icon_src.resize((676, 676), Image.LANCZOS); fg.paste(s, (174, 174), s)
fg.save(OUT / 'icon-foreground.png')
Image.new('RGBA', (1024, 1024), BG).save(OUT / 'icon-background.png')

av = Image.open(ROOT / 'assets' / 'avatar.png').convert('RGBA')
side = 900
av = av.resize((side, side), Image.LANCZOS)
for name in ('splash.png', 'splash-dark.png'):
    sp = Image.new('RGBA', (2732, 2732), BG)
    sp.paste(av, ((2732 - side) // 2, (2732 - side) // 2), av)
    sp.save(OUT / name)
print('готово:', ', '.join(sorted(p.name for p in OUT.iterdir())))
