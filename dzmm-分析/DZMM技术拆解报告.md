# DZMM.AI 拆解报告：它到底"用什么 AI"

- 抓取时间：2026-11-10（UTC+8 约 20:0x–20:3x）
- 目标：`https://www.dzmm.ai/?t=for_you&c=girl`
- 抓取范围：**只抓公开元数据**——页面 HTML、前端 JS 打包产物、公开 tRPC 接口、robots/sitemap、页脚法律条款、以及第三方中转站的公开比价接口。**没有抓取用户对话、角色卡正文、小说正文等 UGC 内容。**

---

## 一、一句话结论

> DZMM 不是"套一个 ChatGPT"，而是**自建了一套模型网关 + 双血脉模型矩阵**：
> 平价档是自家微调的 **Nalang 系列**（Turbo / Medium / XL / Max），高价档是代号化的 **Apex 系列"巨型实验模型"**（Surge / Dash / Pulse / Sigma / Prism / Flux / Vega / XL-1022）。
> 对外**故意不暴露底层厂牌**，只给代号和日期版本号；平台层统一用 OpenAI 兼容接口 + 自研 Card-Chat v2 接口对外分发，甚至还被第三方中转站按 token 转售。

---

## 二、站点定位（它卖的是什么）

| 项 | 内容 |
|---|---|
| 产品 | AI 角色扮演 / 角色卡社区 / AI 小说 / 角色工坊 / App 小游戏（dzmm 应用平台） |
| 自述 | "DZMM 是一个 AI 角色扮演与创作平台，提供 AI 角色卡、小说创作和 AI 绘画功能"（页面 JSON-LD） |
| 运营主体 | 页脚/隐私政策署名 "DZMM project team"，运营站点 **dzmm.io**；数据跨境声明指向 **美国、新加坡** |
| 内容定位 | 默认允许 R18（多个模型 `strictModeration=false`），站内分区含 `sm / ntr / hougong / foot-fetish / futa / gay` 等 |
| 商业化 | 积分制 + VIP0–VIP3 会员 + API Token（VIP1 起）+ 广告投放（ads.dzmm.io）+ 联盟返佣 |

**历史渊源（中置信度）**：早期对外 API 域名是 `www.gpt4novel.com/api/xiaoshuoai/ext/v1/chat/completions`（社区插件默认值仍写死在这个域名），PTT 教学文亦称"DZMM 的 AI 基于故事编辑器型的 GPT4Novel，但有自行建构的模型 Nalang"。也就是说它是**AI 小说写作站演化成角色扮演平台**的产物，`gpt4novel.com` 现已不解析，品牌统一收拢到 dzmm。

---

## 三、已确认的技术栈（有证据）

| 层 | 实测证据 |
|---|---|
| CDN / 边缘 | `server: cloudflare`，`cf-ray: ...-HKG`，`alt-svc: h3`，`nel`/`report-to` 全套 CF 头 |
| 版本标识 | 响应头自建：`x-dzmm-build: 7fbcbc54...`、`x-dzmm-built-at: 1794327134122` |
| 前端 | React 服务端渲染 + 哈希化 `/assets/*.js` 分块（modulepreload），非 Next.js（无 `__next_f`、无 `astro-island`） |
| 后端 API | **tRPC**：`/api/trpc/...`（batch 协议，superjson transformer，TanStack Query 做缓存）+ 少量 REST `/api/with-auth/*`、`/api/auth/*`、`/api/draw/image/`、`/api/novelApi`、`/api/ads-serving`、`/api/health` → `{"status":"healthy"}` |
| 图片存储 | **Supabase Storage**：公网图床走 `pxlorbit.com` / `assetora.net` / `rls.cheggpt.com`，路径特征 `/storage/v1/object/public/`、`/storage/v1/render/image/public/`（含图片渲染/缩放）+ 多域名 standby 容灾切换脚本 |
| 对外模型 API | "OpenAI 兼容 + Card-Chat v2"：`/v1` Chat Completions 形态 + v2 角色卡对话（可传角色设定、用户称呼、上下文、多轮 messages），并专门适配 **SillyTavern** |
| 支付/其他 | `/api/recharge/payweld-link`、`/api/auth/sign-in-code/v2`（验证码登录）、`/api/web_experiments/`（前端实验分流） |
| 模型分发 | 第三方中转站 `aiproxynode.com` 的 `dzmm` 分组直接转售其 33 个模型（new-api 体系，`supported_endpoint_types: ["openai"]`，倍率 ratio=0.135），最低报价约 **0.27 元/百万输入 token** |

