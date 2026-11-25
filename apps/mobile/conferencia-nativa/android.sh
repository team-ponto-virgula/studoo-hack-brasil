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
  resumo "| Emulador | Android 15 (API 35, google_apis x86_64), 720 × 1560 a 320 dpi: 360 × 780 dp |"
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
    -e "s|openLink: exp://127\\.0\\.0\\.1:$PORTA_METRO\$|openLink: \"$LINK_DO_APP\"|" \
    -e '/^- startRecording:/d' -e '/^- stopRecording/d' {} +
  # Sem o vídeo da criação no Android: gravar a tela (screenrecord) com a GPU por software e o registro de áudio ao mesmo
  # tempo pesava na máquina quando o emulador caiu (execução 44911656576). O vídeo continua no iPhone.
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

# As telas rodam uma sessão do Maestro por fluxo (comum.sh, fluxo_telas_uma_por_vez), com o aparelho conferido antes de
# cada uma.
TELAS_UMA_POR_VEZ=1
# A prova da criação roda depois das telas no Android: se o emulador cair nela, as telas já estão capturadas.
CRIACAO_DEPOIS_DAS_TELAS=1

# O emulador ainda está no adb e o sistema dele responde? Espera até 60 s (um adb que reconecta volta nesse tempo); se não
# voltar, guarda o momento na carga da máquina e diz que não.
aparelho_responde() {
  local tentativa id
  for tentativa in 1 2 3 4 5 6; do
    id="$(dispositivo)"
    if [ -n "$id" ] && [ "$(timeout 20 adb -s "$id" shell getprop sys.boot_completed 2> /dev/null | tr -d '\r')" = "1" ]; then
      return 0
    fi
    sleep 10
  done
  echo "$(date -u +%H:%M:%S) o emulador não responde no adb há 60 s" >> "$REGISTROS/carga-da-maquina.log"
  adb devices -l >> "$REGISTROS/carga-da-maquina.log" 2>&1 || true
  return 1
}

# A carga da máquina a cada 15 s, enquanto o emulador roda: carga média, memória livre e troca, o processo do emulador
# (memória e CPU) e se o adb ainda o vê. É o que falta para dizer por que o emulador some (máquina sem memória, sem CPU
# ou o processo morto por outro motivo).
iniciar_registro_de_carga() {
  {
    echo "hora (UTC) | carga 1/5/15 min | memória MB: total usada livre compartilhada cache disponível | troca MB: total usada livre | emulador: RSS MB, %CPU | adb"
    while :; do
      printf '%s | %s | %s | %s | %s | %s\n' "$(date -u +%H:%M:%S)" "$(cut -d' ' -f1-3 /proc/loadavg)" \
        "$(free -m | awk '/^Mem:/ { print $2, $3, $4, $5, $6, $7 }')" "$(free -m | awk '/^Swap:/ { print $2, $3, $4 }')" \
        "$(ps -C qemu-system-x86_64 -o rss=,pcpu= 2> /dev/null | awk '{ printf "%d %s", $1 / 1024, $2 }')" \
        "$(adb devices 2> /dev/null | awk 'NR > 1 && NF { printf "%s=%s ", $1, $2 }')"
      sleep 15
    done
  } >> "$REGISTROS/carga-da-maquina.log" 2>&1 &
  echo $! > "$SAIDA/registro-de-carga.pid"
}

# Os maiores processos e o fim do registro do kernel: um emulador morto pelo kernel por falta de memória aparece aqui
# ("Out of memory: Killed process ... qemu-system").
guardar_estado_da_maquina() {
  if [ -f "$SAIDA/registro-de-carga.pid" ]; then
    kill "$(cat "$SAIDA/registro-de-carga.pid")" 2> /dev/null || true
    rm -f "$SAIDA/registro-de-carga.pid"
  fi
  ps -eo pid,rss,pcpu,etime,comm --sort=-rss 2> /dev/null | head -25 > "$REGISTROS/processos-no-fim.txt" || true
  sudo -n dmesg -T 2> /dev/null | tail -n 400 > "$REGISTROS/dmesg-fim.txt" || true
  if grep -qiE 'out of memory|oom-kill|killed process' "$REGISTROS/dmesg-fim.txt" 2> /dev/null; then
    aviso "O kernel matou processo por falta de memória durante o passo do emulador: $(grep -iE 'killed process' "$REGISTROS/dmesg-fim.txt" | tail -1 | cut -c1-200)"
  fi
}

# No fim do passo, com ou sem falha: o estado da máquina, o fim do registro do Android e a tela do emulador.
depois_do_emulador() {
  local id
  guardar_estado_da_maquina
  id="$(dispositivo)"
  [ -n "$id" ] || return 0
  adb -s "$id" logcat -d -v time 2> /dev/null | tail -n 5000 | cut -c1-600 > "$REGISTROS/logcat-fim.txt" || true
  capturar_tela_do_aparelho "$REGISTROS/tela-no-fim-do-emulador.png"
}

