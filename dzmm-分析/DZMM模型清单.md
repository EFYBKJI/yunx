# DZMM 模型清单（提取自公开接口）

- 来源：`https://www.dzmm.ai/api/trpc/chat.models`（无需登录）
- 抓取时间：2026-11-10
- 默认模型：`x-apex-surge-0505`
- 规模：**18 个档位 / 52 个上下文变体**（其中 49 个对外 API 可调，Vega 的 3 个为内测隐藏）

## 一张表：代号 → 内部模型名（家族）

| 展示名（对外） | 内部模型名 | 家族 | 系列 | 上下文 | 单价 |
|---|---|---|---|---|---|
| Dash-0727 (16K) | `x-apex-dash-0727-16k` | APEX | Dash-0727 | 16K | 0.0001 |
| Dash-0727 (32K) | `x-apex-dash-0727` | APEX | Dash-0727 | 32K | 0.0001 |
| Dash-0727 (64K) | `x-apex-dash-0727-64k` | APEX | Dash-0727 | 64K | 0.0001 |
| Dash-0727 (128K) | `x-apex-dash-0727-128k` | APEX | Dash-0727 | 128K | 0.0001 |
| Dash-0826 (16K) | `x-apex-dash-0826-16k` | APEX | Dash-0826 | 16K | 0.0001 |
| Dash-0826 (32K) | `x-apex-dash-0826` | APEX | Dash-0826 | 32K | 0.0001 |
| Dash-0826 (64K) | `x-apex-dash-0826-64k` | APEX | Dash-0826 | 64K | 0.0001 |
| Dash-0826 (128K) | `x-apex-dash-0826-128k` | APEX | Dash-0826 | 128K | 0.0001 |
| Flux-0217 (10K) | `x-apex-flux-0217-10k` | APEX | Flux-0217 | 10K | 0.0002 |
| Flux-0217 (16K) | `x-apex-flux-0217-16k` | APEX | Flux-0217 | 16K | 0.0002 |
| Flux-0217 (32K) | `x-apex-flux-0217` | APEX | Flux-0217 | 32K | 0.0002 |
| Max-0826 (10K) | `nalang-max-0826-10k` | NALANG | Max-0826 | 10K | 0.0004 |
| Max-0826 (16K) | `nalang-max-0826-16k` | NALANG | Max-0826 | 16K | 0.0004 |
| Max-0826 (32K) | `nalang-max-0826` | NALANG | Max-0826 | 32K | 0.0004 |
| Medium-0826 (10K) | `nalang-medium-0826-10k` | NALANG | Medium-0826 | 10K | 0.0002 |
| Medium-0826 (16K) | `nalang-medium-0826-16k` | NALANG | Medium-0826 | 16K | 0.0002 |
| Medium-0826 (32K) | `nalang-medium-0826` | NALANG | Medium-0826 | 32K | 0.0002 |
| Prism-0626 (16K) | `x-apex-prism-0408-16k` | APEX | Prism-0626 | 16K | 0.0003 |
| Prism-0626 (32K) | `x-apex-prism-0408` | APEX | Prism-0626 | 32K | 0.0003 |
| Pulse-0731 (16K) | `x-apex-pulse-0731-16k` | APEX | Pulse-0731 | 16K | 0.0002 |
| Pulse-0731 (32K) | `x-apex-pulse-0731` | APEX | Pulse-0731 | 32K | 0.0002 |
| Pulse-0731 (64K) | `x-apex-pulse-0731-64k` | APEX | Pulse-0731 | 64K | 0.0002 |
| Pulse-0731 (128K) | `x-apex-pulse-0731-128k` | APEX | Pulse-0731 | 128K | 0.0002 |
| Sigma-0621 (16K) | `x-apex-sigma-0621-16k` | APEX | Sigma-0621 | 16K | 0.0005 |
| Sigma-0621 (32K) | `x-apex-sigma-0621` | APEX | Sigma-0621 | 32K | 0.0005 |
| Sigma-0621 (64K) | `x-apex-sigma-0621-64k` | APEX | Sigma-0621 | 64K | 0.0005 |
| Sigma-0829 (16K) | `x-apex-sigma-0829-16k` | APEX | Sigma-0829 | 16K | 0.0005 |
| Sigma-0829 (32K) | `x-apex-sigma-0829` | APEX | Sigma-0829 | 32K | 0.0005 |
| Sigma-0829 (64K) | `x-apex-sigma-0829-64k` | APEX | Sigma-0829 | 64K | 0.0005 |
| Surge-0505 (16K) | `x-apex-surge-0505-16k` | APEX | Surge-0505 | 16K | 0.0004 |
| Surge-0505 (32K) | `x-apex-surge-0505` | APEX | Surge-0505 | 32K | 0.0004 |
| Surge-0923-a (16K) | `x-apex-surge-0923-a-16k` | APEX | Surge-0923-a | 16K | 0.0004 |
| Surge-0923-a (32K) | `x-apex-surge-0923-a` | APEX | Surge-0923-a | 32K | 0.0004 |
| Surge-0923-b (16K) | `x-apex-surge-0923-b-16k` | APEX | Surge-0923-b | 16K | 0.0004 |
| Surge-0923-b (32K) | `x-apex-surge-0923-b` | APEX | Surge-0923-b | 32K | 0.0004 |
| Surge-1018 (16K) | `x-apex-surge-1018-16k` | APEX | Surge-1018 | 16K | 0.0004 |
| Surge-1018 (32K) | `x-apex-surge-1018` | APEX | Surge-1018 | 32K | 0.0004 |
| Turbo-0101 (10K) | `nalang-turbo-1115-10k` | NALANG | Turbo-0101 | 10K | 0.0001 |
| Turbo-0101 (16K) | `nalang-turbo-1115-16k` | NALANG | Turbo-0101 | 16K | 0.0001 |
| Turbo-0101 (32K) | `nalang-turbo-1115` | NALANG | Turbo-0101 | 32K | 0.0001 |
| Turbo-0826 (10K) | `nalang-turbo-0826-10k` | NALANG | Turbo-0826 | 10K | 0.0001 |
| Turbo-0826 (16K) | `nalang-turbo-0826-16k` | NALANG | Turbo-0826 | 16K | 0.0001 |
| Turbo-0826 (32K) | `nalang-turbo-0826` | NALANG | Turbo-0826 | 32K | 0.0001 |
| Vega-1014 (16K) | `x-apex-vega-1014-16k` | APEX | Vega-1014 | 16K | 0.0005 |
| Vega-1014 (32K) | `x-apex-vega-1014` | APEX | Vega-1014 | 32K | 0.0005 |
| Vega-1014 (64K) | `x-apex-vega-1014-64k` | APEX | Vega-1014 | 64K | 0.0005 |
| XL-0826 (10K) | `nalang-xl-0826-10k` | NALANG | XL-0826 | 10K | 0.0003 |
| XL-0826 (16K) | `nalang-xl-0826-16k` | NALANG | XL-0826 | 16K | 0.0003 |
| XL-0826 (32K) | `nalang-xl-0826` | NALANG | XL-0826 | 32K | 0.0003 |
| XL-1022 (10K) | `x-apex-xl-1022-10k` | APEX | XL-1022 | 10K | 0.0003 |
| XL-1022 (16K) | `x-apex-xl-1022-16k` | APEX | XL-1022 | 16K | 0.0003 |
| XL-1022 (32K) | `x-apex-xl-1022` | APEX | XL-1022 | 32K | 0.0003 |

