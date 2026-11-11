"""测试：正常账务 / 幂等 / 并发 / 不透支 / 权限 / 审计 / 对账 / 防篡改。

运行：python3 -m unittest -v test_ledger.py
"""

from __future__ import annotations

import os
import sqlite3
import tempfile
import threading
import unittest

from ledger import (
    MAX_ABS_DELTA,
    AccountNotFound,
    InsufficientFunds,
    Ledger,
    PermissionDenied,
    ValidationError,
)


class LedgerTestBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "ledger.db")
        self.db = Ledger(self.db_path)
        self.acct = self.db.create_account("user-1")

    def tearDown(self):
        self.tmp.cleanup()

    # 便捷方法
    def adjust(self, delta, **kw):
        kw.setdefault("account_id", self.acct)
        kw.setdefault("reason", "测试调账")
        kw.setdefault("operator_id", "op-001")
        return self.db.adjust(delta, **kw)


class TestBasicFlow(LedgerTestBase):
    def test_credit_then_debit(self):
        r1 = self.adjust(500)
        self.assertFalse(r1["duplicate"])
        self.assertEqual(r1["balance"], 500)

        r2 = self.adjust(-200)
        self.assertEqual(r2["balance_before"], 500)
        self.assertEqual(r2["balance_after"], 300)
        self.assertEqual(self.db.balance(self.acct), 300)

    def test_history_is_ordered_and_complete(self):
        self.adjust(100)
        self.adjust(-30)
        self.adjust(7)
        h = self.db.history(self.acct)
        self.assertEqual([r["balance_after"] for r in h], [100, 70, 77])
        self.assertEqual(sum(r["delta"] for r in h), 77)

    def test_account_lookup_by_user_id(self):
        self.adjust(42, account_id=None, user_id="user-1")
        self.assertEqual(self.db.balance(user_id="user-1"), 42)

    def test_unknown_account(self):
        with self.assertRaises(AccountNotFound):
            self.db.adjust(10, account_id=99999, reason="x", operator_id="op")


class TestIdempotency(LedgerTestBase):
    def test_replay_returns_same_result_without_double_charge(self):
        key = "idem-fixed-key"
        first = self.adjust(100, idempotency_key=key)
        second = self.adjust(100, idempotency_key=key)

        self.assertFalse(first["duplicate"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(first["ledger_id"], second["ledger_id"])
        self.assertEqual(self.db.balance(self.acct), 100)
        self.assertEqual(len(self.db.history(self.acct)), 1)

    def test_different_keys_accumulate(self):
        self.adjust(100, idempotency_key="k1")
        self.adjust(100, idempotency_key="k2")
        self.assertEqual(self.db.balance(self.acct), 200)

    def test_same_key_different_delta_is_not_double_applied(self):
        self.adjust(100, idempotency_key="k-dup")
        r = self.adjust(-999, idempotency_key="k-dup")  # 重放键优先，忽略新参数
        self.assertTrue(r["duplicate"])
        self.assertEqual(self.db.balance(self.acct), 100)


class TestConcurrency(LedgerTestBase):
    def test_40_concurrent_credits_no_lost_update(self):
        n = 40
        errors: list[BaseException] = []
        barrier = threading.Barrier(n)

        def worker(i: int):
            try:
                barrier.wait()
                self.db.adjust(
                    1,
                    account_id=self.acct,
                    reason="并发压测",
                    operator_id=f"op-{i}",
                    idempotency_key=f"conc-{i}",
                )
            except BaseException as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)

        self.assertEqual(errors, [], f"并发异常: {errors[:3]}")
        self.assertEqual(self.db.balance(self.acct), n, "出现丢失更新")
        self.assertEqual(len(self.db.history(self.acct)), n)
        self.assertTrue(self.db.reconcile()["ok"])

    def test_20_concurrent_same_idempotency_key_applies_once(self):
        n = 20
        errors: list[BaseException] = []
        barrier = threading.Barrier(n)
        results: list[dict] = []
        lock = threading.Lock()

        def worker():
            try:
                barrier.wait()
                r = self.db.adjust(
                    50,
                    account_id=self.acct,
                    reason="同键并发",
                    operator_id="op-same",
                    idempotency_key="same-key",
                )
                with lock:
                    results.append(r)
            except BaseException as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(n)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)

        self.assertEqual(errors, [], f"并发异常: {errors[:3]}")
        self.assertEqual(self.db.balance(self.acct), 50, "同一幂等键被重复入账")
        self.assertEqual(len(self.db.history(self.acct)), 1)
        self.assertEqual(sum(1 for r in results if not r["duplicate"]), 1)


