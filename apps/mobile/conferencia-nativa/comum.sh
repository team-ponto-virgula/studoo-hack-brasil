#!/usr/bin/env bash
# O que a conferência nativa do iPhone (ios.sh) e a do Android (android.sh) têm em comum: as pastas, as utilidades, a API
# do repositório nesta máquina (banco, build, HTTPS e dados), o Maestro, o Metro com a cache, os três fluxos e a coleta.
# Cada script define TITULO_DA_CONFERENCIA antes de carregar este arquivo, e as funções `dispositivo` e
# `capturar_tela_do_aparelho`, que os fluxos usam.
#
# Nada daqui fala com o site publicado nem usa segredo: a API é a do repositório, na própria máquina, com IA simulada e
# uma conta sintética cuja senha é sorteada a cada execução.
#
# Roda no bash 3.2 do macOS e no bash do Ubuntu: sem recursos do bash 4 (mapfile, vetores associativos) e sem `timeout`.

TITULO_DA_CONFERENCIA="${TITULO_DA_CONFERENCIA:-Conferência nativa}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
AQUI="$RAIZ/apps/mobile/conferencia-nativa"
SAIDA="${CONFERENCIA_SAIDA:-${RUNNER_TEMP:-/tmp}/conferencia}"
REGISTROS="$SAIDA/registros"
FERRAMENTAS="$SAIDA/ferramentas"
TLS="$SAIDA/tls"
DADOS="$SAIDA/dados"
CAPTURAS="$SAIDA/capturas"
SAIDA_MAESTRO="$SAIDA/maestro"
MAESTRO="$FERRAMENTAS/maestro/bin/maestro"

API="https://127.0.0.1:3443"
PORTA_API=3443
PORTA_WEB=3000
# O app abre o Metro pela porta 8081, onde fica a cache dos pacotes (servidor/cache-do-metro.mjs); o Metro fica na 8082.
PORTA_METRO=8081
PORTA_METRO_INTERNA=8082

# O que o percurso inteiro deve produzir. `coletar` acusa a captura que faltar.
CAPTURAS_ESPERADAS="
01-entrada-em-repouso 02-entrada-email-em-foco 03-entrada-senha-em-foco 04-entrada-preenchida 05-depois-de-entrar
10-mapa-da-trilha 11-mapa-rolado-sob-a-barra 12-mapa-rolado-mais
20-minhas-trilhas 21-minhas-trilhas-rolada 22-menu-aberto 23-confirmacao-de-apagar
30-exercicio-ordenar 30-exercicio-ordenar-abaixo 31-exercicio-associar 31-exercicio-associar-abaixo
32-exercicio-multipla-escolha 32-exercicio-multipla-escolha-abaixo 33-exercicio-verdadeiro-falso 33-exercicio-verdadeiro-falso-abaixo
34-exercicio-lacuna 34-exercicio-lacuna-abaixo 35-exercicio-aberta 35-exercicio-aberta-abaixo
40-explorar 41-explorar-rolado 50-perfil 51-perfil-rolado 55-perfil-privacidade 56-excluir-conta-confirmacao 57-excluir-conta-digitado
60-configuracoes 61-bloquear-confirmacao 61-bloquear-aviso 62-denuncia-motivo 62-denuncia-protocolo 63-perfil-ajuda
70-exemplo-curto-etapa-2 71-exemplo-curto-etapa-3 72-exemplo-longo-etapa-2 73-exemplo-longo-lido 74-exemplo-longo-etapa-3
80-ilha-nova-trilha 81-ilha-nova-trilha-fim 82-ilha-minhas-trilhas-fim 83-ilha-ultimo-toque
90-criacao-pedido 91-criacao-em-andamento 92-criacao-pronta 93-criacao-primeira-aula 94-criacao-mapa-ao-voltar
95-resposta-exercicio 96-resposta-errada 97-resposta-certa
98-ponte-passo-1 98-ponte-desafio 99-ensine-explicacao-escrita 99-ensine-retorno-do-stu
"

# Os fluxos do Maestro; o Android usa uma cópia com o pacote e o link do app dele.
PASTA_DOS_FLUXOS="$AQUI/fluxos"

mkdir -p "$REGISTROS" "$FERRAMENTAS" "$TLS" "$DADOS" "$CAPTURAS" "$SAIDA_MAESTRO"

# ---------------------------------------------------------------------------------------------------------------------
# Utilidades

# Uma linha no sumário da execução (ou na saída, fora do GitHub Actions).
resumo() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"; fi
  printf '%s\n' "$1"
}

# Falha legível: anotação de erro, linha no sumário e saída 1.
erro() {
  # Na saída de erro: dentro de $(...) a saída comum seria engolida, e o GitHub lê as anotações das duas.
  printf '::error title=%s::%s\n' "$TITULO_DA_CONFERENCIA" "$1" >&2
  resumo "❌ **$1**" >&2
  exit 1
}

aviso() {
  printf '::warning title=%s::%s\n' "$TITULO_DA_CONFERENCIA" "$1"
  resumo "⚠️ $1"
}

# O fim de um registro, dobrado no log do passo.
mostrar_registro() {
  echo "::group::Fim de $(basename "$1")"
  tail -n "${2:-80}" "$1" 2>/dev/null || echo "(registro vazio ou ausente)"
  echo "::endgroup::"
}

# Espera um endereço responder com sucesso. Uso: esperar_http <url> <segundos> [opções do curl]
esperar_http() {
  local url="$1" limite="$2" passados=0
  shift 2
  while [ "$passados" -lt "$limite" ]; do
    if curl -sf -m 5 -o /dev/null "$@" "$url"; then return 0; fi
    sleep 1
    passados=$((passados + 1))
  done
  return 1
}

# O macOS não tem `timeout` (o perl existe nos dois sistemas). Uso: com_limite <segundos> <comando...>
com_limite() {
  local limite="$1"
  shift
  perl -e 'alarm shift; exec @ARGV or die "exec: $!"' "$limite" "$@"
}

conferir_sha256() {
  local arquivo="$1" esperado="$2" obtido
  obtido="$(shasum -a 256 "$arquivo" | awk '{print $1}')"
  if [ "$obtido" != "$esperado" ]; then
    erro "O arquivo $(basename "$arquivo") não confere com o sha256 fixado (esperado $esperado, veio $obtido)."
  fi
}

# Largura × altura de um PNG (os bytes 16 a 23, no cabeçalho IHDR), nos dois sistemas: o sips só existe no macOS.
tamanho_png() {
  local hexa
  hexa="$(od -An -tx1 -j16 -N8 "$1" 2> /dev/null | tr -d ' \n')"
  if [ "${#hexa}" -ne 16 ]; then echo "? × ?"; return; fi
  echo "$((16#${hexa:0:8})) × $((16#${hexa:8:8}))"
}

# Lê uma chave do .env da raiz (o arquivo é gerado aqui; os valores não têm aspas nem espaços).
do_env() {
  awk -F= -v chave="$1" '$1 == chave { print substr($0, length(chave) + 2); exit }' "$RAIZ/.env"
}

# ---------------------------------------------------------------------------------------------------------------------
# servidor: a API do repositório nesta máquina, atrás de HTTPS, com IA simulada e dados de demonstração

# O OpenSSL da receita é o 3 ou mais novo (-noenc, -copy_extensions). No macOS, o /usr/bin/openssl é LibreSSL: vale
# o do Homebrew quando existir; senão, o primeiro do PATH.
OPENSSL="openssl"
for candidato in /opt/homebrew/opt/openssl@3/bin/openssl /opt/homebrew/opt/openssl/bin/openssl /usr/local/opt/openssl@3/bin/openssl; do
  if [ -x "$candidato" ]; then OPENSSL="$candidato"; break; fi
done

# CA e certificado de loopback. Devolve falha se qualquer comando do openssl falhar.
gerar_certificado() {
  "$OPENSSL" req -x509 -newkey rsa:2048 -sha256 -days 2 -noenc -subj "/CN=Studoo Conferencia CA" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -keyout "$TLS/ca.key" -out "$TLS/ca.crt" || return 1
  "$OPENSSL" req -new -newkey rsa:2048 -noenc -subj "/CN=127.0.0.1" \
    -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature,keyEncipherment" -addext "extendedKeyUsage=serverAuth" \
    -keyout "$TLS/local.key" -out "$TLS/local.csr" || return 1
  "$OPENSSL" x509 -req -sha256 -days 2 -copy_extensions copy -in "$TLS/local.csr" \
    -CA "$TLS/ca.crt" -CAkey "$TLS/ca.key" -CAcreateserial -out "$TLS/local.crt" || return 1
  "$OPENSSL" verify -CAfile "$TLS/ca.crt" "$TLS/local.crt"
}

