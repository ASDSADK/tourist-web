import { randomUUID } from 'node:crypto';
import { chinaDay } from './core.mjs';
if (!process.env.INGEST_TOKEN) throw new Error('Configure INGEST_TOKEN in .env first');
const origin = `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const initial = await fetch(`${origin}/api/dashboard`).then(response => { if (!response.ok) throw new Error('Cannot read initial state'); return response.json(); });
if (initial.sameDay && initial.latest?.source !== 'local-simulation') throw new Error('This data store contains UE data. Do not run two producers against the same park.');
let entered = initial.sameDay ? initial.latest.enteredToday : 0;
let exited = initial.sameDay ? initial.latest.exitedToday : 0;
let day = chinaDay(Date.now());
let sequence = 0;
const sessionId = randomUUID();
console.log('Local simulation started. Values are simulated; stop before using UE.');
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
while (!stopped) {
  const now = new Date();
  if (chinaDay(now) !== day) { day = chinaDay(now); entered = 0; exited = 0; }
  entered += Math.floor(Math.random() * 30) + 8;
  exited += Math.min(entered - exited, Math.floor(Math.random() * 20));
  const response = await fetch(`${origin}/api/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INGEST_TOKEN}` }, body: JSON.stringify({ parkId: 'zhangjiajie-demo', sessionId, sequence: ++sequence, sampledAt: now.toISOString(), source: 'local-simulation', enteredToday: entered, exitedToday: exited, occupancy: entered - exited }) });
  if (!response.ok) throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  await new Promise(resolve => setTimeout(resolve, 5000));
}
