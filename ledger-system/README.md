# 账务核心（余额 + 流水）参考实现与测试

> **范围声明**：这是一份**本地、离线、跑在你自己数据库上**的账务参考实现，用于演示"改余额"的正确工程做法（流水记账 + 幂等 + 并发安全 + 对账）。
> 代码**不含任何联网逻辑**，不会、也不能对 `dzmm.ai` 或任何第三方站点发起请求。

## 目录

```
ledger.py          核心：建表 + 调账 + 幂等 + 并发 + 对账 + CLI
test_ledger.py     25 个测试用例（单元 / 并发 / 安全 / 对账）
demo.py            演示一遍完整流程（含"被绕过篡改"的检测）
run_tests.sh       一键跑测试 + 演示 + 对账
```

## 快速开始

```bash
python3 -m unittest -v test_ledger.py   # 跑测试（约 1 秒）
python3 demo.py                         # 看流程
python3 ledger.py ./ledger.db           # 对账（不一致返回非 0）
```

实测输出（本机）：

```
Ran 25 tests in 1.369s
OK
```

## 它解决的核心问题

| 问题 | 错误做法 | 本实现 |
|---|---|---|
| 改余额 | `UPDATE accounts SET balance = 999` | 只允许**追加流水**，余额由流水推导 |
| 客户端超时重试 | 用户的余额被加两次 | `(account_id, idempotency_key)` 唯一索引，重放返回首次结果 |
| 并发扣费 | 丢更新（lost update） | `BEGIN IMMEDIATE` 写锁 + 版本号 + 锁冲突重试 |
| 扣成负数 | 先查后写，中间被插队 | 事务内判断 + `CHECK(balance >= 0)` 双保险 |
| 金额精度 | 用 float 存钱 | 只收整数（分/积分），拒绝 `float`/`bool`/`str` |
| 谁改的说不清 | 只留最后余额 | 审计字段齐全：人、时间、原因、工单、IP、改前改后 |
| 事后追责 | 允许改/删流水 | 触发器让流水**只追加**，改删直接报错 |
| 查账 | 人工翻数据库 | `reconcile()`：`SUM(ledger.delta) == accounts.balance` |

## 核心不变量

```
1. accounts.balance == SUM(ledger.delta WHERE account_id = accounts.id)
2. ledger 只允许 INSERT
3. 任何一次余额变化都对应一条唯一 (account_id, idempotency_key) 的流水
4. balance >= 0
5. 每笔流水都有 operator_id + reason（否则拒绝）
```

第 1 条由 `reconcile()` 校验，也是抓"有人直接改库"的唯一手段——`demo.py` 第 ⑤ 步就演示了余额被手改成 +9999 后对账立刻报警。

## 接口层怎么接（示例）

```python
# 伪代码：把 Ledger.adjust 挂到管理端接口
@app.post("/admin/accounts/{account_id}/adjust")
def adjust(account_id, body, user):
    require_role(user, "finance")                       # RBAC
    return ledger.adjust(
        delta=body["delta"],
        account_id=account_id,
        reason=body["reason"],
        ticket=body.get("ticket"),
        operator_id=user.id,
        role=user.role,
        client_ip=request.client_ip,
        idempotency_key=request.headers["Idempotency-Key"],   # 必填
    )
```

要点：`Idempotency-Key` 由**客户端生成**（网关/前端重试时保持不变），服务端不自己编。

## 换成 Postgres / Node 时怎么对应

| 本实现（SQLite） | Postgres | Node/TS 等价 |
|---|---|---|
| `BEGIN IMMEDIATE` | `BEGIN` + `SELECT ... FOR UPDATE` | `client.query('BEGIN')` + `FOR UPDATE` |
| `UNIQUE(account_id, idempotency_key)` | 同 | Prisma `@@unique` / Knex 唯一索引 |
| 触发器禁 UPDATE/DELETE | `REVOKE UPDATE, DELETE ON ledger FROM app` | 同（用权限，不用应用层自觉） |
| `CHECK(balance >= 0)` | 同 | 同 |
| `reconcile()` | 定时任务 + 告警 | `node-cron` + 钉钉/飞书 webhook |

## 测试矩阵（25 例）

| 组 | 覆盖 |
|---|---|
| BasicFlow (4) | 加/扣、流水顺序、按 user_id 查、账户不存在 |
| Idempotency (3) | 重放不重复入账、不同键累加、同键不同参数以首次为准 |
| Concurrency (2) | **40 线程各 +1 无丢失更新**、**20 线程同键只入账一次** |
| Guards (9) | 不透支、0 值、float、bool、str、单笔上限、reason 必填、角色校验、操作员必填 |
| AuditAndImmutability (4) | 审计字段落库、流水禁改禁删、余额禁负（SQL 层）、冲正保留原记录 |
| Reconcile (3) | 正常对账、**检出绕过接口的篡改**、多账户汇总 |

## 已知边界（生产要补）

- 本实现用 SQLite，适合单机/演示；生产建议 Postgres + 行锁。
- 未含：多币种、冻结额度（预扣/退款）、跨账户转账、审批流（双人复核）。
- 未含鉴权中间件本身（`require_role` 只是示意），实际要接你的登录态。
- 对账建议做成**只读副本上的定时任务**，并保留每次对账快照，便于回溯。