servidor() {
  local senha_banco senha_conta pid passados=0
  cd "$RAIZ"

  # 1. Ambiente do piloto local, como o `db:local` espera, mais o que o app pede (sessão do app, compartilhar, comunidade).
  if [ ! -f .env ]; then
    senha_banco="$("$OPENSSL" rand -hex 24)"
    senha_conta="$("$OPENSSL" rand -hex 12)"
    echo "::add-mask::$senha_conta"
    echo "::add-mask::$senha_banco"
    (
      umask 077
      {
        echo "DATABASE_URL=postgresql://studoo:${senha_banco}@127.0.0.1:55432/studoo_local"
        echo "STUDOO_ORIGEM=$API"
        echo "STUDOO_DOMINIO_EMAIL=example.test"
        echo "STUDOO_EMAIL=piloto@example.test"
        echo "STUDOO_SENHA=${senha_conta}"
        echo "STUDOO_CHAVE_ASSINATURA=$("$OPENSSL" rand -hex 32)"
        echo "STUDOO_SESSAO_MOBILE_PILOTO=1"
        echo "STUDOO_PROXY_HTTPS=1"
        echo "STUDOO_COMPARTILHAR=1"
        echo "STUDOO_COMUNIDADE=1"
        echo "STUDOO_COMUNIDADE_DEMO=1"
        # A pausa entre os eventos da IA falsa só vale na geração ao vivo (src/servidor/ia/falsa.ts: `aoVivo ? pausa : 0`),
        # que só a prova da criação (fluxo 90) usa; o preparo dos dados pede a proposta de uma vez (aoVivo: false). Com 0, a
        # trilha de frações (10 eventos) ficava pronta antes de o driver do iPhone ler a tela (~10 s por leitura na execução
        # 45071340280) e a faixa da geração nunca era vista; com 1500, a geração dura uns 15 s.
        echo "STUDOO_IA_FALSA_PAUSA_MS=1500"
        echo "IA=falsa"
        echo "EMAIL=falso"
      } > .env
    )
  fi

  # 2. CA e certificado de loopback, válidos por dois dias (a receita de docs/RODAR-LOCALMENTE.md). O simulador do iPhone
  #    recebe a CA; no Android, ela vai para dentro do build de debug (plugins/with-android-piloto-ca.cjs).
  echo "::group::Certificado local"
  gerar_certificado || erro "O certificado local não foi gerado ($("$OPENSSL" version 2> /dev/null || echo 'sem openssl')). A receita pede OpenSSL 3 ou mais novo."
  echo "::endgroup::"

  # 3. Banco: PostgreSQL embutido, migrações e conta sintética. O `db:local` fica rodando.
  nohup npm run db:local > "$REGISTROS/banco.log" 2>&1 < /dev/null &
  pid=$!
  until grep -q "PostgreSQL local pronto" "$REGISTROS/banco.log" 2> /dev/null; do
    if ! kill -0 "$pid" 2> /dev/null; then
      mostrar_registro "$REGISTROS/banco.log"
      erro "O banco local não subiu: \`npm run db:local\` terminou antes de ficar pronto."
    fi
    if [ "$passados" -ge 300 ]; then
      mostrar_registro "$REGISTROS/banco.log"
      erro "O banco local não ficou pronto em 5 minutos."
    fi
    sleep 1
    passados=$((passados + 1))
  done
  echo "Banco local pronto em ${passados}s."

  # 4. Build e servidor de produção. EMAIL=resend sem chave deixa a recuperação de senha desligada, como no site: a
  #    entrada fica com os mesmos itens que o dono vê.
  if ! npm run build > "$REGISTROS/build.log" 2>&1; then
    mostrar_registro "$REGISTROS/build.log" 120
    erro "O build da web (\`npm run build\`) falhou; sem ele não há API para o app."
  fi
  EMAIL=resend nohup npm start > "$REGISTROS/servidor.log" 2>&1 < /dev/null &
  if ! esperar_http "http://localhost:$PORTA_WEB/api/saude" 120; then
    mostrar_registro "$REGISTROS/servidor.log"
    erro "O servidor (\`npm start\`) não respondeu em /api/saude em 2 minutos."
  fi

  # 5. HTTPS na frente do servidor: o app só aceita API em HTTPS.
  nohup node "$AQUI/servidor/proxy-https.mjs" --cert "$TLS/local.crt" --chave "$TLS/local.key" \
    --porta "$PORTA_API" --destino "http://localhost:$PORTA_WEB" > "$REGISTROS/proxy.log" 2>&1 < /dev/null &
  if ! esperar_http "$API/api/auth/config" 30 --cacert "$TLS/ca.crt"; then
    mostrar_registro "$REGISTROS/proxy.log"
    erro "O proxy HTTPS não respondeu em $API."
  fi
  echo "Configuração de acesso que o app vai ler: $(curl -sf -m 10 --cacert "$TLS/ca.crt" "$API/api/auth/config")"

  # 6. Dados: a comunidade de demonstração (Explorar) e a conta sintética com uma trilha por formato de exercício.
  if ! npm run comunidade:demo > "$REGISTROS/comunidade-demo.log" 2>&1; then
    mostrar_registro "$REGISTROS/comunidade-demo.log"
    erro "O conteúdo de demonstração da comunidade não foi criado (\`npm run comunidade:demo\`)."
  fi
  if ! NODE_EXTRA_CA_CERTS="$TLS/ca.crt" node --env-file=.env --import tsx "$AQUI/servidor/preparar-dados.mjs" \
    --api "$API" --saida "$DADOS" > "$REGISTROS/preparar-dados.log" 2>&1; then
    mostrar_registro "$REGISTROS/preparar-dados.log"
    erro "O preparo dos dados falhou: $(tail -n 1 "$REGISTROS/preparar-dados.log")"
  fi
  cat "$REGISTROS/preparar-dados.log"
  aquecer_servidor
  iniciar_amostra_de_carga

  resumo "**Dados da conta sintética** (trilha de cada formato de exercício e a lição em que ela está):"
  resumo ""
  resumo '```'
  resumo "$(grep -E '^(- |Destaque|AVISO)' "$REGISTROS/preparar-dados.log" || true)"
  resumo '```'
  resumo ""
}

# Aquecimento: duas voltas nas rotas que os fluxos usam logo de cara, para o primeiro pedido de cada uma não pagar o
# carregamento do módulo (sem sessão: a resposta é 401, mas a rota já carrega). O tempo de cada pedido fica em
# aquecimento.log, e a linha do proxy.log onde os fluxos começam, em proxy-inicio-dos-fluxos.txt (resumir_proxy só conta
# dali em diante).
aquecer_servidor() {
  local volta rota tempo
  for volta in 1 2; do
    for rota in /api/auth/config /api/sessao /api/aprendizado/planos /api/perfil /api/privacidade /api/explorar /api/bloqueios /api/perfil/novidades; do
      tempo="$(curl -s -o /dev/null -m 30 -w '%{http_code} %{time_total}s' --cacert "$TLS/ca.crt" "$API$rota" 2> /dev/null || echo 'sem resposta')"
      echo "volta $volta $rota $tempo" >> "$REGISTROS/aquecimento.log"
    done
  done
  wc -l < "$REGISTROS/proxy.log" | tr -d ' ' > "$REGISTROS/proxy-inicio-dos-fluxos.txt"
  echo "Servidor aquecido: $(wc -l < "$REGISTROS/aquecimento.log" | tr -d ' ') pedidos (aquecimento.log)."
}

