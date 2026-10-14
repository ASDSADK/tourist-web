export const PARK_ID = 'zhangjiajie-demo';
export const CAPACITY = 30000; // Demonstration parameter, not an official capacity.
export const chinaDay = time => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
export const emptyState = () => ({ latest: null, points: [] });

export function validateSnapshot(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
  const { parkId, sessionId, sequence, sampledAt, source, enteredToday, exitedToday, occupancy } = value;
  if (parkId !== PARK_ID) throw new Error('Unknown parkId');
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(sessionId)) throw new Error('Invalid sessionId');
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('Invalid sequence');
  if (!['ue-simulation', 'local-simulation'].includes(source)) throw new Error('Invalid simulation source');
  if (typeof sampledAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(sampledAt) || !Number.isFinite(Date.parse(sampledAt))) throw new Error('sampledAt must include a timezone');
  if (Math.abs(Date.parse(sampledAt) - now) > 120000) throw new Error('Clock differs by more than 120 seconds');
  for (const count of [enteredToday, exitedToday, occupancy]) {
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000000) throw new Error('Invalid count');
  }
  // Demo protocol assumes an empty park at midnight and counts entry/exit person-times.
  if (exitedToday > enteredToday || occupancy !== enteredToday - exitedToday) throw new Error('Counts do not balance');
  return { parkId, sessionId, sequence, sampledAt: new Date(sampledAt).toISOString(), source, enteredToday, exitedToday, occupancy };
}

export function applySnapshot(state, value, now = Date.now()) {
  const snapshot = validateSnapshot(value, now);
  const previous = state.latest;
  if (previous) {
    if (snapshot.sessionId === previous.sessionId && snapshot.sequence <= previous.sequence) return { state, accepted: false, reason: 'duplicate-or-old-sequence' };
    if (Date.parse(snapshot.sampledAt) <= Date.parse(previous.sampledAt)) return { state, accepted: false, reason: 'old-timestamp' };
    if (chinaDay(snapshot.sampledAt) === chinaDay(previous.sampledAt)) {
      if (snapshot.source !== previous.source) throw new Error('Restart with a separate data store to switch simulation source');
      if (snapshot.enteredToday < previous.enteredToday || snapshot.exitedToday < previous.exitedToday) throw new Error('Daily cumulative counts cannot decrease');
    }
  }
  const bucket = Math.floor(Date.parse(snapshot.sampledAt) / 300000) * 300000;
  let points = state.points.filter(point => point.bucket >= now - 7 * 86400000);
  const point = { ...snapshot, bucket };
  if (points.at(-1)?.bucket === bucket) points = [...points.slice(0, -1), point];
  else points = [...points, point];
  return { state: { latest: snapshot, points }, accepted: true };
}

export function publicState(state, now = Date.now()) {
  const day = chinaDay(now);
  const today = state.points.filter(point => chinaDay(point.sampledAt) === day);
  const trend = today.map((point, index) => {
    const previous = today[index - 1];
    // No invented first interval, or interpolation across missing intervals.
    const continuous = previous && point.bucket - previous.bucket === 300000;
    return { time: point.bucket, entered: continuous ? point.enteredToday - previous.enteredToday : null, exited: continuous ? point.exitedToday - previous.exitedToday : null, occupancy: point.occupancy };
  });
  const latest = state.latest;
  return { parkId: PARK_ID, day, capacity: CAPACITY, latest, stale: !latest || now - Date.parse(latest.sampledAt) > 30000, sameDay: !!latest && chinaDay(latest.sampledAt) === day, trend };
}
