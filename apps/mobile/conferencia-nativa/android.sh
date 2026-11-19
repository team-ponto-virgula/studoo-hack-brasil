#!/usr/bin/env bash
# Conferência nativa do app num emulador de Android, nas máquinas Ubuntu do GitHub Actions. É a rota A1 de
# docs/BUILD-ANDROID.md: o build de debug do próprio projeto, que confia na CA local só no debug
# (plugins/with-android-piloto-ca.cjs), com o JavaScript do Metro desta máquina e a API em HTTPS, as duas por `adb reverse`.
#
# Cada subcomando é um passo do job `android` de `.github/workflows/capturas-nativas.yml`, na ordem:
#   sonda -> servidor -> app -> maestro -> metro -> no-emulador (dentro do passo do emulador) -> coletar
# O emulador só existe durante o passo dele: a preparação do aparelho e os três fluxos rodam ali, em `no-emulador`.
# O que vale também para o iPhone (a API, o Maestro, o Metro, os fluxos e a coleta) está em comum.sh. Os fluxos são os
# mesmos, numa cópia com o pacote e o link deste app.
#
# Nada daqui fala com o site publicado nem usa segredo.
set -eo pipefail

TITULO_DA_CONFERENCIA="Conferência nativa (Android)"
# shellcheck source=apps/mobile/conferencia-nativa/comum.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comum.sh"

PACOTE_ANDROID="com.studoo.mobile.dev"
# O cliente de desenvolvimento abre o projeto por este link; a porta é a da cache do Metro, que o `adb reverse` leva à máquina.
LINK_DO_APP="studoo-dev://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${PORTA_METRO}"
PASTA_DOS_FLUXOS="$SAIDA/fluxos-android"
PROJETO_ANDROID="$RAIZ/apps/mobile/android"
APK="$PROJETO_ANDROID/app/build/outputs/apk/debug/app-debug.apk"

# O emulador que o adb vê (o Maestro usa o mesmo identificador) e a tela dele, para rodar_maestro (comum.sh).
dispositivo() {
  { adb devices 2> /dev/null | awk 'NR > 1 && $2 == "device" { print $1 }' | head -1; } || true
}
capturar_tela_do_aparelho() {
  local id
  id="$(dispositivo)"
  [ -n "$id" ] || return 0
  adb -s "$id" exec-out screencap -p > "$1" 2> /dev/null || true
}

# ---------------------------------------------------------------------------------------------------------------------
# sonda: o que a máquina tem

sonda() {
  echo "::group::Versões"
  {
    echo "Sistema: $(. /etc/os-release && echo "$PRETTY_NAME"), $(uname -m)"
    echo "CPU: $(nproc) | memória: $(free -g | awk '/^Mem/ {print $2}') GB | disco livre: $(df -h / | awk 'NR==2 {print $4}')"
    echo "KVM: $([ -e /dev/kvm ] && echo presente || echo ausente)"
    echo "Node: $(node --version 2> /dev/null || echo ausente) | npm: $(npm --version 2> /dev/null || echo ausente)"
    echo "Java: $(java -version 2>&1 | head -1)"
    echo "SDK do Android: ${ANDROID_HOME:-${ANDROID_SDK_ROOT:-ausente}}"
    echo "OpenSSL: $("$OPENSSL" version 2> /dev/null || echo ausente)"
  } | tee "$REGISTROS/sonda-versoes.txt"
  echo "::endgroup::"
  [ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ] || erro "A máquina não tem o SDK do Android (ANDROID_HOME): não há como compilar o app nem ligar o emulador."
  command -v java > /dev/null || erro "A máquina não tem Java: o Gradle e o Maestro precisam dele."
  [ -e /dev/kvm ] || aviso "A máquina não tem /dev/kvm: o emulador vai rodar sem aceleração e bem mais devagar."

  resumo "### Conferência nativa no Android"
  resumo ""
  resumo "| | |"
  resumo "|---|---|"
  resumo "| Máquina | $(. /etc/os-release && echo "$PRETTY_NAME"), $(nproc) CPUs |"
  resumo "| Emulador | Android 15 (API 35, google_apis x86_64), 1080 × 2340 a 480 dpi: 360 × 780 dp |"
  resumo "| App | build de debug do projeto ($PACOTE_ANDROID), com o JavaScript do Metro sem modo de desenvolvimento |"
  resumo "| Dados | API do repositório nesta máquina, com IA simulada e conta sintética |"
  resumo ""
}

# ---------------------------------------------------------------------------------------------------------------------
# app: o projeto Android gerado aqui (apps/mobile/android/ é ignorado pelo Git) e o APK de debug

