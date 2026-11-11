# 安卓上的渗透学习环境（合法靶场向）

**先说清楚边界**：下面所有工具只对**你自己的资产 / 授权靶场 / 公开练习平台**使用。对第三方站点做扫描、爆破、越权测试，即使"只是看看"，也属于《网络安全法》第 27 条和《刑法》285 条覆盖的行为，工具越专业，性质越重。

## 一、不建议装"渗透工具合集 APK"

市面上那些"黑客工具箱 / 渗透全家桶 APK"：

- 大多是别人打包的二次分发，**常被植入后门、盗号木马、挖矿**；
- 无法审计来源，装的还是 system 级权限；
- 里面的工具版本陈旧，缺依赖，跑不起来。

要工具，用**官方源**（Termux、F-Droid、GitHub Release、官方 Docker 镜像）自己装。

## 二、手机端主环境：Termux（不改系统、免 root）

```bash
pkg update && pkg upgrade -y
pkg install -y python git curl wget nmap sqlmap nikto hydra dnsutils whois openssl tcpdump openjdk-17
pip install requests beautifulsoup4

# 逆向/安卓分析（Termux 内）
pkg install -y apktool            # APK 解包/回编译
# jadx / frida / objection 建议在 PC 上跑，手机上性能与兼容性都差
```

**推荐组合**：手机用 Termux 做侦察与脚本，PC（或一台云主机）跑重量级工具。

## 三、按方向选工具

| 方向 | 工具 | 说明 |
|---|---|---|
| Web 侦察 | `nmap -sV`、`httpx`、`whatweb`、`nuclei` | 先建基线，别对公网盲扫 |
| Web 漏洞 | Burp Suite Community（PC）、`sqlmap`、`nikto`、`ffuf` | Burp 挂手机代理即可抓 App/浏览器流量 |
| 安卓 App | `jadx`、`apktool`、`MobSF`（Docker）、`frida`、`objection` | 静态 + 动态；Frida 需 root 或可调试包 |
| 流量分析 | `mitmproxy`、Wireshark（PC）、`tcpdump` | 证书固定（pinning）要单独处理，先看自己 App 的配置 |
| 网络/内网 | `nmap`、`crackmapexec`、`impacket` | 仅限授权内网 |
| 学习平台 | PortSwigger Web Security Academy、TryHackMe、HackTheBox、VulnHub、PentesterLab | 从"业务逻辑漏洞"开始，最贴近真实场景 |
| 本地靶场 | OWASP Juice Shop、DVWA、bWAPP（Docker 一键起） | 无风险，随便打 |

### 手机上就能跑的靶场

```bash
pkg install -y nodejs
npx -y juice-shop        # 打开 http://127.0.0.1:3000 ，自带 100+ 关卡
```

## 四、学习路线（4 周可落地）

1. **第 1 周**：HTTP 基础 + Burp 抓包改包 + PortSwigger 前 10 个 Lab（含 Business Logic、IDOR）
2. **第 2 周**：SQL 注入、XSS、文件上传、SSRF——每个都在 Juice Shop 里打通一次
3. **第 3 周**：安卓逆向基础：`apktool d` 解包 → `jadx` 读 dex → 找登录校验字符串 → 用自己写的 App 练
4. **第 4 周**：打 TryHackMe 的 Easy 房间，写 3 份完整报告（侦察 → 利用 → 修复建议）

## 五、如果你有 root（可选）

- **Kali NetHunter**：官方支持一加/小米等机型，提供 chroot 完整 Kali（`nmap/sqlmap/metasploit` 全在）。只建议在**专门的学习机**上刷，不要装日常主力机。
- **Magisk + LSPosed**：做 App 行为分析时很有用，但会与银行/支付类 App 冲突。

## 六、报告模板（练习时就用它）

```
1. 目标与授权范围
2. 复现步骤（请求原文、账号、时间）
3. 影响（能读到什么/改到什么/影响多少用户）
4. 证据（截图、响应体、日志）
5. 修复建议（代码层 + 配置层）
6. 复测结果
```

这份模板同时也是给厂商报漏洞的格式——走正规披露（`security.txt`）比偷偷改数据安全得多。
