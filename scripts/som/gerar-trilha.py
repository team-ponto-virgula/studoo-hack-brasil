#!/usr/bin/env python3
"""
Fonte de produção dos sons do Studoo: trilha de fundo e efeitos musicais.

Tudo aqui é sintetizado do zero (composição e gravação próprias): nenhuma
amostra, loop ou arquivo de terceiro entra no resultado. A referência de
clima consultada está em `docs/som/PRODUCAO.md`.

Uso:
    python3 scripts/som/gerar-trilha.py musica  [--destino-demo DIR]
    python3 scripts/som/gerar-trilha.py efeitos [--destino-demo DIR]

Dependências: numpy (só para gerar; os arquivos finais vão para o repositório).

Convenções musicais do Studoo (identidade):
    tônica D maior, 86 BPM, 4/4, tema de 32 compassos em quatro frases
    (A, A', B, A''), malho/kalimba à frente, pad quente, baixo curto.
    A melodia vive entre D5 (587 Hz) e D6 (1175 Hz), a faixa que o
    alto-falante de celular reproduz bem.
"""
from __future__ import annotations

import argparse
import math
import os
import struct
import subprocess
import sys
import wave
from dataclasses import dataclass, field

import numpy as np

SR = 44100
FFMPEG = os.environ.get("FFMPEG", "/tmp/audio-tools/ffmpeg")

# ---------------------------------------------------------------------------
# utilidades de áudio
# ---------------------------------------------------------------------------


def midi_hz(n: float) -> float:
    return 440.0 * 2.0 ** ((n - 69) / 12.0)


def seg(duracao_s: float) -> int:
    return int(round(duracao_s * SR))


def rampa(n: int, ataque: float, queda: float, curva: float = 2.0) -> np.ndarray:
    """Envelope ataque linear + queda exponencial (em segundos)."""
    t = np.arange(n) / SR
    a = np.clip(t / max(ataque, 1e-4), 0, 1)
    a = a * a * (3 - 2 * a)  # smoothstep: ataque sem estalo
    d = np.exp(-np.clip(t - ataque, 0, None) / max(queda, 1e-4) * curva)
    return a * d


def ruido(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n)


def bp(x: np.ndarray, lo: float, hi: float, ordem: int = 2) -> np.ndarray:
    """Filtro passa-faixa de fase zero no domínio da FFT (não importa a fase)."""
    n = len(x)
    if n == 0:
        return x
    N = 1 << int(math.ceil(math.log2(n + 1)))
    f = np.fft.rfftfreq(N, 1 / SR)
    centro = math.sqrt(lo * hi)
    largura = max(hi - lo, 1.0)
    q = centro / largura
    # resposta em magnitude de um passa-banda ressonante (RBJ), ao quadrado por
    # ser aplicada duas vezes (ordem 2).
    w = f / centro
    mag = (1.0 / q) * w / np.sqrt((1 - w**2) ** 2 + (w / q) ** 2)
    mag = np.clip(mag, 0, None) ** ordem
    mag[f < 1] = 0
    return np.fft.irfft(np.fft.rfft(x, N) * mag, N)[:n]


def passa_alta(x: np.ndarray, corte: float, ordem: int = 2) -> np.ndarray:
    n = len(x)
    N = 1 << int(math.ceil(math.log2(n + 1)))
    f = np.fft.rfftfreq(N, 1 / SR)
    r = (f / corte) ** (2 * ordem)
    mag = r / (1 + r)
    mag[f < 1] = 0
    return np.fft.irfft(np.fft.rfft(x, N) * mag, N)[:n]


def passa_baixa(x: np.ndarray, corte: float, ordem: int = 2) -> np.ndarray:
    n = len(x)
    N = 1 << int(math.ceil(math.log2(n + 1)))
    f = np.fft.rfftfreq(N, 1 / SR)
    r = (f / corte) ** (2 * ordem)
    mag = 1 / (1 + r)
    return np.fft.irfft(np.fft.rfft(x, N) * mag, N)[:n]


def shelf(x: np.ndarray, freq: float, ganho_db: float, q: float = 0.7, alto: bool = True) -> np.ndarray:
    """Shelf de fase zero, para o master (presença e ar)."""
    n = len(x)
    N = 1 << int(math.ceil(math.log2(n + 1)))
    f = np.maximum(np.fft.rfftfreq(N, 1 / SR), 1e-3)
    w = f / freq
    if alto:
        g = 1 / (1 + w ** (2 * q * 2))
        curva = 1 + (10 ** (ganho_db / 20) - 1) * g
    else:
        g = 1 / (1 + (1 / w) ** (2 * q * 2))
        curva = 1 + (10 ** (ganho_db / 20) - 1) * g
    return np.fft.irfft(np.fft.rfft(x, N) * curva, N)[:n]


def pan_stereo(m: np.ndarray, pan: float) -> np.ndarray:
    """pan -1..1 com lei de potência constante; devolve (n, 2)."""
    ang = (pan + 1) * math.pi / 4
    return np.stack([m * math.cos(ang), m * math.sin(ang)], axis=1)


# ---------------------------------------------------------------------------
# instrumentos (síntese aditiva com envelopes próprios)
# ---------------------------------------------------------------------------


def malho(freq: float, dur: float, vel: float, rng, brilho: float = 1.0) -> np.ndarray:
    """Kalimba/marimba: parciais inarmônicos, ataque curto, queda média."""
    n = seg(dur)
    t = np.arange(n) / SR
    # leve queda de afinação no ataque (a lâmina "assenta")
    f0 = freq * (1 + 0.004 * np.exp(-t / 0.02))
    fase = 2 * np.pi * np.cumsum(f0) / SR
    parciais = [(1.0, 1.0, 0.95), (3.0, 0.28 * brilho, 0.42), (5.4, 0.13 * brilho, 0.24), (8.2, 0.06 * brilho, 0.14)]
    y = np.zeros(n)
    for mult, amp, dec in parciais:
        y += amp * np.sin(fase * mult) * np.exp(-t / (dec * dur * 0.9))
    y *= rampa(n, 0.002, dur * 0.55, 1.6)
    # estalo do malho (dá o "toque" no alto-falante pequeno)
    click = bp(ruido(n, rng), 2500, 7000) * np.exp(-t / 0.006) * 0.10
    return (y + click) * vel