## 按系列分组（含运营参数）

### 🚀 XL-0826（XL系列）
- 描述：稳定均衡，承接清楚，适合常规长聊
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：否
- 内部模型名：`nalang-xl-0826-10k`(10K)、`nalang-xl-0826-16k`(16K)、`nalang-xl-0826`(32K)

### 🚀 XL-1022（XL系列）
- 描述：稳定均衡，承接清楚，适合常规长聊
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-xl-1022-10k`(10K)、`x-apex-xl-1022-16k`(16K)、`x-apex-xl-1022`(32K)

### ⚡ Surge-0505（Apex系列）
- 描述：情绪反应快，互动感强，适合高代入角色扮演
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-surge-0505-16k`(16K)、`x-apex-surge-0505`(32K)

### ⚡ Surge-0923-b（Apex系列）
- 描述：情绪反应快，互动感强，适合高代入角色扮演
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-surge-0923-b-16k`(16K)、`x-apex-surge-0923-b`(32K)

### ⚡ Surge-0923-a（Apex系列）
- 描述：情绪反应快，互动感强，适合高代入角色扮演
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-surge-0923-a-16k`(16K)、`x-apex-surge-0923-a`(32K)

### ⚡ Surge-1018（Apex系列）
- 描述：情绪反应快，互动感强，适合高代入角色扮演
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-surge-1018-16k`(16K)、`x-apex-surge-1018`(32K)

### ⚡ Dash-0826（Apex系列）
- 描述：响应更快、积分消耗更低，适合长对话高频互动
- 思维链(thinking)：支持 ｜ 严格审核：是 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-dash-0826-16k`(16K)、`x-apex-dash-0826`(32K)、`x-apex-dash-0826-64k`(64K)、`x-apex-dash-0826-128k`(128K)

