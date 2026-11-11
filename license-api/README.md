# 卡密系统（自有产品）

发卡 → 兑换 → 绑定用户 → 发 API Token → 查/吊销。跑在本地 SQLite，零依赖。

> 用途：给**你自己的产品**做授权。上游模型额度请用你自己的付费 API Token（官方 VIP1 或正规中转），这套系统只管"谁能用、用多少、用到什么时候"。

## 跑起来

```bash
cd license-api
python3 server.py
# http://127.0.0.1:8790
# Admin Token: admin-local-test（生产用环境变量 LICENSE_ADMIN_TOKEN 换掉）
```

## 四个动作

```bash
# 1) 发 3 张卡（明文只出现这一次）
curl -s -X POST http://127.0.0.1:8790/admin/cards \
  -H 'X-Admin-Token: admin-local-test' \
  -H 'Content-Type: application/json' \
  -d '{"count":3,"plan":"starter","quota_total":1000,"duration_days":30}'

# 2) 用户兑换（一卡一绑，返回 sk- 开头的 API Token）
curl -s -X POST http://127.0.0.1:8790/redeem \
  -H 'Content-Type: application/json' \
  -d '{"key":"DZMM-XXXXX-XXXXX-XXXXX-XXXXX","user_id":"u_1001"}'

# 3) 查卡（脱敏，不消耗）
curl -s -X POST http://127.0.0.1:8790/lookup \
  -H 'Content-Type: application/json' -d '{"key":"DZMM-..."}'

# 4) 吊销 / 统计
curl -s -X POST http://127.0.0.1:8790/admin/cards/1/revoke -H 'X-Admin-Token: admin-local-test'
curl -s http://127.0.0.1:8790/admin/stats -H 'X-Admin-Token: admin-local-test'
```

## 设计要点

| 点 | 做法 | 为什么 |
|---|---|---|
| 卡密存储 | 只存 `SHA-256(key)`，明文仅在发卡响应里出现一次 | 拖库拿不到原文；日志、备份也不泄露 |
| 卡密格式 | `DZMM-XXXXX-XXXXX-XXXXX-XXXXX`，25 字符集去掉 `I O 0 1` | 手抄/口述不出错 |
| 一卡一绑 | 兑换后 `status=redeemed` + `bound_to` | 二次兑换 409，防转卖刷额度 |
| 有效期 | `expires_at = 兑换时刻 + duration_days` | 过期自动失效，`lookup` 显示 `expired` |
| 吊销 | `status=revoked`，即时生效 | 退款/风控 |
| Token | `sk-` + 24 字节随机，库里同样只存哈希 | 与卡密同级别保护 |
| 限流 | 每 IP 每分钟 30 次 redeem/lookup | 挡撞库 |
| 审计 | `events` 表记 issue / redeem_ok / redeem_fail / revoke | 出事能回溯 |

**关键推论**：卡密原文只在你发卡那一刻存在。所以"拷别人的卡密"这件事，在技术上也拿不到——对方数据库里只有哈希，撞 32^20 种组合没意义；能拿到的只有"已被使用的前缀"，没有价值。

## 接到你的服务上

把 `api_tokens` 表当成你的鉴权源：

```python
def check_token(raw: str) -> dict | None:
    h = hashlib.sha256(raw.encode()).hexdigest()
    row = db.execute("SELECT * FROM api_tokens WHERE token_hash=? AND revoked=0", (h,)).fetchone()
    if not row: return None
    if row["quota_used"] >= row["quota_total"]: return None
    return dict(row)
```

再在每次调用大模型前 `quota_used += tokens`，超额返回 402。这就是完整的"卡密 → 额度 → 调用"闭环。

## 测试

```bash
python3 -m unittest -v test_server.py     # 13 项
```

覆盖：发卡格式、列表脱敏、**库里无明文**、兑换发 Token、二次兑换 409、缺 user_id 400、坏卡 404、lookup 脱敏、吊销后 403、过期判定、管理端鉴权、统计、限流 429。
