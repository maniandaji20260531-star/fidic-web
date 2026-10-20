const { handleAsk } = require('../lib/core');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const [code, data] = await handleAsk(body, ip); res.status(code).json(data);
};
