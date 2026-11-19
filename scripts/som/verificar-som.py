#!/usr/bin/env python3
"""
Verificação dos arquivos de som do Studoo (fundos e efeitos).

Mede o que o dono percebe e o que o alto-falante do celular entrega:
volume e pico, silêncio involuntário no começo, ataque, balanço de bandas,
presença na faixa do celular (400 Hz–4 kHz), peso (RMS), emenda do laço em
duas voltas e andamento estimado.

Uso:
    python3 scripts/som/verificar-som.py public/sons/fundos/*.mp3
    python3 scripts/som/verificar-som.py --laco public/sons/fundos/foco-calmo.mp3
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np

SR = 44100
FFMPEG = os.environ.get("FFMPEG", "/tmp/audio-tools/ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "/tmp/audio-tools/ffprobe")


def decodificar(caminho: str, sr: int = SR) -> np.ndarray:
    p = subprocess.run(
        [FFMPEG, "-v", "error", "-i", caminho, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True,
    )
    if p.returncode:
        raise RuntimeError(p.stderr.decode()[:300])
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)


def info(caminho: str) -> dict:
    p = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels:format=duration,size",
         "-of", "json", caminho],
        capture_output=True,
    )
    d = json.loads(p.stdout)
    st = (d.get("streams") or [{}])[0]
    fmt = d.get("format") or {}
    return {
        "codec": st.get("codec_name"),
        "sr": int(st.get("sample_rate") or 0),
        "ch": int(st.get("channels") or 0),
        "dur": float(fmt.get("duration") or 0),
        "bytes": int(fmt.get("size") or os.path.getsize(caminho)),
    }


def db(x: float) -> float:
    return 20 * math.log10(max(float(x), 1e-12))


def bandas(y: np.ndarray) -> dict[str, float]:
    N = 4096
    hop = 2048
    if len(y) < N:
        N = 1 << int(math.ceil(math.log2(max(len(y), 16))))
        hop = N // 2
    S = np.zeros(N // 2 + 1)
    k = 0
    for i in range(0, len(y) - N, hop):
        S += np.abs(np.fft.rfft(y[i : i + N] * np.hanning(N))) ** 2
        k += 1
    S /= max(k, 1)
    f = np.fft.rfftfreq(N, 1 / SR)
    tot = S.sum() + 1e-20
    faixas = [(0, 200), (200, 500), (500, 2000), (2000, 6000), (6000, 12000), (12000, 22050)]
    return {f"{a}-{b}": round(100 * S[(f >= a) & (f < b)].sum() / tot, 1) for a, b in faixas}


def passa_faixa(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    N = 1 << int(math.ceil(math.log2(len(x) + 1)))
    f = np.fft.rfftfreq(N, 1 / SR)
    mag = ((f >= lo) & (f <= hi)).astype(float)
    return np.fft.irfft(np.fft.rfft(x, N) * mag, N)[: len(x)]


def emenda(y: np.ndarray) -> dict:
    """Descontinuidade na virada do fim para o começo, comparada ao miolo."""
    if len(y) < SR:
        return {}
    passo = np.abs(np.diff(y))
    tipico = float(np.percentile(passo, 99.9))
    salto = abs(float(y[-1] - y[0]))
    k = int(0.05 * SR)
    rms_fim = math.sqrt(float(np.mean(y[-k:] ** 2)) + 1e-20)
    rms_ini = math.sqrt(float(np.mean(y[:k] ** 2)) + 1e-20)
    return {
        "salto": round(salto, 5),
        "salto_vs_tipico": round(salto / (tipico + 1e-12), 2),
        "fim_db": round(db(rms_fim), 1),
        "ini_db": round(db(rms_ini), 1),
        "delta_db": round(db(rms_fim) - db(rms_ini), 1),
    }


def andamento(y: np.ndarray) -> float:
    hop = 512
    n = len(y) // hop
    if n < 32:
        return 0.0
    env = np.sqrt(np.mean(y[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-20)
    env = np.maximum(np.diff(env), 0)
    env = env - env.mean()
    ac = np.correlate(env, env, "full")[len(env) - 1 :]
    fps = SR / hop
    lo, hi = int(fps * 60 / 200), int(fps * 60 / 45)
    hi = min(hi, len(ac))
    if hi <= lo + 1:
        return 0.0
    lag = lo + int(np.argmax(ac[lo:hi]))
    return round(60 * fps / lag, 1)


def bloco_lame(caminho: str) -> dict:
    """Lê atraso e enchimento do bloco LAME/Xing (o que o decodificador tira)."""
    import struct

    br1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
    sr1 = [44100, 48000, 32000, 0]
    d = open(caminho, "rb").read()
    i = 0
    if d[:3] == b"ID3":
        i = 10 + (((d[6] & 0x7F) << 21) | ((d[7] & 0x7F) << 14) | ((d[8] & 0x7F) << 7) | (d[9] & 0x7F))
    while i < len(d) - 4 and not (d[i] == 0xFF and (d[i + 1] & 0xE0) == 0xE0 and ((d[i + 1] >> 3) & 3) == 3 and ((d[i + 1] >> 1) & 3) == 1):
        i += 1
    h = d[i : i + 4]
    br, sr = br1[(h[2] >> 4) & 0xF] * 1000, sr1[(h[2] >> 2) & 3]
    if not br or not sr:
        return {}
    tam = int(144 * br / sr) + (h[2] & 1)
    corpo = d[i + 4 : i + tam]
    p = corpo.find(b"Xing")
    p = p if p >= 0 else corpo.find(b"Info")
    if p < 0:
        return {}
    quadros = struct.unpack(">I", corpo[p + 8 : p + 12])[0]
    lpos = corpo.find(b"LAME")
    lpos = lpos if lpos >= 0 else corpo.find(b"Lavc")
    if lpos < 0:
        return {}
    b = corpo[lpos + 21 : lpos + 24]
    v = (b[0] << 16) | (b[1] << 8) | b[2]
    return {"encoder": corpo[lpos : lpos + 9].decode("latin1"), "quadros": quadros,
            "delay": v >> 12, "padding": v & 0xFFF, "amostras": quadros * 1152}


def emenda_web(caminho: str, aparo: float = 0.026, decodificador_atraso: int = 529) -> dict:
    """Emenda como o toca-sons da web toca: loopStart = aparo, loopEnd = duração.

    Mede três casos: o buffer como o Chromium entrega (já sem o atraso do
    codificador, medido em `OfflineAudioContext`), o buffer de um navegador que
    mantenha o atraso, e o começo sem aparo (loopStart = 0).
    """
    y = decodificar(caminho)
    t = bloco_lame(caminho)
    extra = (t.get("amostras") or len(y)) - len(y)
    atraso = (t.get("delay", 576) + decodificador_atraso) if t else 1105
    if atraso > extra:
        atraso = extra // 2
    naivo = np.concatenate([np.zeros(atraso), y, np.zeros(max(0, extra - atraso))])

    def nivel(a):
        return round(db(math.sqrt(float(np.mean(a**2)) + 1e-20)), 1)

    def compasso1(buf, acima_db=-20.0):
        w = int(0.01 * SR)
        for i in range(0, len(buf) - w, w):
            if db(math.sqrt(float(np.mean(buf[i : i + w] ** 2)) + 1e-20)) > acima_db:
                return i
        return 0

    def caso(nome, buf, inicio_fixo=None):
        ini = int(round(aparo * SR)) if inicio_fixo is None else inicio_fixo
        fim = len(buf)
        passo = np.abs(np.diff(buf))
        tipico = float(np.percentile(passo, 99.9))
        salto = abs(float(buf[fim - 1] - buf[ini]))
        k = int(0.05 * SR)
        return {
            "caso": nome,
            "loopStart_ms": round(ini / SR * 1000, 2),
            "loop_s": round((fim - ini) / SR, 4),
            "amostras_de_musica_puladas": max(0, ini - atraso),
            "salto": round(salto, 5),
            "salto_vs_tipico": round(salto / (tipico + 1e-12), 2),
            "nivel_antes_db": nivel(buf[fim - k : fim]),
            "nivel_depois_db": nivel(buf[ini : ini + k]),
        }

    return {
        "arquivo": os.path.basename(caminho),
        "atraso_codificador": t.get("delay") if t else None,
        "enchimento_codificador": t.get("padding") if t else None,
        "atraso_no_buffer_medido": atraso,
        "compasso1_ms": round(compasso1(y) / SR * 1000, 2),
        "casos": [
            caso("Chromium (medido)", y),
            caso("navegador com atraso", naivo),
            caso("sem aparo", y, 0),
        ],
    }


def medir(caminho: str, laco: bool = False) -> dict:
    y = decodificar(caminho)
    i = info(caminho)
    a = np.abs(y)
    pico = float(a.max())
    rms = float(np.sqrt(np.mean(y**2)))
    # silêncio involuntário no começo (janelas de 1 ms abaixo de -60 dBFS)
    w = int(0.001 * SR)
    ini = 0
    while ini + w < len(y) and db(math.sqrt(float(np.mean(y[ini : ini + w] ** 2)))) < -60:
        ini += w
    # ataque: tempo até 90% do pico
    acima = np.flatnonzero(a > 0.9 * pico)
    ataque_ms = (acima[0] / SR * 1000) if len(acima) else float("nan")
    # presença no alto-falante do celular
    celular = passa_faixa(y, 400, 4000)
    rms_cel = float(np.sqrt(np.mean(celular**2)))
    r = {
        "arquivo": os.path.basename(caminho),
        "formato": f"{i['codec']} {i['sr']} Hz {'mono' if i['ch'] == 1 else f'{i[chr(99)+chr(104)]} canais'}",
        "dur_s": round(i["dur"], 2),
        "kb": round(i["bytes"] / 1024),
        "pico_db": round(db(pico), 1),
        "rms_db": round(db(rms), 1),
        "crista_db": round(db(pico) - db(rms), 1),
        "silencio_inicial_ms": round(ini / SR * 1000, 2),
        "ataque_ms": round(ataque_ms, 1) if ataque_ms == ataque_ms else None,
        "celular_rms_db": round(db(rms_cel), 1),
        "celular_delta_db": round(db(rms_cel) - db(rms), 1),
        "bandas_%": bandas(y),
        "andamento": andamento(y),
    }
    if laco:
        r["emenda"] = emenda(y)
        # duas voltas: a emenda acontece duas vezes, com o mesmo material
        duplo = np.concatenate([y, y])
        k = len(y)
        r["emenda_2a_volta"] = emenda(duplo[k - int(0.05 * SR) : k + int(0.05 * SR)])
    return r


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return
    if "--laco-web" in sys.argv:
        for caminho in args:
            print(json.dumps(emenda_web(caminho), ensure_ascii=False))
        return
    for caminho in args:
        print(json.dumps(medir(caminho, laco=True), ensure_ascii=False))


if __name__ == "__main__":
    main()
