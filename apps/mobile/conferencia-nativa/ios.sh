#!/usr/bin/env bash
# Conferência nativa do app num simulador de iPhone, nas máquinas macOS do GitHub Actions.
#
# Cada subcomando é um passo de `.github/workflows/capturas-nativas.yml`, na ordem:
#   sonda -> ligar -> servidor -> simulador -> maestro -> metro -> fluxo-entrada -> sem-preenchimento -> fluxo-entrar
#   -> fluxo-telas (e, depois das telas, a passada curta de "Reduzir transparência") -> coletar
# O passo que falha diz, numa linha, o que quebrou (anotação de erro e sumário da execução); os registros de cada
# programa ficam em $CONFERENCIA_SAIDA/registros e sobem como artefato.
#
# Nada daqui fala com o site publicado nem usa segredo: a API é a do repositório, na própria máquina, com IA simulada e
# uma conta sintética cuja senha é sorteada a cada execução.
#
# O que vale também para o Android (a API, o Maestro, o Metro, os fluxos e a coleta) está em comum.sh.
#
# Roda no bash 3.2 do macOS: sem recursos do bash 4 (mapfile, vetores associativos) e sem `timeout`.
set -eo pipefail

TITULO_DA_CONFERENCIA="Conferência nativa (iPhone)"
# shellcheck source=apps/mobile/conferencia-nativa/comum.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comum.sh"

EXPO_GO="host.exp.Exponent"

udid() {
  if [ -n "${CONFERENCIA_UDID:-}" ]; then printf '%s' "$CONFERENCIA_UDID"; return; fi
  if [ -f "$SAIDA/udid" ]; then cat "$SAIDA/udid"; return; fi
  erro "Sem simulador escolhido: o passo da sonda não rodou."
}

# O identificador que o Maestro usa e a tela do simulador, para rodar_maestro (comum.sh).
dispositivo() { udid; }
capturar_tela_do_aparelho() { xcrun simctl io "$(udid)" screenshot "$1" > /dev/null 2>&1 || true; }

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
  # Para o arquivo de origem que vai junto das capturas (coletar o completa).
  {
    echo "Simulador: $aparelho$criado, $nome_runtime"
    echo "Máquina: GitHub Actions, macOS $(sw_vers -productVersion) $(uname -m), $(xcodebuild -version 2> /dev/null | head -1)"
  } > "$SAIDA/origem-simulador.txt"

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
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$FERRAMENTAS/Expo Go.app/Info.plist" > "$SAIDA/expo-go-versao" 2> /dev/null \
    || echo '?' > "$SAIDA/expo-go-versao"
  echo "Expo Go $(cat "$SAIDA/expo-go-versao") instalado."
  rm -f "$FERRAMENTAS/expo-go.tar.gz"

  preparar_menu_do_expo_go
}

# Na primeira vez que um projeto carrega, o Expo Go abre sozinho o menu de desenvolvedor, com uma apresentação por cima,
# e depois deixa um botão flutuante (a engrenagem azul, "Tools button") sobre o app. Com o menu aberto, a árvore de
# elementos só tem o Expo Go (foi o que parou a primeira execução); o botão sairia em todas as capturas e pode cobrir um
# toque. As três chaves são as preferências desse menu (pacote expo-dev-menu do SDK 58) e moram nas preferências do Expo
# Go, dentro da pasta de dados dele no simulador. São escritas antes da primeira abertura, pelo serviço de preferências
# do próprio simulador; se não pegarem, os fluxos ainda fecham a apresentação e o menu (partes/sair-do-menu-do-expo-go.yaml).
preparar_menu_do_expo_go() {
  local id dados preferencias par chave valor falhas=0
  id="$(udid)"
  if ! dados="$(xcrun simctl get_app_container "$id" "$EXPO_GO" data 2> /dev/null)" || [ -z "$dados" ]; then
    aviso "Não achei a pasta de dados do Expo Go: o menu de desenvolvedor dele pode abrir sozinho (os fluxos o fecham)."
    return 0
  fi
  mkdir -p "$dados/Library/Preferences"
  preferencias="$dados/Library/Preferences/$EXPO_GO"
  for par in EXDevMenuIsOnboardingFinished:YES EXDevMenuShowsAtLaunch:NO EXDevMenuShowFloatingActionButton:NO; do
    chave="${par%%:*}"
    valor="${par#*:}"
    if ! xcrun simctl spawn "$id" defaults write "$preferencias" "$chave" -bool "$valor" 2>> "$REGISTROS/expo-go-preferencias.txt"; then
      # Sem o serviço do simulador, direto no arquivo: o Expo Go ainda não abriu, nada guarda outra versão dele.
      if [ ! -f "$preferencias.plist" ]; then
        printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>' '<plist version="1.0"><dict/></plist>' > "$preferencias.plist"
      fi
      plutil -replace "$chave" -bool "$valor" "$preferencias.plist" 2>> "$REGISTROS/expo-go-preferencias.txt" || falhas=$((falhas + 1))
    fi
  done
  {
    echo "== Preferências do menu de desenvolvedor do Expo Go, antes da primeira abertura"
    xcrun simctl spawn "$id" defaults read "$preferencias" 2>&1 || plutil -p "$preferencias.plist" 2>&1 || true
  } | tee -a "$REGISTROS/expo-go-preferencias.txt"
  if [ "$falhas" -gt 0 ]; then
    aviso "$falhas de 3 preferências do menu do Expo Go não foram gravadas: a apresentação e o botão flutuante podem aparecer (os fluxos fecham o menu)."
  fi
}