def sino(freq: float, dur: float, vel: float, rng) -> np.ndarray:
    """Sino/glockenspiel suave, para cintilância."""
    n = seg(dur)
    t = np.arange(n) / SR
    f0 = freq * (1 + 0.002 * np.exp(-t / 0.05))
    fase = 2 * np.pi * np.cumsum(f0) / SR
    y = np.zeros(n)
    for mult, amp, dec in [(1, 1.0, 1.0), (2.76, 0.35, 0.55), (5.4, 0.16, 0.3), (8.93, 0.07, 0.16)]:
        y += amp * np.sin(fase * mult) * np.exp(-t / (dec * dur * 0.8))
    y *= rampa(n, 0.003, dur * 0.6, 1.4)
    return y * vel


def pad(freqs: list[float], dur: float, vel: float, rng, brilho: float = 1.0) -> np.ndarray:
    """Pad quente: harmônicos até o 10º, ataque lento, desafinação dupla."""
    n = seg(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.0025, 0.0, 0.0025):
            ff = f * (1 + det)
            for h in range(1, 11):
                if ff * h > 9000:
                    break
                amp = (1.0 / h**1.7) * brilho
                y += amp * np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28))
    y /= max(len(freqs), 1)
    env = rampa(n, 0.55, dur * 1.2, 1.1)
    respiro = 1 + 0.05 * np.sin(2 * np.pi * 0.08 * t + rng.uniform(0, 6.28))
    return passa_baixa(y * env * respiro, 2600) * vel


def baixo(freq: float, dur: float, vel: float, rng) -> np.ndarray:
    """Baixo curto de estudo: fundamental + harmônicos que o celular alcança."""
    n = seg(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for h, amp, dec in [(1, 1.0, 1.0), (2, 0.55, 0.75), (3, 0.32, 0.6), (4, 0.18, 0.45), (5, 0.1, 0.35)]:
        y += amp * np.sin(2 * np.pi * freq * h * t) * np.exp(-t / (0.5 * dur * dec))
    y *= rampa(n, 0.006, dur * 0.6, 2.0)
    return y * vel


def piano_feltro(freq: float, dur: float, vel: float, rng) -> np.ndarray:
    """Piano abafado (feltro): parciais quase harmônicos, ataque macio."""
    n = seg(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for h, amp, dec in [(1, 1.0, 1.0), (2, 0.42, 0.7), (3, 0.2, 0.5), (4, 0.1, 0.4), (5, 0.05, 0.3)]:
        y += amp * np.sin(2 * np.pi * freq * h * t) * np.exp(-t / (0.42 * dur * dec))
    y *= rampa(n, 0.012, dur * 0.5, 1.7)
    y = passa_baixa(y, 4200)
    return y * vel


def flauta(freq: float, dur: float, vel: float, rng) -> np.ndarray:
    """Flauta doce: senoide com sopro e vibrato discreto."""
    n = seg(dur)
    t = np.arange(n) / SR
    vib = 1 + 0.0035 * np.sin(2 * np.pi * 4.8 * t + rng.uniform(0, 6.28))
    fase = 2 * np.pi * np.cumsum(freq * vib) / SR
    y = np.sin(fase) + 0.14 * np.sin(2 * fase) + 0.05 * np.sin(3 * fase)
    sopro = bp(ruido(n, rng), 1200, 6000) * 0.02
    y = (y + sopro) * rampa(n, 0.055, dur * 0.9, 1.2)
    return y * vel


def piano_eletrico(freq: float, dur: float, vel: float, rng) -> np.ndarray:
    """Piano elétrico tipo FM, para o lo-fi."""
    n = seg(dur)
    t = np.arange(n) / SR
    mod = 1.8 * np.exp(-t / 0.25) * np.sin(2 * np.pi * freq * 1.0 * t)
    y = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / (dur * 0.5))
    y += 0.15 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / (dur * 0.3))
    y *= rampa(n, 0.006, dur * 0.45, 1.8)
    return y * vel


def chocalho(vel: float, rng, dur: float = 0.07) -> np.ndarray:
    n = seg(dur)
    t = np.arange(n) / SR
    y = bp(ruido(n, rng), 3800, 9500) * np.exp(-t / 0.022)
    return y * vel


def bumbo(vel: float, rng, dur: float = 0.22) -> np.ndarray:
    n = seg(dur)
    t = np.arange(n) / SR
    f = 95 * np.exp(-t / 0.035) + 48
    fase = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(fase) * np.exp(-t / 0.11)
    y += bp(ruido(n, rng), 60, 300) * np.exp(-t / 0.02) * 0.25
    return y * vel


def caixa_escova(vel: float, rng, dur: float = 0.13) -> np.ndarray:
    n = seg(dur)
    t = np.arange(n) / SR
    y = bp(ruido(n, rng), 900, 5200) * np.exp(-t / 0.045)
    return y * vel


def madeira(vel: float, rng, dur: float = 0.09) -> np.ndarray:
    n = seg(dur)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 1800 * t) + 0.4 * np.sin(2 * np.pi * 2900 * t)) * np.exp(-t / 0.016)
    return y * vel


# ---------------------------------------------------------------------------
# camadas de ambiente (chuva, vento, sala, vinil)
# ---------------------------------------------------------------------------


