#!/usr/bin/env bash
# 一键跑全部测试；任一失败即非 0 退出
set -euo pipefail
cd "$(dirname "$0")"

echo "== 单元 + 并发测试 =="
python3 -m unittest -v test_ledger.py

echo
echo "== 演示流程 =="
python3 demo.py

echo
echo "== 对账（空库应通过）=="
TMP="$(mktemp -d)"
python3 ledger.py "$TMP/empty.db"
rm -rf "$TMP"

echo
echo "ALL GREEN"