# ---------------------------------------------------------------------------------------------------------------------
# metro: o Metro e a cache, servindo o Expo Go

metro() {
  iniciar_metro ios --go
}

# ---------------------------------------------------------------------------------------------------------------------
# Fluxos do Maestro: os três fluxos estão em comum.sh; aqui, o ajuste do simulador antes do fluxo 2

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

# "Reduzir transparência" no simulador: a preferência do sistema que o UIKit lê (UIAccessibilityIsReduceTransparencyEnabled),
# no domínio de acessibilidade. O app a pergunta ao abrir (AccessibilityInfo.isReduceTransparencyEnabled).
DOMINIO_ACESSIBILIDADE="com.apple.Accessibility"
CHAVE_TRANSPARENCIA="EnhancedBackgroundContrastEnabled"

# O valor da preferência: 1 ou 0, "ausente" (a chave não existe: vale o padrão, desligada) ou "desconhecido: <motivo>".
ler_transparencia() {
  local saida codigo=0
  saida="$(com_limite 30 xcrun simctl spawn "$(udid)" defaults read "$DOMINIO_ACESSIBILIDADE" "$CHAVE_TRANSPARENCIA" 2>&1)" || codigo=$?
  if [ "$codigo" -eq 0 ]; then
    printf '%s' "$saida"
  elif printf '%s' "$saida" | grep -Eq 'domain/default pair of .* does not exist|Domain .* does not exist'; then
    printf 'ausente'
  else
    printf 'desconhecido: código %s, %s' "$codigo" "$(printf '%s' "$saida" | head -1 | cut -c1-120)"
  fi
}

# Passada curta da alternativa opaca no iPhone, depois dos fluxos das telas (as capturas deles já estão guardadas, na
# pasta do Maestro de cada fase): liga a preferência de verdade, reabre o app (fluxos/variantes/transparencia-reduzida.yaml)
# e devolve a preferência ao estado de antes, aconteça o que acontecer com o fluxo. Nunca falha o passo: o que aconteceu
# fica em $SAIDA/transparencia-reduzida.txt, que a coleta resume. Se o simulador não aceitar a preferência, a passada diz
# isso e a prova principal não muda.
passada_transparencia_reduzida() {
  local estado="$SAIDA/transparencia-reduzida.txt" antes ligada depois
  antes="$(ler_transparencia)"
  echo "antes: $antes" > "$estado"
  if ! com_limite 30 xcrun simctl spawn "$(udid)" defaults write "$DOMINIO_ACESSIBILIDADE" "$CHAVE_TRANSPARENCIA" -bool true \
    >> "$REGISTROS/transparencia-reduzida.log" 2>&1; then
    echo "não rodou: a gravação da preferência falhou (defaults write)" >> "$estado"
    return 0
  fi
  ligada="$(ler_transparencia)"
  echo "ligada: $ligada" >> "$estado"
  if [ "$ligada" != "1" ]; then
    echo "não rodou: a preferência não ficou ligada na leitura de volta" >> "$estado"
  elif rodar_maestro transparencia "$PASTA_DOS_FLUXOS/variantes/transparencia-reduzida.yaml"; then
    echo "fluxo: completo" >> "$estado"
  else
    echo "fluxo: falhou (veja maestro-transparencia.log e tela-no-fim-de-transparencia.png)" >> "$estado"
  fi
  # De volta ao estado de antes: sem a chave, se ela não existia; com o valor de antes, se existia; desligada, se ele não
  # foi lido (é o padrão).
  case "$antes" in
    ausente) com_limite 30 xcrun simctl spawn "$(udid)" defaults delete "$DOMINIO_ACESSIBILIDADE" "$CHAVE_TRANSPARENCIA" ;;
    1) com_limite 30 xcrun simctl spawn "$(udid)" defaults write "$DOMINIO_ACESSIBILIDADE" "$CHAVE_TRANSPARENCIA" -bool true ;;
    *) com_limite 30 xcrun simctl spawn "$(udid)" defaults write "$DOMINIO_ACESSIBILIDADE" "$CHAVE_TRANSPARENCIA" -bool false ;;
  esac >> "$REGISTROS/transparencia-reduzida.log" 2>&1 || true
  depois="$(ler_transparencia)"
  echo "depois: $depois" >> "$estado"
  if [ "$depois" != "$antes" ] && ! { [ "$antes" != "1" ] && [ "$depois" = "0" ]; }; then
    aviso "\"Reduzir transparência\" não voltou ao estado de antes no simulador (antes: $antes; depois: $depois). O material calculado no ORIGEM.txt é lido na coleta e pode refletir a preferência ligada."
  fi
}

