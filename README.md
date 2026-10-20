# FIDIC 合同问答（网页版 v1）

手机/微信打开链接即可提问。回答只引用内置知识库片段（世行/EBRD/ADB/CDB/EIB 公开文件、判例、FIDIC 简报），**不含 FIDIC 官方红/黄/银皮书全文**。仅供参考，不构成法律意见。

## 目录
- `public/index.html` 单页中文界面（移动端适配）
- `api/ask.js`、`api/config.js` Vercel 无服务器函数
- `server.js` 本地服务器（`npm start`）
- `lib/core.js` 检索（BM25 + 中英术语扩展 + 条款号精确匹配）、提示词、LLM 调用、限流、访问码
- `scripts/build-index.js` 从 `/workspace/fidic-kb/text/*.txt`、`web/*.md` 生成 `data/index.json`（约 1500 字/块，300 字重叠，保留文件名+行号）
- `data/index.json` 预构建索引（随代码部署，不依赖原机器）
- `scripts/test.js` 检索与提示词测试

## 环境变量
| 变量 | 说明 |
|---|---|
| `LLM_API_KEY` | 必填，大模型 API key（只在服务器端使用，不会发给浏览器） |
| `LLM_BASE_URL` | OpenAI 兼容接口地址，默认 `https://api.openai.com/v1`（DeepSeek 用 `https://api.deepseek.com/v1` 等） |
| `LLM_MODEL` | 模型名，默认 `gpt-4o-mini` |
| `ACCESS_CODE` | 可选，设置后需输入访问码才能提问 |
| `RATE_LIMIT_PER_HOUR` | 可选，每个 IP 每小时提问上限，默认 20 |
| `PORT` | 本地端口，默认 3000 |

## 本地运行
```bash
npm run build-index   # 知识库更新后重建索引（可选，已内置）
LLM_API_KEY=xxx LLM_MODEL=gpt-4o-mini npm start
npm test              # 检索测试
```
需 Node.js 18+，无第三方依赖。

## 部署到 Vercel
1. 把本目录推到 GitHub 仓库（含 `data/index.json`）。
2. Vercel → New Project → 导入该仓库，Framework 选 Other，无需构建命令。
3. Settings → Environment Variables 添加 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`（可选 `ACCESS_CODE`）。
4. Deploy，得到 `https://xxx.vercel.app`，可直接发到微信。
   - 注意：`*.vercel.app` 在中国大陆可能访问不稳定，建议绑定自有域名（大陆长期使用可能需备案或改用国内云）。
   - 也可用命令行：`npx vercel --prod`。

## 限制与后续
- v1 **不做全网搜索与回填**；后续可接搜索 API（如 Tavily/Bing），把网络结果存到 `fidic-kb/web/*.md` 后重跑 `npm run build-index` 再部署。
- 限流为内存实现，Serverless 多实例下只是近似；需要严格限流可接 Upstash Redis/Vercel KV。
- 检索为关键词（BM25），中文问题靠内置中英术语表扩展到英文原文。