> 也就是说：**它不只是"用 AI"，它自己就是一家"卖 AI 算力"的网关服务商**。

---

## 四、模型体系：公开接口把底牌掀了

`https://www.dzmm.ai/api/trpc/chat.models` 这个接口**不需要登录**就能拉到完整模型目录（共 **18 个档位 / 49 个条目**，含上下文档位变体）。关键字段：`internalName / displayName / maxContext / price / isApex / thinkingSupported / strictModeration / minMembershipLevel`。

### 4.1 两条血脉

- **`nalang-*`**：自称自建/微调的 Nalang 系列 —— Turbo、Medium、XL、Max（版本号 0826 / 1115）。
- **`x-apex-*`**：Apex 系列，官方分类描述 **"巨型实验模型，极致智能"**，全部 `isApex: true`，代号 + 日期版本：
  - `Surge`（0505 / 0923-a / 0923-b / 1018）——情绪反应快、代入感强
  - `Dash`（0727 / 0826）——快、便宜，适合高频长聊
  - `Pulse`（0731）——速度与细节兼顾
  - `Sigma`（0621 / 0829）——长线剧情旗舰，VIP3 门槛
  - `Prism`（0626，内部名仍叫 `prism-0408`）——强场景、唯一不支持 thinking 的档位
  - `Flux`（0217）——画面感强
  - `Vega`（1014）——内测，仅受邀（VIP3 + 强制审核 + 拒绝续写）
  - `XL-1022`——XL 系列的 Apex 版

### 4.2 完整档位表（18 档）

| 系列 | 档位 | 内部模型名 | 上下文 | 计费系数 | Apex | thinking | 审核 | 门槛 |
|---|---|---|---|---|---|---|---|---|
| XL | XL-0826 | `nalang-xl-0826(-10k/-16k)` | 10/16/32K | 0.0003 | 否 | ✅ | 宽松 | 游客 |
| XL | XL-1022 | `x-apex-xl-1022(-10k/-16k)` | 10/16/32K | 0.0003 | 是 | ✅ | 宽松 | 游客 |
| Apex | Surge-0505 | `x-apex-surge-0505(-16k)` | 16/32K | 0.0004 | 是 | ✅ | 宽松 | 游客 |
| Apex | Surge-0923-a / -b | `x-apex-surge-0923-a/b(-16k)` | 16/32K | 0.0004 | 是 | ✅ | 宽松 | 游客 |
| Apex | Surge-1018 | `x-apex-surge-1018(-16k)` | 16/32K | 0.0004 | 是 | ✅ | 宽松 | 游客 |
| Apex | Dash-0727 | `x-apex-dash-0727(-16k/-64k/-128k)` | 16K–128K | 0.0001 | 是 | ✅ | 宽松 | 游客 |
| Apex | Dash-0826 | `x-apex-dash-0826(-16k/-64k/-128k)` | 16K–128K | 0.0001 | 是 | ✅ | **严格** | 游客 |
| Apex | Pulse-0731 | `x-apex-pulse-0731(-16k/-64k/-128k)` | 16K–128K | 0.0002 | 是 | ✅ | 宽松 | 游客 |
| Apex | Flux-0217 | `x-apex-flux-0217(-10k/-16k)` | 10/16/32K | 0.0002 | 是 | ✅ | 宽松 | 游客 |
| Apex | Prism-0626 | `x-apex-prism-0408(-16k)` | 16/32K | 0.0003 | 是 | ❌ | 宽松 | 游客 |
| Apex | Sigma-0621 | `x-apex-sigma-0621(-16k/-64k)` | 16/32/64K | 0.0005 | 是 | ✅ | 宽松 | VIP3 |
| Apex | Sigma-0829 | `x-apex-sigma-0829(-16k/-64k)` | 16/32/64K | 0.0005 | 是 | ✅ | **严格** | VIP3 |
| Apex | Vega-1014 | `x-apex-vega-1014(-16k/-64k)` | 16/32/64K | 0.0005 | 是 | ✅ | **严格+拒绝续写** | VIP3 受邀 |
| Max | Max-0826 | `nalang-max-0826(-10k/-16k)` | 10/16/32K | 0.0004 | 否 | ✅ | 宽松 | 游客 |
| Turbo | Turbo-0826 | `nalang-turbo-0826(-10k/-16k)` | 10/16/32K | 0.0001 | 否 | ✅ | 宽松 | 游客 |
| Turbo | Turbo-0101 | `nalang-turbo-1115(-10k/-16k)` | 10/16/32K | 0.0001 | 否 | ✅ | 宽松 | 游客 |
| Medium | Medium-0826 | `nalang-medium-0826(-10k/-16k)` | 10/16/32K | 0.0002 | 否 | ✅ | 宽松 | 游客 |

