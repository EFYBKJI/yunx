#!/usr/bin/env python3
"""把最新的模型清单重新注入油猴脚本（离线，不联网）。

用法：
    python3 tools/update-data.py                    # 用默认的 dzmm-models.json
    python3 tools/update-data.py path/to/models.json

JSON 格式要求：{"models": [{internal, display, series, maxContext, price, isApex,
                            thinking, minMembershipLevel, strictModeration, description}, ...]}
"""

from __future__ import annotations

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "dzmm-helper.user.js")
DEFAULT_DATA = os.path.join(HERE, "..", "..", "dzmm-分析", "dzmm-models.json")


def build_block(models: list[dict]) -> str:
    lines = ["  const MODELS = ["]
    for idx, m in enumerate(models):
        item = {
            "i": m["internal"],
            "d": m["display"],
            "s": m["series"],
            "c": int(m["maxContext"]),
            "p": float(m["price"]),
            "a": 1 if m["isApex"] else 0,
            "t": 1 if m["thinking"] else 0,
            "m": int(m["minMembershipLevel"]),
            "x": 1 if m["strictModeration"] else 0,
            "r": m.get("description", ""),
        }
        comma = "," if idx < len(models) - 1 else ""
        lines.append("    " + json.dumps(item, ensure_ascii=False, separators=(",", ":")) + comma)
    lines.append("  ];")
    return "\n".join(lines)


def main() -> None:
    data_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATA
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)
    models = data["models"]

    with open(SCRIPT, encoding="utf-8") as f:
        src = f.read()

    pattern = re.compile(r"  const MODELS = \[.*?\n  \];", re.S)
    if not pattern.search(src):
        raise SystemExit("没找到 MODELS 数据块，脚本可能已损坏")

    new_src = pattern.sub(build_block(models), src, count=1)
    with open(SCRIPT, "w", encoding="utf-8") as f:
        f.write(new_src)

    print(f"已注入 {len(models)} 条 → {os.path.relpath(SCRIPT)}")


if __name__ == "__main__":
    main()
