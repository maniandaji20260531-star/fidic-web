const http = require('http'), fs = require('fs'), path = require('path');
const { handleAsk } = require('./lib/core');
const PORT = +process.env.PORT || 3000;
http.createServer((req, res) => {
  const send = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  if (req.url === '/api/config') return send(200, { needCode: !!process.env.ACCESS_CODE });
  if (req.url === '/api/ask' && req.method === 'POST') {
    let b = ''; req.on('data', d => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on('end', async () => { let body = {}; try { body = JSON.parse(b); } catch {}
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
      const [c, o] = await handleAsk(body, ip); send(c, o); });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
}).listen(PORT, () => console.log('FIDIC web on http://localhost:' + PORT));
