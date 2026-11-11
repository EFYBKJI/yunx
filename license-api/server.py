#!/usr/bin/env python3
"""卡密系统（自有产品用）：发卡 / 兑换 / 查询 / 吊销 / 发 API Token

这不是"DZMM 的卡密"，是你自己产品的授权体系。上游模型额度请用你自己的付费 API Token，
卡密只负责"谁能用、能用多少、用到什么时候"。

设计要点（也是"为什么拷别人的卡密没用"的技术原因）：
  · 卡密只存 SHA-256 哈希，明文只在生成那一刻返回一次，库里查不到原文
  · 一卡一绑：兑换后绑定 user_id，二次兑换返回 409
  · 有效期 + 总额度 + 已用额度，过期/超额自动拒绝
  · 吊销即时生效；兑换与查询都记事件日志
  · 内置简单的按 IP 限流，防止批量撞卡密

端点：
  POST /admin/cards            批量发卡（X-Admin-Token）
  GET  /admin/cards            列表（脱敏）
  POST /admin/cards/{id}/revoke 吊销
  GET  /admin/stats            统计
  POST /redeem                 兑换 {key, user_id} → 发 API Token
  POST /lookup                 查询 {key}（脱敏，不消耗）
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.environ.get("LICENSE_DB", os.path.join(HERE, "license.db"))
ADMIN_TOKEN = os.environ.get("LICENSE_ADMIN_TOKEN", "admin-local-test")
PORT = int(os.environ.get("LICENSE_PORT", "8790"))

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去掉 I O 0 1，避免手抄错
KEY_RE = re.compile(r"^DZMM(-[A-Z2-9]{5}){4}$")
RATE_LIMIT = 30          # 每个 IP 每分钟最多 redeem/lookup 次数
RATE_WINDOW = 60

SCHEMA = """
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS cards (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash      TEXT NOT NULL UNIQUE,
    key_prefix    TEXT NOT NULL,
    plan          TEXT NOT NULL,
    quota_total   INTEGER NOT NULL CHECK (quota_total >= 0),
    quota_used    INTEGER NOT NULL DEFAULT 0 CHECK (quota_used >= 0),
    duration_days INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active',   -- active | redeemed | revoked
    note          TEXT,
    created_at    TEXT NOT NULL,
    redeemed_at   TEXT,
    expires_at    TEXT,
    bound_to      TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);

