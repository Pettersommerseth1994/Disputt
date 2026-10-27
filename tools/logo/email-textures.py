"""Bildene som gir e-posten (shopify/ordrebekreftelse.liquid) det samme kornete papiret som spillet.

Spillet legger tekstur (public/assets/textures/) oppå en flat farge med CSS. En e-post kan ikke det, så hver kombinasjon er slått sammen til én flis (512 x 512,
få farger, så filene blir små) som e-posten bruker som bakgrunn, med den flate fargen som reserve for programmer som ikke viser bilder:

    bg-burgundy.png   burgunder side         (#6a1428 + crayon-dark + grain-soft)
    bg-paper.png      kremfarget papirkort   (#f8e6b8 + crayon-light-soft + grain-soft)
    bg-yellow.png     gul knapp og piller    (#fae025 + crayon-light + grain-soft)

Øyet på kortet (disputt-epost-oye.png) er assets/art/eye-right.svg som PNG, 180 piksler bredt; lag det med sharp:
    node -e "require('sharp')('public/assets/art/eye-right.svg',{density:300}).resize({width:180}).png({palette:true,colors:48}).toFile('public/assets/email/disputt-epost-oye.png')"

Kjør fra roten av repoet (trenger Python med Pillow):  python3 tools/logo/email-textures.py
Bildene ligger på disputt.site/assets/email/ for alltid: e-poster blir liggende i innboksene i årevis. Endrer du en av dem, legg til en ny ?v=-verdi i e-posten.
"""
import os
from PIL import Image

TEXTURES = 'public/assets/textures/'
OUT = 'public/assets/email/'


def tiled(name, size=512):
    img = Image.open(TEXTURES + name).convert('RGBA')
    out = Image.new('RGBA', (size, size))
    for x in range(0, size, img.width):
        for y in range(0, size, img.height):
            out.paste(img, (x, y))
    return out


def make(name, color, layers, colors):
    base = Image.new('RGBA', (512, 512), color)
    for layer in layers:  # from the bottom up
        base = Image.alpha_composite(base, tiled(layer))
    path = OUT + name
    base.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)
    print(path, os.path.getsize(path), 'byte')


make('bg-burgundy.png', '#6a1428FF', ['crayon-dark.png', 'grain-soft.png'], 16)
make('bg-paper.png', '#f8e6b8FF', ['crayon-light-soft.png', 'grain-soft.png'], 12)
make('bg-yellow.png', '#fae025FF', ['crayon-light.png', 'grain-soft.png'], 12)