> 注：显示名与内部名会错位（如 `Prism-0626` → `x-apex-prism-0408`、`Turbo-0101` → `nalang-turbo-1115`），说明**对外展示名是一层"营销外壳"**，内部仍按训练/上线版本管理。
> 游客默认模型 = `x-apex-surge-0505`（Surge-0505 32K），不是最便宜的档位。

### 4.3 从命名读出的三条硬信息

1. **全部模型都支持"思考开关"（thinking）**，除 Prism。→ 底层要能输出思维链，说明至少是具备 reasoning 能力的大模型（自研或大参数开源/闭源均可满足）。
2. **版本号是"月日"制 + A/B 变体**（`0923-a` / `0923-b`、`1022`、`1018`）。这是**自家训练 checkpoint 的命名习惯**；纯转发第三方 API 的站不会出现同月 a/b 双版本。
3. **上下文是"同一权重切三档卖"**（10K/16K/32K/64K/128K），计费系数随档位不变。这是典型的**自建推理服务**做法（同一模型按 context 长度做限流/计价），而不是按厂商 API 原价加价。

### 4.4 绘图 / 语音

- 绘图模型两项：`Anime`（免费档）与 `Iroha`（**VIP2 起**，`imageGenerationModelVipRequired`）。另有独立的 `x-apex-flux-0217` 在对外 API 里被标为 `image-generation` 类型的模型。
- 语音：角色对话支持"声优 / 语音设置 / 自动生成语音"（TTS），会员权益里还有"Nalang Dream"每日次数额度。

---

## 五、"用的是什么 AI"——分层结论

### ✅ 确定（可直接验证）
1. 平台是**多模型聚合 + 自建网关**，不存在"单一模型"。
2. 存在**两套自有品牌模型线**：`nalang-*`（自研系列）与 `x-apex-*`（Apex 实验系列），共 18 档位 / 49 条目。
3. 对外统一成 **OpenAI 兼容 /v1** + 自研 **Card-Chat v2**，并适配 SillyTavern；模型名对第三方以 `dzmm` 分组按 token 转售。
4. 图纸/语音是独立子系统（Anime + Iroha 画图，TTS 声优），与对话模型分开计费。
5. 底层厂牌**被刻意隐藏**：厂商名只出现在"OpenAI 兼容接口"这类技术描述里，从不作为"模型来源"披露；对外只有自造代号（Nalang / Apex / Anime / Iroha）与"巨型实验模型"这种模糊描述。

