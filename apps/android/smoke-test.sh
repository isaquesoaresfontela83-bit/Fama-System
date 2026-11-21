#!/usr/bin/env bash
set -euo pipefail
mkdir -p android-test-screens
adb install -r android-artifacts/Water-System-teste.apk
adb install -r android-artifacts/Water-Control-teste.apk
for item in 'system online.watersystem.app' 'control online.watersystem.control'; do
  read -r name package <<< "$item"
  adb shell am start -W -n "$package/online.watersystem.mobile.MainActivity"
  sleep 15
  adb shell pidof "$package" >/dev/null
  adb shell uiautomator dump /sdcard/water-window.xml >/dev/null
  adb shell cat /sdcard/water-window.xml > "android-test-screens/$name.xml"
  adb exec-out screencap -p > "android-test-screens/$name.png"
  if grep -q 'Não foi possível carregar o sistema' "android-test-screens/$name.xml"; then
    echo "A tela inicial não carregou: $name" >&2
    exit 1
  fi
  adb shell am force-stop "$package"
done