# Diagnóstico das travadas do servidor local (Lead, 23/11): a cada 10 s, até o fim do job, a carga da máquina, a memória
# livre e os 8 processos que mais usam CPU (pid, %CPU, memória residente em MB, nome), numa linha só, com a hora UTC, em
# carga-dos-processos.log. A hora casa com a do proxy.log. Roda nos dois sistemas (ps do macOS e do Linux) e não para
# nada se falhar.
iniciar_amostra_de_carga() {
  local registro="$REGISTROS/carga-dos-processos.log"
  echo "hora UTC | carga 1/5/15 min | memória | 8 processos com mais CPU: pid %CPU MB nome" > "$registro"
  (
    set +e +o pipefail
    while :; do
      if [ "$(uname)" = Darwin ]; then
        carga="$(sysctl -n vm.loadavg 2> /dev/null | tr -d '{}' | xargs)"
        memoria="$(memory_pressure -Q 2> /dev/null | sed -n 's/.*free percentage: *//p') livre"
        processos="$(ps -Ao pid=,pcpu=,rss=,comm= -r 2> /dev/null | head -8)"
      else
        carga="$(cut -d' ' -f1-3 /proc/loadavg 2> /dev/null)"
        memoria="$(free -m 2> /dev/null | awk '/^Mem:/ { print $7 " MB disponíveis" }')"
        processos="$(ps -eo pid=,pcpu=,rss=,comm= --sort=-pcpu 2> /dev/null | head -8)"
      fi
      printf '%s | %s | %s | %s\n' "$(date -u +%H:%M:%S)" "$carga" "$memoria" \
        "$(printf '%s\n' "$processos" | awk '{ n = $4; for (i = 5; i <= NF; i++) n = n " " $i; sub(/.*\//, "", n); printf "%s %s%% %dMB %s; ", $1, $2, $3 / 1024, n }')"
      sleep 10
    done
  ) >> "$registro" 2>&1 < /dev/null &
  echo "Amostra de carga dos processos a cada 10 s em carga-dos-processos.log (pid $!)."
}

# Uma linha no resumo com a saúde do servidor local durante os fluxos, pelo proxy.log (cada linha: hora, método, caminho,
# código e "<n>ms" no fim; o 502 do proxy diz "(servidor fora do ar)", e o 499, que o app desistiu): quantos 5xx (com os
# horários), quantos 499, quantos pedidos acima de 3 s e o mais lento. Serve para separar a instabilidade da máquina de um defeito do app.
resumir_proxy() {
  local registro="$REGISTROS/proxy.log" inicio linha
  [ -f "$registro" ] || return 0
  inicio="$(cat "$REGISTROS/proxy-inicio-dos-fluxos.txt" 2> /dev/null || echo 0)"
  # A linha pode começar pela hora (proxy-https.mjs desde 23/11): "01:23:45.678 GET /api/sessao 200 12ms".
  linha="$(tail -n +"$((inicio + 1))" "$registro" | awk '
    { hora = ""; if ($1 ~ /^[0-9][0-9]:[0-9][0-9]:/) { hora = $1; $1 = ""; $0 = $0 } }
    $1 ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/ {
      total++
      if ($3 ~ /^5[0-9][0-9]$/) { cinco++; if (hora != "" && cinco <= 6) horas = horas (horas == "" ? "" : ", ") hora }
      if ($3 == "499") desistiu++
      ms = $NF; sub(/ms$/, "", ms); ms += 0
      if (ms > 3000) lentos++
      if (ms > maximo) { maximo = ms; lento = $1 " " $2 (hora != "" ? " às " hora : "") }
    }
    END {
      printf "%d pedidos, %d com 5xx%s, %d desistidos pelo app (499), %d acima de 3 s (o mais lento: %d ms, %s)", total, cinco, horas != "" ? " (" horas ")" : "", desistiu, lentos, maximo, lento
    }')"
  resumo "Servidor local durante os fluxos (proxy.log, depois do aquecimento): $linha. A carga de cada processo, a cada 10 s, está em carga-dos-processos.log."
}

# ---------------------------------------------------------------------------------------------------------------------
# maestro: baixa a versão fixada e confere

instalar_maestro() {
  : "${MAESTRO_VERSAO:?falta MAESTRO_VERSAO}" "${MAESTRO_SHA256:?falta MAESTRO_SHA256}"
  local endereco="https://github.com/mobile-dev-inc/Maestro/releases/download/cli-${MAESTRO_VERSAO}/maestro.zip"
  curl -fsSL --retry 3 -o "$FERRAMENTAS/maestro.zip" "$endereco" || erro "Não deu para baixar o Maestro $MAESTRO_VERSAO."
  conferir_sha256 "$FERRAMENTAS/maestro.zip" "$MAESTRO_SHA256"
  rm -rf "$FERRAMENTAS/maestro"
  unzip -q -o "$FERRAMENTAS/maestro.zip" -d "$FERRAMENTAS" || erro "O arquivo do Maestro $MAESTRO_VERSAO não abriu (unzip)."
  rm -f "$FERRAMENTAS/maestro.zip"
  chmod +x "$MAESTRO" || erro "O Maestro $MAESTRO_VERSAO veio sem o executável esperado (maestro/bin/maestro)."
  MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=true "$MAESTRO" --version || erro "O Maestro $MAESTRO_VERSAO não rodou nesta máquina (precisa de Java 17 ou mais novo)."
}

# ---------------------------------------------------------------------------------------------------------------------
# metro: serve o app e compila o pacote antes de o aparelho pedir. Uso: iniciar_metro <ios|android> <--go|--dev-client>

iniciar_metro() {
  local plataforma="$1" modo="$2" manifesto pacote medida
  cd "$RAIZ/apps/mobile"
  # O Expo embute as variáveis EXPO_PUBLIC_ no pacote. O .env.local é ignorado pelo Git. EXPO_PUBLIC_STUDOO_REGISTRO_SOM
  # pede ao app, se ele souber, que registre cada som ("[som] comando <id> <ms>" e "[som] reproducao <id> <ms>"), para a
  # linha do tempo da criação de trilha (servidor/linha-do-tempo-som.mjs); um app que não lê a variável não muda nada.
  printf 'EXPO_PUBLIC_STUDOO_API_URL=%s\nEXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI=studoo-dev://auth/google\nEXPO_PUBLIC_STUDOO_REGISTRO_SOM=1\n' "$API" > .env.local

  # Sem modo de desenvolvimento e minificado, como o servidor que o dono usa no iPhone dele: sem avisos de
  # desenvolvimento por cima das telas. EXPO_PACKAGER_PROXY_URL faz o manifesto apontar para a cache, e não para o Metro.
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_PACKAGER_PROXY_URL="http://127.0.0.1:$PORTA_METRO" \
    EXPO_PUBLIC_STUDOO_API_URL="$API" EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI="studoo-dev://auth/google" EXPO_PUBLIC_STUDOO_REGISTRO_SOM=1 \
    nohup npx expo start "$modo" --localhost --port "$PORTA_METRO_INTERNA" --no-dev --minify --max-workers 2 > "$REGISTROS/metro.log" 2>&1 < /dev/null &
  if ! esperar_http "http://127.0.0.1:$PORTA_METRO_INTERNA/status" 180; then
    mostrar_registro "$REGISTROS/metro.log"
    erro "O Metro (\`expo start\`) não subiu na porta $PORTA_METRO_INTERNA em 3 minutos."
  fi

  # A cache na frente do Metro: a cada abertura, o Expo Go pede o pacote de novo, e o Metro o refazia (7 a 73 s com o
  # bytecode do Hermes; um pedido passou do tempo do Expo Go na execução 44511779137).
  nohup node "$AQUI/servidor/cache-do-metro.mjs" --porta "$PORTA_METRO" --destino "$PORTA_METRO_INTERNA" \
    > "$REGISTROS/cache-do-metro.log" 2>&1 < /dev/null &
  if ! esperar_http "http://127.0.0.1:$PORTA_METRO/status" 30; then
    mostrar_registro "$REGISTROS/cache-do-metro.log"
    erro "A cache na frente do Metro não respondeu na porta $PORTA_METRO."
  fi

  manifesto="$(curl -sf -m 60 -H "expo-platform: $plataforma" -H 'accept: application/expo+json,application/json' "http://127.0.0.1:$PORTA_METRO/")" || {
    mostrar_registro "$REGISTROS/metro.log"
    erro "O Metro não entregou o manifesto do app ($plataforma)."
  }
  printf '%s\n' "$manifesto" > "$REGISTROS/manifesto-$plataforma.json"
  pacote="$(printf '%s' "$manifesto" | jq -r '.launchAsset.url // empty' 2> /dev/null || true)"
  [ -n "$pacote" ] || erro "O manifesto do Expo veio sem o endereço do pacote (launchAsset.url). Veja manifesto-$plataforma.json nos registros."
  echo "Pacote: $pacote"
  case "$pacote" in
    "http://127.0.0.1:$PORTA_METRO/"*) ;;
    *) aviso "O manifesto aponta o pacote para fora da cache ($pacote): cada abertura vai esperar o Metro refazer o pacote." ;;
  esac

  # Compila agora, com tempo de sobra, para o app abrir rápido no aparelho. Se o código não compilar, o erro aparece aqui.
  if ! medida="$(curl -sf -m 900 -o "$FERRAMENTAS/pacote-$plataforma" -w '%{size_download} bytes em %{time_total}s' "$pacote")"; then
    echo "::group::Resposta do Metro ao pedido do pacote"
    curl -s -m 300 "$pacote" | head -c 4000 || true
    echo
    echo "::endgroup::"
    mostrar_registro "$REGISTROS/metro.log" 120
    erro "O pacote do app ($plataforma) não compilou no Metro. O erro está no passo do Metro e em metro.log."
  fi
  echo "Pacote do app ($plataforma) compilado: $medida."
  rm -f "$FERRAMENTAS/pacote-$plataforma"
  if [ "$modo" = --go ]; then aquecer_assinatura "$plataforma" "$manifesto"; fi
}

