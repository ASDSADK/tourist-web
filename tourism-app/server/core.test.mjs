import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, applySnapshot, publicState } from './core.mjs';
const base = Date.parse('2026-10-14T00:00:00Z');
function snapshot(offset = 0, extras = {}) { return { parkId: 'zhangjiajie-demo', sessionId: 'session-a', sequence: 1, sampledAt: new Date(base + offset).toISOString(), source: 'ue-simulation', enteredToday: 10, exitedToday: 2, occupancy: 8, ...extras }; }
test('duplicate, old sequence and out-of-order timestamps do not count twice', () => {
  const state = applySnapshot(emptyState(), snapshot(), base).state;
  assert.equal(applySnapshot(state, snapshot(), base).accepted, false);
  assert.equal(applySnapshot(state, snapshot(-1000, { sessionId: 'session-b' }), base).accepted, false);
});
test('invalid counts, naive timestamps and cumulative rollback are rejected', () => {
  assert.throws(() => applySnapshot(emptyState(), snapshot(0, { occupancy: 9 }), base));
  assert.throws(() => applySnapshot(emptyState(), snapshot(0, { sampledAt: '2026-10-14T08:00:00' }), base));
  const state = applySnapshot(emptyState(), snapshot(), base).state;
  assert.throws(() => applySnapshot(state, snapshot(1000, { sequence: 2, enteredToday: 9, occupancy: 7 }), base + 1000));
});
test('same-bucket snapshots replace the point; five-minute differences use matching units', () => {
  let state = applySnapshot(emptyState(), snapshot(), base).state;
  state = applySnapshot(state, snapshot(1000, { sequence: 2, enteredToday: 12, occupancy: 10 }), base + 1000).state;
  assert.equal(state.points.length, 1);
  state = applySnapshot(state, snapshot(300000, { sequence: 3, enteredToday: 20, exitedToday: 5, occupancy: 15 }), base + 300000).state;
  assert.equal(publicState(state, base + 300000).trend[1].entered, 8);
  assert.equal(publicState(state, base + 300000).trend[0].entered, null);
});
test('gaps remain missing; stale status updates without incoming data', () => {
  let state = applySnapshot(emptyState(), snapshot(), base).state;
  state = applySnapshot(state, snapshot(600000, { sequence: 2, enteredToday: 20, occupancy: 18 }), base + 600000).state;
  assert.equal(publicState(state, base + 600000).trend[1].entered, null);
  assert.equal(publicState(state, base + 631000).stale, true);
});
test('Shanghai midnight starts a new daily counter and keeps history', () => {
  const before = Date.parse('2026-10-14T15:59:55Z');
  const after = Date.parse('2026-10-14T16:00:05Z');
  let state = applySnapshot(emptyState(), { ...snapshot(), sampledAt: new Date(before).toISOString() }, before).state;
  state = applySnapshot(state, { ...snapshot(), sampledAt: new Date(after).toISOString(), sequence: 2, enteredToday: 1, exitedToday: 0, occupancy: 1 }, after).state;
  assert.equal(state.points.length, 2);
  assert.equal(publicState(state, after).day, '2026-10-15');
  assert.equal(publicState(state, after).trend.length, 1);
});