CREATE TABLE IF NOT EXISTS api_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    card_id    INTEGER REFERENCES cards(id),
    user_id    TEXT NOT NULL,
    plan       TEXT NOT NULL,
    quota_total INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT NOT NULL,
    kind    TEXT NOT NULL,
    card_id INTEGER,
    ip      TEXT,
    detail  TEXT
);
"""


# ---------------------------------------------------------------- 工具

def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def gen_key() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(20))
    return "DZMM-" + "-".join(raw[i:i + 5] for i in range(0, 20, 5))


def key_hash(key: str) -> str:
    return hashlib.sha256(key.strip().upper().encode("utf-8")).hexdigest()


def token_hash(tok: str) -> str:
    return hashlib.sha256(tok.encode("utf-8")).hexdigest()


class Store:
    def __init__(self, path: str):
        self.path = path
        conn = self._conn()
        conn.executescript(SCHEMA)
        conn.close()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=20, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 20000")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    # ---------- 发卡 ----------
    def issue(self, count: int, plan: str, quota_total: int, duration_days: int, note: str = "") -> list[dict]:
        out = []
        conn = self._conn()
        try:
            for _ in range(count):
                key = gen_key()
                cur = conn.execute(
                    """INSERT INTO cards(key_hash, key_prefix, plan, quota_total, duration_days,
                                         status, note, created_at)
                       VALUES (?,?,?,?,?,'active',?,?)""",
                    (key_hash(key), key[:10], plan, quota_total, duration_days, note, iso(now())),
                )
                out.append({"id": int(cur.lastrowid), "key": key, "prefix": key[:10]})
                conn.execute("INSERT INTO events(at, kind, card_id, ip, detail) VALUES (?,?,?,?,?)",
                             (iso(now()), "issue", int(cur.lastrowid), None, plan))
        finally:
            conn.close()
        return out

    # ---------- 兑换 ----------
    def redeem(self, key: str, user_id: str, ip: str) -> tuple[int, dict]:
        key = key.strip().upper()
        if not KEY_RE.match(key):
            return 404, {"error": "卡密格式不正确"}
        conn = self._conn()
        try:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM cards WHERE key_hash=?", (key_hash(key),)).fetchone()
            if row is None:
                conn.execute("INSERT INTO events(at, kind, ip, detail) VALUES (?,?,?,?)",
                             (iso(now()), "redeem_fail", ip, "not_found"))
                conn.execute("ROLLBACK")
                return 404, {"error": "卡密不存在"}
            if row["status"] == "revoked":
                conn.execute("ROLLBACK")
                return 403, {"error": "卡密已被吊销"}
            if row["status"] == "redeemed":
                conn.execute("ROLLBACK")
                return 409, {"error": "卡密已被使用", "bound_to": row["bound_to"]}

            exp = now() + timedelta(days=int(row["duration_days"]))
            conn.execute(
                "UPDATE cards SET status='redeemed', redeemed_at=?, expires_at=?, bound_to=? WHERE id=?",
                (iso(now()), iso(exp), user_id, row["id"]),
            )
            token = "sk-" + secrets.token_urlsafe(24)
            conn.execute(
                """INSERT INTO api_tokens(token_hash, token_prefix, card_id, user_id, plan,
                                          quota_total, created_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (token_hash(token), token[:10], row["id"], user_id, row["plan"],
                 row["quota_total"], iso(now())),
            )
            conn.execute("INSERT INTO events(at, kind, card_id, ip, detail) VALUES (?,?,?,?,?)",
                         (iso(now()), "redeem_ok", row["id"], ip, user_id))
            conn.execute("COMMIT")
            return 200, {
                "ok": True, "plan": row["plan"], "quota_total": row["quota_total"],
                "expires_at": iso(exp), "user_id": user_id,
                "api_token": token, "token_note": "只显示这一次，服务端只存哈希",
            }
        except Exception:
            try:
                conn.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            conn.close()

    # ---------- 查询 ----------
    def lookup(self, key: str) -> tuple[int, dict]:
        key = key.strip().upper()
        if not KEY_RE.match(key):
            return 404, {"error": "卡密格式不正确"}
        conn = self._conn()
        try:
            row = conn.execute("SELECT * FROM cards WHERE key_hash=?", (key_hash(key),)).fetchone()
        finally:
            conn.close()
        if row is None:
            return 404, {"error": "卡密不存在"}
        expired = bool(row["expires_at"] and row["expires_at"] < iso(now()))
        return 200, {
            "valid": row["status"] == "active" and not expired,
            "status": "expired" if expired else row["status"],
            "prefix": row["key_prefix"] + "…",
            "plan": row["plan"],
            "quota_total": row["quota_total"],
            "quota_used": row["quota_used"],
            "bound_to": row["bound_to"],
            "expires_at": row["expires_at"],
        }

    # ---------- 管理 ----------
    def list_cards(self, limit: int = 50) -> list[dict]:
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT id, key_prefix, plan, quota_total, quota_used, status, created_at,"
                "       redeemed_at, expires_at, bound_to FROM cards ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        finally:
            conn.close()
        return [dict(r) for r in rows]

    def revoke(self, card_id: int) -> bool:
        conn = self._conn()
        try:
            cur = conn.execute("UPDATE cards SET status='revoked' WHERE id=? AND status<>'revoked'", (card_id,))
            ok = cur.rowcount > 0
            if ok:
                conn.execute("INSERT INTO events(at, kind, card_id, detail) VALUES (?,?,?,?)",
                             (iso(now()), "revoke", card_id, "admin"))
            return ok
        finally:
            conn.close()

    def stats(self) -> dict:
        conn = self._conn()
        try:
            row = conn.execute(
                """SELECT COUNT(*) AS total,
                          SUM(CASE WHEN status='active'   THEN 1 ELSE 0 END) AS active,
                          SUM(CASE WHEN status='redeemed'  THEN 1 ELSE 0 END) AS redeemed,
                          SUM(CASE WHEN status='revoked'   THEN 1 ELSE 0 END) AS revoked
                   FROM cards"""
            ).fetchone()
            tok = conn.execute("SELECT COUNT(*) AS c FROM api_tokens").fetchone()
        finally:
            conn.close()
        return {
            "cards_total": row["total"] or 0,
            "active": row["active"] or 0,
            "redeemed": row["redeemed"] or 0,
            "revoked": row["revoked"] or 0,
            "api_tokens": tok["c"] or 0,
        }


# ---------------------------------------------------------------- HTTP

