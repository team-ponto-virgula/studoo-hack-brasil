#!/usr/bin/env bash
# Dentro do emulador (android-emulator-runner): instala o APK final como veio, roda o fluxo do visitante e guarda capturas,
# registros e o fim do logcat em $SAIDA. Sai com o código do Maestro.
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
adb logcat -c || true
cd "$SAIDA/maestro"
MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=true "$MAESTRO" test "$GITHUB_WORKSPACE/apps/mobile/conferencia-nativa/apk-final/visitante.yaml" \
  --test-output-dir "$SAIDA/maestro" < /dev/null 2>&1 | tee "$SAIDA/registros/maestro.log"
codigo=${PIPESTATUS[0]}
find "$SAIDA/maestro" -type f -name '0*-apk-final-*.png' -exec cp -f {} "$SAIDA/capturas/" \; 2> /dev/null || true
adb exec-out screencap -p > "$SAIDA/registros/tela-no-fim.png" 2> /dev/null || true
adb logcat -d -t 3000 '*:W' ReactNativeJS:V AndroidRuntime:V > "$SAIDA/registros/logcat-fim.txt" 2>&1 || true
if grep -q "FATAL EXCEPTION" "$SAIDA/registros/logcat-fim.txt"; then echo "::error::O app caiu (FATAL EXCEPTION no logcat)."; codigo=1; fi
exit "$codigo"