# O passo das telas no iPhone: os fluxos das telas e, depois, a passada de "Reduzir transparência". A falha das telas
# continua sendo a falha do passo; a passada só registra.
telas_e_transparencia() {
  local falha=0
  ( fluxo_telas ) || falha=$?
  ( passada_transparencia_reduzida ) || aviso "A passada de \"Reduzir transparência\" parou no meio; a prova principal não muda (veja transparencia-reduzida.log nos registros)."
  return "$falha"
}

# O resultado da passada de "Reduzir transparência", para o ORIGEM.txt e o sumário.
resultado_transparencia() {
  local estado="$SAIDA/transparencia-reduzida.txt" visto
  if [ ! -f "$estado" ]; then
    echo "Reduzir transparência ligada (passada extra no iPhone): não rodou (os fluxos das telas não chegaram a ela)"
    return 0
  fi
  if grep -q '^não rodou:' "$estado"; then
    echo "Reduzir transparência ligada (passada extra no iPhone): não rodou, $(sed -n 's/^não rodou: //p' "$estado" | head -1). Limitação do simulador; a prova principal não muda."
    return 0
  fi
  if [ -n "$(find "$SAIDA_MAESTRO/transparencia" -type f -name 'transparencia-reduzida-opaca.png' 2> /dev/null | head -1 || true)" ]; then
    visto="superfície opaca (barra-material-opaca), como pede a spec 05"
  elif [ -n "$(find "$SAIDA_MAESTRO/transparencia" -type f -name 'transparencia-reduzida-vidro.png' 2> /dev/null | head -1 || true)" ]; then
    visto="vidro (barra-material-vidro): com a preferência gravada, o app continuou no vidro"
  else
    visto="não identificado (nenhum dos dois testID apareceu)"
  fi
  echo "Reduzir transparência ligada (passada extra no iPhone, a preferência do sistema no simulador): material observado $visto; captura transparencia-reduzida-minhas-trilhas.png; preferência $CHAVE_TRANSPARENCIA $(sed -n 's/^antes: //p' "$estado") antes, $(sed -n 's/^ligada: //p' "$estado") na passada e $(sed -n 's/^depois: //p' "$estado") depois; $(sed -n 's/^fluxo: /fluxo /p' "$estado")"
}

# ---------------------------------------------------------------------------------------------------------------------
# coletar: junta as capturas, diz o que faltou e arruma os registros (o comum está em comum.sh)

