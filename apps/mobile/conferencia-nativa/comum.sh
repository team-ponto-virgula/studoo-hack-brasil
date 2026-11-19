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
40-explorar 41-explorar-rolado 50-perfil 51-perfil-rolado
60-configuracoes
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
        echo "STUDOO_IA_FALSA_PAUSA_MS=0"
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

  resumo "**Dados da conta sintética** (trilha de cada formato de exercício e a lição em que ela está):"
  resumo ""
  resumo '```'
  resumo "$(grep -E '^(- |Destaque|AVISO)' "$REGISTROS/preparar-dados.log" || true)"
  resumo '```'
  resumo ""
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
  # O Expo embute as variáveis EXPO_PUBLIC_ no pacote. O .env.local é ignorado pelo Git.
  printf 'EXPO_PUBLIC_STUDOO_API_URL=%s\nEXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI=studoo-dev://auth/google\n' "$API" > .env.local

  # Sem modo de desenvolvimento e minificado, como o servidor que o dono usa no iPhone dele: sem avisos de
  # desenvolvimento por cima das telas. EXPO_PACKAGER_PROXY_URL faz o manifesto apontar para a cache, e não para o Metro.
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_PACKAGER_PROXY_URL="http://127.0.0.1:$PORTA_METRO" \
    EXPO_PUBLIC_STUDOO_API_URL="$API" EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI="studoo-dev://auth/google" \
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

  # A tela do aparelho no fim da fase: mostra onde parou, com ou sem falha. (Do passo que falha, o Maestro guarda
  # também a árvore de elementos, na saída dele: é com ela que se corrige um seletor.)
  capturar_tela_do_aparelho "$REGISTROS/tela-no-fim-de-$fase.png"
  return "$codigo"
}

fluxo_entrada() {
  rodar_maestro entrada "$PASTA_DOS_FLUXOS/01-entrada.yaml" \
    || erro "O fluxo da entrada falhou (app aberto, entrada em repouso e com o teclado). O passo acima diz em que comando; a tela está em tela-no-fim-de-entrada.png, nos registros."
  resumo "✅ Entrada: em repouso, e-mail em foco e senha em foco com o teclado."
}

fluxo_entrar() {
  rodar_maestro entrar "$PASTA_DOS_FLUXOS/02-entrar.yaml" \
    || erro "O fluxo de entrar na conta falhou; sem sessão, as outras telas não são capturadas. A tela está em tela-no-fim-de-entrar.png, nos registros."
  resumo "✅ Entrou na conta sintética e chegou ao mapa da trilha."
}

fluxo_telas() {
  local falhas
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
  # O Maestro guarda cada captura em <saída>/<sessão>/<fluxo>/takeScreenshot/<nome>.png.
  find "$SAIDA_MAESTRO" -type f -name '[0-9][0-9]-*.png' -exec cp -f {} "$CAPTURAS/" \; 2> /dev/null || true
  escrever_origem "$1"
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
  resumo "✅ As $TOTAL_DE_CAPTURAS capturas do percurso saíram."
}