# O aparelho pronto para os fluxos: tamanho e densidade, barra fixa, teclado da tela, sem janelas de erro do sistema e as
# portas da API e do Metro. Roda no começo e de novo depois de religar o emulador (reviver_aparelho).
preparar_aparelho() {
  local id="$1" comando
  # 360 × 780 dp, a largura dos pares de 360 da web: 720 × 1560 a 320 dpi. Antes era 1080 × 2340 a 480 (os mesmos dp), mas a
  # GPU do emulador é por software (swiftshader) e desenha cada quadro na CPU: 2,25 vezes menos pixels pesam menos na máquina
  # que caiu na execução 44911656576 (carga 8 a 9 com 4 vCPUs, emulador a 350% de CPU e 5,8 GB quando sumiu).
  adb -s "$id" shell wm size 720x1560
  adb -s "$id" shell wm density 320
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
  # Sem as janelas de erro do sistema por cima do app: com a máquina carregada, o "Pixel Launcher isn't responding" cobriu a
  # entrada na execução 44809026116 e o primeiro fluxo não achou nenhum id. hide_error_dialogs esconde as janelas de travamento
  # e de "não está respondendo"; anr_show_background=0 não mostra as de processos em segundo plano (o launcher, com o app na
  # frente). Uma janela que já esteja aberta fecha com CLOSE_SYSTEM_DIALOGS. Os fluxos ainda tocam "Wait" se ela voltar
  # (partes/sair-do-menu-do-expo-go.yaml).
  adb -s "$id" shell settings put global hide_error_dialogs 1 || true
  adb -s "$id" shell settings put secure anr_show_background 0 || true
  adb -s "$id" shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1 || true
  echo "Janelas de erro do sistema: hide_error_dialogs=$(adb -s "$id" shell settings get global hide_error_dialogs | tr -d '\r'), anr_show_background=$(adb -s "$id" shell settings get secure anr_show_background | tr -d '\r')"

  # A API (HTTPS) e a cache do Metro chegam ao emulador como 127.0.0.1, como no iPhone.
  timeout 20 adb -s "$id" reverse "tcp:$PORTA_API" "tcp:$PORTA_API" > /dev/null || return 1
  timeout 20 adb -s "$id" reverse "tcp:$PORTA_METRO" "tcp:$PORTA_METRO" > /dev/null || return 1

}

# Religa o emulador quando ele some do adb (execução 44911656576: o processo do emulador saiu no toque em "Começar" da
# criação, e os fluxos seguintes não tinham aparelho). Mesmo AVD do ReactiveCircus/android-emulator-runner ("test"), mesmas
# opções do workflow, sem snapshot: o disco do AVD continua, então o APK instalado e a sessão do app ficam. Espera o boot
# (até 6 min), prepara o aparelho de novo e devolve 0; sem o binário ou sem boot, devolve 1 e os fluxos seguintes ficam como
# "não rodou", como antes.
# O driver do Maestro parado e os encaminhamentos de porta dele desfeitos, para a nova partida (rodar_maestro, em comum.sh).
# Só `adb forward`: o `adb reverse` da API e do Metro continua.
limpar_driver_maestro() {
  local id; id="$(dispositivo)"
  adb -s "$id" shell am force-stop dev.mobile.maestro > /dev/null 2>&1 || true
  adb -s "$id" shell am force-stop dev.mobile.maestro.test > /dev/null 2>&1 || true
  adb -s "$id" forward --remove-all > /dev/null 2>&1 || true
}

REVIVIDOS=0
reviver_aparelho() {
  local sdk emulador avd id fim
  sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  emulador="$sdk/emulator/emulator"
  avd="${AVD_DA_CONFERENCIA:-test}"
  [ -x "$emulador" ] || { echo "$(date -u +%H:%M:%S) sem o binário do emulador em $emulador: não dá para religar" >> "$REGISTROS/carga-da-maquina.log"; return 1; }
  REVIVIDOS=$((REVIVIDOS + 1))
  echo "$(date -u +%H:%M:%S) religando o emulador ($avd), vez $REVIVIDOS" >> "$REGISTROS/carga-da-maquina.log"
  # Um processo do emulador que ficou pendurado sem responder ao adb sai antes (é o do próprio passo, na máquina do CI).
  pkill -f "qemu-system-x86_64.*-avd $avd" 2> /dev/null || true
  adb kill-server > /dev/null 2>&1 || true
  adb start-server > /dev/null 2>&1 || true
  nohup "$emulador" -avd "$avd" -no-window -gpu swiftshader_indirect -no-snapshot -noaudio -no-boot-anim -camera-back none \
    -cores 3 -memory 4096 > "$REGISTROS/emulador-religado-$REVIVIDOS.log" 2>&1 &
  fim=$(( $(date +%s) + 360 ))
  while [ "$(date +%s)" -lt "$fim" ]; do
    id="$(dispositivo)"
    if [ -n "$id" ] && [ "$(timeout 20 adb -s "$id" shell getprop sys.boot_completed 2> /dev/null | tr -d '\r')" = "1" ]; then
      if ! timeout 20 adb -s "$id" shell pm path "$PACOTE_ANDROID" | grep -q '^package:' || ! preparar_aparelho "$id"; then
        echo "$(date -u +%H:%M:%S) emulador religado sem o app instalado ou sem acesso às portas da API e do Metro" >> "$REGISTROS/carga-da-maquina.log"
        return 1
      fi
      echo "$(date -u +%H:%M:%S) emulador de volta ($id)" >> "$REGISTROS/carga-da-maquina.log"
      return 0
    fi
    sleep 10
  done
  echo "$(date -u +%H:%M:%S) o emulador religado não terminou o boot em 6 min" >> "$REGISTROS/carga-da-maquina.log"
  return 1
}

no_emulador() {
  local id comando versao api modelo escala codigo
  trap depois_do_emulador EXIT
  iniciar_registro_de_carga
  id="$(dispositivo)"
  [ -n "$id" ] || erro "Nenhum emulador ligado no adb."

  preparar_aparelho "$id"

  if ! adb -s "$id" install -r "$APK" > "$REGISTROS/adb-instalar.log" 2>&1; then
    mostrar_registro "$REGISTROS/adb-instalar.log"
    erro "O APK de debug não instalou no emulador."
  fi
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
