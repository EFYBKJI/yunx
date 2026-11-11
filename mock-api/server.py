#!/usr/bin/env python3
"""DZMM 本地模拟 API（OpenAI 兼容 + 积分额度 + 管理端充值）

用途：在本地把"调用 DZMM 模型"的客户端调通，不用花钱、不用真账号。
模型 ID 与 DZMM 公开目录一致（52 条），所以客户端代码写完可以原样切到真接口。

包含：
  GET  /v1/models             列出全部模型（等同 OpenAI 的 models 接口）
  POST /v1/chat/completions   对话（支持 stream=true 的 SSE）
  GET  /v1/quota              查看本机额度
  POST /admin/topup           管理端加/减额度（模拟"充值"）

额度是真账本：每次对话按 token × 单价系数扣分，扣分走 ledger（只追加流水、幂等、可对账）。

⚠️ 这是本地模拟：不连接 dzmm.ai，也不会影响任何真实账号的额度。
"""

from __future__ import annotations

import json
import math
import os
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ledger-system"))

from ledger import AccountNotFound, InsufficientFunds, Ledger  # noqa: E402

MODELS_FILE = os.path.join(HERE, "models.json")
DEFAULT_TOKEN = os.environ.get("MOCK_API_TOKEN", "sk-local-test")
DEFAULT_ADMIN = os.environ.get("MOCK_ADMIN_TOKEN", "admin-local-test")
DEFAULT_DB = os.environ.get("MOCK_DB", os.path.join(HERE, "mock.db"))
INITIAL_QUOTA = int(os.environ.get("MOCK_INITIAL_QUOTA", "1000"))
COST_FACTOR = float(os.environ.get("MOCK_COST_FACTOR", "1000"))

with open(MODELS_FILE, encoding="utf-8") as f:
    CATALOG = json.load(f)["models"]

MODEL_MAP = {m["internal"]: m for m in CATALOG}


def estimate_tokens(messages: list) -> int:
    """中文粗估：1 token ≈ 1.6 字。"""
    chars = 0
    for m in messages or []:
        c = m.get("content")
        if isinstance(c, str):
            chars += len(c)
        elif isinstance(c, list):
            for part in c:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    chars += len(part["text"])
    return max(1, math.ceil(chars / 1.6))


def price_of(model_id: str) -> float:
    return float(MODEL_MAP[model_id]["price"])


def cost_of(model_id: str, tokens: int) -> int:
    return max(1, math.ceil(tokens * price_of(model_id) * COST_FACTOR))


