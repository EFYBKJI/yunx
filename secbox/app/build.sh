#!/usr/bin/env bash
# 构建 SecBox.apk —— 面向 ARM64 手机/容器（官方 build-tools 里的 aapt2 是 x86_64，跑不了）
# 依赖：JDK（javac/java）、arm64 的 aapt2/zipalign、d8.jar、apksigner.jar
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

AAPT2="${AAPT2:-/usr/lib/android-sdk/build-tools/debian/aapt2}"
ZIPALIGN="${ZIPALIGN:-/usr/lib/android-sdk/build-tools/debian/zipalign}"
D8_JAR="${D8_JAR:-/opt/android-sdk/build-tools/36.0.0/lib/d8.jar}"
SIGNER_JAR="${SIGNER_JAR:-/usr/lib/android-sdk/build-tools/debian/apksigner.jar}"
ANDROID_JAR="${ANDROID_JAR:-/opt/android-sdk/platforms/android-34/android.jar}"

for f in "$AAPT2" "$ZIPALIGN" "$D8_JAR" "$SIGNER_JAR" "$ANDROID_JAR"; do
  [ -f "$f" ] || { echo "缺少：$f"; exit 1; }
done

# javac 在含中文的挂载路径下会报 "file not found"，先复制到 ASCII 临时目录
WORK="$(mktemp -d /tmp/secbox-build.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
cp -r "$SRC_DIR/src" "$SRC_DIR/assets" "$SRC_DIR/AndroidManifest.xml" "$WORK/"
cd "$WORK"
mkdir -p build/classes build/dex

echo "[1/6] javac"
javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" \
  -d build/classes $(find src -name '*.java')

echo "[2/6] aapt2 link"
"$AAPT2" link -o build/base.apk -I "$ANDROID_JAR" \
  --manifest AndroidManifest.xml -A assets \
  --min-sdk-version 26 --target-sdk-version 34

echo "[3/6] d8"
java -cp "$D8_JAR" com.android.tools.r8.D8 \
  --lib "$ANDROID_JAR" --min-api 26 --output build/dex \
  $(find build/classes -name '*.class')

echo "[4/6] 打包 dex + 对齐"
(cd build/dex && zip -q ../base.apk classes.dex)
"$ZIPALIGN" -f 4 build/base.apk build/aligned.apk

echo "[5/6] 签名（在临时目录内操作，避免 JVM 处理中文路径）"
KS_SRC="$SRC_DIR/debug.keystore"
KS="./debug.keystore"
if [ -f "$KS_SRC" ]; then
  cp "$KS_SRC" "$KS"
else
  keytool -genkeypair -keystore "$KS" -alias secbox -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass secbox123 -keypass secbox123 \
    -dname "CN=SecBox, O=Local, C=CN" >/dev/null 2>&1
  cp "$KS" "$KS_SRC" || true
fi
java -jar "$SIGNER_JAR" sign --ks "$KS" --ks-pass pass:secbox123 --key-pass pass:secbox123 \
  --out ./secbox.apk ./build/aligned.apk

echo "[6/6] 校验并复制"
java -jar "$SIGNER_JAR" verify --print-certs ./secbox.apk 2>&1 | head -3
cp ./secbox.apk "$SRC_DIR/secbox.apk"
ls -lh "$SRC_DIR/secbox.apk"
echo "✅ 产物：$SRC_DIR/secbox.apk"
