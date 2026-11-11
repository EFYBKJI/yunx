"""卡密系统测试：发卡 / 兑换 / 重复兑换 / 查询 / 吊销 / 过期 / 限流 / 只存哈希。

运行：python3 -m unittest -v test_server.py
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import create_server  # noqa: E402

ADMIN = "admin-test-ok"


class LicenseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.db_path = os.path.join(cls.tmp.name, "license.db")
        cls.httpd = create_server(db_path=cls.db_path, admin_token=ADMIN, rate_limit=500)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        cls.tmp.cleanup()

    # ---------- 工具 ----------
    def call(self, method, path, body=None, admin=False):
        url = "http://127.0.0.1:%d%s" % (self.port, path)
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if admin:
            req.add_header("X-Admin-Token", ADMIN)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode())

    def issue(self, **kw):
        body = {"count": 1, "plan": "starter", "quota_total": 1000, "duration_days": 30}
        body.update(kw)
        code, d = self.call("POST", "/admin/cards", body, admin=True)
        self.assertEqual(code, 200, d)
        return d["cards"][0]

    # ---------- 用例 ----------
    def test_health(self):
        code, d = self.call("GET", "/health")
        self.assertEqual((code, d["status"]), (200, "ok"))

    def test_issue_returns_plaintext_once(self):
        card = self.issue()
        self.assertRegex(card["key"], r"^DZMM(-[A-Z2-9]{5}){4}$")
        code, d = self.call("GET", "/admin/cards?limit=5", admin=True)
        self.assertEqual(code, 200)
        self.assertTrue(d["data"])
        # 列表里只有前缀，没有明文
        for row in d["data"]:
            self.assertNotIn("key", row)
            self.assertTrue(row["key_prefix"].startswith("DZMM-"))

    def test_db_stores_hash_only(self):
        card = self.issue()
        conn = sqlite3.connect(self.db_path)
        try:
            hits = conn.execute("SELECT COUNT(*) FROM cards WHERE key_hash LIKE ?",
                                ("%" + card["key"] + "%",)).fetchone()[0]
            rows = conn.execute("SELECT key_hash, key_prefix FROM cards WHERE id=?", (card["id"],)).fetchone()
        finally:
            conn.close()
        self.assertEqual(hits, 0, "库里不应出现明文卡密")
        self.assertEqual(len(rows[0]), 64, "应是 SHA-256 十六进制")

    def test_redeem_ok_returns_token(self):
        card = self.issue()
        code, d = self.call("POST", "/redeem", {"key": card["key"], "user_id": "u1"})
        self.assertEqual(code, 200, d)
        self.assertTrue(d["api_token"].startswith("sk-"))
        self.assertEqual(d["plan"], "starter")
        self.assertEqual(d["quota_total"], 1000)
        self.assertTrue(d["expires_at"])

    def test_redeem_twice_conflict(self):
        card = self.issue()
        self.call("POST", "/redeem", {"key": card["key"], "user_id": "u1"})
        code, d = self.call("POST", "/redeem", {"key": card["key"], "user_id": "u2"})
        self.assertEqual(code, 409, d)
        self.assertEqual(d["bound_to"], "u1")

    def test_redeem_requires_user(self):
        card = self.issue()
        code, _ = self.call("POST", "/redeem", {"key": card["key"]})
        self.assertEqual(code, 400)

    def test_bad_key(self):
        code, _ = self.call("POST", "/redeem", {"key": "DZMM-AAAAA-BBBBB-CCCCC-DDDDD", "user_id": "u"})
        self.assertEqual(code, 404)
        code, _ = self.call("POST", "/redeem", {"key": "garbage", "user_id": "u"})
        self.assertEqual(code, 404)

    def test_lookup_masked(self):
        card = self.issue()
        code, d = self.call("POST", "/lookup", {"key": card["key"]})
        self.assertEqual(code, 200, d)
        self.assertTrue(d["valid"])
        self.assertEqual(d["status"], "active")
        self.assertNotIn("key", d)
        self.assertTrue(d["prefix"].endswith("…"))

    def test_revoke_blocks_redeem(self):
        card = self.issue()
        code, _ = self.call("POST", "/admin/cards/%d/revoke" % card["id"], {}, admin=True)
        self.assertEqual(code, 200)
        code, d = self.call("POST", "/redeem", {"key": card["key"], "user_id": "u"})
        self.assertEqual(code, 403, d)

    def test_expired_card(self):
        card = self.issue(duration_days=1)
        self.call("POST", "/redeem", {"key": card["key"], "user_id": "u1"})
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("UPDATE cards SET expires_at='2000-01-01T00:00:00+00:00' WHERE id=?", (card["id"],))
            conn.commit()
        finally:
            conn.close()
        code, d = self.call("POST", "/lookup", {"key": card["key"]})
        self.assertEqual(code, 200)
        self.assertFalse(d["valid"])
        self.assertEqual(d["status"], "expired")

    def test_admin_required(self):
        code, _ = self.call("POST", "/admin/cards", {"count": 1})
        self.assertEqual(code, 401)
        code, _ = self.call("GET", "/admin/stats")
        self.assertEqual(code, 401)

    def test_stats(self):
        self.issue(count=2)
        code, d = self.call("GET", "/admin/stats", admin=True)
        self.assertEqual(code, 200)
        self.assertGreaterEqual(d["cards_total"], 2)
        self.assertGreaterEqual(d["api_tokens"], 1)

    def test_rate_limit(self):
        tmp = tempfile.TemporaryDirectory()
        httpd = create_server(db_path=os.path.join(tmp.name, "rl.db"), admin_token=ADMIN, rate_limit=2)
        port = httpd.server_address[1]
        th = threading.Thread(target=httpd.serve_forever, daemon=True)
        th.start()
        try:
            url = "http://127.0.0.1:%d/lookup" % port
            codes = []
            for _ in range(4):
                req = urllib.request.Request(url, data=json.dumps(
                    {"key": "DZMM-AAAAA-BBBBB-CCCCC-DDDDD"}).encode(), method="POST")
                req.add_header("Content-Type", "application/json")
                try:
                    with urllib.request.urlopen(req, timeout=5) as r:
                        codes.append(r.status)
                except urllib.error.HTTPError as e:
                    codes.append(e.code)
            self.assertIn(429, codes, codes)
        finally:
            httpd.shutdown(); httpd.server_close(); th.join(timeout=3); tmp.cleanup()


if __name__ == "__main__":
    unittest.main(verbosity=2)
