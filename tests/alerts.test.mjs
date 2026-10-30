// Alert planning & grouping, history compaction. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEvents, notFired, splitDue, groupDue, groupIncoming, summarizeWaves, MIN_AHEAD, DUE_WINDOW, INCOMING_GROUP_MS } from '../lib/alerts.js';
import { compactRows, compactHistory, snapshotCities, prunePlayers, pruneGains, HIST_MAX, HIST_DAYS } from '../lib/history.js';
import { mergeSettings } from '../lib/shared.js';

const H = 3.6e6, D = 864e5;
const NOW = new Date(2026, 9, 31, 15, 0, 0).getTime();
const city = (key, res, extra = {}) => ({ key, name: `C${key}`, seenAt: NOW, res, ...extra });

test('computeEvents: full / empty / queue / training / trade, only future events', () => {
  const settings = mergeSettings({ alerts: { trade: true } });
  const cities = {
    '1:1': city('1:1', { wood: { v: 900, cap: 1000, rate: 100 }, food: { v: 100, cap: 1000, rate: -50 } }, { queue: { endsAt: NOW + 2 * H } }),
    '2:2': city('2:2', { wood: { v: 1000, cap: 1000, rate: 100 } }) // already full → no event
  };
  const movements = {
    serverOffset: 0,
    training: [{ id: 7, queue: [{ unit: 'ranger', count: 10, done: 0, perUnitMs: 60000, startAt: NOW }] }],
    armies: [{ id: 'a1', trade: true, order: 'trade', arriveAt: NOW + H }, { id: 'a2', trade: true, order: 'return', arriveAt: NOW + H }]
  };
  const ev = computeEvents({ cities, settings, movements }, NOW);
  const names = ev.map((e) => e.name);
  assert.ok(names.includes('full|1:1|wood'));
  assert.ok(names.includes('empty|1:1|food'));
  assert.ok(names.includes('queue|1:1'));
  assert.ok(names.includes('train|7'));
  assert.ok(names.includes('trade|a1'));
  assert.ok(!names.includes('trade|a2'), 'returning carts are not announced');
  assert.ok(!names.some((n) => n.startsWith('full|2:2')), 'an already full warehouse is not scheduled');
  assert.ok(ev.every((e) => e.when > NOW + MIN_AHEAD));
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].when <= ev[i].when, 'sorted by time');
});

test('one alarm is enough for 200 cities (browsers cap alarms at ~500)', () => {
  const settings = mergeSettings({});
  const cities = {};
  for (let i = 0; i < 200; i++) cities[`${i}:0`] = city(`${i}:0`, { wood: { v: 0, cap: 1000, rate: 10 + i }, stone: { v: 0, cap: 1000, rate: 20 }, iron: { v: 0, cap: 1000, rate: 30 }, food: { v: 500, cap: 1000, rate: -5 } }, { queue: { endsAt: NOW + H } });
  const ev = computeEvents({ cities, settings, movements: null }, NOW);
  assert.ok(ev.length > 500); // the old code would have needed this many alarms
  const { due, rest } = splitDue(ev, ev[0].when);
  assert.ok(due.length >= 1 && due.length + rest.length === ev.length);
});

test('splitDue fires events inside the window together; notFired stops re-firing', () => {
  const plan = [{ name: 'a', when: NOW }, { name: 'b', when: NOW + DUE_WINDOW - 1 }, { name: 'c', when: NOW + DUE_WINDOW + 1000 }];
  const { due, rest } = splitDue(plan, NOW);
  assert.deepEqual(due.map((e) => e.name), ['a', 'b']);
  assert.deepEqual(rest.map((e) => e.name), ['c']);
  const fired = { b: NOW + DUE_WINDOW - 1 };
  assert.deepEqual(notFired(plan, fired).map((e) => e.name), ['a', 'c']);
  // the same subject much later (e.g. the warehouse fills up again tomorrow) is announced again
  assert.equal(notFired([{ name: 'b', when: NOW + D }], fired).length, 1);
});

test('groupDue: one full entry per city with all its resources', () => {
  const g = groupDue([
    { kind: 'full', key: '1:1', res: 'wood' }, { kind: 'full', key: '1:1', res: 'stone' }, { kind: 'full', key: '2:2', res: 'iron' },
    { kind: 'queue', key: '1:1' }, { kind: 'queue', key: '1:1' }, { kind: 'train', key: '7' }
  ]);
  assert.deepEqual([...g.full.entries()], [['1:1', ['wood', 'stone']], ['2:2', ['iron']]]);
  assert.deepEqual(g.queue, ['1:1']);
  assert.deepEqual(g.train, ['7']);
});

