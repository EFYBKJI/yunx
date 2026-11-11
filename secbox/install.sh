#!/data/data/com.termux/files/usr/bin/bash
# SecBox 工具箱安装脚本（在 Termux 里跑）
#   bash install.sh            标准安装（轻量工具）
#   bash install.sh --full     追加 apktool / nodejs / mitmproxy 等重一些的
set -u

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }

command -v pkg >/dev/null 2>&1 || { echo "请在 Termux 里运行本脚本"; exit 1; }

info "更新索引"
pkg update -y >/dev/null 2>&1 || warn "pkg update 有报错，继续"

BASE="python git curl wget nmap sqlmap nikto hydra ffuf dnsutils whois openssl tcpdump zip unzip termux-api"
info "安装基础工具：$BASE"
pkg install -y $BASE || warn "部分包安装失败，可稍后重试"

if [ "${1:-}" = "--full" ]; then
    info "安装扩展工具（较慢）"
    pkg install -y apktool nodejs mitmproxy openjdk-17 || warn "扩展工具部分失败"
fi

info "安装 secbox 主程序"
DEST="${PREFIX:-/data/data/com.termux/files/usr}/bin/secbox"
if [ -f "./secbox" ]; then
    cp ./secbox "$DEST"
    chmod 755 "$DEST"
    ok "已安装到 $DEST"
else
    warn "当前目录没有 secbox，跳过（把整个目录拷进 Termux 再跑）"
fi

info "配置 Termux 允许外部调用（SecBox.apk 需要）"
PROPS="$HOME/.termux/termux.properties"
mkdir -p "$HOME/.termux"
if grep -q '^allow-external-apps' "$PROPS" 2>/dev/null; then
    ok "已配置 allow-external-apps"
else
    printf '\nallow-external-apps=true\n' >> "$PROPS"
    ok "已写入 allow-external-apps=true（执行 termux-reload-settings 生效）"
fi
command -v termux-reload-settings >/dev/null 2>&1 && termux-reload-settings

info "环境自检"
command -v secbox >/dev/null 2>&1 && secbox doctor || warn "secbox 未就绪"

cat <<'EOF'

完成。用法：
  secbox            打开菜单
  secbox doctor     自检
  secbox capture    抓包（mitmproxy）
  secbox reverse    逆向 APK
  secbox recon      侦察（需授权确认）
  secbox lab        本地靶场

提醒：只对自己的资产或靶场使用。
EOF
