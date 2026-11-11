# SecBox —— 手机端安全工具箱（APK + Termux 菜单）

两件东西：

| 组件 | 说明 |
|---|---|
| `secbox.apk` | Android 控制台 App（17KB，WebView 壳）：状态检测 + 一键调起工具 + 内置浏览 + 可远程调试 |
| `secbox` + `install.sh` | Termux 侧的工具菜单：终端 / 抓包 / 逆向 / 侦察 / 靶场 / 自检 |

## 一、安装

### 1) 装 APK

文件在 `secbox.apk`（也复制了一份到 `/sdcard/Download/SecBox.apk`）。

用文件管理器点开 → 允许「安装未知应用」→ 安装。或者：

```bash
# 需要在手机上手动点确认，adb 安装被设备策略拦了，属正常
```

启动后是控制台：顶部显示 Termux 是否安装，中间六个按钮，下面是浏览器输入框。

### 2) 装 Termux 工具

```bash
# Termux 里执行
pkg install -y termux-api
cd /sdcard/网站配置文件/secbox
bash install.sh --full
```

装完 `secbox` 就在 `$PREFIX/bin` 里，终端输入 `secbox` 打开菜单。

### 3) 打通 App → Termux

1. 装 **Termux:Tasker**（F-Droid，与 Termux 同签名）
2. `~/.termux/termux.properties` 里加 `allow-external-apps=true`（`install.sh` 会自动加）
3. 执行 `termux-reload-settings`
4. 回 SecBox App 点「终端」等按钮，就会在 Termux 里跑对应命令

不通时的典型原因：没装 Termux:Tasker、没开 allow-external-apps、`secbox` 不在 PATH。

## 二、菜单功能

```
1) 终端        交互 shell
2) 抓包        mitmproxy 8080 + 证书安装指引
3) 逆向        选 APK（自动扫 /sdcard/Download）→ apktool 解包 + jadx 反编译
               → 打印常用检索命令（找 URL / 密钥 / 加固特征）
4) 侦察        nmap -sV + httpx；公开目标必须先输入 AUTHORIZED
5) 靶场        Juice Shop / DVWA 一键起
6) 自检        逐项检查工具是否就位
```

**授权门**：`recon` 对非私有地址（不是 `127.* / 10.* / 192.168.* / 172.16-31.* / *.local / *.test`）会要求你输入大写 `AUTHORIZED` 才继续，并明示法律依据。

## 三、浏览器部分（重要限制）

- SecBox 内置的 WebView **不支持 Chrome 扩展**，这是 WebView 的能力边界，不是没做。
- 要装插件/油猴：用狐猴 Lemur（`com.lemurbrowser.exts`）、Titanium（`io.github.jqssun.helium`）这类 Chromium 分支。
- SecBox 的价值在别处：**开发者调试**。已开 `WebView.setWebContentsDebuggingEnabled(true)`，手机连电脑后在 Chrome 打开 `chrome://inspect` 即可调试 App 内的页面；页面内的 Eruda 面板（油猴脚本里的按钮）则是纯手机端的 DevTools。
- 想自己编一个完整 Chromium：需要 `depot_tools` + 100GB 源码 + 数小时构建，手机端做不了。

## 四、自己重新打包

```bash
cd app
bash build.sh          # 产物：app/secbox.apk
```

关键点（踩过的坑）：

| 坑 | 处理 |
|---|---|
| 官方 build-tools 的 `aapt2`/`zipalign` 是 **x86_64**，ARM 设备跑不了 | 用 Debian 侧 `/usr/lib/android-sdk/build-tools/debian/{aapt2,zipalign}`（arm64） |
| `javac` 在含中文的挂载路径下报 `file not found` | 先复制到 `/tmp` 的 ASCII 目录再编译 |
| `d8` 只有 jar，没有可执行文件 | `java -cp .../lib/d8.jar com.android.tools.r8.D8` |
| `apksigner` 处理中文路径签名失败 | 在临时目录里签，签完 `cp` 回来 |

## 五、边界

- 工具全部来自 Termux 官方源与 GitHub Release，**APK 不内置任何二进制**，也不含 exploit。
- 只对**你自己的资产**或**本地靶场**使用。未授权扫描/攻击他人系统，在国内属违法（《网络安全法》第 27 条、《刑法》第 285/286 条），且手机端会留下完整网络痕迹。
- 第三方"渗透合集 APK"不要装：来源不可审计、常夹带后门。

## 六、目录

```
secbox/
├── secbox.apk          已签名可安装
├── secbox              Termux 菜单脚本
├── install.sh          Termux 安装脚本
└── app/
    ├── AndroidManifest.xml
    ├── build.sh        纯 aapt2+javac+d8+apksigner 构建
    ├── assets/index.html  控制台界面
    └── src/.../MainActivity.java
```