# O Expo Go pede o manifesto com `expo-expect-signature: …keyid="expo-root"…`. No primeiro pedido assim, o Expo CLI
# (@expo/cli 58.1.21, build/src/utils/codesigning.js, DevelopmentCodeSigningInfoFile.readAsync) não acha
# ~/.expo/codesigning/<projectId>/development-code-signing-settings-2.json e grava os padrões com o @expo/json-file, que
# escreve num temporário de nome `<arquivo>.<sha256 do conteúdo>` e o renomeia (build/writeAtomic.js, getTarget). Dois
# pedidos juntos gravam o mesmo conteúdo no MESMO temporário: o primeiro renomeia e o segundo dá ENOENT no rename, e o
# Metro responde 500 ao Expo Go, que fica no splash (execuções 44923807240 e 44926124145; o sufixo do temporário é o
# mesmo nas duas porque o conteúdo é o mesmo). Aqui o mesmo pedido vai antes, um de cada vez, pela cache da 8081, para o
# arquivo já existir quando o Expo Go abrir; se ainda faltar, ele é criado com os mesmos padrões (só leitura depois).
aquecer_assinatura() {
  local plataforma="$1" manifesto="$2" projeto casa arquivo codigo=000 tentativa
  projeto="$(printf '%s' "$manifesto" | jq -r '.extra.eas.projectId // empty' 2> /dev/null || true)"
  if [ -z "$projeto" ]; then
    projeto="$(jq -r '.expo.extra.eas.projectId // empty' "$RAIZ/apps/mobile/app.json" 2> /dev/null || true)"
  fi
  casa="${__UNSAFE_EXPO_HOME_DIRECTORY:-$HOME/.expo}"
  for tentativa in 1 2 3; do
    codigo="$(curl -s -o /dev/null -m 60 -w '%{http_code}' -H "expo-platform: $plataforma" \
      -H 'accept: application/expo+json,application/json' \
      -H 'expo-expect-signature: sig, keyid="expo-root", alg="rsa-v1_5-sha256"' \
      "http://127.0.0.1:$PORTA_METRO/" || true)"
    [ "$codigo" = 200 ] && break
    sleep 2
  done
  if [ -z "$projeto" ]; then
    resumo "⚠️ Aquecimento da assinatura do manifesto: sem o projectId do EAS no manifesto, o arquivo de assinatura não é conferido (pedido assinado: HTTP $codigo)."
    return 0
  fi
  arquivo="$casa/codesigning/$projeto/development-code-signing-settings-2.json"
  if [ "$codigo" = 200 ] && [ -s "$arquivo" ]; then
    resumo "✅ Aquecimento da assinatura do manifesto: o pedido do Expo Go (expo-expect-signature) respondeu 200 em $tentativa tentativa(s) e o arquivo de assinatura já existe antes de abrir o Expo Go."
  else
    mkdir -p "$(dirname "$arquivo")"
    if [ ! -s "$arquivo" ]; then
      printf '{\n  "easProjectId": null,\n  "scopeKey": null,\n  "privateKey": null,\n  "certificateChain": null\n}\n' > "$arquivo"
    fi
    resumo "⚠️ Aquecimento da assinatura do manifesto: o pedido do Expo Go respondeu HTTP $codigo; o arquivo de assinatura foi criado aqui com os padrões do Expo CLI para o Expo Go não disputar a gravação."
    mostrar_registro "$REGISTROS/metro.log" 40
  fi
}

# ---------------------------------------------------------------------------------------------------------------------
# Fluxos do Maestro

# Uso: rodar_maestro <fase> <arquivo ou pasta> [opções do `maestro test`]. Cada sistema define `dispositivo` (o
# identificador que o Maestro usa) e `capturar_tela_do_aparelho <arquivo>`.
rodar_maestro() {
  local fase="$1" alvo="$2" codigo linha
  local parametros=()
  shift 2
  [ -x "$MAESTRO" ] || erro "O Maestro não está instalado: o passo dele não rodou."

  parametros=(-e "EMAIL=$(do_env STUDOO_EMAIL)" -e "SENHA=$(do_env STUDOO_SENHA)")
  if [ -f "$DADOS/parametros-dos-fluxos.txt" ]; then
    while IFS= read -r linha; do
      if [ -n "$linha" ]; then parametros+=(-e "$linha"); fi
    done < "$DADOS/parametros-dos-fluxos.txt"
  fi

  set +e
  MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true \
    MAESTRO_DRIVER_STARTUP_TIMEOUT=240000 \
    "$MAESTRO" --device "$(dispositivo)" test --test-output-dir "$SAIDA_MAESTRO/$fase" \
    "${parametros[@]}" "$@" "$alvo" 2>&1 | tee "$REGISTROS/maestro-$fase.log"
  codigo=${PIPESTATUS[0]}
  set -e

  # O driver do Maestro às vezes morre na partida, antes do primeiro comando (execução 44920181903, Android: "Server
  # running on port [37701]" e, 0,3 s depois, "Failed to bind to address [::]:37701" no gRPC do próprio driver, e o
  # Maestro desiste com DeviceServerDiedException em 'deviceInfo'). Não é o app nem o fluxo: o fluxo roda de novo uma vez,
  # com o driver parado e os encaminhamentos dele desfeitos (limpar_driver_maestro, do android.sh; o adb reverse fica).
  if [ "$codigo" -ne 0 ] && [ -z "${MAESTRO_JA_REPETIU:-}" ] \
    && grep -qE "DeviceServerDiedException|Failed to bind to address|Device server died" "$REGISTROS/maestro-$fase.log"; then
    resumo "⚠️ O driver do Maestro caiu na partida da fase \`$fase\` (antes do primeiro comando); a fase rodou de novo uma vez."
    cp "$REGISTROS/maestro-$fase.log" "$REGISTROS/maestro-$fase-primeira-tentativa.log"
    if declare -F limpar_driver_maestro > /dev/null; then limpar_driver_maestro; fi
    sleep 5
    MAESTRO_JA_REPETIU=1 rodar_maestro "$fase" "$alvo" "$@"
    return $?
  fi

  # A tela do aparelho no fim da fase: mostra onde parou, com ou sem falha. (Do passo que falha, o Maestro guarda
  # também a árvore de elementos, na saída dele: é com ela que se corrige um seletor.)
  capturar_tela_do_aparelho "$REGISTROS/tela-no-fim-de-$fase.png"
  return "$codigo"
}

# A fase falhou na ABERTURA do app (antes da tela de entrada): a espera de partes/abrir-pela-primeira-vez.yaml, pela
# entrada, pelo menu do Expo Go ou pela janela de erro, deu falso. É a cara do 500 do manifesto (o Expo Go para no
# splash). Falhas depois da entrada (um seletor, um texto) não contam.
falhou_na_abertura() {
  grep -qE "Assertion is false: id: titulo-entrada" "$REGISTROS/maestro-$1.log" 2> /dev/null
}
quinhentos_no_metro() {
  grep -c "HTTP response error 500" "$REGISTROS/metro.log" 2> /dev/null || true
}