test('groupIncoming: waves of one attacker on one city share a notification', () => {
  const wave = (id, extra = {}) => ({ id, order: 'attack', owner: 'Evil', toX: 10, toY: 10, fromX: 1, fromY: 1, arriveAt: NOW + H, target: { name: 'Home' }, ...extra });
  let r = groupIncoming(null, [wave('w1'), wave('w2', { order: 'siege', fromX: 2 })], NOW);
  assert.equal(r.changed.length, 1);
  const gid = r.changed[0];
  assert.equal(r.state.groups[gid].waves.length, 2);
  // the same armies again: nothing new
  r = groupIncoming(r.state, [wave('w1'), wave('w2')], NOW + 2000);
  assert.equal(r.changed.length, 0);
  // a third wave a few minutes later joins the same group (same notification id)
  r = groupIncoming(r.state, [wave('w3', { arriveAt: NOW + H + 5 * 60000 })], NOW + 3 * 60000);
  assert.deepEqual(r.changed, [gid]);
  assert.equal(r.state.groups[gid].waves.length, 3);
  // another attacker on the same city, or the same attacker on another city → separate notifications
  r = groupIncoming(r.state, [wave('x1', { owner: 'Other' }), wave('y1', { toX: 20 })], NOW + 4 * 60000);
  assert.equal(r.changed.length, 2);
  assert.ok(!r.changed.includes(gid));
  // the same attacker much later → a new notification
  r = groupIncoming(r.state, [wave('w9')], NOW + 4 * 60000 + INCOMING_GROUP_MS + 1000);
  assert.equal(r.changed.length, 1);
  assert.notEqual(r.changed[0], gid);
  const s = summarizeWaves(r.state.groups[gid].waves);
  assert.equal(s.orders, 'attack ×2, siege');
  assert.equal(s.from, '1:1, 2:1');
  assert.equal(s.first, NOW + H);
  assert.equal(s.last, NOW + H + 5 * 60000);
});

test('history: hourly for the last week, one point per day before that, 60 days max', () => {
  const rows = [];
  for (let t = NOW - 70 * D; t <= NOW; t += H) rows.push([t, 100, 50, 1000, 2000, 3000, 4000, 500, 9999]);
  const c = compactRows(rows, NOW);
  assert.ok(c.length <= HIST_MAX, `${c.length} rows`);
  assert.ok(c.length < rows.length / 5, 'at least 5× smaller');
  assert.ok(c[0][0] >= NOW - (HIST_DAYS + 1) * D, 'nothing older than 60 days');
  assert.equal(c[c.length - 1][0], NOW, 'the newest point is kept as is');
  const daily = c.filter((r) => r[0] < NOW - 8 * D);
  assert.ok(daily.every((r) => new Date(r[0]).getHours() === 12), 'daily points at local noon (cities line up in the charts)');
  assert.deepEqual(daily[5].slice(1), [100, 50, 1000, 2000, 3000, 4000, 500, 9999], 'averages of equal values');
  for (let i = 1; i < c.length; i++) assert.ok(c[i - 1][0] < c[i][0], 'sorted, no duplicates');
  // compacting again changes nothing
  assert.deepEqual(compactRows(c, NOW), c);
  assert.deepEqual(compactHistory({ a: rows, b: [] }, NOW), { a: c });
});

test('history: a daily point averages rates and keeps the last score', () => {
  const day = new Date(2026, 9, 1).getTime();
  const rows = [[day + 1 * H, 10, 5, 100, 0, 0, 0, 0, 0], [day + 2 * H, 20, 6, 300, 0, 0, 0, 0, 0]];
  const [r] = compactRows(rows, NOW);
  assert.equal(r[0], day + 12 * H);
  assert.deepEqual(r.slice(1, 4), [20, 6, 200]);
});

test('snapshotCities adds one point per hour and compacts', () => {
  const cities = { '1:1': city('1:1', { wood: { v: 0, cap: 100, rate: 10 } }) };
  let h = snapshotCities({}, cities, NOW);
  assert.equal(h['1:1'].length, 1);
  h = snapshotCities(h, cities, NOW + 10 * 60000);
  assert.equal(h['1:1'].length, 1, 'not twice in the same hour');
  h = snapshotCities(h, cities, NOW + H);
  assert.equal(h['1:1'].length, 2);
});

test('prunePlayers / pruneGains forget old entries only', () => {
  const players = {
    Old: { name: 'Old', seenAt: NOW - 200 * D, cities: { '1:1': { seenAt: NOW - 200 * D } } },
    Mixed: { name: 'Mixed', seenAt: NOW, cities: { '2:2': { seenAt: NOW - 100 * D }, '3:3': { seenAt: NOW - D } } }
  };
  const p = prunePlayers(players, NOW);
  assert.deepEqual(Object.keys(p), ['Mixed']);
  assert.deepEqual(Object.keys(p.Mixed.cities), ['3:3']);
  assert.equal(prunePlayers(p, NOW), null, 'nothing to do → null');
  const g = pruneGains({ a: [{ at: NOW - 40 * D }], b: [{ at: NOW - 40 * D }, { at: NOW - D }] }, NOW);
  assert.deepEqual(g, { b: [{ at: NOW - D }] });
});
