#!/usr/bin/env python3
"""Filme de conceito da assinatura mobile; usa a coreografia e o PNG reais do projeto.

Não é captura nativa. O hold do filme é explícito e não muda os tempos lidos do contrato do app.
Render: python3 scripts/motion/oculos-em-foco.py --out .studoo-local/oculos --hold-ms 500
Dependências: Pillow, NumPy e FFmpeg. Não altera a imagem original nem redesenha letras.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CFG = json.loads((ROOT / 'packages/contratos/src/abertura-motion.json').read_text())
SOURCE = ROOT / 'apps/mobile/assets/marca/logo-com-sorriso.png'
STYLE = {
    'direction': 'Flat vector — assinatura óptica',
    'message': 'Os óculos são o foco e voltam a formar o nome Studoo.',
    'palette': {'background': '#FFFFFF', 'lens': CFG['corLente'], 'wordmark': 'pixels originais'},
    'typography': 'wordmark fornecido, sem texto recomposto',
    'exclusions': ['sem partículas', 'sem confete', 'sem som', 'sem loop no app', 'sem API', 'sem novo mascote'],
    'timing': 'extração → foco → recomposição → dissolve',
}
S = 2
W, H = 390 * S, 844 * S
FPS = 60
K = CFG['largura'] / CFG['fonte']['largura'] * S
SRC = Image.open(SOURCE).convert('RGBA')
DIV, SMILE = CFG['fonte']['divisao'], CFG['fonte']['linhaSorriso']
WORD = SRC.crop((0, 0, DIV, CFG['fonte']['altura']))
HD = Image.open(ROOT/'apps/mobile/assets/marca/abertura-oculos-hd.png').convert('RGBA')
RIMS = HD.crop((DIV*4, 0, CFG['fonte']['largura']*4, SMILE*4))
SMILE_IMG = HD.crop((DIV*4, SMILE*4, CFG['fonte']['largura']*4, CFG['fonte']['altura']*4))
FULL = SRC.resize((round(CFG['largura'] * S), round(CFG['fonte']['altura'] * K)), Image.Resampling.LANCZOS)


def bezier(u: float) -> float:
    """Mesmo cubic-bezier CSS/RN; resolve x antes de ler y, sem acumulação temporal."""
    x1, y1, x2, y2 = CFG['curva']
    lo, hi = 0.0, 1.0
    for _ in range(28):
        t = (lo + hi) / 2
        x = 3*(1-t)**2*t*x1 + 3*(1-t)*t*t*x2 + t**3
        if x < u: lo = t
        else: hi = t
    t = (lo + hi) / 2
    return 3*(1-t)**2*t*y1 + 3*(1-t)*t*t*y2 + t**3


def value(key: str, progress: float) -> float:
    knots = CFG['marcos']
    values = CFG[key]
    for i in range(1, len(knots)):
        if progress <= knots[i]:
            u = max(0.0, min(1.0, (progress-knots[i-1])/(knots[i]-knots[i-1])))
            return values[i-1] + (values[i]-values[i-1]) * bezier(u)
    return values[-1]


def opacity(image: Image.Image, alpha: float) -> Image.Image:
    if alpha >= 1: return image
    image = image.copy()
    image.putalpha(image.getchannel('A').point(lambda n: round(n * max(0, alpha))))
    return image


def compose(canvas: Image.Image, image: Image.Image, x: float, y: float, alpha=1.0):
    if alpha > 0:
        canvas.alpha_composite(opacity(image, alpha), (round(x), round(y)))


def static_frame() -> Image.Image:
    image = Image.new('RGBA', (W, H), CFG['fundo'])
    compose(image, FULL, (W-FULL.width)/2, (H-FULL.height)/2)
    return image


def frame(n: int, hold_ms: int, tail_ms: int) -> Image.Image:
    ms = n * 1000 / FPS
    progress = min(1.0, ms / CFG['sequenciaMs'])
    final_ms = CFG['sequenciaMs'] + hold_ms
    alpha = 1.0 if ms <= final_ms else 1-bezier(min(1.0, (ms-final_ms)/CFG['saidaMs']))
    canvas = Image.new('RGBA', (W, H), CFG['fundo'])
    # O original integral é usado nos dois repousos, também no componente nativo.
    if progress <= 0 or progress >= CFG['marcos'][-2]:
        compose(canvas, FULL, (W-FULL.width)/2, (H-FULL.height)/2, alpha)
        return canvas.convert('RGB')
    word = WORD.resize((round(DIV*K), FULL.height), Image.Resampling.LANCZOS)
    compose(canvas, word, (W-FULL.width)/2 + value('palavraX', progress)*S,
            (H-FULL.height)/2, value('palavraOpacidade', progress)*alpha)
    group_w = round((CFG['fonte']['largura']-DIV)*K)
    group_h = FULL.height
    group = Image.new('RGBA', (group_w, group_h))
    # O reflexo pertence apenas ao interior das lentes, sob os pixels da armação.
    lens_alpha = value('lenteOpacidade', progress)
    shine_alpha = value('reflexoOpacidade', progress)
    for lens in CFG['lentes']:
        d = round(lens['diametro']*K)
        circle = Image.new('RGBA', (d, d))
        mask = Image.new('L', (d, d))
        ImageDraw.Draw(mask).ellipse((0, 0, d-1, d-1), fill=255)
        tint = tuple(int(CFG['corLente'][i:i+2], 16) for i in (1,3,5))
        ImageDraw.Draw(circle).rectangle((0, 0, d, d), fill=(*tint, round(255*lens_alpha)))
        x = d/2 + value('reflexoX', progress)*S
        stripe = ImageDraw.Draw(circle)
        angle = math.radians(-24)
        points = [(x+dx*math.cos(angle)-dy*math.sin(angle), d/2+dx*math.sin(angle)+dy*math.cos(angle))
                  for dx,dy in [(-2*S,-d),(2*S,-d),(2*S,d),(-2*S,d)]]
        stripe.polygon(points, fill=(255, 255, 255, round(255*shine_alpha)))
        circle.putalpha(Image.fromarray(np.minimum(np.array(circle.getchannel('A')), np.array(mask))))
        compose(group, circle, (lens['x']-DIV)*K-d/2, lens['y']*K-d/2)
    rims = RIMS.resize((group_w, round(SMILE*K)), Image.Resampling.LANCZOS)
    compose(group, rims, 0, 0)
    smile_width = max(1, round(group_w * value('sorrisoEscala', progress)))
    smile = SMILE_IMG.resize((smile_width, round((CFG['fonte']['altura']-SMILE)*K)), Image.Resampling.LANCZOS)
    compose(group, smile, (group_w-smile_width)/2, SMILE*K, value('sorrisoOpacidade', progress))
    scale = value('oculosEscala', progress)
    group = group.resize((round(group_w*scale), round(group_h*scale)), Image.Resampling.BICUBIC)
    group = group.rotate(-value('oculosRotacao', progress), Image.Resampling.BICUBIC, expand=True)
    offset = ((DIV + CFG['fonte']['largura'])/2 - CFG['fonte']['largura']/2) * K
    cx = W/2 + offset + value('oculosX', progress)*offset
    cy = H/2 + value('oculosY', progress)*S
    compose(canvas, group, cx-group.width/2, cy-group.height/2, alpha)
    return canvas.convert('RGB')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--hold-ms', type=int, default=500)
    parser.add_argument('--tail-ms', type=int, default=160)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    duration = CFG['sequenciaMs'] + args.hold_ms + CFG['saidaMs'] + args.tail_ms
    total = math.ceil(duration*FPS/1000)
    target = args.out / 'oculos-em-foco.mp4'
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-movflags', '+faststart', str(target)]
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(total): process.stdin.write(frame(n, args.hold_ms, args.tail_ms).tobytes())
    process.stdin.close()
    if process.wait(): raise SystemExit('Falha do FFmpeg')
    samples = sorted({round(CFG['sequenciaMs']*p) for p in [0, .13, *CFG['marcos'][1:], .73]})
    for ms in samples:
        frame(round(ms*FPS/1000), args.hold_ms, args.tail_ms).save(args.out / f'frame-{ms:03}.png')
    assert np.array_equal(np.array(frame(0, 500, 0)), np.array(static_frame().convert('RGB')))
    meta = {'type': 'filme de conceito, não captura do app', 'style': STYLE, 'source': str(SOURCE.relative_to(ROOT)),
            'motionContract': 'packages/contratos/src/abertura-motion.json', 'fps': FPS, 'resolution': [W,H],
            'mobileNominalMs': CFG['sequenciaMs']+CFG['saidaMs'], 'conceptHoldMs': args.hold_ms,
            'durationMs': duration, 'sampleMs': samples, 'nativeValidated': False}
    (args.out/'render.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'video': str(target), 'frames': total, 'nominalMobileMs': CFG['sequenciaMs']+CFG['saidaMs'], 'conceptHoldMs': args.hold_ms}))

if __name__ == '__main__': main()