# Roda a fase; se ela falhar na abertura do app, para o Expo Go e roda de novo UMA vez. A repetição sempre aparece no
# resumo com ⚠️ (com o 500 do Metro, se houver), mesmo quando a segunda tentativa passa.
rodar_com_abertura_repetida() {
  local fase="$1" fluxo="$2" antes depois
  antes="$(quinhentos_no_metro)"
  if rodar_maestro "$fase" "$fluxo"; then return 0; fi
  falhou_na_abertura "$fase" || return 1
  depois="$(quinhentos_no_metro)"
  resumo "⚠️ A fase \`$fase\` falhou na abertura do app (a entrada não apareceu; respostas 500 do Metro ao Expo Go nesta fase: $(( ${depois:-0} - ${antes:-0} ))). O Expo Go foi parado e a fase rodou de novo uma vez; a primeira tentativa está em maestro-$fase-primeira-tentativa.log e tela-no-fim-de-$fase-primeira-tentativa.png."
  cp "$REGISTROS/maestro-$fase.log" "$REGISTROS/maestro-$fase-primeira-tentativa.log"
  cp "$REGISTROS/tela-no-fim-de-$fase.png" "$REGISTROS/tela-no-fim-de-$fase-primeira-tentativa.png" 2> /dev/null || true
  if declare -F parar_app_do_aparelho > /dev/null; then parar_app_do_aparelho; fi
  sleep 5
  rodar_maestro "$fase" "$fluxo"
}

fluxo_entrada() {
  rodar_com_abertura_repetida entrada "$PASTA_DOS_FLUXOS/01-entrada.yaml" \
    || erro "O fluxo da entrada falhou (app aberto, entrada em repouso e com o teclado). O passo acima diz em que comando; a tela está em tela-no-fim-de-entrada.png, nos registros."
  resumo "✅ Entrada: em repouso, e-mail em foco e senha em foco com o teclado."
}

fluxo_entrar() {
  rodar_com_abertura_repetida entrar "$PASTA_DOS_FLUXOS/02-entrar.yaml" \
    || erro "O fluxo de entrar na conta falhou; sem sessão, as outras telas não são capturadas. A tela está em tela-no-fim-de-entrar.png, nos registros."
  # O fluxo 2 digita o e-mail de novo quando o campo ficou vazio (teclado frio depois de religar o simulador): sempre no
  # resumo, para a repetição não passar despercebida.
  if [ "$(grep -c 'Input text ${EMAIL}' "$REGISTROS/maestro-entrar.log" 2> /dev/null || true)" -gt 1 ]; then
    resumo "⚠️ No fluxo 2, o e-mail não ficou no campo na primeira digitação e foi digitado de novo (maestro-entrar.log)."
  fi
  resumo "✅ Entrou na conta sintética e chegou ao mapa da trilha."
}

# A criação de uma trilha (fluxos/criacao/90-criacao-da-trilha.yaml), numa fase própria antes das telas: as provas dela
# saem cedo e sobrevivem a uma falha mais adiante (uma queda do emulador, um tempo esgotado). Enquanto o fluxo roda, cada
# sistema grava o que o áudio dele registra (iniciar_registro_de_audio, em ios.sh e android.sh). Com ou sem falha, as
# capturas e o vídeo da transição vão logo para o artefato, e a linha do tempo do som é montada.
# As trilhas da conta são fotografadas antes do fluxo e comparadas depois (servidor/trilhas-da-criacao.mjs): só a trilha
# criada pela própria prova sai, e só quando é inequívoca (exatamente uma nova, nenhuma sumida, a base do preparo
# conferida antes). Uma fase que falha antes de criar não apaga nada; duas ou mais trilhas novas são uma falha de
# duplicação, com o detalhe delas nos registros, e nada é apagado. Nunca para o passo; uma falha da prova que não deixe
# captura faltando fica em $SAIDA/criacao-falhou.txt, e a coleta a acusa.
trilhas_da_criacao() {
  (cd "$RAIZ" && NODE_EXTRA_CA_CERTS="$TLS/ca.crt" node --env-file=.env --import tsx "$AQUI/servidor/trilhas-da-criacao.mjs" \
    "$@" --api "$API") 2>> "$REGISTROS/trilhas-da-criacao.log" | tee -a "$REGISTROS/trilhas-da-criacao.log"
  return "${PIPESTATUS[0]}"
}

# A resposta certa e uma errada do primeiro exercício da trilha temporária (servidor/resposta-da-prova.mjs): duas linhas,
# RESPOSTA_CERTA=<id> e RESPOSTA_ERRADA=<id>; o motivo de não escolher vai para resposta-da-prova.log.
resposta_da_prova() {
  (cd "$RAIZ" && NODE_EXTRA_CA_CERTS="$TLS/ca.crt" node --env-file=.env --import tsx "$AQUI/servidor/resposta-da-prova.mjs" \
    --api "$API" --antes "$REGISTROS/trilhas-antes-da-criacao.json" --saida "$REGISTROS/resposta-da-prova.json") 2>> "$REGISTROS/resposta-da-prova.log"
}

# O fundo por baixo dos fluxos 90 e 95, pelo veredito da linha do tempo (servidor/linha-do-tempo-som.mjs): ✅ só com o
# lofi_estudo identificado e cada troca de tela, o erro e o acerto cobertos; ❌ com outra faixa tocando, pausa, reinício ou
# volume baixo; ⚠️ com dado ausente, inclusive o fluxo 95 que não rodou. É o estado que o expo-audio relata do reprodutor,
# não a saída no alto-falante.
resumir_fundo() {
  local fundo
  fundo="$(grep -m 1 '^Fundo: ' "$1" 2> /dev/null || true)"
  case "$fundo" in
    'Fundo: CONTÍNUO '*) resumo "✅ $fundo" ;;
    'Fundo: FALHA '*)
      resumo "❌ $fundo"
      aviso "O fundo não seguiu contínuo nos fluxos 90 e 95 (outra faixa, pausa, reinício ou volume baixo): veja linha-do-tempo-criacao.txt, nos registros." ;;
    'Fundo: INCONCLUSIVO '*) resumo "⚠️ $fundo" ;;
    *) resumo "⚠️ Fundo nos fluxos 90 e 95: inconclusivo, a linha do tempo não chegou ao veredito (linha-do-tempo-criacao.txt, nos registros)." ;;
  esac
  # Android: a oscilação do emulador (travadas curtas, fora do veredito) aparece sempre, com a quantidade e os segundos.
  local oscilacoes
  oscilacoes="$(grep -m 1 '^Oscilações do emulador: ' "$1" 2> /dev/null || true)"
  if [ -n "$oscilacoes" ]; then resumo "⚠️ $oscilacoes"; fi
}

