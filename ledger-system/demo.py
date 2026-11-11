#!/usr/bin/env python3
"""演示：正常调账 → 幂等重放 → 并发 → 对账 → 检测越权篡改。

运行：python3 demo.py
"""

import os
import tempfile

from ledger import Ledger


def main() -> None:
    tmp = tempfile.TemporaryDirectory()
    db = Ledger(os.path.join(tmp.name, "demo.db"))
    acct = db.create_account("demo-user")

    print("① 调账 +500（工单 OTB-0001，操作员 finance-zhang）")
    r = db.adjust(500, account_id=acct, reason="工单补偿", ticket="OTB-0001",
                  operator_id="finance-zhang", idempotency_key="demo-1", client_ip="10.0.0.9")
    print(f"   余额：{r['balance_before']} → {r['balance_after']}")

    print("② 同一 Idempotency-Key 重放（模拟客户端超时重试）")
    r2 = db.adjust(500, account_id=acct, reason="工单补偿", ticket="OTB-0001",
                   operator_id="finance-zhang", idempotency_key="demo-1")
    print(f"   duplicate={r2['duplicate']}，余额仍为 {db.balance(acct)}（未重复入账）")

    print("③ 扣 120（模型消耗）")
    r3 = db.adjust(-120, account_id=acct, reason="对话消耗", operator_id="system")
    print(f"   余额：{r3['balance_before']} → {r3['balance_after']}")

    print("④ 对账")
    rep = db.reconcile()
    print(f"   ok={rep['ok']}，账户 {rep['accounts']} 个，流水 {rep['entries']} 条")

    print("⑤ 模拟「有人绕过接口直接改数据库」（余额 +9999）")
    import sqlite3
    conn = sqlite3.connect(db.db_path)
    conn.execute("UPDATE accounts SET balance = balance + 9999 WHERE id = ?", (acct,))
    conn.commit()
    conn.close()

    rep = db.reconcile()
    print(f"   ok={rep['ok']}，发现 {len(rep['mismatches'])} 处不一致：")
    for m in rep["mismatches"]:
        print(f"     account={m['id']} 余额={m['balance']} 流水和={m['ledger_sum']} 差额={m['balance'] - m['ledger_sum']}")

    tmp.cleanup()


if __name__ == "__main__":
    main()
