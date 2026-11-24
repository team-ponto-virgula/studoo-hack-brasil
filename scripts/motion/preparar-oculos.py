#!/usr/bin/env python3
"""Extrai a marca branca do ícone oficial para uma camada HD de animação.

Operação determinística de preparação de asset, sem geração/desenho de uma nova marca.
O wordmark integral original continua sendo usado nos estados inicial e final.
"""
from pathlib import Path
from collections import Counter
import json
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
source = ROOT/'apps/mobile/assets/marca/icone-1024.png'
target = ROOT/'apps/mobile/assets/marca/abertura-oculos-hd.png'
icon = np.array(Image.open(source).convert('RGBA'))
colors = Counter(tuple(v) for v in icon[icon[:,:,3] > 250, :3])
background = np.array(colors.most_common(1)[0][0], dtype=float)
coverage = np.clip(((icon[:,:,:3].astype(float)-background)/(255-background)).mean(axis=2), 0, 1)
coverage *= icon[:,:,3]/255
rows, cols = np.where(coverage > .05)
bounds = (int(cols.min()), int(rows.min()), int(cols.max()+1), int(rows.max()+1))
mask = Image.fromarray(np.round(coverage*255).astype('uint8')).crop(bounds)
# Regiões medidas do PNG original, mantidas no sistema de coordenadas560×184.
ratio = 4
mask = mask.resize((194*ratio, 136*ratio), Image.Resampling.LANCZOS)
mark = Image.new('RGBA', mask.size, (56,88,214,0))
mark.putalpha(mask)
canvas = Image.new('RGBA', (560*ratio,184*ratio))
canvas.alpha_composite(mark, (356*ratio,39*ratio))
canvas.save(target, optimize=True)
print(json.dumps({'source':str(source.relative_to(ROOT)),'sourceBounds':bounds,'output':str(target.relative_to(ROOT)), 'bytes':target.stat().st_size,'canvas':canvas.size,'originalLogoUnchanged':True}))
