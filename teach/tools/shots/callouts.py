# 설명서 캡처에 번호 동그라미 + 테두리를 그린다 (manual.mjs 가 남긴 boxes.json 사용)
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src = Path(sys.argv[1])            # scratchpad/manual
dst = Path(sys.argv[2])            # repo docs/manual
dst.mkdir(parents=True, exist_ok=True)
boxes = json.loads((src / 'boxes.json').read_text())
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
ACC = (31, 95, 122)                # 강조색 (maker-ui 의 --acc 근처)
R = 16

for png in sorted(src.glob('*.png')):
    im = Image.open(png).convert('RGB')
    d = ImageDraw.Draw(im)
    for b in boxes.get(png.name, []):
        x, y, w, h = b['x'], b['y'], b['width'], b['height']
        d.rounded_rectangle([x - 4, y - 4, x + w + 4, y + h + 4], radius=8, outline=ACC, width=3)
        cx, cy = x - 6, y - 6
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=ACC, outline='white', width=2)
        tw = d.textlength(b['label'], font=font)
        d.text((cx - tw / 2, cy - 12), b['label'], font=font, fill='white')
    im.save(dst / png.name, optimize=True)
    print('wrote', dst / png.name)