fluxo_criacao() {
  local plataforma=iphone comandos90 comandos95 fluxo=falhou resposta codigo=0 linha parametros certa errada
  case "$TITULO_DA_CONFERENCIA" in *Android*) plataforma=android ;; esac
  rm -f "$SAIDA/criacao-falhou.txt"
  trilhas_da_criacao antes --dados "$DADOS/dados-da-conferencia.json" --saida "$REGISTROS/trilhas-antes-da-criacao.json" > /dev/null || true
  if declare -F iniciar_registro_de_audio > /dev/null; then iniciar_registro_de_audio "$REGISTROS/audio-criacao.log" || true; fi
  if rodar_maestro criacao "$PASTA_DOS_FLUXOS/criacao/90-criacao-da-trilha.yaml"; then fluxo=passou; fi
  # O emulador caiu no meio da prova da criação duas vezes (execuções 44911656576 e 45064765725, numa troca de tela, com o
  # Maestro esperando o toque e o emulador fora do adb no fim). No Android, se ele não responde depois da falha, ele é
  # religado (até duas vezes no total), a trilha da tentativa sai (o fluxo 95 precisa de exatamente uma trilha nova) e a
  # criação roda de novo uma vez. A repetição aparece no resumo com ⚠️; o fluxo 98 não roda depois de religar.
  if [ "$fluxo" != passou ] && [ "$plataforma" = android ] && ! aparelho_responde \
    && declare -F reviver_aparelho > /dev/null && [ "${REVIVIDOS:-0}" -lt 2 ] && reviver_aparelho; then
    resumo "⚠️ O emulador parou de responder no meio da prova da criação; foi religado, a trilha da tentativa saiu e a criação rodou de novo uma vez (a primeira tentativa está em maestro-criacao-primeira-tentativa.log)."
    cp "$REGISTROS/maestro-criacao.log" "$REGISTROS/maestro-criacao-primeira-tentativa.log"
    trilhas_da_criacao depois --antes "$REGISTROS/trilhas-antes-da-criacao.json" \
      --saida "$REGISTROS/trilhas-depois-da-primeira-tentativa.json" --apagar > /dev/null || true
    if declare -F parar_registro_de_audio > /dev/null; then parar_registro_de_audio || true; fi
    if declare -F iniciar_registro_de_audio > /dev/null; then iniciar_registro_de_audio "$REGISTROS/audio-criacao.log" || true; fi
    if rodar_maestro criacao "$PASTA_DOS_FLUXOS/criacao/90-criacao-da-trilha.yaml"; then fluxo=passou; fi
  fi
  # Uma resposta errada e uma certa na primeira lição da trilha temporária (fluxo 95), antes de ela sair: o app ficou no
  # mapa dela. Sem a criação, ou sem opções escolhidas sem dúvida, o fluxo não roda, e as capturas 95 a 97 faltam.
  if [ "$fluxo" != passou ]; then
    resposta="não rodou: a criação falhou"
  elif parametros="$(resposta_da_prova)"; then
    certa="$(printf '%s\n' "$parametros" | sed -n 's/^RESPOSTA_CERTA=//p')"
    errada="$(printf '%s\n' "$parametros" | sed -n 's/^RESPOSTA_ERRADA=//p')"
    if rodar_maestro resposta "$PASTA_DOS_FLUXOS/criacao/95-resposta-certa-e-errada.yaml" -e "RESPOSTA_CERTA=$certa" -e "RESPOSTA_ERRADA=$errada"; then
      resposta=passou
    else
      resposta="falhou (maestro-resposta.log e tela-no-fim-de-resposta.png, nos registros)"
    fi
  else
    resposta="não rodou: $(tail -n 1 "$REGISTROS/resposta-da-prova.log" 2> /dev/null || echo 'as opções não foram escolhidas')"
  fi
  if declare -F parar_registro_de_audio > /dev/null; then parar_registro_de_audio || true; fi
  # Os momentos "erro → ponte" e "Ensine ao Stu" (fluxo 98, aprovado pelo Lead em 21/11), na mesma trilha temporária,
  # depois do 95 e fora da linha do tempo do som. No Android, só com o emulador nunca religado nesta execução.
  local ponte="não rodou: o fluxo 95 não passou"
  if [ "$resposta" = passou ]; then
    if [ "$plataforma" = android ] && [ "${REVIVIDOS:-0}" -ne 0 ]; then
      ponte="não rodou: o emulador foi religado nesta execução (o fluxo 98 só roda com REVIVIDOS=0)"
    elif rodar_maestro ponte "$PASTA_DOS_FLUXOS/criacao/98-ponte-e-ensine.yaml" -e "RESPOSTA_CERTA=$certa" -e "RESPOSTA_ERRADA=$errada"; then
      ponte=passou
    else
      ponte="falhou (maestro-ponte.log e tela-no-fim-de-ponte.png, nos registros)"
    fi
  fi
  # As provas da criação, das respostas e da ponte vão já para o artefato das capturas, com ou sem falha.
  find "$SAIDA_MAESTRO/criacao" "$SAIDA_MAESTRO/resposta" "$SAIDA_MAESTRO/ponte" -type f \( -name '9[0-9]-*.png' -o -name 'criacao-transicao*.mp4' \) \
    -exec cp -f {} "$CAPTURAS/" \; 2> /dev/null || true
  comandos90="$(find "$SAIDA_MAESTRO/criacao" -type f -name commands.json -path '*90-criacao-da-trilha*' 2> /dev/null | head -1 || true)"
  comandos95="$(find "$SAIDA_MAESTRO/resposta" -type f -name commands.json -path '*95-resposta-certa-e-errada*' 2> /dev/null | head -1 || true)"
  # O registro de som do app (apps/mobile/src/sons.ts) chega pelo log do sistema e, se o Expo o repassar, pelo do Metro.
  node "$AQUI/servidor/linha-do-tempo-som.mjs" --comandos "$comandos90" --comandos "$comandos95" \
    --audio "$REGISTROS/audio-criacao.log" --audio "$REGISTROS/metro.log" \
    --plataforma "$plataforma" > "$REGISTROS/linha-do-tempo-criacao.txt" 2>&1 || true
  if [ "$resposta" = passou ]; then
    resumo "✅ Resposta errada e certa na trilha temporária (fluxo 95): os tempos estão em linha-do-tempo-criacao.txt, nos registros."
  else
    resumo "❌ Resposta errada e certa na trilha temporária (fluxo 95): $resposta."
  fi
  resumir_fundo "$REGISTROS/linha-do-tempo-criacao.txt"
  if [ "$ponte" = passou ]; then
    resumo "✅ Erro → ponte e \"Ensine ao Stu\" em texto na trilha temporária (fluxo 98): capturas 98 e 99."
  else
    resumo "❌ Erro → ponte e \"Ensine ao Stu\" (fluxo 98): $ponte."
  fi

  # O resultado dos três, para o modo só da criação (fluxo_so_criacao): "passou" ou o motivo de cada um.
  RESULTADO_DA_CRIACAO="90 $fluxo; 95 $resposta; 98 $ponte"
  linha="$(trilhas_da_criacao depois --antes "$REGISTROS/trilhas-antes-da-criacao.json" --saida "$REGISTROS/trilhas-depois-da-criacao.json" --apagar)" || codigo=$?
  case "$codigo:$fluxo" in
    0:passou)
      if printf '%s' "$linha" | grep -q 'nenhuma trilha nova'; then
        echo "o fluxo passou, mas nenhuma trilha nova apareceu na conta" > "$SAIDA/criacao-falhou.txt"
        resumo "❌ Criação de trilha: o fluxo passou, mas nenhuma trilha nova apareceu na conta (trilhas-depois-da-criacao.json, nos registros)."
      else
        resumo "✅ Criação de trilha: o pedido, em criação, pronta, a etapa 1 da primeira lição num toque só e o mapa ao voltar. $linha"
      fi ;;
    0:falhou)
      resumo "❌ A criação de trilha falhou no fluxo (maestro-criacao.log e tela-no-fim-de-criacao.png, nos registros). $linha" ;;
    4:*)
      echo "duplicação: $linha" > "$SAIDA/criacao-falhou.txt"
      resumo "❌ Criação de trilha duplicada: $linha O detalhe de cada trilha está em trilhas-depois-da-criacao.json, nos registros." ;;
    *)
      echo "$linha" > "$SAIDA/criacao-falhou.txt"
      resumo "❌ Criação de trilha: o fluxo $fluxo, e a conferência das trilhas parou (código $codigo): $linha" ;;
  esac
}

fluxo_telas() {
  local falhas
  # Com CONFERENCIA_TELAS (lista de telas, ou "criacao" para só a prova da criação), nas duas plataformas: o iPhone também
  # repete só o que caiu (input telas_ios do workflow), uma sessão do Maestro por fluxo, como o Android.
  if [ "${TELAS_UMA_POR_VEZ:-}" = "1" ] || [ -n "${CONFERENCIA_TELAS:-}" ]; then
    fluxo_telas_uma_por_vez
    return
  fi
  fluxo_criacao || true
  if ! rodar_maestro telas "$PASTA_DOS_FLUXOS/telas" --config "$PASTA_DOS_FLUXOS/telas/config.yaml" \
    --format junit --output "$REGISTROS/maestro-telas.xml"; then
    # Os fluxos que falharam e o motivo de cada um, tirados do relatório do Maestro.
    falhas="$(node "$AQUI/servidor/falhas-do-relatorio.mjs" "$REGISTROS/maestro-telas.xml" 2> /dev/null || true)"
    if [ -n "$falhas" ]; then
      resumo "**Fluxos das telas que falharam:**"
      resumo ""
      resumo "$falhas"
      resumo ""
    fi
    erro "Um ou mais fluxos das telas falharam (mapa, Minhas trilhas, exercícios, Explorar, Perfil). O sumário lista quais e o que faltou."
  fi
  resumo "✅ Telas: mapa, Minhas trilhas, menu e confirmação, os seis exercícios, Explorar e Perfil."
}

