"""账务核心：账户 + 单向流水（ledger）+ 幂等 + 并发安全 + 对账。

设计要点（对应"改余额"这件事的工程正解）：
  1. 余额不是"改"出来的，是流水累加出来的：ledger 只追加，永不 UPDATE/DELETE（触发器强制）。
  2. 每个请求带 Idempotency-Key：(account_id, idempotency_key) 唯一索引，重放直接返回上次结果。
  3. 并发安全：写事务用 BEGIN IMMEDIATE（SQLite 的写锁），配 busy_timeout + 重试；余额 UPDATE 带 version 自增。
  4. 不透支：accounts.balance CHECK(balance >= 0)，扣款在事务内判断，不足即抛异常。
  5. 金额只允许整数（积分/分），拒绝 float 与 bool，避免浮点误差。
  6. 审计：谁、何时、何因、工单号、IP、改前改后余额，全部落库。
  7. 对账：SUM(ledger.delta) 必须等于 accounts.balance。

仅用于本地/自有数据库；不包含任何联网逻辑。
"""

from __future__ import annotations

import sqlite3
import time
import uuid
from datetime import datetime, timezone

# ---------------------------------------------------------------- 常量

MAX_ABS_DELTA = 1_000_000          # 单笔上限（积分）
ALLOWED_ROLES = {"finance", "admin"}  # 只有财务/管理员可调账
RETRY_TIMES = 8                    # 写锁冲突重试次数
RETRY_BASE_SLEEP = 0.01            # 退避基数（秒）

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL UNIQUE,
    balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    version     INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    delta           INTEGER NOT NULL CHECK (delta <> 0),
    reason          TEXT    NOT NULL,
    ticket          TEXT,
    idempotency_key TEXT    NOT NULL,
    operator_id     TEXT    NOT NULL,
    operator_role   TEXT    NOT NULL,
    client_ip       TEXT,
    balance_before  INTEGER NOT NULL,
    balance_after   INTEGER NOT NULL,
    created_at      TEXT    NOT NULL,
    UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger(account_id, id);

-- 流水表只允许 INSERT
CREATE TRIGGER IF NOT EXISTS trg_ledger_no_update
BEFORE UPDATE ON ledger
BEGIN
    SELECT RAISE(ABORT, 'ledger is append-only: UPDATE forbidden');
END;

CREATE TRIGGER IF NOT EXISTS trg_ledger_no_delete
BEFORE DELETE ON ledger
BEGIN
    SELECT RAISE(ABORT, 'ledger is append-only: DELETE forbidden');