### ⚡ Pulse-0731（Apex系列）
- 描述：兼顾响应速度与细节表现，适合长对话和高频剧情互动
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-pulse-0731-16k`(16K)、`x-apex-pulse-0731`(32K)、`x-apex-pulse-0731-64k`(64K)、`x-apex-pulse-0731-128k`(128K)

### ⚡ Dash-0727（Apex系列）
- 描述：响应更快、积分消耗更低，适合长对话高频互动
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-dash-0727-16k`(16K)、`x-apex-dash-0727`(32K)、`x-apex-dash-0727-64k`(64K)、`x-apex-dash-0727-128k`(128K)

### 🧪 Vega-1014（Apex系列）
- 描述：内测档位，仅对受邀账号开放
- 思维链(thinking)：支持 ｜ 严格审核：是 ｜ 最低会员：VIP3 ｜ Apex：是
- 内部模型名：`x-apex-vega-1014-16k`(16K)、`x-apex-vega-1014`(32K)、`x-apex-vega-1014-64k`(64K)

### 🧠 Sigma-0829（Apex系列）
- 描述：长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开
- 思维链(thinking)：支持 ｜ 严格审核：是 ｜ 最低会员：VIP3 ｜ Apex：是
- 内部模型名：`x-apex-sigma-0829-16k`(16K)、`x-apex-sigma-0829`(32K)、`x-apex-sigma-0829-64k`(64K)

### ⚡ Flux-0217（Apex系列）
- 描述：画面感强，场景推进快，适合沉浸式剧情互动
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-flux-0217-10k`(10K)、`x-apex-flux-0217-16k`(16K)、`x-apex-flux-0217`(32K)

### 🧠 Sigma-0621（Apex系列）
- 描述：长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP3 ｜ Apex：是
- 内部模型名：`x-apex-sigma-0621-16k`(16K)、`x-apex-sigma-0621`(32K)、`x-apex-sigma-0621-64k`(64K)

### 💎 Prism-0626（Apex系列）
- 描述：高密度沉浸派，刺激直给，适合强场景
- 思维链(thinking)：不支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：是
- 内部模型名：`x-apex-prism-0408-16k`(16K)、`x-apex-prism-0408`(32K)

### 👑 Max-0826（Max系列）
- 描述：旗舰稳定款，叙事顺滑，承接直接，适合高质量长聊
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：否
- 内部模型名：`nalang-max-0826-10k`(10K)、`nalang-max-0826-16k`(16K)、`nalang-max-0826`(32K)

### 🚀 Turbo-0826（Turbo系列）
- 描述：旧版低消耗模型，适合基础聊天
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：否
- 内部模型名：`nalang-turbo-0826-10k`(10K)、`nalang-turbo-0826-16k`(16K)、`nalang-turbo-0826`(32K)

### 🚀 Turbo-0101（Turbo系列）
- 描述：低消耗均衡款，适合轻量日常聊天
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：否
- 内部模型名：`nalang-turbo-1115-10k`(10K)、`nalang-turbo-1115-16k`(16K)、`nalang-turbo-1115`(32K)

### ✨ Medium-0826（Medium系列）
- 描述：轻量耐用，互动自然，适合日常陪伴和中低消耗长聊
- 思维链(thinking)：支持 ｜ 严格审核：否 ｜ 最低会员：VIP0 ｜ Apex：否
- 内部模型名：`nalang-medium-0826-10k`(10K)、`nalang-medium-0826-16k`(16K)、`nalang-medium-0826`(32K)