def chuva(dur: float, rng: np.random.Generator, vel: float = 1.0) -> np.ndarray:
    n = seg(dur)
    t = np.arange(n) / SR
    base = bp(ruido(n, rng), 400, 5200)
    base *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.05 * t)
    gotas = np.zeros(n)
    for _ in range(int(dur * 7)):
        pos = rng.integers(0, n - seg(0.05))
        g = seg(0.05)
        tg = np.arange(g) / SR
        f = rng.uniform(1400, 4200)
        gotas[pos : pos + g] += np.sin(2 * np.pi * f * tg) * np.exp(-tg / 0.008) * rng.uniform(0.04, 0.16)
    return (base * 0.5 + gotas) * vel


def vento(dur: float, rng: np.random.Generator, vel: float = 1.0) -> np.ndarray:
    n = seg(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for centro, amp in [(350, 0.7), (900, 0.35), (2200, 0.12)]:
        sopro = rng.standard_normal(n)
        # bandas lentas: filtro por seguimentos para economizar
        passo = seg(0.25)
        for i in range(0, n, passo):
            b = min(passo, n - i)
            x = sopro[i : i + b]
            lfo = 0.6 + 0.4 * math.sin(2 * math.pi * rng.uniform(0.03, 0.09) * (i / SR))
            y[i : i + b] += passa_baixa(passa_alta(x, centro * 0.6), centro * 1.7) * lfo * amp
    return y / max(np.max(np.abs(y)), 1e-9) * vel


def sala(dur: float, rng: np.random.Generator, vel: float = 1.0) -> np.ndarray:
    """Tom de sala: ruído rosa muito baixo, sem eventos."""
    n = seg(dur)
    branco = rng.standard_normal(n)
    # ruído rosa por integração fracionária simples
    rosa = np.zeros(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    # filtro IIR de 4ª ordem em blocos (numpy não tem lfilter)
    x1 = x2 = x3 = y1 = y2 = y3 = 0.0
    for i in range(n):
        v = branco[i]
        sa = b[0] * v + b[1] * x1 + b[2] * x2 + b[3] * x3 - a[1] * y1 - a[2] * y2 - a[3] * y3
        x3, x2, x1 = x2, x1, v
        y3, y2, y1 = y2, y1, sa
        rosa[i] = sa
    return rosa / max(np.max(np.abs(rosa)), 1e-9) * vel


def vinil(dur: float, rng: np.random.Generator, vel: float = 1.0) -> np.ndarray:
    n = seg(dur)
    y = bp(ruido(n, rng), 600, 7000) * 0.05
    for _ in range(int(dur * 22)):
        pos = rng.integers(0, n - 200)
        g = rng.integers(30, 160)
        t = np.arange(g) / SR
        y[pos : pos + g] += rng.uniform(0.05, 0.3) * np.sin(2 * np.pi * rng.uniform(900, 3600) * t) * np.exp(-t / 0.0015)
    return y * vel


# ---------------------------------------------------------------------------
# composição: tema do Studoo
# ---------------------------------------------------------------------------

BPM = 86
COMPASSOS = 32
DUR_COMPASSO = 4 * 60 / BPM
LOOP_S = COMPASSOS * DUR_COMPASSO  # 89,30 s

# acordes por compasso (MIDI, para o pad; o baixo usa a fundamental)
ACORDES = [
    ("D", [50, 57, 62, 66]),
    ("G", [43, 50, 55, 59]),
    ("Bm", [47, 54, 59, 62]),
    ("A", [45, 52, 57, 61]),
    ("D/F#", [42, 50, 57, 62]),
    ("G", [43, 50, 55, 59]),
    ("Em7", [40, 47, 52, 55, 59]),
    ("A7", [45, 52, 55, 61]),
]
HARMONIA = ACORDES + ACORDES + [
    ("Bm", [47, 54, 59, 62]),
    ("G", [43, 50, 55, 59]),
    ("D", [50, 57, 62, 66]),
    ("A", [45, 52, 57, 61]),
    ("Bm", [47, 54, 59, 62]),
    ("Em7", [40, 47, 52, 55, 59]),
    ("G", [43, 50, 55, 59]),
    ("A7", [45, 52, 55, 61]),
] + ACORDES

RAIZ = {"D": 38, "G": 43, "Bm": 47, "A": 45, "D/F#": 42, "Em7": 40, "A7": 45}

# melodia A (compasso relativo 0..7): (tempo em batidas, duração, nota)
MELODIA_A = [
    (0.0, 1.5, 78), (1.5, 0.5, 76), (2.0, 2.0, 74),
    (4.0, 1.0, 79), (5.0, 1.0, 78), (6.0, 2.0, 76),
    (8.0, 1.0, 74), (9.0, 1.0, 78), (10.0, 2.0, 83),
    (12.0, 3.0, 81),
    (16.0, 1.0, 78), (17.0, 1.0, 81), (18.0, 1.5, 86),
    (20.0, 1.5, 83), (21.5, 0.5, 81), (22.0, 2.0, 79),
    (24.0, 1.0, 78), (25.0, 1.0, 76), (26.0, 1.0, 74), (27.0, 1.0, 71),
    (28.0, 1.0, 73), (29.0, 1.0, 76), (30.0, 2.0, 81),
]
# melodia B (compassos 16..23 do tema)
MELODIA_B = [
    (0.0, 2.0, 83), (2.0, 1.0, 78), (3.0, 1.0, 74),
    (4.0, 1.5, 79), (5.5, 0.5, 81), (6.0, 2.0, 83),
    (8.0, 2.0, 86), (10.0, 1.0, 81), (11.0, 1.0, 78),
    (12.0, 1.0, 76), (13.0, 1.0, 78), (14.0, 2.0, 81),
    (16.0, 1.0, 83), (17.0, 1.0, 86), (18.0, 2.0, 78),
    (20.0, 2.0, 79), (22.0, 1.0, 76), (23.0, 1.0, 74),
    (24.0, 1.0, 83), (25.0, 1.0, 81), (26.0, 1.0, 79), (27.0, 1.0, 76),
    (28.0, 3.5, 81),
]


@dataclass
class Evento:
    inicio: float  # segundos
    notas: list[tuple[float, float, int]]  # (inicio_s, dur_s, midi)
    instrumento: str
    vel: float
    pan: float = 0.0


@dataclass
class Trilha:
    nome: str
    eventos: list[Evento] = field(default_factory=list)
    camada: list[tuple[str, float, float, float]] = field(default_factory=list)  # (tipo, dur, vel, pan)


def compasso(bar: int, beat: float) -> float:
    return bar * DUR_COMPASSO + beat * 60 / BPM


def frase(trilha: Trilha, melodia, bar0: int, instrumento: str, vel: float, pan: float = 0.0):
    for beat_ini, dur_beats, nota in melodia:
        trilha.eventos.append(
            Evento(compasso(bar0, beat_ini), [(0.0, dur_beats * 60 / BPM, nota)], instrumento, vel, pan)
        )


def acompanhamento(trilha: Trilha, bar0: int, n: int, instrumento: str, vel: float, pan: float, oitava: int = 0):
    """Acorde no compasso inteiro (pad) ou meio (piano)."""
    for i in range(n):
        bar = (bar0 + i) % len(HARMONIA)
        notas = HARMONIA[bar][1]
        dur = DUR_COMPASSO if instrumento in ("pad", "piano_feltro") else DUR_COMPASSO / 2
        tri = [(0.0, dur, m + oitava) for m in notas]
        trilha.eventos.append(Evento(compasso(bar0 + i, 0), tri, instrumento, vel, pan))


def baixo_linha(trilha: Trilha, bar0: int, n: int, vel: float, padrao: str = "raiz_quinta"):
    for i in range(n):
        bar = (bar0 + i) % len(HARMONIA)
        nome = HARMONIA[bar][0]
        r = RAIZ[nome]
        if padrao == "raiz_quinta":
            eventos = [(0.0, 1.4, r), (2.0, 1.2, r + 7)]
        elif padrao == "raiz_so":
            eventos = [(0.0, 2.6, r)]
        else:  # andamento
            eventos = [(0.0, 1.0, r), (1.5, 0.9, r), (2.5, 1.2, r + 7)]
        tri = [(b * 60 / BPM, d * 60 / BPM, m) for b, d, m in eventos]
        trilha.eventos.append(Evento(compasso(bar0 + i, 0), tri, "baixo", vel, 0.0))


def arpejo(trilha: Trilha, bar0: int, n: int, instrumento: str, vel: float, pan: float, altura: int = 12):
    """Colcheias quebradas do acorde (dá movimento sem competir com a melodia)."""
    for i in range(n):
        bar = (bar0 + i) % len(HARMONIA)
        notas = [m + altura for m in HARMONIA[bar][1]]
        seq = [0, 1, 2, 3, 2, 1, 0, 1]
        for k, idx in enumerate(seq):
            if idx >= len(notas):
                continue
            tri = [(0.0, 0.55 * 60 / BPM, notas[idx])]
            trilha.eventos.append(Evento(compasso(bar0 + i, k * 0.5), tri, instrumento, vel, pan))


def pickup_de_laco(trilha: Trilha, instrumento: str, vel: float, pan: float = 0.0):
    """Duas colcheias do dominante (A, C#) no fim do compasso 32.

    Elas preenchem o último tempo antes da emenda e resolvem na tônica do
    compasso 1 (D), então a volta do laço soa como continuação e não como
    reinício. A cauda dessas notas ainda é dobrada no começo pelo `fecha_laco`.
    """
    for beat, nota in ((3.0, 69), (3.5, 73)):
        trilha.eventos.append(
            Evento(compasso(31, beat), [(0.0, 0.45, nota)], instrumento, vel, pan)
        )


# ---------------------------------------------------------------------------
# arranjos: os cinco climas
# ---------------------------------------------------------------------------


def construir_trilha(nome: str, rng: np.random.Generator) -> Trilha:
    t = Trilha(nome)
    if nome == "foco_calmo":
        # Tema cantável à frente, pad quente, baixo curto, chocalho só no fim.
        acompanhamento(t, 0, 32, "pad", 0.20, 0.0)
        baixo_linha(t, 0, 32, 0.42, "raiz_quinta")
        frase(t, MELODIA_A, 0, "malho", 0.62, -0.15)
        frase(t, MELODIA_A, 8, "malho", 0.62, -0.15)
        frase(t, MELODIA_B, 16, "malho", 0.66, -0.15)
        frase(t, MELODIA_A, 24, "malho", 0.62, -0.15)
        # contracanto de flauta uma sexta abaixo nas frases A' e B
        contracanto = [(b, d, n - 9) for b, d, n in MELODIA_A]
        frase(t, contracanto, 8, "flauta", 0.16, 0.25)
        arpejo(t, 8, 8, "malho", 0.20, 0.3, 12)
        arpejo(t, 24, 8, "malho", 0.14, 0.3, 12)
        for bar in range(8, 32):
            for k in range(8):
                v = 0.22 if k % 2 else 0.11
                t.eventos.append(Evento(compasso(bar, k * 0.5), [(0.0, 0.07, 0)], "chocalho", v, 0.35))
        pickup_de_laco(t, "malho", 0.34, -0.15)
        # cintilância discreta no fim de cada frase
        for bar in (7, 15, 23, 31):
            t.eventos.append(Evento(compasso(bar, 3.5), [(0.0, 0.7, 86)], "sino", 0.30, 0.4))

    elif nome == "chuva_suave":
        # Caixinha de música esparsa sobre chuva; sem percussão.
        acompanhamento(t, 0, 32, "pad", 0.22, 0.0)
        baixo_linha(t, 0, 32, 0.20, "raiz_so")
        frase(t, MELODIA_A, 0, "sino", 0.33, 0.1)
        frase(t, MELODIA_A, 8, "sino", 0.30, 0.1)
        frase(t, MELODIA_B, 16, "sino", 0.34, 0.1)
        frase(t, MELODIA_A, 24, "sino", 0.32, 0.1)
        arpejo(t, 16, 8, "malho", 0.10, -0.3, 12)
        pickup_de_laco(t, "sino", 0.20, 0.15)
        t.camada += [("chuva", LOOP_S, 0.5, 0.0), ("sala", LOOP_S, 0.05, 0.0)]

    elif nome == "lofi_estudo":
        # Meio-tempo: acordes de piano elétrico, bumbo e escova, melodia discreta.
        for i in range(32):
            bar = i % len(HARMONIA)
            nome_ac = HARMONIA[bar][0]
            notas = [m + 12 for m in HARMONIA[bar][1]]
            tri = [(0.0, DUR_COMPASSO * 0.9, m) for m in notas]
            t.eventos.append(Evento(compasso(i, 0), tri, "piano_eletrico", 0.16, 0.0))
        baixo_linha(t, 0, 32, 0.30, "andamento")
        # bateria em meio-tempo: 1 e 3 com bumbo, 3 com escova
        for i in range(32):
            t.eventos.append(Evento(compasso(i, 0), [(0.0, 0.22, 0)], "bumbo", 0.36, 0.0))
            t.eventos.append(Evento(compasso(i, 2), [(0.0, 0.22, 0)], "bumbo", 0.28, 0.0))
            t.eventos.append(Evento(compasso(i, 1), [(0.0, 0.13, 0)], "caixa", 0.13, 0.1))
            t.eventos.append(Evento(compasso(i, 3), [(0.0, 0.13, 0)], "caixa", 0.16, 0.1))
            for k in range(8):
                t.eventos.append(Evento(compasso(i, k * 0.5), [(0.0, 0.06, 0)], "chocalho", 0.055 if k % 2 else 0.03, -0.35))
        # melodia: só em duas frases, abafada
        frase(t, MELODIA_A, 8, "piano_eletrico", 0.30, -0.1)
        frase(t, MELODIA_B, 16, "piano_eletrico", 0.32, -0.1)
        frase(t, MELODIA_A, 24, "piano_eletrico", 0.28, -0.1)
        acompanhamento(t, 0, 32, "pad", 0.07, 0.0)
        pickup_de_laco(t, "malho", 0.26, -0.1)
        t.camada += [("vinil", LOOP_S, 0.35, 0.0)]

    elif nome == "biblioteca":
        # Piano de feltro, muito espaço, sem bateria; harmonia em meio compasso.
        for i in range(32):
            bar = i % len(HARMONIA)
            notas = [m + 12 for m in HARMONIA[bar][1]]
            tri = [(0.0, DUR_COMPASSO * 1.4, m) for m in notas]
            t.eventos.append(Evento(compasso(i, 0), tri, "piano_feltro", 0.15, 0.0))
        baixo_linha(t, 0, 32, 0.16, "raiz_so")
        frase(t, MELODIA_A, 0, "piano_feltro", 0.34, 0.1)
        frase(t, MELODIA_A, 8, "piano_feltro", 0.24, 0.1)
        arpejo(t, 8, 8, "piano_feltro", 0.10, -0.2, 12)
        frase(t, MELODIA_B, 16, "piano_feltro", 0.36, 0.1)
        frase(t, MELODIA_A, 24, "piano_feltro", 0.32, 0.1)
        acompanhamento(t, 0, 32, "pad", 0.09, 0.0)
        pickup_de_laco(t, "piano_feltro", 0.22, 0.1)
        t.camada += [("sala", LOOP_S, 0.10, 0.0)]

    elif nome == "brisa_natural":
        # Vento + flauta à frente + harpa; base harmônica quente.
        acompanhamento(t, 0, 32, "pad", 0.20, 0.0)
        baixo_linha(t, 0, 32, 0.18, "raiz_so")
        frase(t, MELODIA_A, 0, "flauta", 0.40, -0.1)
        frase(t, MELODIA_A, 8, "flauta", 0.38, -0.1)
        frase(t, MELODIA_B, 16, "flauta", 0.42, -0.1)
        frase(t, MELODIA_A, 24, "flauta", 0.40, -0.1)
        arpejo(t, 0, 32, "malho", 0.10, 0.35, 12)
        pickup_de_laco(t, "flauta", 0.18, -0.1)
        t.camada += [("vento", LOOP_S, 0.11, 0.0)]
    else:
        raise SystemExit(f"clima desconhecido: {nome}")
    return t


# ---------------------------------------------------------------------------
# render
# ---------------------------------------------------------------------------


def render_instrumento(nome: str, tri: list[tuple[float, float, int]], rng) -> np.ndarray:
    """Soma um acorde/nota do instrumento pedido, já com duração própria."""
    if not tri:
        return np.zeros(0)
    fim_total = max(max(i + d for i, d, _ in tri), 0.05)
    n = seg(fim_total + 0.05)
    y = np.zeros(n)
    for ini, dur, nota in tri:
        f = midi_hz(nota)
        off = seg(ini)
        if nome == "malho":
            s = malho(f, dur, 1.0, rng)
        elif nome == "sino":
            s = sino(f, dur, 1.0, rng)
        elif nome == "baixo":
            s = baixo(f, dur, 1.0, rng)
        elif nome == "piano_feltro":
            s = piano_feltro(f, dur, 1.0, rng)
        elif nome == "flauta":
            s = flauta(f, dur, 1.0, rng)
        elif nome == "piano_eletrico":
            s = piano_eletrico(f, dur, 1.0, rng)
        else:
            s = np.zeros(seg(dur))
        fim = min(n, off + len(s))
        y[off:fim] += s[: fim - off]
    return y


def render_evento(ev: Evento, rng) -> np.ndarray:
    if ev.instrumento == "pad":
        dur = max(d for _, d, _ in ev.notas) + 0.6
        freqs = [midi_hz(m) for _, _, m in ev.notas]
        return pad(freqs, dur, 1.0, rng)
    if ev.instrumento in ("chocalho", "bumbo", "caixa", "madeira"):
        dur = {"chocalho": 0.07, "bumbo": 0.22, "caixa": 0.13, "madeira": 0.09}[ev.instrumento]
        n = seg(dur)
        if ev.instrumento == "chocalho":
            return chocalho(1.0, rng)
        if ev.instrumento == "bumbo":
            return bumbo(1.0, rng)
        if ev.instrumento == "caixa":
            return caixa_escova(1.0, rng)
        return madeira(1.0, rng)
    inicio = min(i for i, _, _ in ev.notas)
    tri = [(i - inicio, d, m) for i, d, m in ev.notas]
    return render_instrumento(ev.instrumento, tri, rng)


def render_trilha(t: Trilha, rng, cauda: float = 1.2) -> tuple[np.ndarray, list[tuple[str, np.ndarray, float, float]]]:
    N = seg(LOOP_S + cauda)
    mistura = np.zeros((N, 2))
    camadas = []
    for ev in t.eventos:
        s = render_evento(ev, rng)
        if len(s) == 0:
            continue
        off = seg(ev.inicio)
        fim = min(N, off + len(s))
        if off >= N:
            continue
        s = s[: fim - off] * ev.vel
        mistura[off:fim] += pan_stereo(s, ev.pan)
    for tipo, dur, vel, pan in t.camada:
        if tipo == "chuva":
            s = chuva(dur, rng, 1.0)
        elif tipo == "vento":
            s = vento(dur, rng, 1.0)
        elif tipo == "sala":
            s = sala(dur, rng, 1.0)
        elif tipo == "vinil":
            s = vinil(dur, rng, 1.0)
        else:
            continue
        s = s[:N] * vel
        s = np.pad(s, (0, N - len(s)))
        camadas.append((tipo, s, vel, pan))
        mistura += pan_stereo(s, pan)
    return mistura, camadas


def reverb(x: np.ndarray, rng, mix: float = 0.22, dur: float = 1.6) -> np.ndarray:
    """Convolução com uma resposta sintética estéreo (sala pequena).

    A resposta é normalizada pela energia, não pelo pico: o molhado entra na
    proporção pedida em `mix`, sem estourar o barramento.
    """
    n = seg(dur)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        ruido_ir = rng.standard_normal(n) * np.exp(-t / (dur * 0.32))
        ir[:, c] = ruido_ir
        for atraso, g in [(0.011, 0.5), (0.019, 0.35), (0.031, 0.25)]:
            k = seg(atraso)
            ir[k, c] += g
    ir = np.stack([passa_baixa(ir[:, c], 5200) for c in range(2)], axis=1)
    ir /= np.sqrt(np.mean(ir**2)) + 1e-9
    N = 1 << int(math.ceil(math.log2(len(x) + n)))
    molhado = np.zeros_like(x)
    for c in range(2):
        X = np.fft.rfft(x[:, c], N)
        Y = np.fft.rfft(ir[:, c], N)
        molhado[:, c] = np.fft.irfft(X * Y, N)[: len(x)]
    escala = math.sqrt(float(np.mean(x**2)) + 1e-12) / (math.sqrt(float(np.mean(molhado**2))) + 1e-12)
    return x + molhado * escala * mix


def loudness(x: np.ndarray) -> float:
    """Loudness integrada aproximada (K-weighting + portão de -10 LU)."""
    N = 1 << int(math.ceil(math.log2(len(x) + 1)))
    f = np.fft.rfftfreq(N, 1 / SR)
    # estágio 1: passa-alta; estágio 2: prateleira de agudos (norma ITU-R BS.1770)
    r = (f / 60) ** 4
    hp = r / (1 + r)
    sh = 1 + (10 ** (4.0 / 20) - 1) / (1 + (1500 / np.maximum(f, 1e-3)) ** 2)
    peso = hp * sh
    y = np.zeros_like(x)
    for c in range(x.shape[1]):
        y[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], N) * peso, N)[: len(x)]
    k = seg(0.4)
    n = len(x) // k
    if n == 0:
        return -70.0
    ms = np.mean(y[: n * k].reshape(n, k, 2) ** 2, axis=(1, 2))
    l = -0.691 + 10 * np.log10(ms + 1e-20)
    acima = ms[l > -70]
    if len(acima) == 0:
        return -70.0
    porta = -0.691 + 10 * np.log10(float(np.mean(acima))) - 10
    acima = ms[l > porta]
    if len(acima) == 0:
        return -70.0
    return float(-0.691 + 10 * math.log10(float(np.mean(acima)) + 1e-20))


