const fs = require('fs'), path = require('path');
const STOP = new Set('the of and to a in or be is by for any this shall with as on that under such which are an at from it its not has have was will may if all other'.split(' '));
function tokenize(s) {
  s = s.toLowerCase(); const out = [];
  for (const w of s.match(/[a-z0-9]+(?:\.[0-9]+)*/g) || []) if (!STOP.has(w) && w.length > 1 || /\d/.test(w)) out.push(w);
  for (const seg of s.match(/[\u4e00-\u9fff]+/g) || []) for (let i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2));
  return out;
}
// 中文 → 英文术语扩展（知识库主要为英文）
const GLOSS = { '索赔': 'claim claims notice', '工期': 'extension time completion', '延期': 'extension time delay', '延误': 'delay', '变更': 'variation variations change', '工程师': 'engineer', '争议': 'dispute disputes', '仲裁': 'arbitration', '裁决': 'adjudication decision', '终止': 'termination terminate', '暂停': 'suspension suspend', '付款': 'payment', '支付': 'payment', '雇主': 'employer', '承包商': 'contractor', '通知': 'notice', '保函': 'guarantee security', '履约': 'performance', '误期': 'delay damages', '违约': 'default breach', '不可抗力': 'force majeure exceptional events', '保险': 'insurance', '分包': 'subcontractor', '缺陷': 'defects', '验收': 'taking over tests', '价格调整': 'adjustment changes cost', '确定': 'determination determine', '期限': 'period days', '时效': 'time bar days', '红皮书': 'red book construction', '黄皮书': 'yellow book design build', '银皮书': 'silver book epc turnkey', '专用条件': 'particular conditions', '通用条件': 'general conditions', '预付款': 'advance payment', '保留金': 'retention money', '计量': 'measurement', '费用': 'cost', '利润': 'profit', '工期延长': 'extension time' };
function expand(q) { let e = q; for (const k in GLOSS) if (q.includes(k)) e += ' ' + GLOSS[k]; return e; }
function clauseRefs(q) { // Sub-Clause 20.1 / 第20.1条 / 20.1款
  const m = q.match(/\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\b/g) || []; return [...new Set(m)];
}
let IDX = null;
function loadIndex() { if (!IDX) IDX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'index.json'), 'utf8')); return IDX; }
function search(q, k = 6) {
  const idx = loadIndex(), K1 = 1.4, B = 0.75;
  const terms = [...new Set(tokenize(expand(q)))], refs = clauseRefs(q);
  const res = [];
  for (const c of idx.chunks) {
    let s = 0;
    for (const t of terms) { const f = c.tf[t]; if (!f) continue; const n = idx.df[t];
      const idf = Math.log(1 + (idx.N - n + 0.5) / (n + 0.5));
      s += idf * f * (K1 + 1) / (f + K1 * (1 - B + B * c.len / idx.avgdl)); }
    for (const r of refs) { // 精确条款号加权
      const re = new RegExp('(sub-?clause|clause|条|款)?\\s*' + r.replace(/\./g, '\\.') + '(?![\\d.])', 'i');
      if (new RegExp('sub-?clause\\s*' + r.replace(/\./g, '\\.') + '(?![\\d])', 'i').test(c.text)) s += 15;
      else if (re.test(c.text)) s += 4; }
    if (s > 0) res.push({ s, c });
  }
  res.sort((a, b) => b.s - a.s);
  return res.slice(0, k).map(({ s, c }) => ({ score: +s.toFixed(2), file: c.file, start: c.start, end: c.end, text: c.text }));
}
const DISCLAIMER = '仅供参考，不构成法律意见；重大索赔/仲裁须律师或人工复核。';
function buildMessages(question, hits) {
  const sys = `你是 FIDIC 合同问答助手。必须用中文回答，并严格使用以下固定两段结构：

### 1. 条款 / 原文
- 只能引用下方「检索片段」中的原文（可保留英文原文并附中文释义），每条引用必须标注来源：文件名 + 行号范围（如 \`text/02_xxx.txt\` L109–119）。
- 绝不编造、补全或凭记忆复述 FIDIC 条款原文。片段中没有的内容，必须写「知识库中未找到」，并说明：本知识库不含 FIDIC 官方红皮书/黄皮书/银皮书全文（需向 FIDIC 购买），请查阅官方出版物或项目合同。
- 区分通用条件与多边银行（世行/EBRD/ADB/CDB 等）专用条件，不要把专用条件说成 FIDIC 通用原文。

### 2. 项目化方案
- 简要按「项目事实 → 适用材料 → 结论」给出（可用表格）。
- 若用户未提供合同版本（1999/2017、红/黄/银皮书）、专用条件或函件，列出需要补充的文件。

结尾固定附上免责声明：「${DISCLAIMER}」
若问题涉及较大金额索赔、仲裁或合同终止，必须在显著位置标注「建议人工审核」。`;
  const ctx = hits.length ? hits.map((h, i) => `[片段${i + 1}] 来源：${h.file} L${h.start}–${h.end}\n${h.text}`).join('\n\n---\n\n') : '（未检索到相关片段）';
  return [{ role: 'system', content: sys }, { role: 'user', content: `检索片段：\n\n${ctx}\n\n====\n用户问题：${question}` }];
}
async function callLLM(messages) {
  const key = process.env.LLM_API_KEY; if (!key) throw new Error('服务器未配置 LLM_API_KEY');
  const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const r = await fetch(base + '/chat/completions', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: process.env.LLM_MODEL || 'gpt-4o-mini', messages, temperature: 0.2 }) });
  if (!r.ok) throw new Error('LLM 接口错误 ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json(); return j.choices?.[0]?.message?.content || '';
}
// 简单按 IP 限流（内存；serverless 下为单实例近似）
const buckets = new Map();
function rateLimit(ip) {
  const per = +process.env.RATE_LIMIT_PER_HOUR || 20, now = Date.now();
  const arr = (buckets.get(ip) || []).filter(t => now - t < 3600e3);
  if (arr.length >= per) return false; arr.push(now); buckets.set(ip, arr); return true;
}
async function handleAsk(body, ip) {
  if (process.env.ACCESS_CODE && body.code !== process.env.ACCESS_CODE) return [401, { error: '访问码错误' }];
  const q = String(body.question || '').trim().slice(0, 1000);
  if (!q) return [400, { error: '请输入问题' }];
  if (!rateLimit(ip)) return [429, { error: '提问过于频繁，请稍后再试' }];
  const hits = search(q);
  try { const answer = await callLLM(buildMessages(q, hits));
    return [200, { answer, sources: hits.map(h => ({ file: h.file, start: h.start, end: h.end, score: h.score, excerpt: h.text.slice(0, 300) })) }];
  } catch (e) { return [500, { error: e.message }]; }
}
module.exports = { tokenize, search, buildMessages, callLLM, handleAsk, DISCLAIMER };
