#!/usr/bin/env bash
# Conferência nativa do app num simulador de iPhone, nas máquinas macOS do GitHub Actions.
#
# Cada subcomando é um passo de `.github/workflows/capturas-nativas.yml`, na ordem:
#   sonda -> ligar -> servidor -> simulador -> maestro -> metro -> fluxo-entrada -> sem-preenchimento -> fluxo-entrar
#   -> fluxo-telas -> coletar
# O passo que falha diz, numa linha, o que quebrou (anotação de erro e sumário da execução); os registros de cada
# programa ficam em $CONFERENCIA_SAIDA/registros e sobem como artefato.
#
# Nada daqui fala com o site publicado nem usa segredo: a API é a do repositório, na própria máquina, com IA simulada e
# uma conta sintética cuja senha é sorteada a cada execução.
#
# Roda no bash 3.2 do macOS: sem recursos do bash 4 (mapfile, vetores associativos) e sem `timeout`.
set -eo pipefail

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
PORTA_METRO=8081
EXPO_GO="host.exp.Exponent"

# O que o percurso inteiro deve produzir. `coletar` acusa a captura que faltar.
CAPTURAS_ESPERADAS="
01-entrada-em-repouso 02-entrada-email-em-foco 03-entrada-senha-em-foco 04-entrada-preenchida 05-depois-de-entrar
10-mapa-da-trilha 11-mapa-rolado-sob-a-barra 12-mapa-rolado-mais
20-minhas-trilhas 21-minhas-trilhas-rolada 22-menu-aberto 23-confirmacao-de-apagar
30-exercicio-ordenar 30-exercicio-ordenar-abaixo 31-exercicio-associar 31-exercicio-associar-abaixo
32-exercicio-multipla-escolha 32-exercicio-multipla-escolha-abaixo 33-exercicio-verdadeiro-falso 33-exercicio-verdadeiro-falso-abaixo
34-exercicio-lacuna 34-exercicio-lacuna-abaixo 35-exercicio-aberta 35-exercicio-aberta-abaixo
40-explorar 41-explorar-rolado 50-perfil 51-perfil-rolado
"

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
  printf '::error title=Conferência nativa (iPhone)::%s\n' "$1" >&2
  resumo "❌ **$1**" >&2
  exit 1
}

