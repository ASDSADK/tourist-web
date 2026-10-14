import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// This checker writes only to a separately started local QA backend.
const origin = 'http://127.0.0.1:3002';
const get = async path => { const response = await fetch(origin + path); assert.equal(response.status, 200); return response.json(); };
assert.equal((await get('/api/health')).mode, 'demo');
const content = await get('/api/content');
assert.equal(content.bookingUrl, null);
assert.equal(content.attractions.length, 3);
assert.equal(JSON.stringify(content).includes(process.env.INGEST_TOKEN), false);
assert.equal((await fetch(origin + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
const post = body => fetch(origin + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INGEST_TOKEN}` }, body: JSON.stringify(body) });
assert.equal((await post({})).status, 400);
const initial = await get('/api/dashboard');
const entered = (initial.sameDay ? initial.latest?.enteredToday : 0) ?? 0;
const exited = (initial.sameDay ? initial.latest?.exitedToday : 0) ?? 0;
const payload = { parkId: 'zhangjiajie-demo', sessionId: randomUUID(), sequence: 1, sampledAt: new Date().toISOString(), source: 'local-simulation', enteredToday: entered + 120, exitedToday: exited + 20, occupancy: entered - exited + 100 };
assert.equal((await (await post(payload)).json()).accepted, true);
assert.equal((await (await post(payload)).json()).accepted, false);
const saved = await get('/api/dashboard');
assert.equal(saved.latest.enteredToday, payload.enteredToday);
assert.equal(saved.stale, false);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const response = await fetch(origin + '/api/events', { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const chunk = new TextDecoder().decode((await reader.read()).value);
  assert.match(chunk, /event: snapshot/);
  assert.match(chunk, /local-simulation/);
  await reader.cancel();
} finally { clearTimeout(timeout); controller.abort(); }
console.log('HTTP checks passed: health, content, token privacy, authorization, validation, upload, deduplication, dashboard and SSE.');