# Só a prova da criação (CONFERENCIA_TELAS=criacao ou so-criacao; no workflow, pelo input telas_android): os fluxos 90, 95
# e 98, depois da entrada e da conta, sem os fluxos das telas. Com a lista toda, o Android não chega à criação nos 90 min
# do passo (execução 45078070221); assim ela roda numa parte própria. O emulador só é religado se não responder antes.
# O passo falha se um dos três não passar; as capturas das telas aparecem como faltando na coleta, como nas outras partes.
fluxo_so_criacao() {
  resumo "Só a prova da criação (CONFERENCIA_TELAS=${CONFERENCIA_TELAS:-}): fluxos 90, 95 e 98, sem os fluxos das telas (as capturas das telas vão aparecer como faltando)."
  if ! aparelho_responde; then
    if declare -F reviver_aparelho > /dev/null && [ "${REVIVIDOS:-0}" -lt 2 ] && reviver_aparelho; then
      resumo "⚠️ O aparelho não respondia antes da prova da criação e foi religado (o fluxo 98 não roda depois de religar)."
    else
      erro "A prova da criação não rodou: o aparelho não respondia."
    fi
  fi
  RESULTADO_DA_CRIACAO=""
  fluxo_criacao || true
  if [ "$RESULTADO_DA_CRIACAO" != "90 passou; 95 passou; 98 passou" ] || [ -f "$SAIDA/criacao-falhou.txt" ]; then
    erro "A prova da criação não passou inteira (${RESULTADO_DA_CRIACAO:-sem resultado}). O sumário acima diz o que faltou."
  fi
  resumo "✅ Só a prova da criação: 90, 95 e 98 passaram."
}