aviso() {
  printf '::warning title=Conferência nativa (iPhone)::%s\n' "$1"
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

# O macOS não tem `timeout`. Uso: com_limite <segundos> <comando...>
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

udid() {
  if [ -n "${CONFERENCIA_UDID:-}" ]; then printf '%s' "$CONFERENCIA_UDID"; return; fi
  if [ -f "$SAIDA/udid" ]; then cat "$SAIDA/udid"; return; fi
  erro "Sem simulador escolhido: o passo da sonda não rodou."
}

# Lê uma chave do .env da raiz (o arquivo é gerado aqui; os valores não têm aspas nem espaços).
do_env() {
  awk -F= -v chave="$1" '$1 == chave { print substr($0, length(chave) + 2); exit }' "$RAIZ/.env"
}

# Espera o simulador terminar de ligar e repõe o que se perde a cada inicialização.
esperar_simulador() {
  local id
  id="$(udid)"
  if ! com_limite 600 xcrun simctl bootstatus "$id" -b > "$REGISTROS/simulador-boot.log" 2>&1; then
    mostrar_registro "$REGISTROS/simulador-boot.log"
    erro "O simulador não terminou de ligar em 10 minutos."
  fi
  # Hora, bateria e sinal fixos, para as capturas não mudarem de uma execução para outra.
  xcrun simctl status_bar "$id" override --time "9:41" --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4 > /dev/null 2>&1 \
    || echo "A barra de status do simulador ficou como veio (o ajuste falhou)."
}

# ---------------------------------------------------------------------------------------------------------------------
# sonda: o que a máquina tem, e qual simulador a conferência vai usar

sonda() {
  local aparelho="${CONFERENCIA_APARELHO:-iPhone 17 Pro}" ios="${CONFERENCIA_IOS:-26.5}"
  local runtimes aparelhos runtime nome_runtime id criado=""

  command -v jq > /dev/null || erro "A máquina não tem jq: a sonda não consegue ler a lista de simuladores."
  command -v xcrun > /dev/null || erro "A máquina não tem o Xcode (xcrun): não há simulador de iPhone aqui."

  echo "::group::Versões"
  {
    echo "macOS: $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m)"
    echo "Xcode: $(xcodebuild -version 2> /dev/null | tr '\n' ' ')"
    echo "Xcode ativo: $(xcode-select -p 2> /dev/null)"
    echo "Node: $(node --version 2> /dev/null || echo ausente) | npm: $(npm --version 2> /dev/null || echo ausente)"
    echo "Java: $(java -version 2>&1 | head -1)"
    echo "OpenSSL: $("$OPENSSL" version 2> /dev/null || echo ausente) em $OPENSSL"
    echo "curl: $(curl --version | head -1)"
    echo "CPU: $(sysctl -n hw.ncpu) | memória: $(($(sysctl -n hw.memsize) / 1073741824)) GB | disco livre: $(df -h / | awk 'NR==2 {print $4}')"
  } | tee "$REGISTROS/sonda-versoes.txt"
  echo "::endgroup::"

  echo "::group::Sistemas e aparelhos de simulador disponíveis"
  {
    echo "== Sistemas"
    xcrun simctl list runtimes
    echo "== Tipos de iPhone"
    xcrun simctl list devicetypes | grep -i iphone || true
    echo "== Aparelhos prontos"
    xcrun simctl list devices available
  } | tee "$REGISTROS/sonda-simuladores.txt"
  echo "::endgroup::"

  runtimes="$(xcrun simctl list runtimes -j)"
  aparelhos="$(xcrun simctl list devices available -j)"

  # O iOS pedido (26.5 casa com 26.5 e 26.5.x). Se não houver, o iOS mais novo que a máquina tiver, com aviso.
  runtime="$(printf '%s' "$runtimes" | jq -r --arg v "$ios" '
    [.runtimes[] | select((.identifier | test("SimRuntime\\.iOS-")) and (.isAvailable != false) and ((.version // "") | (. == $v or startswith($v + "."))))]
    | sort_by(.version | split(".") | map(tonumber? // 0)) | last | .identifier // empty')"
  if [ -z "$runtime" ]; then
    runtime="$(printf '%s' "$runtimes" | jq -r '
      [.runtimes[] | select((.identifier | test("SimRuntime\\.iOS-")) and (.isAvailable != false))]
      | sort_by(.version | split(".") | map(tonumber? // 0)) | last | .identifier // empty')"
    [ -n "$runtime" ] || erro "A máquina não tem nenhum sistema de simulador de iPhone. Veja a lista no passo da sonda."
    aviso "Não há simulador com iOS $ios nesta máquina; a conferência segue no mais novo que existe ($runtime)."
  fi
  nome_runtime="$(printf '%s' "$runtimes" | jq -r --arg r "$runtime" '.runtimes[] | select(.identifier == $r) | "\(.name) (\(.buildversion // "sem número de compilação"))"' | head -1)"

  id="$(printf '%s' "$aparelhos" | jq -r --arg r "$runtime" --arg n "$aparelho" '(.devices[$r] // []) | map(select(.name == $n and (.isAvailable != false))) | first | .udid // empty')"
  if [ -z "$id" ]; then
    # A imagem não trouxe o aparelho pronto nesse sistema: cria um.
    if ! id="$(xcrun simctl create "Studoo $aparelho" "$aparelho" "$runtime" 2> "$REGISTROS/sonda-criar.log")"; then
      mostrar_registro "$REGISTROS/sonda-criar.log"
      erro "Não há \"$aparelho\" para $nome_runtime e não deu para criar. Aparelhos desse sistema: $(printf '%s' "$aparelhos" | jq -r --arg r "$runtime" '[(.devices[$r] // [])[].name] | join(", ")')."
    fi
    criado=" (criado agora)"
  fi

  printf '%s' "$id" > "$SAIDA/udid"
  if [ -n "${GITHUB_ENV:-}" ]; then echo "CONFERENCIA_UDID=$id" >> "$GITHUB_ENV"; fi

  resumo "### Conferência nativa no iPhone"
  resumo ""
  resumo "| | |"
  resumo "|---|---|"
  resumo "| Máquina | macOS $(sw_vers -productVersion), $(uname -m), $(xcodebuild -version 2> /dev/null | head -1) |"
  resumo "| Simulador | $aparelho$criado, $nome_runtime |"
  resumo "| Dados | API do repositório nesta máquina, com IA simulada e conta sintética |"
  resumo ""
}

# ---------------------------------------------------------------------------------------------------------------------
# ligar: começa a ligar o simulador, sem esperar (o build do servidor roda enquanto isso)

ligar() {
  local id
  id="$(udid)"
  # Sem teclado físico ligado ao simulador: o teclado da tela aparece, como no aparelho.
  defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false || true
  xcrun simctl boot "$id" 2> "$REGISTROS/simulador-ligar.log" || {
    # "Unable to boot device in current state: Booted" não é erro.
    grep -qi "booted" "$REGISTROS/simulador-ligar.log" || { mostrar_registro "$REGISTROS/simulador-ligar.log"; erro "O simulador não ligou."; }
  }
  echo "Simulador $id ligando em segundo plano."
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

  # 2. CA e certificado de loopback, válidos por dois dias (a receita de docs/RODAR-LOCALMENTE.md). O simulador recebe a CA.
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
# simulador: espera ligar, instala a CA local e o Expo Go

simulador() {
  local id
  id="$(udid)"
  : "${EXPO_GO_IOS_URL:?falta EXPO_GO_IOS_URL}" "${EXPO_GO_IOS_SHA256:?falta EXPO_GO_IOS_SHA256}"

  esperar_simulador

  # A CA entra como raiz confiável do simulador: é ela que assina o certificado do proxy HTTPS.
  xcrun simctl keychain "$id" add-root-cert "$TLS/ca.crt" \
    || erro "A CA local não entrou no simulador: o app não confiaria na API desta máquina."

  # Expo Go de simulador, na versão fixada (a que o Expo indica para o SDK do projeto).
  curl -fsSL --retry 3 -o "$FERRAMENTAS/expo-go.tar.gz" "$EXPO_GO_IOS_URL" || erro "Não deu para baixar o Expo Go ($EXPO_GO_IOS_URL)."
  conferir_sha256 "$FERRAMENTAS/expo-go.tar.gz" "$EXPO_GO_IOS_SHA256"
  rm -rf "$FERRAMENTAS/Expo Go.app"
  mkdir -p "$FERRAMENTAS/Expo Go.app"
  tar -xzf "$FERRAMENTAS/expo-go.tar.gz" -C "$FERRAMENTAS/Expo Go.app" || erro "O arquivo do Expo Go não abriu (tar)."
  xcrun simctl install "$id" "$FERRAMENTAS/Expo Go.app" || erro "O Expo Go não instalou no simulador."
  xcrun simctl get_app_container "$id" "$EXPO_GO" > /dev/null 2>&1 || erro "O Expo Go não aparece instalado no simulador ($EXPO_GO)."
  echo "Expo Go $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$FERRAMENTAS/Expo Go.app/Info.plist" 2> /dev/null || echo '?') instalado."
  rm -f "$FERRAMENTAS/expo-go.tar.gz"
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
# metro: serve o app e compila o pacote do iPhone antes de o simulador pedir

metro() {
  local manifesto pacote medida
  cd "$RAIZ/apps/mobile"
  # O Expo embute as variáveis EXPO_PUBLIC_ no pacote. O .env.local é ignorado pelo Git.
  printf 'EXPO_PUBLIC_STUDOO_API_URL=%s\nEXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI=studoo-dev://auth/google\n' "$API" > .env.local

  # Sem modo de desenvolvimento e minificado, como o servidor que o dono usa no iPhone dele: sem avisos de
  # desenvolvimento por cima das telas.
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_STUDOO_API_URL="$API" EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI="studoo-dev://auth/google" \
    nohup npx expo start --go --localhost --port "$PORTA_METRO" --no-dev --minify --max-workers 2 > "$REGISTROS/metro.log" 2>&1 < /dev/null &
  if ! esperar_http "http://127.0.0.1:$PORTA_METRO/status" 180; then
    mostrar_registro "$REGISTROS/metro.log"
    erro "O Metro (\`expo start\`) não subiu na porta $PORTA_METRO em 3 minutos."
  fi

  manifesto="$(curl -sf -m 60 -H 'expo-platform: ios' -H 'accept: application/expo+json,application/json' "http://127.0.0.1:$PORTA_METRO/")" || {
    mostrar_registro "$REGISTROS/metro.log"
    erro "O Metro não entregou o manifesto do app para iOS."
  }
  printf '%s\n' "$manifesto" > "$REGISTROS/manifesto-ios.json"
  pacote="$(printf '%s' "$manifesto" | jq -r '.launchAsset.url // empty' 2> /dev/null || true)"
  [ -n "$pacote" ] || erro "O manifesto do Expo veio sem o endereço do pacote (launchAsset.url). Veja manifesto-ios.json nos registros."
  echo "Pacote: $pacote"

  # Compila agora, com tempo de sobra, para o app abrir rápido no simulador. Se o código não compilar, o erro aparece aqui.
  if ! medida="$(curl -sf -m 900 -o "$FERRAMENTAS/pacote-ios" -w '%{size_download} bytes em %{time_total}s' "$pacote")"; then
    echo "::group::Resposta do Metro ao pedido do pacote"
    curl -s -m 300 "$pacote" | head -c 4000 || true
    echo
    echo "::endgroup::"
    mostrar_registro "$REGISTROS/metro.log" 120
    erro "O pacote do app para iOS não compilou no Metro. O erro está no passo do Metro e em metro.log."
  fi
  echo "Pacote do iPhone compilado: $medida."
  rm -f "$FERRAMENTAS/pacote-ios"
}

# ---------------------------------------------------------------------------------------------------------------------
# Fluxos do Maestro

# Uso: rodar_maestro <fase> <arquivo ou pasta> [opções do `maestro test`]
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
    "$MAESTRO" --device "$(udid)" test --test-output-dir "$SAIDA_MAESTRO/$fase" \
    "${parametros[@]}" "$@" "$alvo" 2>&1 | tee "$REGISTROS/maestro-$fase.log"
  codigo=${PIPESTATUS[0]}
  set -e

  # A tela do simulador no fim da fase: mostra onde parou, com ou sem falha. (Do passo que falha, o Maestro guarda
  # também a árvore de elementos, na saída dele: é com ela que se corrige um seletor.)
  xcrun simctl io "$(udid)" screenshot "$REGISTROS/tela-no-fim-de-$fase.png" > /dev/null 2>&1 || true
  return "$codigo"
}

fluxo_entrada() {
  rodar_maestro entrada "$AQUI/fluxos/01-entrada.yaml" \
    || erro "O fluxo da entrada falhou (app aberto pelo Expo Go, entrada em repouso e com o teclado). O passo acima diz em que comando; a tela está em tela-no-fim-de-entrada.png, nos registros."
  resumo "✅ Entrada: em repouso, e-mail em foco e senha em foco com o teclado."
}

# Digitar em campo de senha falha no simulador com o preenchimento automático ligado (problema conhecido do Maestro).
# A receita é a da documentação dele; os arquivos são internos do simulador e a Apple pode mudar os caminhos.
sem_preenchimento() {
  local id base arquivo feitos=0
  id="$(udid)"
  base="$HOME/Library/Developer/CoreSimulator/Devices/$id/data"
  # Com o simulador desligado, nenhum serviço dele regrava os arquivos por cima do ajuste; ao ligar de novo, o sistema
  # inteiro lê o valor novo (o Expo Go já tinha mostrado o campo de senha no fluxo anterior).
  xcrun simctl shutdown "$id" || true
  for arquivo in \
    "$base/Library/UserConfigurationProfiles/EffectiveUserSettings.plist" \
    "$base/Containers/Shared/SystemGroup/systemgroup.com.apple.configurationprofiles/Library/ConfigurationProfiles/UserSettings.plist"; do
    if [ -f "$arquivo" ] && plutil -replace restrictedBool.allowPasswordAutoFill.value -bool NO "$arquivo"; then
      feitos=$((feitos + 1))
    else
      echo "Não deu para ajustar: $arquivo"
    fi
  done
  # A cópia pública das mesmas configurações, quando o sistema a tiver (não está na receita; não conta para o aviso).
  arquivo="$base/Library/UserConfigurationProfiles/PublicInfo/PublicEffectiveUserSettings.plist"
  if [ -f "$arquivo" ]; then plutil -replace restrictedBool.allowPasswordAutoFill.value -bool NO "$arquivo" || true; fi
  if [ "$feitos" -lt 2 ]; then
    aviso "O preenchimento automático de senhas do simulador pode ter ficado ligado ($feitos de 2 arquivos ajustados): digitar a senha pode falhar no próximo fluxo."
  fi
  xcrun simctl boot "$id" || erro "O simulador não ligou de novo depois do ajuste."
  esperar_simulador
  echo "Simulador reiniciado com o preenchimento automático de senhas desligado ($feitos de 2 arquivos)."
}

fluxo_entrar() {
  rodar_maestro entrar "$AQUI/fluxos/02-entrar.yaml" \
    || erro "O fluxo de entrar na conta falhou; sem sessão, as outras telas não são capturadas. A tela está em tela-no-fim-de-entrar.png, nos registros."
  resumo "✅ Entrou na conta sintética e chegou ao mapa da trilha."
}

fluxo_telas() {
  local falhas
  if ! rodar_maestro telas "$AQUI/fluxos/telas" --config "$AQUI/fluxos/telas/config.yaml" \
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
  local senha arquivo
  senha="$(do_env STUDOO_SENHA 2> /dev/null || true)"
  [ -n "$senha" ] || return 0
  grep -rlF -- "$senha" "$REGISTROS" "$SAIDA_MAESTRO" "$DADOS" 2> /dev/null | while IFS= read -r arquivo; do
    LC_ALL=C sed -i.limpo "s/$senha/(senha da conta sintetica)/g" "$arquivo" && rm -f "$arquivo.limpo"
  done || true
}

coletar() {
  local nome faltam="" total=0 largura altura
  # Em algumas versões, o Maestro guarda a tela e a árvore de elementos do passo que falhou na pasta padrão dele, e não
  # na pasta pedida: vai junto com os registros.
  if [ -d "$HOME/.maestro/tests" ]; then cp -R "$HOME/.maestro/tests" "$SAIDA_MAESTRO/pasta-padrao-do-maestro" 2> /dev/null || true; fi
  # O Maestro guarda cada captura em <saída>/<sessão>/<fluxo>/takeScreenshot/<nome>.png.
  find "$SAIDA_MAESTRO" -type f -name '[0-9][0-9]-*.png' -exec cp -f {} "$CAPTURAS/" \; 2> /dev/null || true

  resumo "### Capturas"
  resumo ""
  resumo "| Captura | Tamanho |"
  resumo "|---|---|"
  for nome in $CAPTURAS_ESPERADAS; do
    if [ -f "$CAPTURAS/$nome.png" ]; then
      largura="$(sips -g pixelWidth "$CAPTURAS/$nome.png" 2> /dev/null | awk '/pixelWidth/ {print $2}')"
      altura="$(sips -g pixelHeight "$CAPTURAS/$nome.png" 2> /dev/null | awk '/pixelHeight/ {print $2}')"
      resumo "| $nome | ${largura:-?} × ${altura:-?} |"
      total=$((total + 1))
    else
      resumo "| $nome | **faltou** |"
      faltam="$faltam $nome"
    fi
  done
  resumo ""
  resumo "Origem: simulador de iPhone numa máquina do GitHub Actions, com o app servido pelo Metro no Expo Go. Não é aparelho de verdade."
  resumo ""

  # O registro do Expo Go no simulador ajuda a entender uma tela em branco ou um erro de rede do app.
  com_limite 120 xcrun simctl spawn "$(udid)" log show --last 30m --style compact --predicate 'process == "Expo Go"' \
    > "$REGISTROS/simulador-expo-go.log" 2> /dev/null || true

  tirar_senha_dos_registros

  if [ -n "$faltam" ]; then
    erro "Faltaram $(echo "$faltam" | wc -w | tr -d ' ') de $(echo "$CAPTURAS_ESPERADAS" | wc -w | tr -d ' ') capturas:$faltam."
  fi
  resumo "✅ As $total capturas do percurso saíram."
}

# ---------------------------------------------------------------------------------------------------------------------

case "${1:-}" in
  sonda) sonda ;;
  ligar) ligar ;;
  servidor) servidor ;;
  simulador) simulador ;;
  maestro) instalar_maestro ;;
  metro) metro ;;
  fluxo-entrada) fluxo_entrada ;;
  sem-preenchimento) sem_preenchimento ;;
  fluxo-entrar) fluxo_entrar ;;
  fluxo-telas) fluxo_telas ;;
  coletar) coletar ;;
  *)
    echo "Uso: $0 sonda|ligar|servidor|simulador|maestro|metro|fluxo-entrada|sem-preenchimento|fluxo-entrar|fluxo-telas|coletar" >&2
    exit 2
    ;;
esac
