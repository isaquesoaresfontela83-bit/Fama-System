#!/usr/bin/env bash
set -euo pipefail
mkdir -p android-test-screens
adb install -r android-artifacts/Water-System-teste.apk
adb install -r android-artifacts/Water-Control-teste.apk
sleep 10
adb shell ping -c 1 -W 3 watersystem.online || true
failures=0
for item in 'system online.watersystem.app' 'control online.watersystem.control'; do
  read -r name package <<< "$item"
  adb logcat -c
  adb shell am start -W -n "$package/online.watersystem.mobile.MainActivity"
  sleep 30
  adb shell pidof "$package" >/dev/null
  adb shell uiautomator dump /sdcard/water-window.xml >/dev/null
  adb shell cat /sdcard/water-window.xml > "android-test-screens/$name.xml"
  adb exec-out screencap -p > "android-test-screens/$name.png"
  adb logcat -d -s WaterWeb > "android-test-screens/$name.log"
  cat "android-test-screens/$name.log"
  if grep -q 'Não foi possível carregar o sistema' "android-test-screens/$name.xml"; then
    echo "A tela inicial não carregou: $name" >&2
    failures=1
  fi
  if ! grep -Eq 'DOM visible text length [1-9][0-9]*' "android-test-screens/$name.log"; then
    echo "O conteúdo da página não ficou visível: $name" >&2
    failures=1
  fi
  if [[ "$name" == system ]] && ! grep -q 'System login visible true' "android-test-screens/$name.log"; then
    echo "O formulário de entrada não ficou visível: $name" >&2
    failures=1
  fi
  adb shell am force-stop "$package"
done
exit "$failures"