# O material que o app deveria usar na barra de baixo, calculado aqui (spec 05, "Barra de abas em cápsula"): o Liquid Glass
# quando o vidro existe e "Reduzir transparência" está desligada; senão, a superfície branca opaca. É uma estimativa: o que
# o app desenhou de fato vem do testID que o fluxo 80 viu (material_observado, em comum.sh).
# O vidro existe quando o aplicativo que roda o JavaScript (aqui, o Expo Go) foi feito com o Xcode 26 ou mais novo, roda no
# iOS 26 ou mais novo e não pede UIDesignRequiresCompatibility: é a conta de isLiquidGlassAvailable, no expo-glass-effect.
# A preferência de transparência vem do domínio de acessibilidade do simulador (EnhancedBackgroundContrastEnabled, a chave
# de UIAccessibilityIsReduceTransparencyEnabled). Cada dado tem três estados: lido, ausente de fato (vale o padrão) e
# desconhecido (a leitura falhou ou não respondeu). Um desconhecido nunca vira "desligada" nem "indisponível".
material_da_barra() {
  local id plist xcode="" sdk="" compat="" ios rt tamanho saida codigo feito26 vidro material nota=""
  id="${CONFERENCIA_UDID:-$(cat "$SAIDA/udid" 2> /dev/null || true)}"
  plist="$FERRAMENTAS/Expo Go.app/Info.plist"
  if [ -f "$plist" ]; then
    xcode="$(/usr/libexec/PlistBuddy -c 'Print :DTXcode' "$plist" 2> /dev/null || true)"
    sdk="$(/usr/libexec/PlistBuddy -c 'Print :DTSDKName' "$plist" 2> /dev/null || true)"
    # Sem a chave (o normal), o app não pede o visual antigo; outro erro deixa o valor desconhecido.
    codigo=0
    saida="$(/usr/libexec/PlistBuddy -c 'Print :UIDesignRequiresCompatibility' "$plist" 2>&1)" || codigo=$?
    if [ "$codigo" -eq 0 ]; then
      compat="$saida"
    elif printf '%s' "$saida" | grep -q 'Does Not Exist'; then
      compat="ausente"
    fi
  else
    nota="; o Info.plist do Expo Go não foi achado"
  fi
  ios="$(sed -n 's/^Simulador: .*, iOS \([0-9][0-9]*\).*/\1/p' "$SAIDA/origem-simulador.txt" 2> /dev/null | head -1 || true)"

  # Feito com o Xcode 26 (o compilador do Swift 6.2): pelo DTXcode (2600 ou mais) ou, sem ele, pelo SDK (iphonesimulator26.x).
  if [ -n "$xcode" ] && [ "$xcode" -eq "$xcode" ] 2> /dev/null; then
    if [ "$xcode" -ge 2600 ]; then feito26="sim"; else feito26="não"; fi
  elif printf '%s' "$sdk" | grep -Eq '^iphone(simulator|os)[0-9]+'; then
    if [ "$(printf '%s' "$sdk" | sed 's/^iphone[a-z]*\([0-9][0-9]*\).*/\1/')" -ge 26 ]; then feito26="sim"; else feito26="não"; fi
  else
    feito26="?"
  fi
  if [ "$feito26" = "não" ] || { [ -n "$ios" ] && [ "$ios" -lt 26 ]; } || [ "$compat" = "true" ]; then
    vidro="indisponível"
  elif [ "$feito26" = "?" ] || [ -z "$ios" ] || [ -z "$compat" ]; then
    vidro="desconhecido"
  else
    vidro="disponível"
  fi

  if [ -z "$id" ]; then
    rt="desconhecida (sem o identificador do simulador)"
  else
    codigo=0
    saida="$(com_limite 30 xcrun simctl spawn "$id" defaults read com.apple.Accessibility EnhancedBackgroundContrastEnabled 2>&1)" || codigo=$?
    if [ "$codigo" -eq 0 ]; then
      case "$saida" in
        1) rt="ligada" ;;
        0) rt="desligada" ;;
        *) rt="desconhecida (valor lido: $(printf '%s' "$saida" | head -1 | cut -c1-60))" ;;
      esac
    elif printf '%s' "$saida" | grep -Eq 'domain/default pair of .* does not exist|Domain .* does not exist'; then
      rt="desligada (a chave não existe no simulador: vale o padrão)"
    elif [ "$codigo" -eq 142 ]; then
      rt="desconhecida (a leitura não respondeu em 30 s)"
    else
      rt="desconhecida (a leitura falhou, código $codigo: $(printf '%s' "$saida" | head -1 | cut -c1-120))"
    fi
  fi

  if [ -z "$id" ]; then
    tamanho="desconhecido (sem o identificador do simulador)"
  else
    codigo=0
    saida="$(com_limite 30 xcrun simctl ui "$id" content_size 2>&1)" || codigo=$?
    saida="$(printf '%s' "$saida" | tr -d '\r' | head -1)"
    if [ "$codigo" -eq 0 ] && [ -n "$saida" ]; then tamanho="$saida"; else tamanho="desconhecido (a leitura falhou, código $codigo)"; fi
  fi

  if [ "$vidro" = "indisponível" ] || [ "$rt" = "ligada" ]; then
    material="superfície branca opaca"
  elif [ "$vidro" = "disponível" ] && [ "${rt%% *}" = "desligada" ]; then
    material="Liquid Glass"
  else
    material="desconhecido"
  fi
  echo "Vidro, pela conta de isLiquidGlassAvailable (calculado): $vidro (iOS ${ios:-desconhecido}; Expo Go feito com o Xcode ${xcode:-desconhecido}, SDK ${sdk:-desconhecido}; UIDesignRequiresCompatibility ${compat:-desconhecida}$nota)"
  echo "Reduzir transparência (lida no simulador): $rt"
  echo "Tamanho do texto do sistema (lido no simulador): $tamanho"
  echo "Material calculado da barra (estimativa, não é o observado): $material"
}