def make_handler(ledger: Ledger, account_id: int, token: str, admin_token: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = "DZMM-Mock/1.0"
        protocol_version = "HTTP/1.1"

        # ---------- 基础设施 ----------
        def log_message(self, fmt, *args):  # 静默，测试时不刷屏
            if os.environ.get("MOCK_VERBOSE"):
                sys.stderr.write("[mock] " + (fmt % args) + "\n")

        def _send(self, code: int, payload: dict | list | None = None, ctype="application/json"):
            if payload is None:
                body = b""
            elif isinstance(payload, str):
                body = payload.encode("utf-8")
            else:
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            if body:
                self.wfile.write(body)

        def _err(self, code: int, message: str, etype="invalid_request_error"):
            self._send(code, {"error": {"message": message, "type": etype, "code": code}})

        def _read_json(self) -> dict:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                return {}
            raw = self.rfile.read(length)
            try:
                return json.loads(raw.decode("utf-8"))
            except Exception:
                return {}

        def _auth(self) -> bool:
            got = (self.headers.get("Authorization") or "").strip()
            return got == "Bearer " + token

        def _admin_auth(self) -> bool:
            got = (self.headers.get("Authorization") or "").strip()
            return got == "Bearer " + admin_token

        def do_OPTIONS(self):  # noqa: N802
            self._send(204)

        # ---------- 路由 ----------
        def do_GET(self):  # noqa: N802
            path = self.path.split("?")[0]
            if path == "/health":
                return self._send(200, {"status": "ok", "models": len(MODEL_MAP)})
            if path in ("/", "/index.html"):
                return self._dashboard()
            if path in ("/v1/models", "/models"):
                if not self._auth():
                    return self._err(401, "Invalid API key", "authentication_error")
                data = [
                    {
                        "id": m["internal"],
                        "object": "model",
                        "created": 0,
                        "owned_by": "dzmm-mock",
                        "context_length": m["maxContext"],
                        "display_name": m["display"],
                        "price": m["price"],
                    }
                    for m in CATALOG
                ]
                return self._send(200, {"object": "list", "data": data})
            if path in ("/v1/quota", "/quota"):
                if not self._auth():
                    return self._err(401, "Invalid API key", "authentication_error")
                return self._send(200, {"object": "quota", "balance": ledger.balance(account_id)})
            return self._err(404, "Not found: " + path)

        def do_POST(self):  # noqa: N802
            path = self.path.split("?")[0]
            if path in ("/v1/chat/completions", "/chat/completions"):
                return self._chat()
            if path == "/admin/topup":
                return self._topup()
            return self._err(404, "Not found: " + path)

        # ---------- 首页仪表盘 ----------
        def _dashboard(self):
            balance = ledger.balance(account_id)
            rows = ledger.history(account_id)[-10:][::-1]
            tr = "".join(
                "<tr><td>%s</td><td style=\"color:%s\">%+d</td><td>%s</td><td>%d→%d</td></tr>" % (
                    r["created_at"][:19].replace("T", " "),
                    "#4ade80" if r["delta"] > 0 else "#ff8b8b",
                    r["delta"], r["reason"][:24], r["balance_before"], r["balance_after"],
                ) for r in rows
            ) or "<tr><td colspan='4' style='color:#888'>暂无流水</td></tr>"
            html = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DZMM 本地模拟 API</title>
<style>
 body{margin:0;padding:18px;background:#101117;color:#e8e9ee;
      font:14px/1.6 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
 h1{font-size:16px;margin:0 0 4px}
 .sub{color:#8b8fa3;font-size:12px;margin-bottom:14px}
 .card{background:#171922;border:1px solid #2a2c36;border-radius:12px;padding:12px;margin-bottom:12px}
 .big{font-size:28px;font-weight:700;color:#c7b3ff}
 table{width:100%%;border-collapse:collapse;font-size:12px}
 th,td{text-align:left;padding:5px 4px;border-bottom:1px solid #23252f}
 th{color:#8b8fa3;font-weight:500}
 code{background:#1e2029;padding:1px 5px;border-radius:4px;font-size:12px}
 a{color:#8fa8ff}
</style></head><body>
<h1>DZMM 本地模拟 API</h1>
<div class="sub">本地运行 · 不连接 dzmm.ai · 额度可自由调整</div>
<div class="card"><div class="sub" style="margin:0">当前额度（模拟）</div>
  <div class="big">%d</div>
  <div class="sub" style="margin:6px 0 0">模型 %d 个 · <a href="/v1/models?token=x">/v1/models</a> 需 Bearer Key</div>
</div>
<div class="card"><div class="sub" style="margin:0 0 6px">最近 10 条流水</div>
<table><tr><th>时间</th><th>变动</th><th>原因</th><th>余额</th></tr>%s</table></div>
<div class="card"><div class="sub" style="margin:0 0 6px">常用命令</div>
<div><code>curl %s/v1/chat/completions -H "Authorization: Bearer sk-local-test" -d '{"model":"nalang-turbo-0826","messages":[{"role":"user","content":"hi"}]}'</code></div>
<div style="margin-top:6px"><code>curl -X POST %s/admin/topup -H "Authorization: Bearer admin-local-test" -d '{"delta":500}'</code></div>
</div></body></html>""" % (balance, len(MODEL_MAP), tr, self._origin(), self._origin())
            self._send(200, html, "text/html; charset=utf-8")

        def _origin(self):
            host = self.headers.get("Host") or ("%s:%d" % self.server.server_address[:2])
            return "http://" + host

        # ---------- 对话 ----------
        def _chat(self):
            if not self._auth():
                return self._err(401, "Invalid API key", "authentication_error")

            body = self._read_json()
            model = body.get("model")
            if not model:
                return self._err(400, "缺少 model 字段")
            if model not in MODEL_MAP:
                return self._err(404, "模型不存在：" + str(model), "model_not_found")

            messages = body.get("messages") or []
            if not isinstance(messages, list) or not messages:
                return self._err(400, "messages 不能为空")

            tokens = estimate_tokens(messages)
            cost = cost_of(model, tokens)
            key = self.headers.get("Idempotency-Key") or ("mock-" + uuid.uuid4().hex)

            try:
                debit = ledger.adjust(
                    -cost,
                    account_id=account_id,
                    reason="对话消耗 " + model,
                    operator_id="mock-server",
                    role="finance",
                    idempotency_key=key,
                    client_ip=self.client_address[0],
                )
            except InsufficientFunds:
                return self._err(402, "额度不足：本次需 %d，当前 %d" % (cost, ledger.balance(account_id)),
                                 "insufficient_quota")

            last = ""
            for m in reversed(messages):
                if m.get("role") == "user" and isinstance(m.get("content"), str):
                    last = m["content"]
                    break
            reply = "[本地模拟 · %s] 收到 %d 条消息，约 %d tokens，扣 %d 积分（余额 %d）。你说：%s" % (
                MODEL_MAP[model]["display"], len(messages), tokens, cost,
                debit["balance"], last[:80],
            )

            usage = {
                "prompt_tokens": tokens,
                "completion_tokens": estimate_tokens([{"content": reply}]),
                "total_tokens": tokens + estimate_tokens([{"content": reply}]),
            }

            if body.get("stream"):
                return self._stream(model, reply, usage, key)

            return self._send(200, {
                "id": "chatcmpl-" + uuid.uuid4().hex[:12],
                "object": "chat.completion",
                "created": int(__import__("time").time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": reply},
                    "finish_reason": "stop",
                }],
                "usage": usage,
                "x_mock_balance": debit["balance"],
            })

        def _stream(self, model, reply, usage, key):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            def chunk(obj):
                self.wfile.write(("data: " + json.dumps(obj, ensure_ascii=False) + "\n\n").encode("utf-8"))
                self.wfile.flush()

            cid = "chatcmpl-" + uuid.uuid4().hex[:12]
            step = 12
            for i in range(0, len(reply), step):
                chunk({
                    "id": cid, "object": "chat.completion.chunk", "model": model,
                    "choices": [{"index": 0, "delta": {"content": reply[i:i + step]}, "finish_reason": None}],
                })
            chunk({"id": cid, "object": "chat.completion.chunk", "model": model,
                   "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}], "usage": usage})
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()

        # ---------- 管理端：改额度 ----------
        def _topup(self):
            if not self._admin_auth():
                return self._err(401, "需要管理端 token", "authentication_error")
            body = self._read_json()
            try:
                delta = int(body.get("delta"))
            except Exception:
                return self._err(400, "delta 必须是整数")
            if delta == 0:
                return self._err(400, "delta 不能为 0")
            try:
                res = ledger.adjust(
                    delta,
                    account_id=account_id,
                    reason=body.get("reason") or "管理端调整",
                    operator_id=body.get("operator") or "admin",
                    role="admin",
                    idempotency_key=body.get("idempotency_key") or ("topup-" + uuid.uuid4().hex),
                )
            except Exception as exc:  # noqa: BLE001
                return self._err(400, str(exc))
            return self._send(200, {
                "object": "quota_adjustment",
                "duplicate": res["duplicate"],
                "balance_before": res["balance_before"],
                "balance": res["balance"],
            })

    return Handler


def create_server(db_path: str | None = None, host: str = "127.0.0.1", port: int = 0,
                  token: str = DEFAULT_TOKEN, admin_token: str = DEFAULT_ADMIN):
    """创建（未启动的）服务器；返回 httpd，调用方负责 serve_forever。"""
    db = Ledger(db_path or DEFAULT_DB)
    try:
        account_id = db.account(user_id="local-user")["id"]
    except AccountNotFound:
        account_id = db.create_account("local-user", initial_balance=INITIAL_QUOTA)

    httpd = ThreadingHTTPServer((host, port), make_handler(db, account_id, token, admin_token))
    httpd.ledger = db          # type: ignore[attr-defined]
    httpd.account_id = account_id  # type: ignore[attr-defined]
    return httpd


def main() -> None:
    httpd = create_server(host=os.environ.get("MOCK_HOST", "127.0.0.1"),
                          port=int(os.environ.get("MOCK_PORT", "8787")))
    host, port = httpd.server_address[:2]
    print("DZMM 本地模拟 API 已启动")
    print("  Base URL   : http://%s:%d/v1" % (host, port))
    print("  API Key    : %s" % DEFAULT_TOKEN)
    print("  Admin Key  : %s" % DEFAULT_ADMIN)
    print("  模型数量   : %d" % len(MODEL_MAP))
    print("  初始额度   : %d（存 %s）" % (INITIAL_QUOTA, DEFAULT_DB))
    print("  停止       : Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
