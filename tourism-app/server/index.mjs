import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { applySnapshot, publicState } from './core.mjs';
import { openStore } from './store.mjs';

const token = process.env.INGEST_TOKEN;
if (!token || token === 'replace-with-a-local-demo-token' || token.length < 16) throw new Error('Set INGEST_TOKEN to a private local demo token of at least 16 characters');
const store = await openStore();
let state = store.state;
const app = Fastify({ logger: true, bodyLimit: 16384 });
const clients = new Set();
let writeQueue = Promise.resolve();
const authorized = header => {
  const actual = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
function send(client) {
  if (client.destroyed || client.writableLength > 65536) { client.destroy(); clients.delete(client); return; }
  client.write(`event: snapshot\ndata: ${JSON.stringify(publicState(state))}\n\n`);
}

app.get('/api/health', async () => ({ ok: true, mode: 'demo' }));
app.get('/api/dashboard', async () => publicState(state));
app.get('/api/content', async () => {
  let bookingUrl = null;
  try { const url = new URL(process.env.BOOKING_URL); if (url.protocol === 'https:') bookingUrl = url.href; } catch {}
  return {
    mode: 'simulation', bookingUrl,
    weather: { condition: '多云', temperature: 26, range: '22–30°C', humidity: 72, note: '演示天气，未接入气象服务' },
    attractions: [
      { id: 'yuanjiajie', name: '袁家界', description: '石峰之间，云海之上', total: 3000, remaining: 860, status: '可预约' },
      { id: 'jinbianxi', name: '金鞭溪', description: '沿溪漫步，探索山谷', total: 2000, remaining: 1240, status: '可预约' },
      { id: 'tianzishan', name: '天子山', description: '登高远眺，群峰尽收', total: 2500, remaining: 180, status: '余量较少' }
    ],
    news: [
      { id: 'notice', tag: '公告', title: '游览前请查看各景点预约余量，合理安排路线', detail: '本条为演示公告。预约余量也是示例数据，实际预约以官方小程序为准。', source: '演示管理端' },
      { id: 'weather', tag: '天气', title: '山地天气变化较快，建议准备雨具与防滑鞋', detail: '本条为演示天气提示，不代表实时预报。', source: '演示管理端' },
      { id: 'guide', tag: '指南', title: '先看客流，再选时段，让游览更从容', detail: '曲线仅显示已经收到的模拟数据，空白表示尚未采集。当前未提供未来客流预测。', source: '演示管理端' }
    ]
  };
});
app.post('/api/ingest', async (request, reply) => {
  if (!authorized(request.headers.authorization)) return reply.code(401).send({ error: 'Unauthorized' });
  const operation = writeQueue.then(async () => {
    const result = applySnapshot(state, request.body);
    if (result.accepted) {
      await store.save(result.state);
      state = result.state;
      for (const client of clients) send(client);
    }
    return { accepted: result.accepted, reason: result.reason };
  });
  writeQueue = operation.catch(() => {});
  try { return await operation; }
  catch (error) {
    if (error.code) { request.log.error(error); return reply.code(500).send({ error: 'Failed to persist data' }); }
    return reply.code(400).send({ error: error.message });
  }
});
app.get('/api/events', (request, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  clients.add(reply.raw);
  send(reply.raw);
  reply.raw.on('close', () => clients.delete(reply.raw));
});
const heartbeat = setInterval(() => { for (const client of clients) send(client); }, 10000);
app.addHook('onClose', async () => { clearInterval(heartbeat); for (const client of clients) client.end(); await writeQueue; await store.close(); });
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '127.0.0.1' });
let closing = false;
async function shutdown() { if (closing) return; closing = true; for (const client of clients) client.end(); await app.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
