#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-/tmp/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export VITE_RECOGNITION_API_URL="${VITE_RECOGNITION_API_URL:-https://app-66ba5c12d8dc.vibecode.bitrix24.tech}"

cd "$root"
npm run android:apk

src="$root/android/app/build/outputs/apk/release/app-release.apk"
dest="$root/releases/numismat-1.0.2.apk"
cp "$src" "$dest"
sha256sum "$dest"
echo "APK: $dest"
