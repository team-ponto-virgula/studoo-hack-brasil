#!/usr/bin/env bash
# Dentro do emulador (android-emulator-runner): instala o APK final como veio, põe o PDF do material em Downloads, liga a
# barra de status de demonstração, roda o fluxo do material (ramo teste/landing-material) e guarda capturas, registros e o
# fim do logcat em $SAIDA. Sai com o código do Maestro.
set -u
SAIDA="${RUNNER_TEMP:-/tmp}/apk-final"
mkdir -p "$SAIDA/capturas" "$SAIDA/registros" "$SAIDA/maestro"
adb wait-for-device
adb shell getprop ro.build.version.release > "$SAIDA/registros/android-versao.txt"
adb install -r "$SAIDA/studoo-final.apk" > "$SAIDA/registros/adb-instalar.log" 2>&1
codigo_instalar=$?
cat "$SAIDA/registros/adb-instalar.log"
adb shell dumpsys package com.studoo.mobile.dev | grep -E "versionName|versionCode|firstInstallTime" > "$SAIDA/registros/pacote-instalado.txt" 2>&1
cat "$SAIDA/registros/pacote-instalado.txt"
if [ "$codigo_instalar" -ne 0 ]; then echo "::error::O APK não instalou no emulador."; exit 1; fi
# O material: PDF de uma página com texto do Studoo, em Downloads, visto pelo MediaStore (o seletor lista por ele).
adb push "$GITHUB_WORKSPACE/apps/mobile/conferencia-nativa/apk-final/regra-dos-tercos.pdf" /sdcard/Download/regra-dos-tercos.pdf
adb shell content call --method scan_volume --uri content://media --arg external_primary > /dev/null 2>&1 || true
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/regra-dos-tercos.pdf > /dev/null 2>&1 || true
adb shell ls -l /sdcard/Download/ | tee "$SAIDA/registros/downloads.txt"
# Tela de 720 × 1560 a 320 dpi (360 × 780 dp), a proporção do celular Android da página de apresentação (Web & API, 24/11).
adb shell wm size 720x1560
adb shell wm density 320
# Barra de status fixa (modo de demonstração do Android), como em android.sh: 9:41, bateria e sinal cheios, sem notificações.
adb shell settings put global sysui_demo_allowed 1
for comando in "enter" "clock -e hhmm 0941" "battery -e level 100 -e plugged false" \
  "network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4" "notifications -e visible false"; do
  # shellcheck disable=SC2086
  adb shell am broadcast -a com.android.systemui.demo -e command $comando > /dev/null || true
done
adb logcat -c || true
cd "$SAIDA/maestro"
MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=true "$MAESTRO" test "$GITHUB_WORKSPACE/apps/mobile/conferencia-nativa/apk-final/material.yaml" \
  --test-output-dir "$SAIDA/maestro" < /dev/null 2>&1 | tee "$SAIDA/registros/maestro.log"
codigo=${PIPESTATUS[0]}
find "$SAIDA/maestro" -type f -name 'm[0-9]-material-*.png' -exec cp -f {} "$SAIDA/capturas/" \; 2> /dev/null || true
adb exec-out screencap -p > "$SAIDA/registros/tela-no-fim.png" 2> /dev/null || true
adb logcat -d -t 3000 '*:W' ReactNativeJS:V AndroidRuntime:V > "$SAIDA/registros/logcat-fim.txt" 2>&1 || true
if grep -q "FATAL EXCEPTION" "$SAIDA/registros/logcat-fim.txt"; then echo "::error::O app caiu (FATAL EXCEPTION no logcat)."; codigo=1; fi
exit "$codigo"
