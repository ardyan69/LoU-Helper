// v1.24 features: unit guess from speed, to-do list, player activity, timeline, plan cost & trade capacity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { guessUnits, SPEED_CLASSES } from '../lib/unitguess.js';
import { buildTodos } from '../lib/todo.js';
import { recordScores, activity, playerTotals } from '../lib/intel.js';
import { buildTimeline, LANES } from '../lib/timeline.js';
import { planCost, tradeInfo } from '../lib/plancost.js';
import { blank, N, TOWNHALL } from '../lib/city.js';

const NOW = Date.UTC(2026, 9, 31, 12);
const H = 3.6e6, D = 864e5, MIN = 60000;

test('unit guess: army speed points to the slowest unit class; sea crossings only fit ships', () => {
  assert.deepEqual(SPEED_CLASSES.map((c) => c.spd).slice(0, 3), [40, 30, 20], 'slowest first');
  // 30 fields at 20 min/field (no bonus) → infantry
  const a = { fromX: 10, fromY: 10, toX: 40, toY: 10, departAt: NOW, arriveAt: NOW + 30 * 20 * MIN };
  const g = guessUnits(a);
  assert.equal(g.best.spd, 20);
  assert.equal(g.best.bonus, 0);
  assert.equal(g.dist, 30);
  // the same army with +50% speed (≈13.3 min/field) still fits infantry best (smaller bonus than siege needs)
  const fast = guessUnits({ ...a, arriveAt: NOW + 30 * (20 / 1.5) * MIN });
  assert.equal(fast.best.spd, 20);
  assert.equal(fast.best.bonus, 50);
  // world speed factor scales the base times
  assert.equal(guessUnits({ ...a, arriveAt: NOW + 30 * 10 * MIN }, 0.5).best.spd, 20);
  // across continents only ships are possible
  const sea = guessUnits({ fromX: 90, fromY: 10, toX: 110, toY: 10, departAt: NOW, arriveAt: NOW + 20 * 5 * MIN });
  assert.ok(sea.water);
  assert.ok(sea.best && SPEED_CLASSES.find((c) => c.spd === sea.best.spd).naval);
  // no times → no guess; impossible speed → no best class
  assert.equal(guessUnits({ ...a, departAt: 0 }), null);
  assert.equal(guessUnits({ ...a, arriveAt: NOW + 30 * 0.5 * MIN }).best, null);
});

function city(key, extra = {}) {
  const [x, y] = key.split(':').map(Number);
  return { key, name: 'C' + key, x, y, seenAt: NOW, ...extra };
}

test('to-do: incoming first, food & full warehouses, empty queue, snooze hides an item', () => {
  const state = {
    settings: { alerts: { fullThreshold: 95 } },
    cities: {
      '1:1': city('1:1', { res: { food: { v: 1000, rate: -1000, cap: 100000 } }, queue: { count: 0 } }),
      '2:2': city('2:2', { res: { wood: { v: 99000, rate: 1000, cap: 100000 } }, queue: { count: 2, endsAt: NOW + 10 * MIN } })
    },
    layouts: [],
    movements: { serverOffset: 0, incoming: [{ id: 1, toX: 2, toY: 2, arriveAt: NOW + 20 * MIN }], armies: [], training: [] }
  };
  const list = buildTodos(state, NOW);
  assert.equal(list[0].kind, 'incoming');
  assert.equal(list[0].key, '2:2');
  const kinds = list.map((x) => x.kind);
  for (const k of ['food', 'full', 'queue', 'queueSoon']) assert.ok(kinds.includes(k), k);
  assert.equal(list.find((x) => x.kind === 'food').sev, 0, 'food gone within 1 h is critical');
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].sev <= list[i].sev, 'sorted by severity');
  const snoozed = buildTodos({ ...state, todoSnooze: { 'queue|1:1': NOW + H } }, NOW);
  assert.ok(!snoozed.some((x) => x.id === 'queue|1:1'));
  assert.ok(buildTodos({ ...state, todoSnooze: { 'queue|1:1': NOW - 1 } }, NOW).some((x) => x.id === 'queue|1:1'), 'expired snooze');
});