coletar() {
  local dados
  # A leitura do Expo Go e do simulador roda à parte: uma falha dela vira "desconhecido" e não para a coleta das capturas.
  {
    echo "Expo Go: $(cat "$SAIDA/expo-go-versao" 2> /dev/null || echo '?')"
    ( material_da_barra ) 2>> "$REGISTROS/material-da-barra.txt" \
      || echo "Material calculado da barra (estimativa, não é o observado): desconhecido (a leitura do Expo Go ou do simulador falhou; veja material-da-barra.txt nos registros)"
    ( resultado_transparencia ) 2>> "$REGISTROS/material-da-barra.txt" || true
  } > "$SAIDA/origem-app.txt" || true
  coletar_inicio "simulador de iPhone numa máquina do GitHub Actions, com o app servido pelo Metro (sem modo de desenvolvimento) dentro do Expo Go. Não é aparelho de verdade."
  # As imagens da passada de "Reduzir transparência" vão junto das capturas.
  find "$SAIDA_MAESTRO" -type f -name 'transparencia-reduzida-*.png' -exec cp -f {} "$CAPTURAS/" \; 2> /dev/null || true
  resumir_barra "$SAIDA/origem-app.txt"
  if ! grep -q '^Reduzir transparência ligada .*material observado superfície opaca' "$SAIDA/origem-app.txt" 2> /dev/null; then
    aviso "A passada de \"Reduzir transparência\" no iPhone não mostrou a superfície opaca: $(grep '^Reduzir transparência ligada' "$SAIDA/origem-app.txt" 2> /dev/null | sed 's/^Reduzir transparência ligada //' | head -1 || true)"
  fi

  # O que o Expo Go guardou das preferências do menu de desenvolvedor depois dos fluxos (o arquivo, como está no disco).
  if dados="$(xcrun simctl get_app_container "$(udid)" "$EXPO_GO" data 2> /dev/null)" && [ -n "$dados" ]; then
    {
      echo "== Preferências do menu de desenvolvedor do Expo Go, depois dos fluxos"
      plutil -p "$dados/Library/Preferences/$EXPO_GO.plist" 2>&1 | grep -E 'EXDevMenu|DevMenuFAB|^\{|^\}' || echo "(arquivo ausente)"
    } >> "$REGISTROS/expo-go-preferencias.txt" 2> /dev/null || true
  fi
  if [ -n "$(find "$SAIDA_MAESTRO" -type f -name 'aviso-botao-do-expo-go.png' 2> /dev/null | head -1)" ]; then
    aviso "O botão flutuante do Expo Go (engrenagem azul) ficou sobre o app: ele aparece nas capturas. Veja aviso-botao-do-expo-go.png e expo-go-preferencias.txt nos registros."
  fi

  coletar_tabela "Origem: simulador de iPhone numa máquina do GitHub Actions, com o app servido pelo Metro no Expo Go. Não é aparelho de verdade. Aparelho, iOS, Expo Go e commit estão em ORIGEM.txt, no artefato das capturas."

  # O registro do Expo Go no simulador ajuda a entender uma tela em branco ou um erro de rede do app.
  com_limite 120 xcrun simctl spawn "$(udid)" log show --last 30m --style compact --predicate 'process == "Expo Go"' \
    > "$REGISTROS/simulador-expo-go.log" 2> /dev/null || true

  coletar_fim
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
  fluxo-telas) telas_e_transparencia ;;
  coletar) coletar ;;
  *)
    echo "Uso: $0 sonda|ligar|servidor|simulador|maestro|metro|fluxo-entrada|sem-preenchimento|fluxo-entrar|fluxo-telas|coletar" >&2
    exit 2
    ;;
esac
