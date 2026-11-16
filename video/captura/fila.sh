#!/usr/bin/env bash
# fila.sh <roteiro> [...]: roda os roteiros de captura em sequência, cada um com o seu log (log-<roteiro>.txt).
cd "$(dirname "$0")"
eval "$(node ../ambiente.cjs --sh)"
for r in "$@"; do
  STUDOO_VERBOSO=1 timeout 1500 "$STUDOO_NODE" "cenas/$r.cjs" > "log-$r.txt" 2>&1
  echo "exit=$?" >> "log-$r.txt"
done
echo fim > log-fila.txt