END;
"""


# ---------------------------------------------------------------- 异常

class LedgerError(Exception):
    """账务异常基类。"""


class ValidationError(LedgerError):
    """参数非法。"""


class PermissionDenied(LedgerError):
    """无调账权限。"""


class AccountNotFound(LedgerError):
    """账户不存在。"""


class InsufficientFunds(LedgerError):
    """余额不足（不允许扣成负数）。"""


# ---------------------------------------------------------------- 工具

def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=30.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _is_locked(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "locked" in msg or "busy" in msg


# ---------------------------------------------------------------- 核心

class Ledger:
    def __init__(self, db_path: str):
        self.db_path = db_path
        with _connect(db_path) as conn:
            conn.executescript(SCHEMA)

    # ---------------- 账户

    def create_account(self, user_id: str, initial_balance: int = 0) -> int:
        if not isinstance(initial_balance, int) or isinstance(initial_balance, bool):
            raise ValidationError("initial_balance 必须是整数")
        if initial_balance < 0:
            raise ValidationError("初始余额不能为负")
        conn = _connect(self.db_path)
        try:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.execute(
                "INSERT INTO accounts(user_id, balance, version, updated_at) VALUES (?,0,0,?)",
                (user_id, _now()),
            )
            account_id = int(cur.lastrowid)
            if initial_balance:
                # 初始余额也必须走流水，否则 SUM(ledger.delta) != balance
                conn.execute(
                    """INSERT INTO ledger(account_id, delta, reason, ticket, idempotency_key,
                                          operator_id, operator_role, client_ip,
                                          balance_before, balance_after, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (account_id, initial_balance, "初始余额", None, "init-" + str(account_id),
                     "system", "admin", None, 0, initial_balance, _now()),
                )
                conn.execute("UPDATE accounts SET balance=?, version=1 WHERE id=?",
                             (initial_balance, account_id))
            conn.execute("COMMIT")
            return account_id
        except Exception:
            try:
                conn.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            conn.close()

    def account(self, account_id: int | None = None, user_id: str | None = None) -> dict:
        conn = _connect(self.db_path)
        try:
            row = self._fetch_account(conn, account_id, user_id)
            return dict(row)
        finally:
            conn.close()

    def balance(self, account_id: int | None = None, user_id: str | None = None) -> int:
        return self.account(account_id, user_id)["balance"]

    # ---------------- 调账

    def adjust(
        self,
        delta: int,
        *,
        account_id: int | None = None,
        user_id: str | None = None,
        reason: str = "",
        operator_id: str = "",
        role: str = "finance",
        idempotency_key: str | None = None,
        ticket: str | None = None,
        client_ip: str | None = None,
    ) -> dict:
        """调整余额。返回 {duplicate, ledger_id, balance_before, balance_after, balance}。"""
        self._validate(delta, reason, operator_id, role)
        key = idempotency_key or str(uuid.uuid4())

        last_exc: Exception | None = None
        for attempt in range(RETRY_TIMES):
            conn = _connect(self.db_path)
            try:
                conn.execute("BEGIN IMMEDIATE")          # 拿写锁，等价于行级串行化
                acct = self._fetch_account(conn, account_id, user_id)

                existing = conn.execute(
                    "SELECT * FROM ledger WHERE account_id=? AND idempotency_key=?",
                    (acct["id"], key),
                ).fetchone()
                if existing:
                    conn.execute("ROLLBACK")
                    return self._result(existing, duplicate=True)

                before = int(acct["balance"])
                after = before + int(delta)
                if after < 0:
                    raise InsufficientFunds(f"余额不足：当前 {before}，扣 {abs(delta)}")

                ts = _now()
                try:
                    cur = conn.execute(
                        """INSERT INTO ledger(account_id, delta, reason, ticket, idempotency_key,
                                              operator_id, operator_role, client_ip,
                                              balance_before, balance_after, created_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                        (acct["id"], int(delta), reason, ticket, key, operator_id,
                         role, client_ip, before, after, ts),
                    )
                except sqlite3.IntegrityError:
                    # 并发下同一幂等键被另一请求抢先写入
                    conn.execute("ROLLBACK")
                    row = _connect(self.db_path).execute(
                        "SELECT * FROM ledger WHERE account_id=? AND idempotency_key=?",
                        (acct["id"], key),
                    ).fetchone()
                    return self._result(row, duplicate=True)

                conn.execute(
                    "UPDATE accounts SET balance=?, version=version+1, updated_at=? WHERE id=? AND version=?",
                    (after, ts, acct["id"], acct["version"]),
                )
                conn.execute("COMMIT")
                return {
                    "duplicate": False,
                    "ledger_id": int(cur.lastrowid),
                    "account_id": int(acct["id"]),
                    "balance_before": before,
                    "balance_after": after,
                    "balance": after,
                    "idempotency_key": key,
                }
            except (InsufficientFunds, ValidationError, AccountNotFound, PermissionDenied):
                self._safe_rollback(conn)
                raise
            except sqlite3.OperationalError as exc:
                self._safe_rollback(conn)
                if not _is_locked(exc) or attempt == RETRY_TIMES - 1:
                    raise
                last_exc = exc
            finally:
                conn.close()
            time.sleep(RETRY_BASE_SLEEP * (2 ** attempt))
        raise LedgerError(f"写事务重试耗尽：{last_exc}")

    # ---------------- 查询 / 对账

    def history(self, account_id: int) -> list[dict]:
        conn = _connect(self.db_path)
        try:
            rows = conn.execute(
                "SELECT * FROM ledger WHERE account_id=? ORDER BY id", (account_id,)
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def reconcile(self) -> dict:
        """全库对账：SUM(ledger.delta) 必须等于 accounts.balance。"""
        conn = _connect(self.db_path)
        try:
            rows = conn.execute(
                """SELECT a.id, a.user_id, a.balance,
                          COALESCE(SUM(l.delta), 0) AS ledger_sum,
                          COUNT(l.id) AS entries
                   FROM accounts a LEFT JOIN ledger l ON l.account_id = a.id
                   GROUP BY a.id ORDER BY a.id"""
            ).fetchall()
        finally:
            conn.close()

        mismatches = [
            dict(r) for r in rows if int(r["balance"]) != int(r["ledger_sum"])
        ]
        return {
            "ok": not mismatches,
            "accounts": len(rows),
            "entries": sum(int(r["entries"]) for r in rows),
            "mismatches": mismatches,
        }

    # ---------------- 内部

    @staticmethod
    def _validate(delta, reason, operator_id, role) -> None:
        if isinstance(delta, bool) or not isinstance(delta, int):
            raise ValidationError("delta 必须是整数（禁止 float/bool，避免精度问题）")
        if delta == 0:
            raise ValidationError("delta 不能为 0")
        if abs(delta) > MAX_ABS_DELTA:
            raise ValidationError(f"单笔超过上限 {MAX_ABS_DELTA}")
        if not reason or not str(reason).strip():
            raise ValidationError("reason 必填（审计要求）")
        if not operator_id:
            raise ValidationError("operator_id 必填")
        if role not in ALLOWED_ROLES:
            raise PermissionDenied(f"角色 {role!r} 无调账权限，仅允许 {sorted(ALLOWED_ROLES)}")

    @staticmethod
    def _fetch_account(conn, account_id, user_id):
        if account_id is None and user_id is None:
            raise ValidationError("必须指定 account_id 或 user_id")
        row = (
            conn.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()
            if account_id is not None
            else conn.execute("SELECT * FROM accounts WHERE user_id=?", (user_id,)).fetchone()
        )
        if row is None:
            raise AccountNotFound(f"账户不存在：id={account_id} user_id={user_id}")
        return row

    @staticmethod
    def _result(row, duplicate: bool) -> dict:
        return {
            "duplicate": duplicate,
            "ledger_id": int(row["id"]),
            "account_id": int(row["account_id"]),
            "balance_before": int(row["balance_before"]),
            "balance_after": int(row["balance_after"]),
            "balance": int(row["balance_after"]),
            "idempotency_key": row["idempotency_key"],
        }

    @staticmethod
    def _safe_rollback(conn) -> None:
        try:
            conn.execute("ROLLBACK")
        except sqlite3.Error:
            pass


# ---------------------------------------------------------------- CLI

if __name__ == "__main__":
    import os
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "ledger.db")
    db = Ledger(path)
    report = db.reconcile()
    print(f"对账结果：{'通过' if report['ok'] else '不一致'}")
    print(f"  账户 {report['accounts']} 个，流水 {report['entries']} 条")
    for m in report["mismatches"]:
        print(f"  ✗ account={m['id']} user={m['user_id']} 余额={m['balance']} 流水和={m['ledger_sum']}")
    sys.exit(0 if report["ok"] else 1)