def master(x: np.ndarray, alvo_lufs: float = -24.0, teto_peak: float = 0.63) -> np.ndarray:
    """Master para alto-falante de celular.

    - corta o rumo que o celular não reproduz e desengordura o grave-médio;
    - dá presença (2,6 kHz) e ar (7,8 kHz), sem hiss;
    - limita só os picos (crest factor preservado) e normaliza o RMS.
    """
    for c in range(2):
        x[:, c] = passa_alta(x[:, c], 55, 2)
        x[:, c] = shelf(x[:, c], 320, -2.6, q=0.45, alto=False)
        x[:, c] = shelf(x[:, c], 2600, 2.6, q=0.55, alto=True)
        x[:, c] = shelf(x[:, c], 6500, 2.4, q=0.6, alto=True)
    # nível: loudness integrada igual para os cinco climas, sem estourar picos
    for _ in range(6):
        lu = loudness(x)
        x *= 10 ** ((alvo_lufs - lu) / 20)
        pico = np.max(np.abs(x))
        if pico <= teto_peak:
            break
        t = float(np.percentile(np.abs(x), 99.4))
        a = np.abs(x)
        x = np.sign(x) * np.where(a < t, a, t + (teto_peak - t) * np.tanh((a - t) / (teto_peak - t)))
    return x