class TestGuards(LedgerTestBase):
    def test_no_overdraft(self):
        self.adjust(100)
        with self.assertRaises(InsufficientFunds):
            self.adjust(-101)
        self.assertEqual(self.db.balance(self.acct), 100)

    def test_zero_delta(self):
        with self.assertRaises(ValidationError):
            self.adjust(0)

    def test_float_rejected(self):
        for bad in (1.5, 0.1, -2.0):
            with self.assertRaises(ValidationError):
                self.adjust(bad)

    def test_bool_rejected(self):
        with self.assertRaises(ValidationError):
            self.adjust(True)

    def test_string_rejected(self):
        with self.assertRaises(ValidationError):
            self.adjust("100")

    def test_single_txn_limit(self):
        with self.assertRaises(ValidationError):
            self.adjust(MAX_ABS_DELTA + 1)

    def test_reason_required(self):
        with self.assertRaises(ValidationError):
            self.adjust(10, reason="  ")

    def test_role_check(self):
        with self.assertRaises(PermissionDenied):
            self.adjust(10, role="user")

    def test_operator_required(self):
        with self.assertRaises(ValidationError):
            self.adjust(10, operator_id="")


class TestAuditAndImmutability(LedgerTestBase):
    def test_audit_fields_recorded(self):
        r = self.adjust(
            300,
            reason="工单补偿",
            ticket="OTB-0001",
            operator_id="finance-zhang",
            role="finance",
            client_ip="10.0.0.9",
        )
        row = self.db.history(self.acct)[0]
        self.assertEqual(row["delta"], 300)
        self.assertEqual(row["reason"], "工单补偿")
        self.assertEqual(row["ticket"], "OTB-0001")
        self.assertEqual(row["operator_id"], "finance-zhang")
        self.assertEqual(row["operator_role"], "finance")
        self.assertEqual(row["client_ip"], "10.0.0.9")
        self.assertEqual(row["balance_before"], 0)
        self.assertEqual(row["balance_after"], 300)
        self.assertTrue(row["created_at"])
        self.assertEqual(row["id"], r["ledger_id"])

    def test_ledger_append_only(self):
        self.adjust(100)
        conn = sqlite3.connect(self.db_path)
        try:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("UPDATE ledger SET delta = 999999")
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("DELETE FROM ledger")
            conn.rollback()
        finally:
            conn.close()

    def test_balance_cannot_go_negative_via_sql(self):
        conn = sqlite3.connect(self.db_path)
        try:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("UPDATE accounts SET balance = -1")
            conn.rollback()
        finally:
            conn.close()

    def test_reversal_keeps_records(self):
        self.adjust(500)
        self.adjust(-500, reason="冲正")
        self.assertEqual(self.db.balance(self.acct), 0)
        h = self.db.history(self.acct)
        self.assertEqual(len(h), 2)
        self.assertEqual([r["delta"] for r in h], [500, -500])


class TestReconcile(LedgerTestBase):
    def test_reconcile_ok(self):
        self.adjust(100)
        self.adjust(-40)
        rep = self.db.reconcile()
        self.assertTrue(rep["ok"])
        self.assertEqual(rep["accounts"], 1)
        self.assertEqual(rep["entries"], 2)

    def test_reconcile_detects_out_of_band_tampering(self):
        self.adjust(100)
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("UPDATE accounts SET balance = balance + 9999 WHERE id = ?", (self.acct,))
            conn.commit()
        finally:
            conn.close()

        rep = self.db.reconcile()
        self.assertFalse(rep["ok"])
        self.assertEqual(len(rep["mismatches"]), 1)
        m = rep["mismatches"][0]
        self.assertEqual(m["balance"], 10099)
        self.assertEqual(m["ledger_sum"], 100)

    def test_reconcile_multiple_accounts(self):
        a2 = self.db.create_account("user-2")
        self.db.adjust(10, account_id=a2, reason="r", operator_id="op")
        self.adjust(5)
        rep = self.db.reconcile()
        self.assertTrue(rep["ok"])
        self.assertEqual(rep["accounts"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