app() {
  local tamanho
  [ -f "$TLS/ca.crt" ] || erro "Sem a CA local: o passo da API não rodou (o build de debug embute a CA)."
  cd "$RAIZ/apps/mobile"
  # O plugin with-android-piloto-ca põe a CA só no build de debug, para 127.0.0.1 e localhost.
  if ! STUDOO_ANDROID_PILOTO_CA="$TLS/ca.crt" CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install \
    > "$REGISTROS/prebuild.log" 2>&1; then
    mostrar_registro "$REGISTROS/prebuild.log"
    erro "O \`expo prebuild\` do Android falhou."
  fi
  [ -f "$PROJETO_ANDROID/app/src/debug/res/raw/studoo_piloto_ca.crt" ] \
    || erro "O build de debug ficou sem a CA local: o plugin with-android-piloto-ca não rodou no prebuild."
  node "$AQUI/servidor/manifesto-android.mjs" "$PROJETO_ANDROID/app/src/debug/AndroidManifest.xml" \
    || erro "Não deu para pôr no manifesto de debug os padrões do menu de desenvolvedor."

  cd "$PROJETO_ANDROID"
  # Memória do Gradle para a nova arquitetura (o padrão do modelo é 2 GB); só a arquitetura do emulador (x86_64).
  sed -i 's/^org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError/' gradle.properties
  if ! ./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon --stacktrace > "$REGISTROS/gradle.log" 2>&1; then
    mostrar_registro "$REGISTROS/gradle.log" 150
    erro "O build de debug do Android (Gradle) falhou. O fim do registro está no passo e em gradle.log."
  fi
  [ -f "$APK" ] || erro "O Gradle terminou sem o APK de debug ($APK)."
  tamanho="$(du -h "$APK" | cut -f1)"
  echo "App: $PACOTE_ANDROID, build de debug do projeto ($tamanho, x86_64), JavaScript do Metro sem modo de desenvolvimento" \
    > "$SAIDA/origem-app.txt"
  resumo "✅ Build de debug do Android pronto ($tamanho)."
}

# ---------------------------------------------------------------------------------------------------------------------
# metro: o Metro e a cache, servindo o cliente de desenvolvimento do build de debug

metro() {
  iniciar_metro android --dev-client
}

# ---------------------------------------------------------------------------------------------------------------------
# no-emulador: dentro do passo do emulador, prepara o aparelho e roda os três fluxos

# Os mesmos fluxos, com o pacote do app e o link do cliente de desenvolvimento no lugar dos do Expo Go.
preparar_fluxos_android() {
  rm -rf "$PASTA_DOS_FLUXOS"
  cp -R "$AQUI/fluxos" "$PASTA_DOS_FLUXOS"
  find "$PASTA_DOS_FLUXOS" -name '*.yaml' -exec sed -i \
    -e "s|^appId: host\\.exp\\.Exponent\$|appId: $PACOTE_ANDROID|" \
    -e "s|openLink: exp://127\\.0\\.0\\.1:$PORTA_METRO\$|openLink: \"$LINK_DO_APP\"|" {} +
  if grep -rlE '^appId: host\.exp\.Exponent|openLink: exp://' "$PASTA_DOS_FLUXOS" > /dev/null; then
    erro "Algum fluxo ficou com o pacote ou o link do Expo Go na cópia do Android."
  fi
}

# O que o áudio registra enquanto a prova da criação de trilha roda (comum.sh, fluxo_criacao): o logcat ao vivo, só com
# as etiquetas do áudio (AudioTrack, AudioFlinger, AAudio, o servidor e o HAL de áudio, o ExoPlayer do expo-audio) e o
# JavaScript do app (ReactNativeJS, onde fica o registro de som do app, se ele existir). O emulador roda com -noaudio: o
# sistema de áudio funciona, mas nada sai para gravar.
iniciar_registro_de_audio() {
  # Com -v epoch, cada linha traz os segundos desde 1970, sem depender do fuso nem do ano do emulador.
  adb -s "$(dispositivo)" logcat -v threadtime -v epoch -T 1 -s 'AudioTrack:V' 'AudioFlinger:V' 'AAudio:V' 'AudioPolicyManager:V' \
    'audioserver:V' 'android.hardware.audio:V' 'ExoPlayerImpl:V' 'MediaCodec:V' 'ReactNativeJS:V' > "$1" 2>&1 &
  echo $! > "$SAIDA/registro-de-audio.pid"
}
parar_registro_de_audio() {
  if [ -f "$SAIDA/registro-de-audio.pid" ]; then
    kill "$(cat "$SAIDA/registro-de-audio.pid")" 2> /dev/null || true
    rm -f "$SAIDA/registro-de-audio.pid"
  fi
}

# No fim do passo, com ou sem falha: o fim do registro do Android e a tela do emulador.
depois_do_emulador() {
  local id
  id="$(dispositivo)"
  [ -n "$id" ] || return 0
  adb -s "$id" logcat -d -v time 2> /dev/null | tail -n 5000 | cut -c1-600 > "$REGISTROS/logcat-fim.txt" || true
  capturar_tela_do_aparelho "$REGISTROS/tela-no-fim-do-emulador.png"
}