### 🟡 高概率（推断，无法从外部证实权重来源）
1. **Apex 系列是"代号化的高级别模型池"**：8 个以上代号、按日期滚动更新、A/B 试验、按 VIP 分层放量（Sigma/Vega 需 VIP3，Vega 仅受邀）——这套运营方式与"自研/自托管大参数模型"高度一致，但也**完全兼容"混合路由"**：部分档位可能路由到第三方前沿模型（Claude / Gemini / GPT 系）做代理，再套上 Apex 专属预设（站点明确写了"Apex 模型仅使用专属 Apex 预设，普通预设不生效"——这就是统一 system prompt 管理层的痕迹）。
2. **Nalang 系列是中文 RP 特调的小/中参数模型**：Triple/Medium/XL/Max 的档位、10K–32K 的小上下文、0.0001–0.0004 的低计费系数、第三方转售价 0.27 元/百万 token——都指向"自托管、成本极低、针对中文与 R18 语料做过 SFT/DPO"的模型，而不像原价转卖闭源 API。
3. **Anime 是自建二次元绘图**（SD / Illustrious / Pony 一类微调的概率较高）；**Iroha 是更高档画图档位**（VIP2 才开），具体底座未公开。

### ❌ 无法证实
- 具体权重底座（是否基于 Qwen / Llama / DeepSeek / 自研预训练）。
- Apex 各代号分别对应哪家上游（如果确实是代理的话）。
- 任何"它其实用的就是 XX"的说法，**目前站方与第三方都没有硬证据**；社区（NGA/贴吧）里也都是猜测。

---

## 六、关键证据链（可复现）

```bash
# 1) 公开模型目录（无需登录，直接给出 18 档位 / 49 条目 + 内部模型名）
curl -s -G "https://www.dzmm.ai/api/trpc/chat.models" \
  --data-urlencode 'batch=1' \
  --data-urlencode 'input={"0":{"json":{}}}'

# 2) tRPC 路由探测（可确认哪些过程存在）
curl -s -G "https://www.dzmm.ai/api/trpc/definitely.nonexistent" \
  --data-urlencode 'batch=1' --data-urlencode 'input={"0":{"json":null}}'
# → 404 "No procedure found on path ..."；而 chat.models 返回 200 真实数据

# 3) 第三方中转站把它的模型按 token 明码标价（33 个 dzmm 分组模型）
curl -s "https://aiproxynode.com/api/pricing" | python3 -m json.tool | grep -i dzmm

# 4) 图床/存储指纹（Supabase Storage 路径特征）
curl -sI "https://pxlorbit.com/storage/v1/object/public/"
```

> 模型清单与"去哪儿拿同类模型"见同目录：`DZMM模型清单.md`（18 档位 / 52 条目逐条对照）与 `模型获取渠道地图.md`（官方 API、中转站、开源替代全路线）。

配套原始数据（本目录）：
- `chat.models-原始返回.json` —— 接口原始响应，含每个模型的完整字段
- `DZMM模型清单.csv` —— 49 条「内部名 / 显示名 / 上下文 / 计费系数 / 是否 Apex / 是否思考」
- `中转站模型报价.json` —— 第三方转售报价（含 `ratio`、`enable_groups`）

---

## 七、想进一步确认，可以这么做（自己动手）

1. **看模型自我认知**：切到不同档位问"你的知识截止时间 / 你是谁 / 你由谁训练"，再对比拒答风格、思维链格式、`<thinking>` 标签习惯——闭源前沿模型的自我认知和输出习惯往往很好认。
2. **比对 token 计费**：同一段中文，各档位扣的积分是否与 token 数线性相关（自建推理通常线性，代理加价常出现"按次/按倍率"跳档）。
3. **看 Apex 预设**：站点已明说 Apex 用专属预设替换默认 content guide；若拿到 VIP1 API Token，可 `GET /v1/models` 拉真实清单，并用 `stream` 观察 chunk 结构（是否为原生 SSE `choices[].delta`，还是二次封装）。
4. **抓响应头/延迟**：不同档位的 TTFB 与首 token 延迟曲线能反推模型规模与是否跨厂商路由。

---

## 八、合规提醒（重要）

- 本报告只使用了**公开页面与公开接口的元数据**；该站的核心资产是用户创作的角色卡 / 小说 / 对话，**批量抓取并再利用涉及著作权与平台条款风险**，且站内含成人内容，请勿二次传播或用于训练。
- 站点条款把用户输入输出纳入"改进模型"的训练数据（可在设置中关闭 `modelTraining`），这也侧面说明它**有自己的训练闭环**——进一步支持"Nalang 为自研/自训练"的判断。
