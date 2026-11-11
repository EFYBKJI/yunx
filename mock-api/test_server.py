"""本地模拟 API 的测试：模型列表 / 对话扣分 / 流式 / 额度不足 / 管理端调整 / 幂等。

运行：python3 -m unittest -v test_server.py
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import create_server  # noqa: E402

TOKEN = "sk-test-ok"
ADMIN = "admin-test-ok"


class MockApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.db_path = os.path.join(cls.tmp.name, "mock.db")
        cls.httpd = create_server(db_path=cls.db_path, token=TOKEN, admin_token=ADMIN)
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
    def url(self, path):
        return "http://127.0.0.1:%d%s" % (self.port, path)

    def request(self, method, path, body=None, token=TOKEN, headers=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.url(path), data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    def json_req(self, method, path, body=None, **kw):
        code, text = self.request(method, path, body, **kw)
        return code, (json.loads(text) if text.strip().startswith(("{", "[")) else text)

    def quota(self):
        _, d = self.json_req("GET", "/v1/quota")
        return d["balance"]

    def set_quota(self, target):
        code, d = self.json_req("POST", "/admin/topup", {"delta": target - self.quota()},
                                token=ADMIN, headers={})
        self.assertEqual(code, 200, d)

    def chat(self, **over):
        body = {"model": "nalang-turbo-0826", "messages": [{"role": "user", "content": "你好"}]}
        body.update(over)
        return self.json_req("POST", "/v1/chat/completions", body)

    # ---------- 用例 ----------
    def test_health(self):
        code, d = self.json_req("GET", "/health")
        self.assertEqual(code, 200)
        self.assertEqual(d["status"], "ok")
        self.assertEqual(d["models"], 52)

    def test_models_requires_auth(self):
        code, _ = self.request("GET", "/v1/models", token=None)
        self.assertEqual(code, 401)

    def test_models_list(self):
        code, d = self.json_req("GET", "/v1/models")
        self.assertEqual(code, 200)
        ids = [m["id"] for m in d["data"]]
        self.assertEqual(len(ids), 52)
        self.assertIn("x-apex-sigma-0621", ids)
        self.assertIn("nalang-turbo-1115", ids)
        self.assertEqual(d["object"], "list")

    def test_chat_deducts_quota(self):
        self.set_quota(1000)
        code, d = self.chat()
        self.assertEqual(code, 200)
        self.assertIn("choices", d)
        self.assertTrue(d["choices"][0]["message"]["content"])
        self.assertGreater(d["usage"]["prompt_tokens"], 0)
        self.assertEqual(d["x_mock_balance"], self.quota())
        self.assertLess(d["x_mock_balance"], 1000)

    def test_expensive_model_costs_more(self):
        self.set_quota(100000)
        _, cheap = self.chat(model="nalang-turbo-0826")
        _, pricey = self.chat(model="x-apex-sigma-0621",
                              messages=[{"role": "user", "content": "你好"}])
        self.assertGreater(pricey["usage"]["prompt_tokens"] and
                           (100000 - pricey["x_mock_balance"]),
                           100000 - cheap["x_mock_balance"])

    def test_stream(self):
        self.set_quota(1000)
        code, text = self.request("POST", "/v1/chat/completions", {
            "model": "nalang-turbo-0826", "stream": True,
            "messages": [{"role": "user", "content": "流式测试"}],
        })
        self.assertEqual(code, 200)
        self.assertIn("data: ", text)
        self.assertIn("[DONE]", text)
        self.assertIn("chat.completion.chunk", text)

    def test_insufficient_quota(self):
        self.set_quota(0)
        code, d = self.chat(messages=[{"role": "user", "content": "x" * 5000}])
        self.assertEqual(code, 402, d)
        self.assertEqual(d["error"]["type"], "insufficient_quota")

    def test_unknown_model(self):
        code, d = self.chat(model="gpt-does-not-exist")
        self.assertEqual(code, 404)
        self.assertEqual(d["error"]["type"], "model_not_found")

    def test_bad_key(self):
        code, _ = self.request("GET", "/v1/models", token="wrong")
        self.assertEqual(code, 401)

    def test_admin_topup(self):
        self.set_quota(100)
        code, d = self.json_req("POST", "/admin/topup", {"delta": 50, "reason": "测试充值"}, token=ADMIN)
        self.assertEqual(code, 200, d)
        self.assertEqual(d["balance"], 150)
        self.assertEqual(self.quota(), 150)

    def test_admin_requires_admin_token(self):
        code, _ = self.json_req("POST", "/admin/topup", {"delta": 10}, token=TOKEN)
        self.assertEqual(code, 401)

    def test_admin_rejects_zero(self):
        code, _ = self.json_req("POST", "/admin/topup", {"delta": 0}, token=ADMIN)
        self.assertEqual(code, 400)

    def test_idempotent_chat(self):
        self.set_quota(500)
        key = "idem-fixed-1"
        _, a = self.json_req("POST", "/v1/chat/completions", {
            "model": "nalang-turbo-0826", "messages": [{"role": "user", "content": "重复请求"}],
        }, headers={"Idempotency-Key": key})
        after_first = self.quota()
        _, b = self.json_req("POST", "/v1/chat/completions", {
            "model": "nalang-turbo-0826", "messages": [{"role": "user", "content": "重复请求"}],
        }, headers={"Idempotency-Key": key})
        self.assertEqual(self.quota(), after_first, "同一幂等键不应重复扣分")
        self.assertEqual(a["x_mock_balance"], b["x_mock_balance"])

    def test_ledger_reconciles(self):
        self.set_quota(300)
        self.chat()
        self.chat()
        report = self.httpd.ledger.reconcile()  # type: ignore[attr-defined]
        self.assertTrue(report["ok"], report)


if __name__ == "__main__":
    unittest.main(verbosity=2)
