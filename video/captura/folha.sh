#!/usr/bin/env bash
# folha.sh <clipe> [colunas] [linhas]: folha de contato do clipe (quadros igualmente espaçados), para conferência.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
eval "$(node "$D/../ambiente.cjs" --sh)"
C="$1"; COLS="${2:-8}"; LINS="${3:-1}"; N=$((COLS*LINS))
Q=$(python3 -c "import json;print(json.load(open('$D/clipes/$C.json'))['quadros'])")
PASSO=$(python3 -c "print(max(1,($Q-1)//max(1,$N-1)))")
mkdir -p "$D/folhas"
"$STUDOO_FFMPEG" -y -loglevel error -i "$D/clipes/$C.mp4" -vf "select='not(mod(n\,$PASSO))',scale=-2:${ALT:-900},tile=${COLS}x${LINS}:padding=10:color=white" -frames:v 1 -q:v 3 "$D/folhas/$C.jpg"
echo "$D/folhas/$C.jpg ($Q quadros, 1 a cada $PASSO)"
