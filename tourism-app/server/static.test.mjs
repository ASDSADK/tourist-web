import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStaticDashboard, staticContent } from '../src/staticDemo.ts';

test('static demo is explicitly identified and counters match the simulated curve', () => {
  const now = Date.parse('2026-10-14T08:00:00Z');
  const data = makeStaticDashboard(now);
  assert.equal(data.latest.source, 'browser-demo');
  assert.equal(data.latest.enteredToday, data.trend.reduce((sum, point) => sum + point.entered, 0));
  assert.equal(data.latest.occupancy, data.latest.enteredToday - data.latest.exitedToday);
  assert.ok(data.trend.every(point => point.time <= now && point.occupancy >= 0));
  assert.equal(staticContent.bookingUrl, null);
});
test('static demo does not carry previous-day samples across Shanghai midnight', () => {
  const data = makeStaticDashboard(Date.parse('2026-10-14T16:01:00Z'));
  assert.equal(data.day, '2026-10-15');
  assert.equal(data.trend.length, 1);
});
