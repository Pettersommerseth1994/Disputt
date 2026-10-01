#!/usr/bin/env bash
# Rebuilds the self-hosted web fonts in public/assets/fonts from the Google Fonts sources.
# Requires: python3 with `fonttools` and `brotli` (pip install fonttools brotli), curl.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=public/assets/fonts
WORK=$(mktemp -d)
BASE=https://github.com/google/fonts/raw/main/ofl
UNI="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+2190-2193,U+2212"

curl -fsSL -o "$WORK/Fraunces-Italic.ttf" "$BASE/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
curl -fsSL -o "$WORK/Lora.ttf"            "$BASE/lora/Lora%5Bwght%5D.ttf"
curl -fsSL -o "$WORK/Lora-Italic.ttf"     "$BASE/lora/Lora-Italic%5Bwght%5D.ttf"

# Display: Fraunces Italic, locked to the "soft + wonky" look; weight and optical size stay variable.
python3 -m fontTools.varLib.instancer "$WORK/Fraunces-Italic.ttf" SOFT=100 WONK=1 wght=600:900 opsz=48:144 -o "$WORK/fraunces.ttf"
python3 -m fontTools.subset "$WORK/fraunces.ttf" --unicodes="$UNI" --layout-features='*' --name-IDs='*' --flavor=woff2 --output-file="$OUT/fraunces-italic.woff2"

# Body: Lora. It declares a Reserved Font Name, so the modified subset is renamed to "Disputt Text".
for style in Lora Lora-Italic; do
  python3 -m fontTools.varLib.instancer "$WORK/$style.ttf" wght=400:700 -o "$WORK/$style-inst.ttf"
  python3 - "$WORK/$style-inst.ttf" "$WORK/$style-ren.ttf" <<'PY'
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1])
for rec in f['name'].names:
    s = rec.toUnicode()
    if 'Lora' in s and rec.nameID in (1, 3, 4, 6, 16, 17, 21, 22):
        rec.string = s.replace('Lora', 'DisputtText' if rec.nameID in (3, 6) else 'Disputt Text')
f.save(sys.argv[2])
PY
done
python3 -m fontTools.subset "$WORK/Lora-ren.ttf"        --unicodes="$UNI" --layout-features='*' --name-IDs='*' --flavor=woff2 --output-file="$OUT/lora.woff2"
python3 -m fontTools.subset "$WORK/Lora-Italic-ren.ttf" --unicodes="$UNI" --layout-features='*' --name-IDs='*' --flavor=woff2 --output-file="$OUT/lora-italic.woff2"
mkdir -p tmp/fonts && cp "$WORK/fraunces.ttf" tmp/fonts/fraunces-display.ttf   # used by tools/logo/build.mjs
rm -rf "$WORK"
ls -la "$OUT"/*.woff2
