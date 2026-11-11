# DZMM 本地模拟 API（OpenAI 兼容 + 可调额度）

在本地跑一个和 DZMM **同款模型 ID** 的接口，用来把客户端、脚本、SillyTavern 配置全部调通，再决定要不要花钱上真接口。

**它不是** DZMM 的任何镜像或逆向服务：不连接 dzmm.ai、不需要对方账号、也不会影响任何真实额度。额度是本地 SQLite 账本，随便改。

## 快速开始

```bash
cd mock-api
python3 server.py
# DZMM 本地模拟 API 已启动
#   Base URL : http://127.0.0.1:8787/v1
#   API Key  : sk-local-test
#   Admin Key: admin-local-test
#   模型数量 : 52
#   初始额度 : 1000
```

```bash
# 1) 列模型（52 个，ID 与 DZMM 一致）
curl -s http://127.0.0.1:8787/v1/models \
  -H "Authorization: Bearer sk-local-test" | head -c 400

# 2) 对话（会按 token 扣额度）
curl -s http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-local-test" \
  -H "Content-Type: application/json" \
  -d '{"model":"x-apex-sigma-0621","messages":[{"role":"user","content":"你好"}]}'

# 3) 查额度
curl -s http://127.0.0.1:8787/v1/quota -H "Authorization: Bearer sk-local-test"

# 4) 改额度（模拟充值 / 回滚，随你调）
curl -s http://127.0.0.1:8787/admin/topup \
  -H "Authorization: Bearer admin-local-test" \
  -H "Content-Type: application/json" \
  -d '{"delta":500,"reason":"手动充值"}'

# 5) 流式
curl -N http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-local-test" \
  -H "Content-Type: application/json" \
  -d '{"model":"nalang-turbo-0826","stream":true,"messages":[{"role":"user","content":"流式"}]}'
```

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 存活检查，返回模型数量 |
| GET | `/v1/models` | 52 个模型（`id` = DZMM 内部模型名，附 `context_length` / `price`） |
| POST | `/v1/chat/completions` | 对话，支持 `stream: true`（SSE） |
| GET | `/v1/quota` | 当前额度 |
| POST | `/admin/topup` | 管理端加减额度，需 Admin Key |

鉴权：`Authorization: Bearer <key>`；管理端用另一个 key，避免客户端误调。

## 额度怎么算

```
tokens ≈ 字符数 / 1.6（中文估算）
cost   = ceil(tokens × 该模型单价系数 × 1000)    # 最少 1 分
```

所以 `x-apex-sigma-0621`（0.0005）比 `nalang-turbo-0826`（0.0001）贵 5 倍——和站内档位差一致，方便你验证"切档省钱"的效果。

额度是真账本（复用 `ledger-system/`）：只追加流水、幂等键去重、事务内扣减、不透支，`ledger.reconcile()` 能对账。所以"改额度"在这里是**合法的管理端操作**，有审计、有流水，不是偷偷 UPDATE 一个数字。

环境变量可调：

| 变量 | 默认 | 作用 |
|---|---|---|
| `MOCK_PORT` | 8787 | 端口 |
| `MOCK_API_TOKEN` | `sk-local-test` | 客户端 Key |
| `MOCK_ADMIN_TOKEN` | `admin-local-test` | 管理端 Key |
| `MOCK_INITIAL_QUOTA` | 1000 | 首次启动的初始额度 |
| `MOCK_COST_FACTOR` | 1000 | 计费系数（想更贵就调大） |
| `MOCK_DB` | `mock.db` | 账本文件 |

## 接客户端

**OpenAI SDK（Python）**

```python
from openai import OpenAI
c = OpenAI(base_url="http://127.0.0.1:8787/v1", api_key="sk-local-test")
print(c.chat.completions.create(
    model="x-apex-surge-0505",
    messages=[{"role": "user", "content": "你好"}],
).choices[0].message.content)
```

**SillyTavern**：连接类型选 `OpenAI 兼容`，Base URL 填 `http://127.0.0.1:8787/v1`，Key 填 `sk-local-test`，模型名手填 `nalang-turbo-0826` 等。

**油猴脚本**：装好 `tampermonkey/dzmm-helper.user.js`，打开「API」页签 → Base URL `http://127.0.0.1:8787/v1`、Key `sk-local-test` → 点「拉取模型 / 查额度 / 发一条测试对话」。

## 换成真 DZMM

同一套客户端代码，只改两处：

1. `base_url` 换成 DZMM 在「我的 → API」里给你的基础地址（OpenAI 兼容端点 / SillyTavern 端点）
2. `api_key` 换成你的 Token（**需要 VIP1 及以上**）

模型名不用改，就是本目录 `models.json` 里那些 `internalName`。真接口按站内积分计费，且有内容审核与频率限制（VIP1 50 次/分 → VIP3 300 次/分）。

## 测试

```bash
cd mock-api
python3 -m unittest -v test_server.py    # 14 项
```

覆盖：模型列表与鉴权、扣额度、贵档更贵、流式、额度不足 402、未知模型 404、坏 Key 401、管理端加减额度、零值拒绝、幂等键不重复扣、账本对账。

## 边界

- 这是**本地模拟**，产出的是假回复（带模型名与扣费信息的回显），不是真模型能力。
- 真站额度**不能**改：改了支付对账立刻不平，且属于非法获取计算机信息系统数据/诈骗。要额度就充值、做任务、拿邀请返佣，或者切便宜档位。
- 本目录代码不发任何外部请求。
