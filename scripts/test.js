const { search, buildMessages } = require('../lib/core');
for (const q of ['索赔', 'Sub-Clause 20.1']) {
  console.log('\n=== ' + q);
  for (const h of search(q, 5)) console.log(h.score, h.file, `L${h.start}-${h.end}`, '|', h.text.replace(/\n/g, ' ').slice(0, 110));
}
const m = buildMessages('红皮书索赔通知期限是多少？', search('红皮书索赔通知期限 Sub-Clause 20.1', 4));
const ok = [m[0].content.includes('知识库中未找到'), m[0].content.includes('仅供参考'), m[0].content.includes('建议人工审核'), /来源：text\/.+ L\d+–\d+/.test(m[1].content)];
console.log('\nprompt checks', ok, 'sys len', m[0].content.length, 'user len', m[1].content.length);
