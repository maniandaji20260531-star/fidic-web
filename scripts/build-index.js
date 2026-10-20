// 构建检索索引：切块 text/*.txt 与 web/*.md，输出 data/index.json
const fs = require('fs'), path = require('path');
const { tokenize } = require('../lib/core');
const KB = process.env.KB_DIR || '/workspace/fidic-kb';
const SKIP = [/^45_/, /^46_/]; // 与 02/03 字节相同的重复文件
const SIZE = 1500, OVERLAP = 300;
const chunks = [];
for (const sub of ['text', 'web']) {
  const dir = path.join(KB, sub); if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.(txt|md)$/.test(f) || SKIP.some(r => r.test(f))) continue;
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n')
      .map(l => l.replace(/\s+/g, ' ').trim());
    let i = 0;
    while (i < lines.length) {
      let len = 0, j = i;
      while (j < lines.length && len < SIZE) { len += lines[j].length + 1; j++; }
      const text = lines.slice(i, j).filter(Boolean).join('\n');
      if (text.length > 40) chunks.push({ file: `${sub}/${f}`, start: i + 1, end: j, text });
      if (j >= lines.length) break;
      // 回退以产生约 OVERLAP 字符重叠
      let back = 0, k = j; while (k > i + 1 && back < OVERLAP) { k--; back += lines[k].length + 1; }
      i = Math.max(k, i + 1);
    }
  }
}
// BM25 统计
const df = {}; let totalLen = 0;
for (const c of chunks) {
  const toks = tokenize(c.text); c.len = toks.length; totalLen += toks.length;
  const tf = {}; for (const t of toks) tf[t] = (tf[t] || 0) + 1; c.tf = tf;
  for (const t in tf) df[t] = (df[t] || 0) + 1;
}
const out = { built: new Date().toISOString(), N: chunks.length, avgdl: totalLen / chunks.length, df, chunks };
fs.writeFileSync(path.join(__dirname, '..', 'data', 'index.json'), JSON.stringify(out));
console.log(`chunks=${chunks.length} terms=${Object.keys(df).length}`);
