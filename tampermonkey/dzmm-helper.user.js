// ==UserScript==
// @name         DZMM 助手 · 模型目录 / 成本速查 / 页面探针
// @namespace    local.dzmm.helper
// @version      1.4.0
// @description  在 dzmm.ai / dzmm.io 页面右下角注入一个悬浮按钮，检测到站点后自动生成可拖动、可缩放、可调功能的悬浮窗：模型目录、成本对比、页面探针、内容提取、数据导出、设置。纯前端只读，不发送任何请求、不修改任何服务端数据。
// @author       local
// @match        https://dzmm.ai/*
// @match        https://*.dzmm.ai/*
// @match        https://dzmm.io/*
// @match        https://*.dzmm.io/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ---------- 站点判定 ----------
  if (!/(^|\.)dzmm\.(ai|io)$/.test(location.hostname)) return;
  if (window.__dzmmHelperLoaded) return;
  window.__dzmmHelperLoaded = true;

  // ---------- 数据快照（来自公开接口 chat.models，2026-11-10）----------
  // 字段：i=内部模型名 d=显示名 s=系列 c=上下文 p=单价系数 a=是否Apex t=是否思考 m=最低会员 x=严格审核 r=说明
  const MODELS = [
    {"i":"nalang-xl-0826-10k","d":"XL-0826 (10K)","s":"XL-0826","c":10000,"p":0.0003,"a":0,"t":1,"m":0,"x":0,"r":"稳定均衡，承接清楚，适合常规长聊"},
    {"i":"nalang-xl-0826-16k","d":"XL-0826 (16K)","s":"XL-0826","c":16000,"p":0.0003,"a":0,"t":1,"m":0,"x":0,"r":"稳定均衡，承接清楚，适合常规长聊"},
    {"i":"nalang-xl-0826","d":"XL-0826 (32K)","s":"XL-0826","c":32000,"p":0.0003,"a":0,"t":1,"m":0,"x":0,"r":"稳定均衡，承接清楚，适合常规长聊"},
    {"i":"x-apex-xl-1022-10k","d":"XL-1022 (10K)","s":"XL-1022","c":10000,"p":0.0003,"a":1,"t":1,"m":0,"x":0,"r":"稳定均衡，承接清楚，适合常规长聊"},
    {"i":"x-apex-xl-1022-16k","d":"XL-1022 (16K)","s":"XL-1022","c":16000,"p":0.0003,"a":1,"t":1,"m":0,"x":0,"r":"稳定均衡，承接清楚，适合常规长聊"},
    {"i":"x-apex-xl-1022","d":"XL-1022 (32K)","s":"XL-1022","c":32000,"p":0.0003,"a":1,"t":1,"m":0,"x":0,"r":"稳定均衡，承接清楚，适合常规长聊"},
    {"i":"x-apex-surge-0505-16k","d":"Surge-0505 (16K)","s":"Surge-0505","c":16000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-0505","d":"Surge-0505 (32K)","s":"Surge-0505","c":32000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-0923-b-16k","d":"Surge-0923-b (16K)","s":"Surge-0923-b","c":16000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-0923-b","d":"Surge-0923-b (32K)","s":"Surge-0923-b","c":32000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-0923-a-16k","d":"Surge-0923-a (16K)","s":"Surge-0923-a","c":16000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-0923-a","d":"Surge-0923-a (32K)","s":"Surge-0923-a","c":32000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-1018-16k","d":"Surge-1018 (16K)","s":"Surge-1018","c":16000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-surge-1018","d":"Surge-1018 (32K)","s":"Surge-1018","c":32000,"p":0.0004,"a":1,"t":1,"m":0,"x":0,"r":"情绪反应快，互动感强，适合高代入角色扮演"},
    {"i":"x-apex-dash-0826-16k","d":"Dash-0826 (16K)","s":"Dash-0826","c":16000,"p":0.0001,"a":1,"t":1,"m":0,"x":1,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-dash-0826","d":"Dash-0826 (32K)","s":"Dash-0826","c":32000,"p":0.0001,"a":1,"t":1,"m":0,"x":1,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-dash-0826-64k","d":"Dash-0826 (64K)","s":"Dash-0826","c":64000,"p":0.0001,"a":1,"t":1,"m":0,"x":1,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-dash-0826-128k","d":"Dash-0826 (128K)","s":"Dash-0826","c":128000,"p":0.0001,"a":1,"t":1,"m":0,"x":1,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-pulse-0731-16k","d":"Pulse-0731 (16K)","s":"Pulse-0731","c":16000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"兼顾响应速度与细节表现，适合长对话和高频剧情互动"},
    {"i":"x-apex-pulse-0731","d":"Pulse-0731 (32K)","s":"Pulse-0731","c":32000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"兼顾响应速度与细节表现，适合长对话和高频剧情互动"},
    {"i":"x-apex-pulse-0731-64k","d":"Pulse-0731 (64K)","s":"Pulse-0731","c":64000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"兼顾响应速度与细节表现，适合长对话和高频剧情互动"},
    {"i":"x-apex-pulse-0731-128k","d":"Pulse-0731 (128K)","s":"Pulse-0731","c":128000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"兼顾响应速度与细节表现，适合长对话和高频剧情互动"},
    {"i":"x-apex-dash-0727-16k","d":"Dash-0727 (16K)","s":"Dash-0727","c":16000,"p":0.0001,"a":1,"t":1,"m":0,"x":0,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-dash-0727","d":"Dash-0727 (32K)","s":"Dash-0727","c":32000,"p":0.0001,"a":1,"t":1,"m":0,"x":0,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-dash-0727-64k","d":"Dash-0727 (64K)","s":"Dash-0727","c":64000,"p":0.0001,"a":1,"t":1,"m":0,"x":0,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-dash-0727-128k","d":"Dash-0727 (128K)","s":"Dash-0727","c":128000,"p":0.0001,"a":1,"t":1,"m":0,"x":0,"r":"响应更快、积分消耗更低，适合长对话高频互动"},
    {"i":"x-apex-vega-1014-16k","d":"Vega-1014 (16K)","s":"Vega-1014","c":16000,"p":0.0005,"a":1,"t":1,"m":3,"x":1,"r":"内测档位，仅对受邀账号开放"},
    {"i":"x-apex-vega-1014","d":"Vega-1014 (32K)","s":"Vega-1014","c":32000,"p":0.0005,"a":1,"t":1,"m":3,"x":1,"r":"内测档位，仅对受邀账号开放"},
    {"i":"x-apex-vega-1014-64k","d":"Vega-1014 (64K)","s":"Vega-1014","c":64000,"p":0.0005,"a":1,"t":1,"m":3,"x":1,"r":"内测档位，仅对受邀账号开放"},
    {"i":"x-apex-sigma-0829-16k","d":"Sigma-0829 (16K)","s":"Sigma-0829","c":16000,"p":0.0005,"a":1,"t":1,"m":3,"x":1,"r":"长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开"},
    {"i":"x-apex-sigma-0829","d":"Sigma-0829 (32K)","s":"Sigma-0829","c":32000,"p":0.0005,"a":1,"t":1,"m":3,"x":1,"r":"长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开"},
    {"i":"x-apex-sigma-0829-64k","d":"Sigma-0829 (64K)","s":"Sigma-0829","c":64000,"p":0.0005,"a":1,"t":1,"m":3,"x":1,"r":"长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开"},
    {"i":"x-apex-flux-0217-10k","d":"Flux-0217 (10K)","s":"Flux-0217","c":10000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"画面感强，场景推进快，适合沉浸式剧情互动"},
    {"i":"x-apex-flux-0217-16k","d":"Flux-0217 (16K)","s":"Flux-0217","c":16000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"画面感强，场景推进快，适合沉浸式剧情互动"},
    {"i":"x-apex-flux-0217","d":"Flux-0217 (32K)","s":"Flux-0217","c":32000,"p":0.0002,"a":1,"t":1,"m":0,"x":0,"r":"画面感强，场景推进快，适合沉浸式剧情互动"},
    {"i":"x-apex-sigma-0621-16k","d":"Sigma-0621 (16K)","s":"Sigma-0621","c":16000,"p":0.0005,"a":1,"t":1,"m":3,"x":0,"r":"长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开"},
    {"i":"x-apex-sigma-0621","d":"Sigma-0621 (32K)","s":"Sigma-0621","c":32000,"p":0.0005,"a":1,"t":1,"m":3,"x":0,"r":"长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开"},
    {"i":"x-apex-sigma-0621-64k","d":"Sigma-0621 (64K)","s":"Sigma-0621","c":64000,"p":0.0005,"a":1,"t":1,"m":3,"x":0,"r":"长线剧情旗舰，结构清楚，适合复杂设定和大篇幅展开"},
    {"i":"x-apex-prism-0408-16k","d":"Prism-0626 (16K)","s":"Prism-0626","c":16000,"p":0.0003,"a":1,"t":0,"m":0,"x":0,"r":"高密度沉浸派，刺激直给，适合强场景"},
    {"i":"x-apex-prism-0408","d":"Prism-0626 (32K)","s":"Prism-0626","c":32000,"p":0.0003,"a":1,"t":0,"m":0,"x":0,"r":"高密度沉浸派，刺激直给，适合强场景"},
    {"i":"nalang-max-0826-10k","d":"Max-0826 (10K)","s":"Max-0826","c":10000,"p":0.0004,"a":0,"t":1,"m":0,"x":0,"r":"旗舰稳定款，叙事顺滑，承接直接，适合高质量长聊"},
    {"i":"nalang-max-0826-16k","d":"Max-0826 (16K)","s":"Max-0826","c":16000,"p":0.0004,"a":0,"t":1,"m":0,"x":0,"r":"旗舰稳定款，叙事顺滑，承接直接，适合高质量长聊"},
    {"i":"nalang-max-0826","d":"Max-0826 (32K)","s":"Max-0826","c":32000,"p":0.0004,"a":0,"t":1,"m":0,"x":0,"r":"旗舰稳定款，叙事顺滑，承接直接，适合高质量长聊"},
    {"i":"nalang-turbo-0826-10k","d":"Turbo-0826 (10K)","s":"Turbo-0826","c":10000,"p":0.0001,"a":0,"t":1,"m":0,"x":0,"r":"旧版低消耗模型，适合基础聊天"},
    {"i":"nalang-turbo-0826-16k","d":"Turbo-0826 (16K)","s":"Turbo-0826","c":16000,"p":0.0001,"a":0,"t":1,"m":0,"x":0,"r":"旧版低消耗模型，适合基础聊天"},
    {"i":"nalang-turbo-0826","d":"Turbo-0826 (32K)","s":"Turbo-0826","c":32000,"p":0.0001,"a":0,"t":1,"m":0,"x":0,"r":"旧版低消耗模型，适合基础聊天"},
    {"i":"nalang-turbo-1115-10k","d":"Turbo-0101 (10K)","s":"Turbo-0101","c":10000,"p":0.0001,"a":0,"t":1,"m":0,"x":0,"r":"低消耗均衡款，适合轻量日常聊天"},
    {"i":"nalang-turbo-1115-16k","d":"Turbo-0101 (16K)","s":"Turbo-0101","c":16000,"p":0.0001,"a":0,"t":1,"m":0,"x":0,"r":"低消耗均衡款，适合轻量日常聊天"},
    {"i":"nalang-turbo-1115","d":"Turbo-0101 (32K)","s":"Turbo-0101","c":32000,"p":0.0001,"a":0,"t":1,"m":0,"x":0,"r":"低消耗均衡款，适合轻量日常聊天"},
    {"i":"nalang-medium-0826-10k","d":"Medium-0826 (10K)","s":"Medium-0826","c":10000,"p":0.0002,"a":0,"t":1,"m":0,"x":0,"r":"轻量耐用，互动自然，适合日常陪伴和中低消耗长聊"},
    {"i":"nalang-medium-0826-16k","d":"Medium-0826 (16K)","s":"Medium-0826","c":16000,"p":0.0002,"a":0,"t":1,"m":0,"x":0,"r":"轻量耐用，互动自然，适合日常陪伴和中低消耗长聊"},
    {"i":"nalang-medium-0826","d":"Medium-0826 (32K)","s":"Medium-0826","c":32000,"p":0.0002,"a":0,"t":1,"m":0,"x":0,"r":"轻量耐用，互动自然，适合日常陪伴和中低消耗长聊"}
  ];

  const SNAPSHOT_AT = '2026-11-10';
  const LS_KEY = 'dzmm_helper_v1';
  const BASE_PRICE = 0.0001; // 最便宜档位，用于算相对倍数

  const FEAT_LABEL = {
    models: '模型目录', cost: '成本对比', probe: '页面探针',
    extract: '内容提取', page: '页面改造', api: 'API 对接', export: '数据导出'
  };
  const TABS = [
    { k: 'models', label: '模型', fn: renderModels },
    { k: 'cost', label: '成本', fn: renderCost },
    { k: 'probe', label: '探针', fn: renderProbe },
    { k: 'extract', label: '提取', fn: renderExtract },
    { k: 'page', label: '改造', fn: renderPage },
    { k: 'api', label: 'API', fn: renderApi },
    { k: 'export', label: '导出', fn: renderExport },
    { k: 'settings', label: '⚙', fn: renderSettings }
  ];

  // ---------- 偏好 ----------
  const DEFAULTS = {
    open: false, tab: 'models', right: 16, bottom: 96, search: '',
    features: { models: true, cost: true, probe: true, extract: true, page: true, api: true, export: true },
    autoOpen: true, theme: 'dark', opacity: 1, fontScale: 1,
    panelW: 362, panelH: 0, fabSize: 52,
    page: { on: false, fontScale: 1, lineHeight: 1.6, maxWidth: 0, filter: 'none', css: '', hidden: [] },
    api: { base: 'http://127.0.0.1:8787/v1', key: 'sk-local-test' }
  };
  const stored = readPrefs();
  const prefs = Object.assign({}, DEFAULTS, stored, {
    features: Object.assign({}, DEFAULTS.features, stored.features || {}),
    page: Object.assign({}, DEFAULTS.page, stored.page || {}),
    api: Object.assign({}, DEFAULTS.api, stored.api || {})
  });
  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch (e) { /* 隐私模式下忽略 */ }
  }

  // ---------- 样式 ----------
  const CSS = `
  :host {
    all: initial;
    --bg:#15161c; --bg2:#1b1d25; --bg3:#1e2029; --bg4:#252833;
    --bd:#2a2c36; --bd2:#2c2f3c;
    --fg:#e8e9ee; --fg2:#b9bdcc; --mut:#8b8fa3; --mut2:#6f7488;
    --acc:#6d4bff; --acc2:#3b82f6; --ok:#4ade80; --warn:#fbbf24;
  }
  * , *::before, *::after { box-sizing: border-box; }
  .fab {
    position: fixed; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #fff; background: linear-gradient(135deg, var(--acc), var(--acc2));
    box-shadow: 0 8px 24px rgba(0,0,0,.38); user-select: none; touch-action: none;
    font: 600 13px/1 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    z-index: 2147483001;
  }
  .fab:active { transform: scale(.95); }
  .fab .dot {
    position: absolute; top: 1px; right: 1px; width: 10px; height: 10px; border-radius: 50%;
    background: var(--ok); border: 2px solid #0f1117;
  }
  .panel {
    position: fixed; display: none; flex-direction: column; overflow: hidden;
    background: var(--bg); color: var(--fg); border: 1px solid var(--bd); border-radius: 14px;
    box-shadow: 0 18px 50px rgba(0,0,0,.55);
    font: 13px/1.5 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    z-index: 2147483002;
  }
  .panel.open { display: flex; }
  .panel.light, .prev.light {
    --bg:#ffffff; --bg2:#f4f5f9; --bg3:#eef1f7; --bg4:#e6eaf3;
    --bd:#dadee8; --bd2:#d2d7e3;
    --fg:#1b1d25; --fg2:#3c4152; --mut:#6b7183; --mut2:#828a9e;
  }
  .hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg2);
    cursor: move; touch-action: none; }
  .hd b { font-size: 13px; font-weight: 600; }
  .hd .sub { font-size: 10px; color: var(--mut); }
  .hd .x { margin-left: auto; width: 24px; height: 24px; border-radius: 7px; display: flex;
    align-items: center; justify-content: center; background: var(--bg4); color: var(--fg2);
    cursor: pointer; font-size: 14px; }
  .hd .x:hover { filter: brightness(1.2); }
  .tabs { display: flex; gap: 2px; padding: 6px 8px 0; background: var(--bg2); }
  .tab { flex: 1 1 0; min-width: 40px; text-align: center; padding: 7px 3px; font-size: 12px;
    color: var(--mut); border-radius: 8px 8px 0 0; cursor: pointer; user-select: none; }
  .tab.on { background: var(--bg); color: var(--fg); }
  .body { padding: 10px 12px 12px; overflow: auto; }
  .search { width: 100%; padding: 7px 9px; margin-bottom: 6px; border-radius: 8px;
    border: 1px solid var(--bd2); background: var(--bg2); color: var(--fg); font-size: 12px; outline: none; }
  .search:focus { border-color: var(--acc2); }
  .row { display: flex; align-items: center; gap: 8px; padding: 7px 6px; border-radius: 8px; cursor: pointer; }
  .row:hover { background: var(--bg3); }
  .row .name { font-weight: 600; font-size: 12px; color: var(--fg); }
  .row .in { font-size: 10px; color: var(--mut);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .row .meta { margin-left: auto; text-align: right; font-size: 10px; color: var(--mut); white-space: nowrap; }
  .badge { display: inline-block; padding: 0 5px; border-radius: 4px; font-size: 9px; line-height: 15px; margin-left: 4px; }
  .b-apex { background: #3a2b6b; color: #c7b3ff; }
  .b-vip { background: #4a2b2b; color: #ffb4b4; }
  .b-strict { background: #4a3f22; color: #ffe08a; }
  .b-think { background: #22394a; color: #9fd0ff; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: left; padding: 4px 3px; border-bottom: 1px solid var(--bd); vertical-align: middle; }
  th { color: var(--mut); font-weight: 500; }
  .bar { height: 5px; border-radius: 3px; background: linear-gradient(90deg, #5b8cff, #9b6bff); }
  .btn { display: block; width: 100%; margin: 6px 0; padding: 9px; border-radius: 9px;
    border: 1px solid var(--bd2); background: var(--bg3); color: var(--fg); font-size: 12px;
    cursor: pointer; text-align: center; font-family: inherit; }
  .btn:hover { filter: brightness(1.12); }
  .btn.primary { background: linear-gradient(135deg, var(--acc), var(--acc2)); border-color: transparent; color: #fff; }
  .btnrow { display: flex; gap: 6px; }
  .btnrow .btn { margin: 6px 0; }
  .note { font-size: 10px; color: var(--mut2); margin-top: 8px; line-height: 1.7; }
  .kv { font-size: 11px; color: var(--fg2); }
  .kv b { color: var(--fg); font-weight: 600; }
  .ok { color: var(--ok); }
  .warn { color: var(--warn); }
  .sec { font-size: 10px; color: var(--mut2); margin: 12px 0 4px; letter-spacing: .6px; }
  .lab { display: flex; justify-content: space-between; font-size: 11px; color: var(--fg2); margin: 8px 0 2px; }
  .lab b { color: var(--fg); font-variant-numeric: tabular-nums; }
  input[type=range] { width: 100%; accent-color: var(--acc); }
  .sw { display: flex; align-items: center; gap: 8px; padding: 6px 4px; font-size: 12px;
    color: var(--fg2); cursor: pointer; }
  .sw input { appearance: none; -webkit-appearance: none; width: 34px; height: 19px; border-radius: 10px;
    background: var(--bd2); position: relative; outline: none; cursor: pointer; transition: .15s; flex: none; }
  .sw input:checked { background: linear-gradient(135deg, var(--acc), var(--acc2)); }
  .sw input::after { content: ''; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px;
    border-radius: 50%; background: #fff; transition: .15s; }
  .sw input:checked::after { left: 17px; }
  .ta { width: 100%; height: 190px; resize: vertical; padding: 8px; border-radius: 9px;
    border: 1px solid var(--bd2); background: var(--bg2); color: var(--fg); outline: none;
    font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .ta:focus { border-color: var(--acc2); }
  .grip { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
    touch-action: none;
    background: linear-gradient(135deg, transparent 46%, var(--bd2) 46%, var(--bd2) 54%, transparent 54%,
      transparent 68%, var(--bd2) 68%, var(--bd2) 76%, transparent 76%); }
  .prev { position: fixed; left: 50%; transform: translateX(-50%); top: 6vh;
    width: min(720px, calc(100vw - 24px)); max-height: 80vh; display: flex; flex-direction: column;
    background: var(--bg); color: var(--fg); border: 1px solid var(--bd2); border-radius: 14px;
    box-shadow: 0 24px 70px rgba(0,0,0,.65); overflow: hidden; z-index: 2147483010;
    font: 13px/1.8 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .prev .ph { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg2); }
  .prev .ph b { font-size: 12px; }
  .prev .ph .x { margin-left: auto; width: 24px; height: 24px; border-radius: 7px; background: var(--bg4);
    display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; }
  .prev .pb { padding: 14px 16px 18px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
  .toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: 28px;
    background: rgba(0,0,0,.86); color: #fff; padding: 8px 14px; border-radius: 10px; font-size: 12px;
    opacity: 0; transition: opacity .18s; z-index: 2147483009; pointer-events: none;
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .toast.on { opacity: 1; }
  .dim { position: fixed; inset: 0; pointer-events: none; display: none; z-index: 2147483000; }
  `;

  // ---------- DOM 骨架 ----------
  const host = document.createElement('div');
  host.setAttribute('data-dzmm-helper', '1');
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;';
  (document.body || document.documentElement).appendChild(host);

  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const fab = document.createElement('div');
  fab.className = 'fab';
  fab.title = 'DZMM 助手（Alt+M 开关）';
  fab.innerHTML = 'AI<span class="dot"></span>';

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="hd" data-drag>
      <b>DZMM 助手</b><span class="sub">模型目录 · 只读</span>
      <div class="x" data-close title="关闭">✕</div>
    </div>
    <div class="tabs"></div>
    <div class="body" data-body></div>
    <div class="grip" data-grip title="拖动调整大小"></div>
  `;

  const toastEl = document.createElement('div');
  toastEl.className = 'toast';

  const dimEl = document.createElement('div');
  dimEl.className = 'dim';

  root.appendChild(dimEl);
  root.appendChild(fab);
  root.appendChild(panel);
  root.appendChild(toastEl);

  const body = panel.querySelector('[data-body]');
  const tabsBar = panel.querySelector('.tabs');
  const grip = panel.querySelector('[data-grip]');

  // ---------- 基础工具 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function fmtCtx(n) { return n >= 1000 ? (n / 1000) + 'K' : String(n); }
  function fmtPrice(p) { return Number(p).toFixed(4).replace(/0+$/, '').replace(/\.$/, ''); }
  function relMultiple(p) { return Math.round((p / BASE_PRICE) * 10) / 10; }

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1600);
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast('已复制：' + (text.length > 40 ? text.slice(0, 40) + '…' : text));
    } catch (e) { toast('复制失败，请手动选择'); }
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast('已导出 ' + name);
  }

  // ---------- 位置 / 拖动 ----------
  function applyPos() {
    const vw = window.innerWidth, vh = window.innerHeight;
    prefs.right = Math.max(0, Math.min(prefs.right, vw - 60));
    prefs.bottom = Math.max(0, Math.min(prefs.bottom, vh - 60));
    const w = Math.min(prefs.panelW, vw - 20);
    fab.style.right = prefs.right + 'px';
    fab.style.bottom = prefs.bottom + 'px';
    panel.style.width = w + 'px';
    panel.style.right = prefs.right + 'px';
    panel.style.bottom = Math.min(prefs.bottom + 62, Math.max(80, vh - 220)) + 'px';
    if (prefs.panelH > 0) {
      panel.style.height = Math.min(prefs.panelH, Math.round(vh * 0.8)) + 'px';
      panel.style.maxHeight = 'none';
    } else {
      panel.style.height = '';
      panel.style.maxHeight = Math.max(240, Math.min(vh - prefs.bottom - 80, vh * 0.72)) + 'px';
    }
  }

  let dragging = false, sx = 0, sy = 0, sr = 0, sb = 0;
  const hd = panel.querySelector('[data-drag]');
  hd.addEventListener('pointerdown', (e) => {
    if (e.target.hasAttribute('data-close')) return;
    dragging = true; sx = e.clientX; sy = e.clientY; sr = prefs.right; sb = prefs.bottom;
    hd.setPointerCapture(e.pointerId);
  });
  hd.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    prefs.right = sr - (e.clientX - sx);
    prefs.bottom = sb - (e.clientY - sy);
    applyPos();
  });
  hd.addEventListener('pointerup', () => { dragging = false; savePrefs(); });
  hd.addEventListener('pointercancel', () => { dragging = false; savePrefs(); });

  // ---------- 面板开关 / 分页 ----------
  function setOpen(v) {
    prefs.open = !!v;
    panel.classList.toggle('open', prefs.open);
    if (prefs.open) { renderTabs(); render(); }
    savePrefs();
  }
  function setTab(name) {
    if (!isTabEnabled(name)) name = firstEnabledTab();
    prefs.tab = name;
    renderTabs();
    render();
    savePrefs();
  }

  fab.addEventListener('click', () => setOpen(!prefs.open));
  panel.querySelector('[data-close]').addEventListener('click', () => setOpen(false));
  tabsBar.addEventListener('click', (e) => {
    const t = e.target.closest ? e.target.closest('.tab') : null;
    if (t) setTab(t.dataset.tab);
  });
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); setOpen(!prefs.open); }
    if (e.key === 'Escape' && prefs.open) setOpen(false);
  });

  // ---------- 渲染 ----------
  function render() {
    const t = TABS.filter((x) => x.k === prefs.tab)[0];
    if (t) t.fn();
    else renderModels();
  }

  // ① 模型目录
  function renderModels() {
    const q = (prefs.search || '').trim().toLowerCase();
    const list = MODELS
      .filter((m) => !q || (m.i + ' ' + m.d + ' ' + m.s).toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (a.p - b.p) || (a.c - b.c));

    const rows = list.map((m) => {
      const badges = [
        m.a ? '<span class="badge b-apex">APEX</span>' : '',
        m.m > 0 ? '<span class="badge b-vip">VIP' + m.m + '</span>' : '',
        m.x ? '<span class="badge b-strict">严格</span>' : '',
        m.t ? '<span class="badge b-think">思考</span>' : ''
      ].join('');
      return '<div class="row" data-copy="' + esc(m.i) + '" title="点击复制内部模型名">' +
        '<div style="min-width:0">' +
          '<div class="name">' + esc(m.d) + badges + '</div>' +
          '<div class="in">' + esc(m.i) + '</div>' +
        '</div>' +
        '<div class="meta">' + fmtCtx(m.c) + ' · ' + fmtPrice(m.p) +
          '<br>' + relMultiple(m.p) + '×</div>' +
      '</div>';
    }).join('');

    body.innerHTML =
      '<input class="search" placeholder="搜索：Surge / sigma / 32K …" value="' + esc(prefs.search) + '">' +
      '<div class="note" style="margin:0 0 6px">共 ' + MODELS.length + ' 个条目 / ' +
        new Set(MODELS.map((m) => m.s)).size + ' 个档位 · 快照 ' + SNAPSHOT_AT + ' · 点击行复制内部名</div>' +
      (rows || '<div class="note">没有匹配项</div>');

    const input = body.querySelector('.search');
    input.addEventListener('input', () => {
      prefs.search = input.value;
      const pos = input.selectionStart;
      renderModels();
      const again = body.querySelector('.search');
      again.focus();
      try { again.setSelectionRange(pos, pos); } catch (e) {}
      savePrefs();
    });
    body.querySelectorAll('[data-copy]').forEach((row) => {
      row.addEventListener('click', () => copyText(row.getAttribute('data-copy')));
    });
  }

  // ② 成本对比
  function renderCost() {
    const tiers = {};
    MODELS.forEach((m) => {
      const t = tiers[m.s] || (tiers[m.s] = { s: m.s, p: m.p, pts: [], apex: m.a, lvl: m.m, strict: m.x, desc: m.r });
      t.pts.push(m.c);
    });
    const arr = Object.values(tiers).sort((a, b) => a.p - b.p);
    const maxRel = Math.max(...arr.map((t) => relMultiple(t.p)));

    const rows = arr.map((t) => {
      const rel = relMultiple(t.p);
      return '<tr>' +
        '<td>' + esc(t.s) + (t.apex ? '<span class="badge b-apex">A</span>' : '') + '</td>' +
        '<td>' + fmtPrice(t.p) + '</td>' +
        '<td style="white-space:nowrap">' + rel + '×</td>' +
        '<td style="width:42%"><div class="bar" style="width:' + Math.max(6, (rel / maxRel) * 100) + '%"></div></td>' +
      '</tr>';
    }).join('');

    const cheapest = arr[0];
    const priciest = arr[arr.length - 1];

    body.innerHTML =
      '<div class="kv">同样的对话量，<b>' + esc(priciest.s) + '</b> 的消耗约为 <b>' +
        esc(cheapest.s) + '</b> 的 <b class="warn">' + Math.round((priciest.p / cheapest.p) * 10) / 10 + ' 倍</b>。</div>' +
      '<table><thead><tr><th>档位</th><th>单价系数</th><th>相对</th><th>比例</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="note">' +
        '· 单价系数取自公开接口，仅用于<b>档位之间横向比较</b>，不是人民币价格。<br>' +
        '· 长上下文档（64K/128K）在同档位内单价相同，但实际消耗更多 token。<br>' +
        '· 省钱做法：日常用 <code>Dash</code> / <code>Turbo</code> 档，长剧情再切 <code>Sigma</code>；' +
        '不用的档位别挂默认。' +
      '</div>';
  }

  // ③ 页面探针
  function renderProbe() {
    body.innerHTML =
      '<div id="probe-out" class="kv">点下面的按钮扫描当前页面（只读 DOM 与资源记录，不发请求）。</div>' +
      '<button class="btn primary" id="do-probe">扫描当前页面</button>' +
      '<div class="note">会从页面文本与性能资源列表里匹配已知的内部模型名，用来判断当前页/当前会话挂的是哪个模型。</div>';

    body.querySelector('#do-probe').addEventListener('click', () => {
      const out = body.querySelector('#probe-out');
      out.textContent = '扫描中…';
      setTimeout(() => {
        const names = new Map(MODELS.map((m) => [m.i, m]));
        const hits = new Map();

        let text = '';
        try { text = document.documentElement.innerHTML.slice(0, 800000); } catch (e) {}
        names.forEach((m, n) => { if (text.includes(n)) hits.set(n, hits.get(n) || 'DOM'); });

        try {
          performance.getEntriesByType('resource').forEach((e) => {
            const u = e.name || '';
            names.forEach((m, n) => {
              if (u.includes(n) || u.includes(encodeURIComponent(n))) hits.set(n, '请求记录');
            });
          });
        } catch (e) {}

        const params = new URLSearchParams(location.search);
        const modelParam = params.get('model') || params.get('m') || '';

        const hitRows = [...hits.entries()].map(([n, src]) => {
          const m = names.get(n);
          return '<div class="row" data-copy="' + esc(n) + '"><div>' +
            '<div class="name">' + esc(m.d) + '</div>' +
            '<div class="in">' + esc(n) + ' · 来源：' + esc(src) + '</div></div></div>';
        }).join('');

        out.innerHTML =
          '<table>' +
          '<tr><td>页面</td><td><b>' + esc(location.hostname + location.pathname) + '</b></td></tr>' +
          '<tr><td>标题</td><td>' + esc((document.title || '').slice(0, 40)) + '</td></tr>' +
          '<tr><td>URL 模型参数</td><td>' + (modelParam ? '<b class="ok">' + esc(modelParam) + '</b>' : '<span class="warn">无</span>') + '</td></tr>' +
          '<tr><td>命中模型</td><td>' + (hits.size ? '<b class="ok">' + hits.size + ' 个</b>' : '<span class="warn">未命中</span>') + '</td></tr>' +
          '</table>' +
          (hitRows || '<div class="note">页面里没有出现已知内部模型名（正常：模型名可能只在登录后的接口返回）。</div>');

        out.querySelectorAll('[data-copy]').forEach((row) => {
          row.addEventListener('click', () => copyText(row.getAttribute('data-copy')));
        });
      }, 30);
    });
  }

  // ④ 导出
  function renderExport() {
    body.innerHTML =
      '<div class="kv">当前数据：<b>' + MODELS.length + '</b> 条 / <b>' +
        new Set(MODELS.map((m) => m.s)).size + '</b> 个档位，快照 <b>' + SNAPSHOT_AT + '</b>。</div>' +
      '<button class="btn primary" id="dl-json">导出 JSON（完整字段）</button>' +
      '<button class="btn" id="dl-csv">导出 CSV（Excel 可直接打开）</button>' +
      '<button class="btn" id="cp-names">复制全部内部模型名</button>' +
      '<div class="note">导出内容仅为模型元数据（名字、上下文、单价系数），不含任何账号或对话数据。</div>';

    body.querySelector('#dl-json').addEventListener('click', () => {
      download('dzmm-models-' + SNAPSHOT_AT + '.json', JSON.stringify(MODELS, null, 2), 'application/json');
    });
    body.querySelector('#dl-csv').addEventListener('click', () => {
      const head = ['internal','display','series','context','price','apex','thinking','strict','min_level'];
      const lines = [head.join(',')].concat(MODELS.map((m) => [
        m.i, '"' + m.d + '"', m.s, m.c, m.p, m.a ? 1 : 0, m.t ? 1 : 0, m.x ? 1 : 0, m.m
      ].join(',')));
      download('dzmm-models-' + SNAPSHOT_AT + '.csv', '\ufeff' + lines.join('\n'), 'text/csv');
    });
    body.querySelector('#cp-names').addEventListener('click', () => {
      copyText(MODELS.map((m) => m.i).join('\n'));
    });
  }

  // ⑤ 提取 / 本地改造
  let lastExtract = null;

  function collectBlocks() {
    const skip = /(nav|header|footer|aside|menu|sidebar|advert|toolbar|topbar|tabbar|comment|footer)/i;
    let best = null;
    let bestScore = 0;
    // 只扫前 2000 个容器，且用 textContent 预筛（避免 innerText 触发大量重排）
    const candidates = Array.prototype.slice.call(
      document.querySelectorAll('main, article, section, div'), 0, 2000
    );
    candidates.forEach((elm) => {
      if (elm.closest('[data-dzmm-helper]')) return;
      const cls = String(elm.className || '') + ' ' + String(elm.id || '');
      if (skip.test(cls)) return;
      const text = (elm.textContent || '').trim();
      if (text.length < 120) return;
      const links = elm.querySelectorAll('a').length;
      const score = text.length / (1 + links * 20);
      if (score > bestScore) { bestScore = score; best = elm; }
    });

    const scope = best || document.body;
    const blocks = [];
    const seen = new Set();
    scope.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre').forEach((n) => {
      if (n.closest('[data-dzmm-helper]')) return;
      const t = (n.innerText || n.textContent || '').trim().replace(/\s+/g, ' ');
      if (!t || t.length < 2 || seen.has(t)) return;
      seen.add(t);
      blocks.push({ tag: n.tagName.toLowerCase(), text: t });
    });

    // 聊天消息（如果当前页是会话页）
    const msgs = [];
    document.querySelectorAll('[class*="message"],[class*="bubble"],[class*="chat-item"]').forEach((n) => {
      if (n.closest('[data-dzmm-helper]')) return;
      if (n.querySelector('[class*="message"],[class*="bubble"]')) return; // 只取最内层
      const t = (n.innerText || n.textContent || '').trim();
      if (t && t.length >= 2) msgs.push(t);
    });

    return {
      url: location.href,
      title: (document.querySelector('h1') || {}).innerText || document.title || '未命名页面',
      at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      scopeHit: !!best,
      blocks: blocks,
      messages: msgs.slice(0, 200)
    };
  }

  function toMarkdown(data, edited) {
    const out = [];
    out.push('# ' + data.title);
    out.push('');
    out.push('> 来源：' + data.url);
    out.push('> 提取时间：' + data.at + ' ｜ 正文块：' + data.blocks.length + ' ｜ 消息：' + data.messages.length);
    out.push('');
    data.blocks.forEach((b) => {
      if (b.tag === 'h1' || b.tag === 'h2') out.push('## ' + b.text);
      else if (b.tag === 'h3' || b.tag === 'h4') out.push('### ' + b.text);
      else if (b.tag === 'li') out.push('- ' + b.text);
      else if (b.tag === 'blockquote') out.push('> ' + b.text);
      else if (b.tag === 'pre') out.push('```\n' + b.text + '\n```');
      else out.push(b.text);
      out.push('');
    });
    if (data.messages.length) {
      out.push('## 对话记录');
      out.push('');
      data.messages.forEach((m, i) => { out.push((i + 1) + '. ' + m); });
      out.push('');
    }
    if (edited) {
      out.push('## 改造备注');
      out.push('');
      out.push('> 以上内容为本地提取与编辑结果，未回写站点。');
    }
    return out.join('\n');
  }

  function showPreview(text) {
    const old = root.querySelector('.prev');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'prev';
    wrap.innerHTML = '<div class="ph"><b>本地预览（改造后）</b>' +
      '<span style="font-size:10px;color:#8b8fa3">仅本地 · 不写回</span>' +
      '<div class="x" title="关闭">✕</div></div><div class="pb"></div>';
    wrap.querySelector('.pb').textContent = text;
    wrap.querySelector('.x').addEventListener('click', () => wrap.remove());
    root.appendChild(wrap);
  }

  function renderExtract() {
    body.innerHTML =
      '<div class="kv">从<b>当前这一页</b>提取正文 / 角色设定 / 对话记录，改完可本地预览与导出。</div>' +
      '<button class="btn primary" id="do-extract">提取当前页内容</button>' +
      '<textarea class="ta" id="ex-ta" placeholder="点上面的按钮开始提取…"></textarea>' +
      '<div class="btnrow">' +
        '<button class="btn" id="ex-copy">复制</button>' +
        '<button class="btn" id="ex-md">导出 MD</button>' +
        '<button class="btn" id="ex-json">导出 JSON</button>' +
      '</div>' +
      '<button class="btn" id="ex-preview">本地预览改造结果</button>' +
      '<div class="note">预览只在你自己屏幕上盖一层，关掉即消失，不写回站点。<br>' +
      '批量抓取全站角色卡 / 小说属于他人 UGC，涉及版权与平台条款，本脚本不做。</div>';

    const ta = body.querySelector('#ex-ta');

    body.querySelector('#do-extract').addEventListener('click', () => {
      const data = collectBlocks();
      lastExtract = data;
      const md = toMarkdown(data, false);
      ta.value = md;
      toast('已提取：' + data.blocks.length + ' 块 / ' + data.messages.length + ' 条消息');
    });

    body.querySelector('#ex-copy').addEventListener('click', () => copyText(ta.value));
    body.querySelector('#ex-md').addEventListener('click', () => {
      if (!ta.value.trim()) return toast('先提取内容');
      download('dzmm-page-' + (lastExtract ? lastExtract.at.slice(0, 10) : 'extract') + '.md', ta.value, 'text/markdown');
    });
    body.querySelector('#ex-json').addEventListener('click', () => {
      if (!lastExtract) return toast('先提取内容');
      const payload = Object.assign({}, lastExtract, {
        editedMarkdown: ta.value,
        exportedAt: new Date().toISOString()
      });
      download('dzmm-page-' + lastExtract.at.slice(0, 10) + '.json', JSON.stringify(payload, null, 2), 'application/json');
    });
    body.querySelector('#ex-preview').addEventListener('click', () => {
      if (!ta.value.trim()) return toast('先提取内容');
      showPreview(ta.value);
    });
  }

  // ---------- API 对接 ----------
  function apiUrl(path) {
    const base = String(prefs.api.base || '').replace(/\/+$/, '');
    return base + path;
  }
  function apiFetch(path, opts) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
    if (prefs.api.key) headers.Authorization = 'Bearer ' + prefs.api.key;
    const init = Object.assign({}, opts || {}, { headers: headers });
    return fetch(apiUrl(path), init);
  }

  function renderApi() {
    body.innerHTML =
      '<div class="kv">这里可以连任何 <b>OpenAI 兼容</b> 端点：本机模拟服务、你自己的中转，或 DZMM 官方（VIP1 拿 Token 后填它给的基础地址）。</div>' +
      '<div class="lab"><span>Base URL</span><b style="font-weight:400;color:#8b8fa3">/v1</b></div>' +
      '<input class="search" id="api-base" value="' + esc(prefs.api.base) + '" placeholder="http://127.0.0.1:8787/v1">' +
      '<div class="lab"><span>API Key</span></div>' +
      '<input class="search" id="api-key" value="' + esc(prefs.api.key) + '" placeholder="sk-...">' +
      '<div class="btnrow">' +
        '<button class="btn primary" id="api-models">拉取模型</button>' +
        '<button class="btn" id="api-quota">查额度</button>' +
      '</div>' +
      '<button class="btn" id="api-chat">发一条测试对话</button>' +
      '<div id="api-out" class="note" style="margin-top:6px;white-space:pre-wrap"></div>';

    const baseIn = body.querySelector('#api-base');
    const keyIn = body.querySelector('#api-key');
    const out = body.querySelector('#api-out');

    baseIn.addEventListener('change', () => { prefs.api.base = baseIn.value.trim(); savePrefs(); });
    keyIn.addEventListener('change', () => { prefs.api.key = keyIn.value.trim(); savePrefs(); });

    body.querySelector('#api-models').addEventListener('click', async () => {
      prefs.api.base = baseIn.value.trim();
      prefs.api.key = keyIn.value.trim();
      savePrefs();
      out.textContent = '请求中…';
      try {
        const r = await apiFetch('/models');
        if (!r.ok) { out.textContent = 'HTTP ' + r.status + '（检查 Key / 地址 / CORS）'; return; }
        const d = await r.json();
        const ids = (d.data || []).map((m) => m.id).filter(Boolean);
        const builtin = MODELS.map((m) => m.i);
        const extra = ids.filter((i) => builtin.indexOf(i) < 0);
        const missing = builtin.filter((i) => ids.indexOf(i) < 0);
        out.textContent = '服务端模型 ' + ids.length + ' 个\\n' +
          '内置快照 ' + builtin.length + ' 个\\n' +
          (extra.length ? '快照里没有的新模型：\\n  ' + extra.slice(0, 12).join('\\n  ') + '\\n' : '没有新增模型\\n') +
          (missing.length ? '快照有但服务端没有：' + missing.length + ' 个\\n' : '');
      } catch (e) {
        out.textContent = '连接失败：' + (e && e.message ? e.message : e);
      }
    });

    body.querySelector('#api-quota').addEventListener('click', async () => {
      out.textContent = '请求中…';
      try {
        const r = await apiFetch('/quota');
        if (!r.ok) { out.textContent = 'HTTP ' + r.status; return; }
        const d = await r.json();
        out.textContent = '当前额度：' + (d.balance == null ? JSON.stringify(d) : d.balance);
      } catch (e) {
        out.textContent = '连接失败：' + (e && e.message ? e.message : e);
      }
    });

    body.querySelector('#api-chat').addEventListener('click', async () => {
      out.textContent = '请求中…';
      try {
        const model = MODELS[0] ? MODELS[0].i : 'nalang-turbo-0826';
        const r = await apiFetch('/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'ping' }] })
        });
        if (!r.ok) {
          const t = await r.text();
          out.textContent = 'HTTP ' + r.status + '\\n' + t.slice(0, 300);
          return;
        }
        const d = await r.json();
        const msg = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        out.textContent = '模型：' + d.model + '\\n回复：' + (msg || '').slice(0, 200) +
          (d.x_mock_balance != null ? '\\n剩余额度：' + d.x_mock_balance : '');
      } catch (e) {
        out.textContent = '连接失败：' + (e && e.message ? e.message : e);
      }
    });
  }

  // ---------- 页面改造（只改本地显示） ----------
  function pageStyleEl() {
    let st = document.getElementById('dzmm-helper-page-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'dzmm-helper-page-style';
      (document.head || document.documentElement).appendChild(st);
    }
    return st;
  }

  function applyPage() {
    const st = pageStyleEl();
    const p = prefs.page;
    if (!p.on) {
      st.textContent = '';
      dimEl.style.display = 'none';
      return;
    }
    const out = [];
    if (Math.abs(p.fontScale - 1) > 0.001) {
      out.push('html{font-size:' + Math.round(16 * p.fontScale) + 'px !important}');
    }
    if (Math.abs(p.lineHeight - 1.6) > 0.001) {
      out.push('body,body p,body li,body div{line-height:' + p.lineHeight + ' !important}');
    }
    if (p.maxWidth > 0) {
      out.push('main,article,[class*="content"],[class*="detail"]{max-width:' + p.maxWidth +
        'px !important;margin-left:auto !important;margin-right:auto !important}');
    }
    (p.hidden || []).forEach((sel) => { if (sel) out.push(sel + '{display:none !important}'); });
    if (p.css) out.push(p.css);
    st.textContent = out.join('\n');

    if (p.filter === 'dim') { dimEl.style.background = 'rgba(0,0,0,.28)'; dimEl.style.display = 'block'; }
    else if (p.filter === 'sepia') { dimEl.style.background = 'rgba(255,236,200,.16)'; dimEl.style.display = 'block'; }
    else { dimEl.style.display = 'none'; }
  }

  function cssPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let sel = node.nodeName.toLowerCase();
      if (node.id) { parts.unshift(sel + '#' + node.id); break; }
      const parent = node.parentElement;
      if (parent) {
        const idx = Array.prototype.indexOf.call(parent.children, node) + 1;
        sel += ':nth-child(' + idx + ')';
      }
      parts.unshift(sel);
      node = parent;
      if (!node || node === document.body) break;
    }
    return parts.join(' > ');
  }

  let picking = false, hoverEl = null, hoverOutline = '';

  function stopPick() {
    picking = false;
    document.removeEventListener('mousemove', onPickMove, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('keydown', onPickKey, true);
    if (hoverEl) { hoverEl.style.outline = hoverOutline; hoverEl = null; }
  }
  function onPickKey(e) { if (e.key === 'Escape') { stopPick(); toast('已取消选取'); } }
  function onPickMove(e) {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el === hoverEl) return;
    if (hoverEl) hoverEl.style.outline = hoverOutline;
    hoverEl = el;
    hoverOutline = el.style.outline;
    el.style.outline = '2px solid #7c5cff';
  }
  function onPickClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    stopPick();
    if (!el || el === document.body || el === document.documentElement) { toast('这个不能隐藏'); return; }
    const sel = cssPath(el);
    if (!sel) { toast('取不到选择器'); return; }
    prefs.page.hidden = (prefs.page.hidden || []).concat([sel]);
    applyPage();
    savePrefs();
    renderPage();
    toast('已隐藏：' + el.nodeName.toLowerCase());
  }
  function startPick() {
    if (picking) { stopPick(); return; }
    picking = true;
    toast('点要隐藏的元素，Esc 取消');
    document.addEventListener('mousemove', onPickMove, true);
    document.addEventListener('click', onPickClick, true);
    document.addEventListener('keydown', onPickKey, true);
  }

  function renderPage() {
    const p = prefs.page;
    const pct = (v) => Math.round(v * 100);
    const hiddenRows = (p.hidden || []).map((sel, i) =>
      '<div class="row" style="cursor:default"><div style="min-width:0"><div class="in">' + esc(sel) + '</div></div>' +
      '<div class="meta"><span class="x-del" data-del="' + i + '" style="cursor:pointer;color:#ff8b8b">撤销</span></div></div>'
    ).join('');

    body.innerHTML =
      '<label class="sw"><input type="checkbox" id="page-on"' + (p.on ? ' checked' : '') + '>' +
      '<span>启用页面改造（只影响本机显示）</span></label>' +
      '<div class="sec">排版</div>' +
      '<div class="lab"><span>字号</span><b data-v="pfont">' + pct(p.fontScale) + '%</b></div>' +
      '<input type="range" min="85" max="140" step="5" value="' + pct(p.fontScale) + '" data-prange="fontScale">' +
      '<div class="lab"><span>行距</span><b data-v="pline">' + p.lineHeight.toFixed(1) + '</b></div>' +
      '<input type="range" min="120" max="220" step="10" value="' + Math.round(p.lineHeight * 100) + '" data-prange="lineHeight">' +
      '<div class="lab"><span>阅读宽度</span><b data-v="pwidth">' + (p.maxWidth ? p.maxWidth + 'px' : '关闭') + '</b></div>' +
      '<input type="range" min="0" max="1400" step="20" value="' + p.maxWidth + '" data-prange="maxWidth">' +
      '<div class="sec">底色</div>' +
      '<div class="btnrow">' +
        '<button class="btn' + (p.filter === 'none' ? ' primary' : '') + '" data-filter="none">无</button>' +
        '<button class="btn' + (p.filter === 'sepia' ? ' primary' : '') + '" data-filter="sepia">护眼</button>' +
        '<button class="btn' + (p.filter === 'dim' ? ' primary' : '') + '" data-filter="dim">变暗</button>' +
      '</div>' +
      '<div class="sec">隐藏元素（点选）</div>' +
      '<button class="btn" id="page-pick">' + (picking ? '选取中…点页面元素' : '选取元素并隐藏') + '</button>' +
      (hiddenRows || '<div class="note" style="margin:2px 0 0">还没有隐藏任何元素</div>') +
      '<div class="sec">自定义 CSS</div>' +
      '<textarea class="ta" id="page-css" style="height:90px" placeholder="例如：.ad-banner{display:none}">' + esc(p.css) + '</textarea>' +
      '<button class="btn" id="page-apply-css">应用 CSS</button>' +
      '<button class="btn" id="page-reset">还原全部改造</button>' +
      '<div class="note">改动只写进本机样式表与遮罩层，刷新或点「还原全部」即恢复；不碰服务端数据。</div>';

    const on = body.querySelector('#page-on');
    on.addEventListener('change', () => { prefs.page.on = on.checked; applyPage(); savePrefs(); toast(on.checked ? '已启用改造' : '已停用改造'); });

    body.querySelectorAll('[data-prange]').forEach((r) => {
      r.addEventListener('input', () => {
        const k = r.dataset.prange;
        const v = Number(r.value);
        if (k === 'fontScale') prefs.page.fontScale = v / 100;
        else if (k === 'lineHeight') prefs.page.lineHeight = v / 100;
        else if (k === 'maxWidth') prefs.page.maxWidth = v;
        const lab = body.querySelector('[data-v="p' + (k === 'fontScale' ? 'font' : k === 'lineHeight' ? 'line' : 'width') + '"]');
        if (lab) lab.textContent = k === 'fontScale' ? v + '%' : k === 'lineHeight' ? (v / 100).toFixed(1) : (v ? v + 'px' : '关闭');
        if (!prefs.page.on) { prefs.page.on = true; const cb = body.querySelector('#page-on'); if (cb) cb.checked = true; }
        applyPage();
      });
      r.addEventListener('change', savePrefs);
    });

    body.querySelectorAll('[data-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        prefs.page.filter = b.dataset.filter;
        if (!prefs.page.on) { prefs.page.on = true; }
        applyPage(); renderPage(); savePrefs();
      });
    });

    body.querySelector('#page-pick').addEventListener('click', () => { startPick(); renderPage(); });
    body.querySelectorAll('[data-del]').forEach((el) => {
      el.addEventListener('click', () => {
        prefs.page.hidden.splice(Number(el.dataset.del), 1);
        applyPage(); renderPage(); savePrefs();
      });
    });

    body.querySelector('#page-apply-css').addEventListener('click', () => {
      prefs.page.css = body.querySelector('#page-css').value;
      if (!prefs.page.on) prefs.page.on = true;
      applyPage(); savePrefs(); toast('CSS 已应用');
    });

    body.querySelector('#page-reset').addEventListener('click', () => {
      prefs.page = JSON.parse(JSON.stringify(DEFAULTS.page));
      applyPage(); renderPage(); savePrefs(); toast('已还原页面改造');
    });
  }

  // ---------- 设置 / 主题 / 尺寸 ----------
  function isTabEnabled(k) {
    return k === 'settings' || !!prefs.features[k];
  }
  function firstEnabledTab() {
    const t = TABS.filter((x) => isTabEnabled(x.k))[0];
    return t ? t.k : 'settings';
  }
  function renderTabs() {
    tabsBar.innerHTML = TABS
      .filter((t) => isTabEnabled(t.k))
      .map((t) => '<div class="tab' + (t.k === prefs.tab ? ' on' : '') + '" data-tab="' + t.k + '">' + t.label + '</div>')
      .join('');
  }
  function applyPrefs() {
    fab.style.width = prefs.fabSize + 'px';
    fab.style.height = prefs.fabSize + 'px';
    fab.style.fontSize = Math.max(10, Math.round(prefs.fabSize * 0.25)) + 'px';
    panel.style.fontSize = (13 * prefs.fontScale).toFixed(1) + 'px';
    panel.style.opacity = String(prefs.opacity);
    panel.classList.toggle('light', prefs.theme === 'light');
    applyPos();
  }

  function renderSettings() {
    const f = prefs.features;
    const pct = (v) => Math.round(v * 100);
    body.innerHTML =
      '<div class="sec">功能开关（关掉即隐藏对应页签）</div>' +
      Object.keys(FEAT_LABEL).map((k) =>
        '<label class="sw"><input type="checkbox" data-feat="' + k + '"' + (f[k] ? ' checked' : '') + '>' +
        '<span>' + FEAT_LABEL[k] + '</span></label>'
      ).join('') +
      '<div class="sec">行为</div>' +
      '<label class="sw"><input type="checkbox" data-opt="autoOpen"' + (prefs.autoOpen ? ' checked' : '') + '>' +
      '<span>进入站点自动展开面板（每会话一次）</span></label>' +
      '<div class="sec">主题</div>' +
      '<div class="btnrow">' +
        '<button class="btn' + (prefs.theme === 'dark' ? ' primary' : '') + '" data-theme="dark">深色</button>' +
        '<button class="btn' + (prefs.theme === 'light' ? ' primary' : '') + '" data-theme="light">浅色</button>' +
      '</div>' +
      '<div class="sec">外观</div>' +
      '<div class="lab"><span>透明度</span><b data-v="opacity">' + pct(prefs.opacity) + '%</b></div>' +
      '<input type="range" min="60" max="100" step="1" value="' + pct(prefs.opacity) + '" data-range="opacity">' +
      '<div class="lab"><span>字号</span><b data-v="fontScale">' + prefs.fontScale.toFixed(1) + '×</b></div>' +
      '<input type="range" min="90" max="140" step="5" value="' + Math.round(prefs.fontScale * 100) + '" data-range="fontScale">' +
      '<div class="lab"><span>面板宽度</span><b data-v="panelW">' + prefs.panelW + 'px</b></div>' +
      '<input type="range" min="300" max="560" step="2" value="' + prefs.panelW + '" data-range="panelW">' +
      '<div class="lab"><span>悬浮球大小</span><b data-v="fabSize">' + prefs.fabSize + 'px</b></div>' +
      '<input type="range" min="40" max="72" step="2" value="' + prefs.fabSize + '" data-range="fabSize">' +
      '<div class="sec">开发</div>' +
      '<button class="btn" id="dev-eruda">打开移动端开发者面板（Eruda）</button>' +
      '<button class="btn" id="reset-all">恢复默认设置</button>' +
      '<div class="note">设置存本机 localStorage；拖面板右下角也能改大小；清站点数据即重置。</div>';

    body.querySelectorAll('[data-feat]').forEach((cb) => {
      cb.addEventListener('change', () => {
        prefs.features[cb.dataset.feat] = cb.checked;
        if (!cb.checked && prefs.tab === cb.dataset.feat) prefs.tab = firstEnabledTab();
        renderTabs();
        applyPos();
        savePrefs();
      });
    });

    const auto = body.querySelector('[data-opt="autoOpen"]');
    if (auto) {
      auto.addEventListener('change', () => { prefs.autoOpen = auto.checked; savePrefs(); });
    }

    body.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        prefs.theme = btn.dataset.theme;
        applyPrefs();
        renderSettings();
        savePrefs();
      });
    });

    body.querySelectorAll('[data-range]').forEach((r) => {
      r.addEventListener('input', () => {
        const key = r.dataset.range;
        const val = Number(r.value);
        if (key === 'opacity') prefs.opacity = val / 100;
        else if (key === 'fontScale') prefs.fontScale = val / 100;
        else if (key === 'panelW') prefs.panelW = val;
        else if (key === 'fabSize') prefs.fabSize = val;
        const label = body.querySelector('[data-v="' + key + '"]');
        if (label) {
          label.textContent = key === 'opacity' ? val + '%'
            : key === 'fontScale' ? (val / 100).toFixed(1) + '×'
            : val + 'px';
        }
        applyPrefs();
      });
      r.addEventListener('change', savePrefs);
    });

    const dev = body.querySelector('#dev-eruda');
    if (dev) dev.addEventListener('click', loadEruda);

    const reset = body.querySelector('#reset-all');
    if (reset) {
      reset.addEventListener('click', () => {
        const keepOpen = prefs.open;
        const fresh = JSON.parse(JSON.stringify(DEFAULTS));
        Object.keys(fresh).forEach((k) => { prefs[k] = fresh[k]; });
        applyPage();
        prefs.open = keepOpen;
        renderTabs();
        applyPrefs();
        renderSettings();
        savePrefs();
        toast('已恢复默认');
      });
    }
  }

  // 移动端开发者面板（Eruda：console / network / elements）
  function loadEruda() {
    if (window.__dzmmEruda) { toast('面板已加载：右下角 e 图标'); return; }
    if (document.querySelector('script[data-eruda]')) { toast('正在加载…'); return; }
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/eruda';
    sc.setAttribute('data-eruda', '1');
    sc.async = true;
    sc.onload = function () {
      window.__dzmmEruda = true;
      try { if (window.eruda) window.eruda.init(); } catch (e) { /* 忽略 */ }
      toast('开发者面板已打开');
    };
    sc.onerror = function () { toast('加载失败：检查网络，或换 unpkg 镜像'); };
    (document.head || document.documentElement).appendChild(sc);
  }

  // 拖右下角调整大小
  (function bindResize() {
    let on = false, x0 = 0, y0 = 0, w0 = 0, h0 = 0;
    grip.addEventListener('pointerdown', (e) => {
      on = true; x0 = e.clientX; y0 = e.clientY;
      const r = panel.getBoundingClientRect();
      w0 = r.width; h0 = r.height;
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!on) return;
      prefs.panelW = Math.max(300, Math.min(560, Math.round(w0 + (x0 - e.clientX))));
      prefs.panelH = Math.max(220, Math.min(Math.round(window.innerHeight * 0.85), Math.round(h0 + (e.clientY - y0))));
      applyPos();
    });
    const stop = () => { if (on) { on = false; savePrefs(); } };
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
  })();

  // ---------- 启动 ----------
  renderTabs();
  applyPrefs();
  applyPage();
  if (prefs.open) panel.classList.add('open');
  window.addEventListener('resize', applyPos);

  try {
    const SEEN = 'dzmm_helper_autoopen';
    if (prefs.autoOpen && !sessionStorage.getItem(SEEN)) {
      sessionStorage.setItem(SEEN, '1');
      setOpen(true);
      toast('已检测到 DZMM，助手已就绪（Alt+M 开关）');
    }
  } catch (e) { /* 隐私模式下忽略 */ }

  // 控制台提示（方便确认脚本已生效）
  try {
    console.log('[DZMM 助手] 已加载，模型条目 ' + MODELS.length + ' 个；Alt+M 开关面板。');
  } catch (e) {}
})();