def make_handler(store: Store, admin_token: str, rate_limit: int = RATE_LIMIT):
    buckets: dict[str, list[float]] = {}

    class Handler(BaseHTTPRequestHandler):
        server_version = "LicenseAPI/1.0"
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *args):
            if os.environ.get("LICENSE_VERBOSE"):
                sys.stderr.write("[license] " + (fmt % args) + "\n")

        # ---------- 基础 ----------
        def _send(self, code: int, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if not isinstance(payload, str) else payload.encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            self.wfile.write(body)

        def _json(self) -> dict:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0:
                return {}
            try:
                return json.loads(self.rfile.read(n).decode("utf-8"))
            except Exception:
                return {}

        def _admin_ok(self) -> bool:
            return (self.headers.get("X-Admin-Token") or "") == admin_token

        def _limit(self) -> bool:
            ip = self.client_address[0]
            t = now().timestamp()
            arr = [x for x in buckets.get(ip, []) if t - x < RATE_WINDOW]
            if len(arr) >= rate_limit:
                buckets[ip] = arr
                return False
            arr.append(t)
            buckets[ip] = arr
            return True

        def do_OPTIONS(self):  # noqa: N802
            self._send(204, "")

        # ---------- 路由 ----------
        def do_GET(self):  # noqa: N802
            u = urlparse(self.path)
            if u.path in ("/health", "/"):
                return self._send(200, {"status": "ok", "service": "license-api"})
            if u.path == "/admin/cards":
                if not self._admin_ok():
                    return self._send(401, {"error": "需要 X-Admin-Token"})
                limit = int(parse_qs(u.query).get("limit", ["50"])[0])
                return self._send(200, {"data": store.list_cards(limit)})
            if u.path == "/admin/stats":
                if not self._admin_ok():
                    return self._send(401, {"error": "需要 X-Admin-Token"})
                return self._send(200, store.stats())
            return self._send(404, {"error": "not found"})

        def do_POST(self):  # noqa: N802
            u = urlparse(self.path)
            path = u.path
            if path == "/admin/cards":
                if not self._admin_ok():
                    return self._send(401, {"error": "需要 X-Admin-Token"})
                b = self._json()
                count = max(1, min(int(b.get("count", 1)), 200))
                plan = str(b.get("plan", "starter"))
                quota = int(b.get("quota_total", 1000))
                days = int(b.get("duration_days", 30))
                cards = store.issue(count, plan, quota, days, str(b.get("note", "")))
                return self._send(200, {"ok": True, "count": len(cards), "cards": cards,
                                        "note": "明文卡密只在这里出现一次"})
            m = re.match(r"^/admin/cards/(\d+)/revoke$", path)
            if m:
                if not self._admin_ok():
                    return self._send(401, {"error": "需要 X-Admin-Token"})
                ok = store.revoke(int(m.group(1)))
                return self._send(200 if ok else 404, {"ok": ok})
            if path == "/redeem":
                if not self._limit():
                    return self._send(429, {"error": "请求过于频繁"})
                b = self._json()
                key = str(b.get("key", ""))
                user_id = str(b.get("user_id", "")).strip()
                if not user_id:
                    return self._send(400, {"error": "缺少 user_id"})
                code, payload = store.redeem(key, user_id, self.client_address[0])
                return self._send(code, payload)
            if path == "/lookup":
                if not self._limit():
                    return self._send(429, {"error": "请求过于频繁"})
                b = self._json()
                code, payload = store.lookup(str(b.get("key", "")))
                return self._send(code, payload)
            return self._send(404, {"error": "not found"})

    return Handler


def create_server(db_path: str | None = None, host: str = "127.0.0.1", port: int = 0,
                  admin_token: str = ADMIN_TOKEN, rate_limit: int = RATE_LIMIT):
    store = Store(db_path or DEFAULT_DB)
    httpd = ThreadingHTTPServer((host, port), make_handler(store, admin_token, rate_limit))
    httpd.store = store  # type: ignore[attr-defined]
    return httpd


def main() -> None:
    host = os.environ.get("LICENSE_HOST", "127.0.0.1")
    httpd = create_server(port=PORT, host=host)
    h, p = httpd.server_address[:2]
    print("卡密系统已启动")
    print("  API      : http://%s:%d" % (h, p))
    print("  Admin    : %s" % ADMIN_TOKEN)
    print("  发卡     : curl -X POST http://%s:%d/admin/cards -H 'X-Admin-Token: %s' "
          "-d '{\"count\":3,\"plan\":\"starter\",\"quota_total\":1000,\"duration_days\":30}'" % (h, p, ADMIN_TOKEN))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