no_emulador() {
  local id comando versao api modelo escala codigo
  trap depois_do_emulador EXIT
  id="$(dispositivo)"
  [ -n "$id" ] || erro "Nenhum emulador ligado no adb."

  # 360 × 780 dp, a largura dos pares de 360 da web: 1080 × 2340 a 480 dpi.
  adb -s "$id" shell wm size 1080x2340
  adb -s "$id" shell wm density 480
  # Barra de status fixa nas capturas (modo de demonstração do Android): 9:41, bateria cheia, sinal cheio, sem notificações.
  adb -s "$id" shell settings put global sysui_demo_allowed 1
  for comando in "enter" "clock -e hhmm 0941" "battery -e level 100 -e plugged false" \
    "network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4" "notifications -e visible false"; do
    # O comando tem várias palavras de propósito: cada uma é um argumento do broadcast.
    # shellcheck disable=SC2086
    adb -s "$id" shell am broadcast -a com.android.systemui.demo -e command $comando > /dev/null || true
  done
  # O teclado da tela aparece mesmo com o teclado do computador, como num celular; sem preenchimento automático de senhas.
  adb -s "$id" shell settings put secure show_ime_with_hard_keyboard 1 || true
  adb -s "$id" shell settings put secure autofill_service null || true

  if ! adb -s "$id" install -r "$APK" > "$REGISTROS/adb-instalar.log" 2>&1; then
    mostrar_registro "$REGISTROS/adb-instalar.log"
    erro "O APK de debug não instalou no emulador."
  fi
  # A API (HTTPS) e a cache do Metro chegam ao emulador como 127.0.0.1, como no iPhone.
  adb -s "$id" reverse "tcp:$PORTA_API" "tcp:$PORTA_API" > /dev/null
  adb -s "$id" reverse "tcp:$PORTA_METRO" "tcp:$PORTA_METRO" > /dev/null

  versao="$(adb -s "$id" shell getprop ro.build.version.release | tr -d '\r')"
  api="$(adb -s "$id" shell getprop ro.build.version.sdk | tr -d '\r')"
  modelo="$(adb -s "$id" shell getprop ro.product.model | tr -d '\r')"
  echo "Emulador: $modelo, Android $versao (API $api), $(adb -s "$id" shell wm size | tr -d '\r' | tail -1), $(adb -s "$id" shell wm density | tr -d '\r' | tail -1)" \
    > "$SAIDA/origem-simulador.txt"
  # A barra de baixo no Android é sempre a superfície branca opaca (spec 05: o vidro é só do iPhone com iOS 26): é o
  # material calculado; o observado vem do testID que o fluxo 80 viu (material_observado, em comum.sh). O tamanho do texto
  # do sistema entra junto, porque a barra cresce com ele. "null" é a chave ausente (vale o padrão, 1,0); uma falha de
  # leitura fica como desconhecida e não para o passo.
  codigo=0
  escala="$(adb -s "$id" shell settings get system font_scale 2>&1 | tr -d '\r')" || codigo=$?
  if [ "$codigo" -ne 0 ] || [ -z "$escala" ]; then
    escala="desconhecido (a leitura falhou, código $codigo)"
  elif [ "$escala" = "null" ]; then
    escala="1.0 (a chave não existe: vale o padrão)"
  fi
  {
    echo "Tamanho do texto do sistema (lido no emulador): font_scale $escala"
    echo "Material calculado da barra (estimativa, não é o observado): superfície branca opaca (o Android não tem o vidro; spec 05)"
  } >> "$SAIDA/origem-simulador.txt"
  cat "$SAIDA/origem-simulador.txt"

  preparar_fluxos_android
  fluxo_entrada
  fluxo_entrar
  fluxo_telas
}

# ---------------------------------------------------------------------------------------------------------------------
# coletar: junta as capturas, diz o que faltou e arruma os registros (o comum está em comum.sh)

coletar() {
  coletar_inicio "emulador de Android numa máquina do GitHub Actions, com o build de debug do próprio projeto e o JavaScript servido pelo Metro (sem modo de desenvolvimento). Não é aparelho de verdade."
  resumir_barra "$SAIDA/origem-simulador.txt"
  coletar_tabela "Origem: emulador de Android numa máquina do GitHub Actions, com o build de debug do projeto. Não é aparelho de verdade. Emulador, Android, app e commit estão em ORIGEM.txt, no artefato das capturas."
  coletar_fim
}

# ---------------------------------------------------------------------------------------------------------------------

case "${1:-}" in
  sonda) sonda ;;
  servidor) servidor ;;
  app) app ;;
  maestro) instalar_maestro ;;
  metro) metro ;;
  no-emulador) no_emulador ;;
  coletar) coletar ;;
  *)
    echo "Uso: $0 sonda|servidor|app|maestro|metro|no-emulador|coletar" >&2
    exit 2
    ;;
esac
