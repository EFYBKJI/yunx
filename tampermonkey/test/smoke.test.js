/**
 * 冒烟测试：jsdom 模拟 dzmm.ai 页面，加载油猴脚本，验证 UI 与数据渲染。
 *
 *   cd tampermonkey
 *   npm install jsdom --no-save
 *   node test/smoke.test.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SCRIPT = path.join(__dirname, '..', 'dzmm-helper.user.js');
const src = fs.readFileSync(SCRIPT, 'utf8');

const dom = new JSDOM(
  '<!doctype html><html><head><title>DZMM 测试页</title></head><body>' +
    '<main><h1>测试角色卡</h1>' +
    '<p>这是一段用于测试提取功能的正文内容，长度必须超过一百二十个字符，否则提取器会跳过它。' +
    '角色设定：古代剑客，性格孤傲，说话简短，喜欢在雨天练剑，讨厌被人打扰。' +
    '世界观：架空王朝，门派林立，江湖恩怨不断。用户扮演一名初入江湖的少侠。' +
    '开场白需要交代场景、人物状态与下一步可选行动。</p>' +
    '<h2>设定补充</h2><p>禁止出戏，保持第三人称叙述，每段不超过三行。</p>' +
    '<ul><li>称呼用户为「少侠」</li><li>回复中不要出现现代词汇</li></ul>' +
    '</main></body></html>',
  {
    url: 'https://www.dzmm.ai/explore?model=x-apex-surge-0505',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  }
);
const { window } = dom;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;

function ok(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra ? ' → ' + extra : ''));
  passed++;
  console.log('  ✓ ' + name);
}

(async () => {
  console.log('① 加载脚本');
  window.eval(src);

  const host = window.document.querySelector('[data-dzmm-helper]');
  ok('注入了宿主节点', !!host);
  const sr = host.shadowRoot;
  ok('shadow root 已创建', !!sr);
  ok('存在悬浮按钮', !!sr.querySelector('.fab'));
  ok('存在面板', !!sr.querySelector('.panel'));
  const panel = sr.querySelector('.panel');
  ok('检测到站点后自动展开面板', panel.classList.contains('open'));

  console.log('② 关闭后手动再打开');
  sr.querySelector('[data-close]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('可关闭', !panel.classList.contains('open'));
  sr.querySelector('.fab').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('点悬浮球再次打开', panel.classList.contains('open'));

  console.log('③ 模型页渲染');
  const body = () => sr.querySelector('[data-body]');
  let rows = body().querySelectorAll('.row');
  ok('模型条目 = 52', rows.length === 52, '实际 ' + rows.length);
  ok('有搜索框', !!body().querySelector('.search'));
  ok('首行含内部模型名', /nalang-|x-apex-/.test(rows[0].textContent));
  ok('显示相对倍数', /×/.test(rows[0].textContent));

  console.log('④ 搜索过滤');
  const input = body().querySelector('.search');
  input.value = 'sigma';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(10);
  rows = body().querySelectorAll('.row');
  ok('搜索 sigma 有结果', rows.length > 0 && rows.length < 52, '结果 ' + rows.length);
  ok('结果都含 sigma', [...rows].every((r) => /sigma/i.test(r.textContent)));

  console.log('⑤ 成本页');
  sr.querySelector('.tab[data-tab="cost"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const costRows = body().querySelectorAll('tbody tr');
  ok('成本表 = 18 个档位', costRows.length === 18, '实际 ' + costRows.length);
  ok('有倍数说明', /倍/.test(body().textContent));

  console.log('⑥ 探针页');
  sr.querySelector('.tab[data-tab="probe"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const probeBtn = body().querySelector('#do-probe');
  ok('有扫描按钮', !!probeBtn);
  probeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(120);
  const out = body().querySelector('#probe-out');
  ok('扫描出结果', out && out.innerHTML.length > 20);
  ok('识别到 URL 里的模型参数', /x-apex-surge-0505/.test(out.innerHTML), out.textContent.slice(0, 80));

  console.log('⑦ 导出页');
  sr.querySelector('.tab[data-tab="export"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('有 JSON 导出', !!body().querySelector('#dl-json'));
  ok('有 CSV 导出', !!body().querySelector('#dl-csv'));
  ok('有复制模型名', !!body().querySelector('#cp-names'));
  ok('数据量文案正确', /52/.test(body().textContent));

  console.log('⑧ 提取页');
  sr.querySelector('.tab[data-tab="extract"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('有提取按钮', !!body().querySelector('#do-extract'));
  ok('有可编辑文本域', !!body().querySelector('#ex-ta'));
  body().querySelector('#do-extract').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  const ta = body().querySelector('#ex-ta');
  ok('提取出内容', ta.value.length > 80, '长度 ' + ta.value.length);
  ok('提取到标题', ta.value.includes('# 测试角色卡'), ta.value.slice(0, 40));
  ok('提取到段落', /剑客/.test(ta.value));
  ok('提取到列表', /- 称呼用户为/.test(ta.value));

  ta.value = ta.value + '\n\n（本地改写的补充说明）';
  body().querySelector('#ex-preview').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const prev = sr.querySelector('.prev');
  ok('预览层已创建', !!prev);
  ok('预览内容是改写后的', /本地改写的补充说明/.test(prev.querySelector('.pb').textContent));
  prev.querySelector('.x').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('预览可关闭', !sr.querySelector('.prev'));

  console.log('⑨ 页面改造（只改本地显示）');
  sr.querySelector('.tab[data-tab="page"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('改造页有启用开关', !!body().querySelector('#page-on'));
  ok('改造页有选取按钮', !!body().querySelector('#page-pick'));
  ok('改造页有自定义 CSS', !!body().querySelector('#page-css'));

  const pageOn = body().querySelector('#page-on');
  pageOn.checked = true;
  pageOn.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(10);
  const pageStyle = window.document.getElementById('dzmm-helper-page-style');
  ok('启用后注入页面样式表', !!pageStyle);

  const fontRange = body().querySelector('[data-prange="fontScale"]');
  fontRange.value = '120';
  fontRange.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(10);
  ok('字号改造生效', /font-size:19px/.test(pageStyle.textContent), pageStyle.textContent.slice(0, 60));

  const css = body().querySelector('#page-css');
  css.value = '.ad-banner{display:none}';
  body().querySelector('#page-apply-css').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('自定义 CSS 生效', /ad-banner/.test(pageStyle.textContent));

  body().querySelector('[data-filter="dim"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const dim = sr.querySelector('.dim');
  ok('变暗遮罩出现', dim && dim.style.display === 'block', dim && dim.style.display);

  body().querySelector('#page-reset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('还原后样式清空', window.document.getElementById('dzmm-helper-page-style').textContent === '');
  ok('还原后遮罩隐藏', sr.querySelector('.dim').style.display === 'none');

  console.log('⑩ API 对接');
  sr.querySelector('.tab[data-tab="api"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('API 页有地址与 Key 输入', !!body().querySelector('#api-base') && !!body().querySelector('#api-key'));

  window.fetch = async (u) => {
    const url = String(u);
    if (url.indexOf('/models') >= 0) {
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'nalang-turbo-0826' }, { id: 'x-brand-new-9999' }] }) };
    }
    if (url.indexOf('/quota') >= 0) {
      return { ok: true, status: 200, json: async () => ({ balance: 42 }) };
    }
    return { ok: true, status: 200, json: async () => ({ model: 'nalang-turbo-0826', choices: [{ message: { content: 'pong' } }], x_mock_balance: 41 }) };
  };

  body().querySelector('#api-models').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  const apiOut = body().querySelector('#api-out').textContent;
  ok('拉取模型有结果', /服务端模型 2 个/.test(apiOut), apiOut.slice(0, 60));
  ok('能识别快照里没有的新模型', /x-brand-new-9999/.test(apiOut));

  body().querySelector('#api-quota').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  ok('查额度生效', /42/.test(body().querySelector('#api-out').textContent));

  body().querySelector('#api-chat').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  const chatOut = body().querySelector('#api-out').textContent;
  ok('测试对话有回复', /pong/.test(chatOut), chatOut.slice(0, 60));
  ok('显示剩余额度', /41/.test(chatOut));

  console.log('⑪ 设置页：功能开关');
  sr.querySelector('.tab[data-tab="settings"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('设置页有 7 个功能开关', body().querySelectorAll('[data-feat]').length === 7);
  ok('设置页有自动展开开关', !!body().querySelector('[data-opt="autoOpen"]'));

  const costCb = body().querySelector('[data-feat="cost"]');
  costCb.checked = false;
  costCb.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(10);
  ok('关掉成本后页签消失', !sr.querySelector('.tab[data-tab="cost"]'));
  ok('其余页签保留', !!sr.querySelector('.tab[data-tab="models"]'));
  costCb.checked = true;
  costCb.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(10);
  ok('重开后页签恢复', !!sr.querySelector('.tab[data-tab="cost"]'));

  console.log('⑫ 设置页：主题与外观');
  body().querySelector('[data-theme="light"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('浅色主题已应用', panel.classList.contains('light'));
  ok('浅色主题设置项高亮', body().querySelector('[data-theme="light"]').classList.contains('primary'));

  const wRange = body().querySelector('[data-range="panelW"]');
  wRange.value = '420';
  wRange.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(10);
  ok('拖动宽度滑块生效', panel.style.width === '420px', panel.style.width);
  ok('数值标签同步', /420px/.test(body().querySelector('[data-v="panelW"]').textContent));

  const opRange = body().querySelector('[data-range="opacity"]');
  opRange.value = '80';
  opRange.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(10);
  ok('透明度生效', panel.style.opacity === '0.8', panel.style.opacity);

  const grip = sr.querySelector('[data-grip]');
  ok('存在缩放把手', !!grip);
  grip.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 500 }));
  grip.dispatchEvent(new window.MouseEvent('pointermove', { bubbles: true, clientX: 400, clientY: 400 }));
  await sleep(10);
  ok('拖动把手改变宽度', panel.style.width !== '420px', panel.style.width);

  body().querySelector('#reset-all').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('恢复默认：宽度回 362', panel.style.width === '362px', panel.style.width);
  ok('恢复默认：主题回深色', !panel.classList.contains('light'));

  console.log('⑬ 开发者面板（Eruda）');
  sr.querySelector('.tab[data-tab="settings"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const devBtn = body().querySelector('#dev-eruda');
  ok('设置页有开发者面板按钮', !!devBtn);
  devBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const erudaScript = window.document.querySelector('script[data-eruda]');
  ok('注入了 Eruda 脚本', !!erudaScript);
  ok('脚本地址正确', /eruda/.test(erudaScript.getAttribute ? erudaScript.getAttribute('src') : erudaScript.src));

  console.log('⑭ 关闭与快捷键');
  sr.querySelector('[data-close]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok('点 ✕ 关闭', !panel.classList.contains('open'));
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm', altKey: true }));
  await sleep(10);
  ok('Alt+M 打开', panel.classList.contains('open'));

  console.log('⑮ 非目标站点不注入');
  const dom2 = new JSDOM('<html><body></body></html>', {
    url: 'https://example.com/',
    runScripts: 'dangerously',
  });
  dom2.window.eval(src);
  ok('example.com 无宿主节点', !dom2.window.document.querySelector('[data-dzmm-helper]'));

  console.log(`\n全部通过：${passed} 项`);
})().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