test('player activity: history only grows on change (or daily), status active / inactive / unknown', () => {
  const players = (score, seenAt) => ({ Bob: { cities: { a: { score, seenAt }, b: { score: 100, seenAt } } } });
  assert.deepEqual(playerTotals(players(50, NOW)).Bob, { score: 150, cities: 2, seenAt: NOW });
  let h = recordScores({}, players(50, NOW - 5 * D), NOW - 5 * D);
  assert.equal(h.Bob.length, 1);
  assert.equal(recordScores(h, players(50, NOW - 5 * D + H), NOW - 5 * D + H), null, 'unchanged → no write');
  h = recordScores(h, players(50, NOW - 2 * D), NOW - 2 * D) || h; // a day later, same score → one more point
  h = recordScores(h, players(50, NOW), NOW) || h;
  assert.equal(activity(h.Bob, NOW).status, 'inactive');
  h = recordScores(h, players(80, NOW + H), NOW + H);
  const act = activity(h.Bob, NOW + H);
  assert.equal(act.status, 'active');
  assert.equal(act.score, 180);
  assert.equal(activity([], NOW).status, 'unknown');
  // players no longer known are dropped
  assert.deepEqual(recordScores(h, {}, NOW + 2 * H), {});
});

test('timeline: armies, trade (incl. delivery into own city), incoming, recruitment on lanes, clipped to the range', () => {
  const state = {
    cities: { '1:1': city('1:1'), '5:5': city('5:5') },
    layouts: [],
    movements: {
      serverOffset: 1000,
      armies: [
        { id: 1, order: 'raid', home: { x: 1, y: 1, name: 'A' }, toX: 9, toY: 9, departAt: NOW - H, arriveAt: NOW + H, units: { 1: 100 } },
        { id: 2, trade: true, order: 'trade', home: { x: 1, y: 1, name: 'A' }, toX: 5, toY: 5, departAt: NOW, arriveAt: NOW + 30 * MIN, tradeLoad: 5000 },
        { id: 3, order: 'attack', home: { x: 1, y: 1 }, toX: 9, toY: 9, departAt: NOW + 50 * H, arriveAt: NOW + 60 * H }
      ],
      incoming: [{ id: 9, toX: 5, toY: 5, fromX: 7, fromY: 7, owner: 'Eve', departAt: NOW - H, arriveAt: NOW + 2 * H }],
      training: [{ x: 5, y: 5, queue: [] }]
    }
  };
  const tl = buildTimeline(state, { from: NOW - 2 * H, to: NOW + 6 * H, now: NOW });
  const row = (k) => tl.rows.find((r) => r.key === k);
  assert.deepEqual(Object.keys(row('1:1').lanes), LANES);
  assert.equal(row('1:1').lanes.army.length, 1, 'the attack 50 h away is outside the range');
  assert.equal(row('1:1').lanes.army[0].cls, 'raid');
  assert.equal(row('1:1').lanes.army[0].e0, NOW + H - 1000, 'server → local time');
  assert.equal(row('1:1').lanes.trade[0].cls, 'out');
  assert.equal(row('5:5').lanes.trade[0].kind, 'tradeIn');
  assert.equal(row('5:5').lanes.incoming[0].owner, 'Eve');
});

test('plan cost: from an empty city, from the current city; trade carts & ships', () => {
  const p = blank(true);
  const cells = p.cells.split('');
  const free = [...cells.keys()].filter((i) => cells[i] === '-' && i !== TOWNHALL);
  cells[free[0]] = 'P';
  cells[free[1]] = 'R';
  const plan = { ...p, cells: cells.join(''), levels: Array(N * N).fill(10) };
  const full = planCost(plan);
  assert.ok(full.total > 0 && full.time > 0);
  assert.equal(full.orders, 9 + 10 + 10, 'Town Hall 1→10, two buildings 0→10');
  // the same city already built → nothing left
  const done = planCost(plan, { cells: plan.cells, levels: Array(N * N).fill(10) });
  assert.equal(done.total, 0);
  assert.equal(done.orders, 0);
  // half built → cheaper
  const half = planCost(plan, { cells: plan.cells, levels: Array(N * N).fill(5) });
  assert.ok(half.total > 0 && half.total < full.total);
  const tr = tradeInfo(plan);
  assert.ok(tr.carts > 0 && tr.ships > 0);
  assert.equal(tr.cartLoad, tr.carts * 1000);
  assert.equal(tr.shipLoad, tr.ships * 10000);
  assert.deepEqual(tradeInfo(blank(false)), { carts: 0, ships: 0, cartLoad: 0, shipLoad: 0 });
});