def fecha_laco(x: np.ndarray, n_loop: int, n_curto: int = seg(0.9), pre: float = 0.026) -> np.ndarray:
    """Dobra a cauda no começo, recorta no compasso exato e acrescenta 26 ms.

    1. A cauda (reverb, notas longas) é somada aos primeiros 0,9 s: o fim do
       laço continua no começo, sem fade nem degrau.
    2. O trecho final de 26 ms é repetido antes do começo. O compasso 1 passa
       a cair em exatamente `aparoInicioSeg` (0,026 s), que é onde o toca-sons
       começa a tocar. No Chromium, que decodifica o MP3 já sem o atraso do
       codificador, o laço então cobre os 32 compassos inteiros e a emenda é a
       do material original; num navegador que não tire o atraso, o começo cai
       dentro desse trecho de cauda, que é quase silêncio, em vez de abrir um
       buraco.
    """
    cauda = x[n_loop:]
    inicio = x[:n_loop].copy()
    k = min(len(cauda), n_curto)
    if k:
        peso = np.linspace(1, 0, k)[:, None] ** 1.2
        inicio[:k] += cauda[:k] * peso
    n_pre = seg(pre)
    return np.concatenate([inicio[-n_pre:], inicio], axis=0)


def escrever_wav(caminho: str, x: np.ndarray, bits: int = 16) -> None:
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    dados = np.clip(x, -1, 1)
    pcm = (dados * (2 ** (bits - 1) - 1)).astype("<i2")
    with wave.open(caminho, "wb") as w:
        w.setnchannels(x.shape[1] if x.ndim > 1 else 1)
        w.setsampwidth(bits // 8)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def para_mp3(wav: str, mp3: str, kbps: str = "80k") -> None:
    subprocess.run(
        [FFMPEG, "-y", "-v", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", kbps, "-ac", "1", mp3],
        check=True,
    )


# ---------------------------------------------------------------------------
# efeitos musicais ligados ao tema (acerto, erro, fim de lição/trilha, conta)
# ---------------------------------------------------------------------------


def efeito(nome: str, rng) -> np.ndarray:
    """Devolve mono float com pico em -1,5 dBFS e ataque imediato.

    Todos os efeitos nascem de gestos musicais do tema (Ré maior) e têm o
    primeiro ataque em <= 6 ms: o som responde no toque, não depois dele.
    """
    if nome == "acerto":
        # duas notas subindo (D5 -> A5) e um sino: o "sim" do tema
        notas = [(0.000, 74, 0.30, 1.00), (0.105, 81, 0.42, 0.80), (0.185, 86, 0.55, 0.55)]
    elif nome == "erro":
        # curto, simpático e inconfundível: G4 -> F4 com corpo no celular
        notas = [(0.000, 67, 0.26, 1.00), (0.120, 65, 0.30, 0.80)]
    elif nome == "concluir_licao":
        # cadência do tema: D F# A D, com sino no fim
        notas = [(0.000, 74, 0.25, 1.00), (0.070, 78, 0.25, 0.90), (0.140, 81, 0.30, 0.85), (0.215, 86, 0.60, 0.75), (0.300, 90, 0.45, 0.50)]
    elif nome == "concluir_trilha":
        # fanfarra: motivo B A G resolvendo em Ré aberto
        notas = [
            (0.000, 83, 0.22, 1.00), (0.090, 81, 0.22, 0.85), (0.180, 79, 0.28, 0.85),
            (0.290, 76, 0.22, 0.85), (0.380, 81, 0.20, 0.90), (0.470, 85, 0.22, 0.90),
            (0.560, 88, 0.55, 0.85), (0.640, 86, 0.60, 0.80),
        ]
    elif nome == "conta_criada":
        # boas-vindas: arpejo de Ré subindo até a nona
        notas = [(0.000, 62, 0.35, 1.00), (0.090, 66, 0.30, 0.70), (0.170, 69, 0.30, 0.70), (0.250, 74, 0.55, 0.70), (0.330, 76, 0.45, 0.45)]
    elif nome == "geracao_pronta":
        notas = [(0.000, 74, 0.22, 1.00), (0.080, 81, 0.22, 0.85), (0.170, 86, 0.50, 0.65)]
    elif nome == "apagar":
        # sopro curto descendente: some, não castiga
        notas = [(0.000, 69, 0.16, 1.00), (0.050, 66, 0.14, 0.70)]
    elif nome == "entrar":
        notas = [(0.000, 69, 0.18, 1.00), (0.090, 74, 0.22, 0.85)]
    elif nome == "ponte_abrir":
        # arpejo que abre caminho
        notas = [(0.000, 74, 0.28, 1.00), (0.085, 78, 0.28, 0.85), (0.170, 81, 0.30, 0.75), (0.255, 86, 0.35, 0.55)]
    elif nome == "seguir":
        notas = [(0.000, 81, 0.18, 1.00), (0.045, 86, 0.20, 0.55)]
    elif nome == "valeu":
        notas = [(0.000, 78, 0.18, 1.00), (0.070, 81, 0.22, 0.80)]
    elif nome == "salvo":
        notas = [(0.000, 74, 0.16, 1.00), (0.060, 81, 0.20, 0.80)]
    elif nome == "link_copiado":
        notas = [(0.000, 88, 0.09, 1.00), (0.055, 93, 0.10, 0.70)]
    elif nome == "gravacao_inicio":
        notas = [(0.000, 74, 0.10, 1.00), (0.040, 81, 0.10, 0.55)]
    elif nome == "cronometro_fim":
        notas = [(0.000, 81, 0.12, 1.00), (0.140, 81, 0.12, 0.90), (0.280, 86, 0.45, 0.85)]
    elif nome == "erro_rede":
        notas = [(0.000, 62, 0.20, 1.00), (0.110, 57, 0.22, 0.85)]
    else:
        raise SystemExit(f"efeito desconhecido: {nome}")

    ALVOS = {"acerto": 0.48, "erro": 0.33, "concluir_licao": 0.82, "concluir_trilha": 1.25,
             "conta_criada": 0.80, "geracao_pronta": 0.62, "apagar": 0.26, "entrar": 0.28,
             "ponte_abrir": 0.42, "seguir": 0.24, "valeu": 0.26, "salvo": 0.24,
             "link_copiado": 0.16, "gravacao_inicio": 0.14, "cronometro_fim": 0.70,
             "erro_rede": 0.30}
    dur = ALVOS[nome]
    n = seg(dur)
    y = np.zeros(n)
    for ini, nota, d, amp in notas:
        f = midi_hz(nota)
        brilho = 0.7 if nome in ("erro", "erro_rede", "apagar") else 1.5
        s = malho(f, d * 1.6, 1.0, rng, brilho=brilho)
        s = s[: min(len(s), n - seg(ini))]
        y[seg(ini) : seg(ini) + len(s)] += s * amp
        # sino uma oitava acima, bem baixo, dá o brilho vivo
        g = sino(f * 2, min(d * 1.8, 0.5), 1.0, rng)[: n - seg(ini)]
        y[seg(ini) : seg(ini) + len(g)] += g * amp * 0.18
    if nome in ("concluir_licao", "concluir_trilha", "acerto", "conta_criada", "ponte_abrir"):
        y = reverb(np.stack([y, y], axis=1), rng, 0.16, 1.0)[:, 0]
    y = passa_alta(y, 90, 2)
    p = np.max(np.abs(y))
    if p > 0:
        y *= 0.84 / p  # -1,5 dBFS
    k = seg(0.005)
    if len(y) > 2 * k:
        y[-k:] *= np.linspace(1, 0, k)
    return y


# ---------------------------------------------------------------------------
# comandos
# ---------------------------------------------------------------------------

CLIMAS = ["foco_calmo", "chuva_suave", "lofi_estudo", "biblioteca", "brisa_natural"]
ARQUIVOS = {
    "foco_calmo": "foco-calmo.mp3",
    "chuva_suave": "chuva-suave.mp3",
    "lofi_estudo": "lofi-estudo.mp3",
    "biblioteca": "biblioteca.mp3",
    "brisa_natural": "brisa-natural.mp3",
}
EFEITOS = {
    "acerto": "acerto.wav",
    "erro": "erro.wav",
    "concluir_licao": "concluir-licao.wav",
    "concluir_trilha": "concluir-trilha.wav",
    "conta_criada": "conta-criada.wav",
    "geracao_pronta": "geracao-pronta.wav",
    "apagar": "apagar.wav",
    "entrar": "entrar.wav",
    "ponte_abrir": "ponte-abrir.wav",
    "seguir": "seguir.wav",
    "valeu": "valeu.wav",
    "salvo": "salvo.wav",
    "link_copiado": "link-copiado.wav",
    "gravacao_inicio": "gravacao-inicio.wav",
    "cronometro_fim": "cronometro-fim.wav",
    "erro_rede": "erro-rede.wav",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("alvo", choices=["musica", "efeitos"])
    ap.add_argument("--destino-demo", default="/tmp/audio-tools/demo")
    ap.add_argument("--raiz", default=".")
    ap.add_argument("--todos", action="store_true",
                    help="grava os cinco arranjos (o padrão grava só o lofi_estudo, o único que o app usa)")
    ap.add_argument("--destino-extras", default="/tmp/studoo-fundos",
                    help="pasta dos quatro arranjos não usados quando --todos")
    args = ap.parse_args()
    rng = np.random.default_rng(20261119)

    if args.alvo == "musica":
        for clima in CLIMAS:
            t = construir_trilha(clima, rng)
            print(f"[{clima}] {len(t.eventos)} eventos…", flush=True)
            mix, _ = render_trilha(t, rng)
            mix = reverb(mix, rng, 0.20 + (0.04 if clima in ("chuva_suave", "biblioteca") else 0.0))
            mix = master(mix)
            mix = fecha_laco(mix, seg(LOOP_S))
            wav_tmp = f"/tmp/trilha-{clima}.wav"
            escrever_wav(wav_tmp, mix)
            # O app usa só o Lo-fi (decisão do dono, spec 12): o padrão grava
            # apenas ele. Os outros quatro saem do pacote; para reouvir, use
            # --todos, que os grava em `--destino-extras`, fora do repositório.
            destino = None
            if clima == "lofi_estudo":
                destino = os.path.join(args.raiz, "public/sons/fundos", ARQUIVOS[clima])
                para_mp3(wav_tmp, destino, "80k")
                copia = os.path.join(args.raiz, "apps/mobile/assets/sons/fundos", ARQUIVOS[clima])
                os.makedirs(os.path.dirname(copia), exist_ok=True)
                subprocess.run(["cp", destino, copia], check=True)
            elif args.todos:
                destino = os.path.join(args.destino_extras, ARQUIVOS[clima])
                os.makedirs(args.destino_extras, exist_ok=True)
                para_mp3(wav_tmp, destino, "80k")
            if destino:
                os.makedirs(args.destino_demo, exist_ok=True)
                para_mp3(wav_tmp, os.path.join(args.destino_demo, ARQUIVOS[clima]), "128k")
                print(f"  -> {destino} ({os.path.getsize(destino)/1024:.0f} KB)", flush=True)
            else:
                print("  (fora do pacote: use --todos para gravar)", flush=True)
            os.remove(wav_tmp)

    else:
        for nome, arquivo in EFEITOS.items():
            print(f"[{nome}]", flush=True)
            y = efeito(nome, rng)
            for raiz in ("public/sons/sfx", "apps/mobile/assets/sons/sfx"):
                destino = os.path.join(args.raiz, raiz, arquivo)
                os.makedirs(os.path.dirname(destino), exist_ok=True)
                escrever_wav(destino, y[:, None])
            os.makedirs(args.destino_demo, exist_ok=True)
            escrever_wav(os.path.join(args.destino_demo, arquivo), y[:, None])
            print(f"  -> {arquivo} ({len(y)/SR*1000:.0f} ms)", flush=True)


if __name__ == "__main__":
    main()