# As mesmas telas, uma sessão do Maestro por fluxo, na ordem de telas/config.yaml (o Android liga com TELAS_UMA_POR_VEZ=1).
# Na execução 44726250118 o emulador sumiu do adb no fluxo 70, depois de 12 min na mesma sessão, e os 12 fluxos seguintes
# falharam em milissegundos ("device not found"). Aqui cada fluxo abre e fecha a própria sessão, o aparelho é conferido
# antes de cada um (`aparelho_responde`, do sistema) e, se ele não volta, o resto fica como "não rodou", com o motivo.
# CONFERENCIA_TELAS (nomes separados por vírgula ou espaço, como "70-exemplo-curto,10-mapa") roda só essas telas e pula a
# prova da criação: serve para refazer as que faltaram sem repetir o resto.
fluxo_telas_uma_por_vez() {
  local fluxo pedidas falhas="" naorodaram="" caiu="" quantos=0 codigo
  pedidas="$(printf '%s' "${CONFERENCIA_TELAS:-}" | tr ',' ' ' | xargs || true)"
  # "criacao" (ou "so-criacao") no lugar das telas: só a prova da criação (90, 95 e 98), sem os fluxos das telas.
  case " $pedidas " in
    *" criacao "* | *" so-criacao "*)
      fluxo_so_criacao
      return ;;
  esac
  if [ -z "$pedidas" ] && [ "${CRIACAO_DEPOIS_DAS_TELAS:-}" != "1" ]; then
    fluxo_criacao || true
  elif [ -n "$pedidas" ]; then
    resumo "Só as telas pedidas: $pedidas (sem a prova da criação; as capturas das outras vão aparecer como faltando)."
  fi

  # A lista vem pelo descritor 3, que nada dentro do laço lê. Pela entrada padrão, o `adb shell` de aparelho_responde e o
  # `adb exec-out` da captura no fim de cada fase repassavam o resto da lista ao aparelho: depois do primeiro fluxo, o
  # `read` não achava mais nada (execuções 45064765725 e 45071340280, Android: "Telas: 1 fluxo(s)", mesmo com o Maestro
  # já em `< /dev/null`).
  local lista
  lista="$(awk '/flowsOrder:/ { dentro = 1; next } dentro && /^ *- / { sub(/^ *- */, ""); sub(/ *#.*/, ""); print }' \
    "$PASTA_DOS_FLUXOS/telas/config.yaml")"
  echo "Fluxos das telas, um por vez ($(printf '%s\n' "$lista" | grep -c .)): $(printf '%s' "$lista" | tr '\n' ' ')"
  while IFS= read -r fluxo <&3; do
    if [ -n "$pedidas" ] && ! printf ' %s ' "$pedidas" | grep -qF " $fluxo "; then continue; fi
    if [ -n "$caiu" ]; then
      naorodaram="$naorodaram $fluxo"
      continue
    fi
    if ! aparelho_responde; then
      # O Android religa o emulador (até duas vezes) e segue deste fluxo; sem isso, o resto fica como "não rodou".
      if declare -F reviver_aparelho > /dev/null && [ "${REVIVIDOS:-0}" -lt 2 ] && reviver_aparelho; then
        resumo "⚠️ O aparelho parou de responder antes de \`$fluxo\` e foi religado; a conferência seguiu dali."
      else
        caiu="$fluxo"
        naorodaram="$naorodaram $fluxo"
        continue
      fi
    fi
    quantos=$((quantos + 1))
    codigo=0
    # `< /dev/null`: o Maestro lê a entrada padrão e, sem isto, engolia o resto da lista de fluxos deste laço (execução
    # 45064765725, Android: só o 80 rodou, e o laço acabou dizendo "1 fluxo(s), todos passaram").
    rodar_maestro "telas-$fluxo" "$PASTA_DOS_FLUXOS/telas/$fluxo.yaml" \
      --format junit --output "$REGISTROS/maestro-telas-$fluxo.xml" < /dev/null || codigo=$?
    if [ "$codigo" -ne 0 ]; then
      falhas="$falhas$(node "$AQUI/servidor/falhas-do-relatorio.mjs" "$REGISTROS/maestro-telas-$fluxo.xml" 2> /dev/null || echo "- \`$fluxo\`: sem relatório do Maestro (código $codigo)")
"
    fi
  done 3< <(printf '%s\n' "$lista")

  # A criação por último (Android): com o aparelho de pé, religando se preciso.
  if [ -z "$pedidas" ] && [ "${CRIACAO_DEPOIS_DAS_TELAS:-}" = "1" ]; then
    if aparelho_responde || { declare -F reviver_aparelho > /dev/null && [ "${REVIVIDOS:-0}" -lt 2 ] && reviver_aparelho; }; then
      fluxo_criacao || true
    else
      resumo "❌ A prova da criação não rodou: o aparelho não respondia depois das telas."
    fi
  fi
  [ "$quantos" -gt 0 ] || [ -n "$caiu" ] || erro "Nenhuma tela de CONFERENCIA_TELAS existe em telas/config.yaml: $pedidas"
  if [ -n "$caiu" ]; then
    resumo "**O aparelho parou de responder antes de \`$caiu\`.** Não rodaram:$(printf ' `%s`' $naorodaram). A carga da máquina está em carga-da-maquina.log e o fim do kernel em dmesg-fim.txt, nos registros."
  fi
  if [ -n "$falhas" ]; then
    resumo "**Fluxos das telas que falharam:**"
    resumo ""
    resumo "$falhas"
  fi
  if [ -n "$falhas" ] || [ -n "$caiu" ]; then
    erro "Um ou mais fluxos das telas falharam ou não rodaram. O sumário lista quais e por quê."
  fi
  resumo "✅ Telas: $quantos fluxo(s), uma sessão do Maestro por fluxo, todos passaram."
}

# ---------------------------------------------------------------------------------------------------------------------
# coletar: junta as capturas, diz o que faltou e arruma os registros

# A senha da conta sintética aparece na saída do Maestro (ele escreve o texto que digita). Ela vale só nesta execução,
# mas os registros sobem como artefato: sai deles antes.
tirar_senha_dos_registros() {
  local senha arquivo restantes
  senha="$(do_env STUDOO_SENHA 2> /dev/null || true)"
  [ -n "$senha" ] || return 0
  grep -rlF -- "$senha" "$REGISTROS" "$SAIDA_MAESTRO" "$DADOS" "$CAPTURAS" 2> /dev/null | while IFS= read -r arquivo; do
    LC_ALL=C sed -i.limpo "s/$senha/(senha da conta sintetica)/g" "$arquivo" && rm -f "$arquivo.limpo"
  done || true
  # Confere de novo. Um arquivo que o sed não limpou não sobe.
  restantes="$(grep -rlF -- "$senha" "$REGISTROS" "$SAIDA_MAESTRO" "$DADOS" "$CAPTURAS" 2> /dev/null || true)"
  if [ -n "$restantes" ]; then
    printf '%s\n' "$restantes" | while IFS= read -r arquivo; do rm -f "$arquivo"; done
    aviso "A senha da conta sintética ficou em $(printf '%s\n' "$restantes" | wc -l | tr -d ' ') arquivo(s) depois da limpeza; eles foram apagados e não sobem."
  else
    resumo "Senha da conta sintética: nenhum arquivo enviado a contém (conferido depois da limpeza)."
  fi
}

# O Maestro grava o registro inteiro do simulador em cada fluxo (perto de 200 MB cada). O que interessa do Expo Go já
# está em simulador-expo-go.log; de cada um fica só o fim, para ver os últimos instantes de um fluxo que falhou.
encurtar_registros_do_simulador() {
  local arquivo
  find "$SAIDA_MAESTRO" -type f -name 'device-simulator.log' 2> /dev/null | while IFS= read -r arquivo; do
    tail -n 2000 "$arquivo" | cut -c1-600 > "${arquivo%.log}-fim.log" 2> /dev/null || true
    rm -f "$arquivo"
  done || true
}

# De onde vieram as capturas, num arquivo ao lado delas: toda prova do app diz a origem. Uso: escrever_origem <o que é,
# numa frase>. Cada sistema deixa em $SAIDA/origem-simulador.txt o aparelho e em $SAIDA/origem-app.txt o app.
escrever_origem() {
  {
    echo "Capturas da conferência nativa do Studoo: $1"
    echo
    cat "$SAIDA/origem-simulador.txt" 2> /dev/null || echo "Aparelho: ? (a sonda não registrou)"
    cat "$SAIDA/origem-app.txt" 2> /dev/null || true
    material_observado
    echo "Maestro: ${MAESTRO_VERSAO:-?}"
    echo "Commit: ${GITHUB_SHA:-$(git -C "$RAIZ" rev-parse HEAD 2> /dev/null || echo '?')}"
    echo "Ramo: ${GITHUB_REF_NAME:-$(git -C "$RAIZ" rev-parse --abbrev-ref HEAD 2> /dev/null || echo '?')}"
    if [ -n "${GITHUB_RUN_ID:-}" ]; then
      echo "Execução: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-?}/actions/runs/$GITHUB_RUN_ID (tentativa ${GITHUB_RUN_ATTEMPT:-1})"
    fi
    echo "Data: $(date -u '+%Y-%m-%d %H:%M') UTC"
    echo "Dados: API do próprio repositório nesta máquina, com IA simulada e conta sintética (nada do site publicado)."
  } > "$CAPTURAS/ORIGEM.txt"
}

# O começo da coleta: a pasta padrão do Maestro, o fim dos registros grandes, as capturas e a origem.
# Uso: coletar_inicio <o que é, numa frase, para o ORIGEM.txt>
coletar_inicio() {
  # Em algumas versões, o Maestro guarda a tela e a árvore de elementos do passo que falhou na pasta padrão dele, e não
  # na pasta pedida: vai junto com os registros.
  if [ -d "$HOME/.maestro/tests" ]; then cp -R "$HOME/.maestro/tests" "$SAIDA_MAESTRO/pasta-padrao-do-maestro" 2> /dev/null || true; fi
  encurtar_registros_do_simulador
  # O Maestro guarda cada captura em <saída>/<sessão>/<fluxo>/takeScreenshot/<nome>.png. A imagem do material observado
  # (material_observado, abaixo) vai junto das capturas.
  find "$SAIDA_MAESTRO" -type f -name '[0-9][0-9]-*.png' -exec cp -f {} "$CAPTURAS/" \; 2> /dev/null || true
  find "$SAIDA_MAESTRO" -type f -name 'material-observado-*.png' -exec cp -f {} "$CAPTURAS/" \; 2> /dev/null || true
  escrever_origem "$1"
  resumir_proxy
}

# O material que o app desenhou de fato na barra de baixo. A View por fora da barra tem o testID barra-material-vidro ou
# barra-material-opaca, conforme o ramo que desenhou (apps/mobile/src/interface.tsx); o fluxo 80 procura os dois e, achando
# um, tira uma imagem com o nome dele. É o estado observado; o calculado (a conta do vidro e das preferências) é outra
# linha do ORIGEM.txt, e os dois não se confundem.
material_observado() {
  local vidro opaca
  vidro="$(find "$SAIDA_MAESTRO" -type f -name 'material-observado-vidro.png' 2> /dev/null | head -1 || true)"
  opaca="$(find "$SAIDA_MAESTRO" -type f -name 'material-observado-opaca.png' 2> /dev/null | head -1 || true)"
  if [ -n "$vidro" ] && [ -n "$opaca" ]; then
    echo "Material observado da barra (testID visto no fluxo 80): os dois apareceram, barra-material-vidro e barra-material-opaca (não devia)"
  elif [ -n "$vidro" ]; then
    echo "Material observado da barra (testID visto no fluxo 80): vidro (barra-material-vidro; imagem material-observado-vidro.png)"
  elif [ -n "$opaca" ]; then
    echo "Material observado da barra (testID visto no fluxo 80): superfície opaca (barra-material-opaca; imagem material-observado-opaca.png)"
  else
    echo "Material observado da barra (testID visto no fluxo 80): não identificado (nenhum dos dois testID apareceu, ou o fluxo 80 não chegou lá)"
  fi
}

# A barra de baixo no sumário: o calculado (as linhas de <origem>) e o observado, um embaixo do outro, com aviso quando o
# observado falta ou não fecha. Uso: resumir_barra <arquivo de origem com as linhas calculadas>
resumir_barra() {
  local linha observado
  observado="$(material_observado)"
  resumo "### Barra de baixo"
  resumo ""
  { grep -E '^(Vidro|Reduzir|Tamanho|Material calculado)' "$1" 2> /dev/null || true; } | while IFS= read -r linha; do resumo "- $linha"; done
  resumo "- $observado"
  resumo ""
  case "$observado" in
    *"não identificado"* | *"os dois apareceram"*) aviso "O material que o app desenhou na barra de baixo não ficou claro pelo testID do fluxo 80: ${observado#*: }." ;;
  esac
}

# A tabela das capturas no sumário, a origem e a cache do Metro. Uso: coletar_tabela <a linha de origem do sumário>
FALTAM=""
TOTAL_DE_CAPTURAS=0
coletar_tabela() {
  local nome
  resumo "### Capturas"
  resumo ""
  resumo "| Captura | Tamanho |"
  resumo "|---|---|"
  for nome in $CAPTURAS_ESPERADAS; do
    if [ -f "$CAPTURAS/$nome.png" ]; then
      resumo "| $nome | $(tamanho_png "$CAPTURAS/$nome.png") |"
      TOTAL_DE_CAPTURAS=$((TOTAL_DE_CAPTURAS + 1))
    else
      resumo "| $nome | **faltou** |"
      FALTAM="$FALTAM $nome"
    fi
  done
  resumo ""
  resumo "$1"
  resumo ""

  if [ -f "$REGISTROS/cache-do-metro.log" ]; then
    resumo "Pacote do app nas aberturas: $(grep -c ' guardado ' "$REGISTROS/cache-do-metro.log" || true) da cache e $(grep -c ' do Metro ' "$REGISTROS/cache-do-metro.log" || true) feitos pelo Metro (cache-do-metro.log)."
    resumo ""
  fi
}

# O fim da coleta: a senha sai dos registros e a falta de captura vira erro.
coletar_fim() {
  tirar_senha_dos_registros
  if [ -n "$FALTAM" ]; then
    erro "Faltaram $(echo "$FALTAM" | wc -w | tr -d ' ') de $(echo "$CAPTURAS_ESPERADAS" | wc -w | tr -d ' ') capturas:$FALTAM."
  fi
  if [ -f "$SAIDA/criacao-falhou.txt" ]; then
    erro "A prova da criação de trilha falhou: $(head -1 "$SAIDA/criacao-falhou.txt")"
  fi
  resumo "✅ As $TOTAL_DE_CAPTURAS capturas do percurso saíram."
}
