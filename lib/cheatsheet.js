// Cheat Sheet data.
// REV_* = values from the Lord of Ultima: Revival client (game rules, extracted from the game bundle).
// COMMUNITY = community cheat sheet tables (classic LoU numbers, as shared by players).

// ---------- Revival: units ----------
// atk, def [infantry, cavalry, magic, artillery], spd = minutes per field, carry, space, cost, food/day, sec = base recruit seconds
export const REV_UNITS = [
  { id: 'cityguard', name: 'City Guard', type: 'infantry', atk: 10, def: [10, 10, 10, 10], spd: 0, carry: 0, space: 0, cost: { wood: 100 }, food: 2, sec: 50, bld: 'City Guard House', lvl: 1, eff: 'none' },
  { id: 'berserker', name: 'Berserker', type: 'infantry', atk: 50, def: [15, 12, 10, 15], spd: 20, carry: 10, space: 1, cost: { iron: 150 }, food: 6, sec: 200, bld: 'Training Ground', lvl: 1, eff: 'infantry' },
  { id: 'ranger', name: 'Ranger', type: 'infantry', atk: 30, def: [40, 10, 25, 15], spd: 20, carry: 10, space: 1, cost: { wood: 160 }, food: 3, sec: 250, bld: 'Training Ground', lvl: 4, eff: 'infantry' },
  { id: 'guardian', name: 'Guardian', type: 'infantry', atk: 10, def: [30, 50, 20, 15], spd: 20, carry: 20, space: 1, cost: { iron: 140, gold: 40 }, food: 3, sec: 300, bld: 'Training Ground', lvl: 10, eff: 'infantry' },
  { id: 'templar', name: 'Templar', type: 'infantry', atk: 25, def: [20, 30, 50, 15], spd: 20, carry: 10, space: 1, cost: { iron: 90, gold: 100 }, food: 3, sec: 350, bld: 'Trinsic Temple', lvl: 1, eff: 'infantry' },
  { id: 'scout', name: 'Scout', type: 'cavalry', atk: 10, def: [10, 10, 10, 10], spd: 8, carry: 0, space: 2, cost: { iron: 40, gold: 120 }, food: 5, sec: 300, bld: 'Stable', lvl: 1, eff: 'none', castle: true },
  { id: 'crossbowman', name: 'Crossbowman', type: 'cavalry', atk: 40, def: [40, 90, 30, 40], spd: 10, carry: 15, space: 2, cost: { wood: 150, gold: 200 }, food: 10, sec: 600, bld: 'Stable', lvl: 5, eff: 'cavalry' },
  { id: 'knight', name: 'Knight', type: 'cavalry', atk: 90, def: [40, 30, 20, 40], spd: 10, carry: 15, space: 2, cost: { iron: 250, gold: 100 }, food: 25, sec: 500, bld: 'Stable', lvl: 10, eff: 'cavalry' },
  { id: 'paladin', name: 'Paladin', type: 'cavalry', atk: 60, def: [50, 20, 90, 40], spd: 10, carry: 20, space: 2, cost: { iron: 200, gold: 160 }, food: 15, sec: 700, bld: 'Trinsic Temple', lvl: 6, eff: 'cavalry' },
  { id: 'mage', name: 'Mage', type: 'magic', atk: 70, def: [15, 10, 30, 15], spd: 20, carry: 5, space: 1, cost: { iron: 50, gold: 150 }, food: 5, sec: 600, bld: 'Moonglow Tower', lvl: 1, eff: 'magic' },
  { id: 'warlock', name: 'Warlock', type: 'magic', atk: 120, def: [30, 20, 50, 40], spd: 10, carry: 10, space: 2, cost: { iron: 100, gold: 350 }, food: 20, sec: 1300, bld: 'Moonglow Tower', lvl: 7, eff: 'magic' },
  { id: 'ram', name: 'Ram', type: 'artillery', atk: 50, def: [20, 20, 20, 50], spd: 30, carry: 0, space: 10, cost: { wood: 500, iron: 300 }, food: 50, sec: 2500, bld: 'Workshop', lvl: 1, eff: 'artillery', castle: true, note: 'structure 250' },
  { id: 'ballista', name: 'Ballista', type: 'artillery', atk: 50, def: [200, 100, 200, 400], spd: 30, carry: 0, space: 10, cost: { wood: 400, iron: 600 }, food: 25, sec: 3500, bld: 'Workshop', lvl: 6, eff: 'artillery' },
  { id: 'catapult', name: 'Catapult', type: 'artillery', atk: 150, def: [100, 100, 200, 50], spd: 30, carry: 0, space: 10, cost: { wood: 300, stone: 600, iron: 200 }, food: 50, sec: 4000, bld: 'Workshop', lvl: 10, eff: 'artillery', castle: true, note: 'building 250' },
  { id: 'sloop', name: 'Sloop', type: 'artillery', atk: 1200, def: [4500, 4500, 2000, 6000], spd: 5, carry: 1500, space: 100, cost: { wood: 6000, iron: 4000, gold: 2000 }, food: 300, sec: 25000, bld: 'Shipyard', lvl: 1, eff: 'naval', naval: true },
  { id: 'frigate', name: 'Frigate', type: 'artillery', atk: 3000, def: [4000, 4000, 2000, 2000], spd: 5, carry: 1000, space: 100, cost: { wood: 15000, iron: 5000, gold: 5000 }, food: 500, sec: 40000, bld: 'Shipyard', lvl: 6, eff: 'naval', naval: true, note: 'transport 500' },
  { id: 'war_galleon', name: 'War Galleon', type: 'artillery', atk: 12000, def: [5000, 5000, 2500, 6000], spd: 5, carry: 3000, space: 400, cost: { wood: 30000, iron: 10000, gold: 20000 }, food: 2500, sec: 80000, bld: 'Shipyard', lvl: 10, eff: 'naval', naval: true, note: 'structure/building 4000' },
  { id: 'baron', name: 'Baron', type: 'infantry', atk: 10, def: [100, 50, 20, 10], spd: 40, carry: 0, space: 1, cost: { iron: 50000, gold: 100000 }, food: 100, sec: 60000, bld: 'Trinsic Temple', lvl: 10, eff: 'none', note: '+ Barracks 1' }
];
export const unitById = (id) => REV_UNITS.find((u) => u.id === id);

// Dungeon efficiency of each unit class per dungeon kind
export const EFF = {
  infantry: { mountain: 1, hill: 0.67, forest: 0.67, sea: 0 },
  cavalry: { forest: 1, hill: 0.67, mountain: 0.67, sea: 0 },
  magic: { hill: 1, forest: 0.67, mountain: 0.67, sea: 0 },
  artillery: { forest: 0.5, hill: 0.5, mountain: 0.5, sea: 0 },
  naval: { sea: 1, forest: 0, hill: 0, mountain: 0 },
  none: { sea: 0, forest: 0, hill: 0, mountain: 0 }
};

// ---------- Revival: dungeons ----------
const OL = [100, 600, 2400, 8500, 26000, 61000, 120000, 215000, 350000, 540000];
const MW = [100, 700, 3000, 10000, 31500, 72500, 146000, 259000, 429000, 657000];
const half = (a) => a.map((v) => Math.round(v * 0.5));
export const DUNGEON_GOLD = [2, 1.2, 0.8, 0.5, 0.35, 0.3, 0.28, 0.27, 0.26, 0.25];
export const REV_DUNGEONS = {
  mountain: { name: 'Mountain Dungeon', weak: 'infantry', strength: half(MW), loot: MW, split: { wood: 16.7, stone: 10, iron: 56.6, food: 16.7 }, monsters: [['Orc', 30], ['Troglodyte', 40], ['Ettin', 120], ['Minotaur', 250]] },
  forest: { name: 'Forest Dungeon', weak: 'cavalry', strength: half(OL), loot: OL, split: { wood: 40, stone: 16, iron: 24, food: 20 }, monsters: [['Giant Spider', 25], ['Thief', 33], ['Centaur', 70], ['Troll', 290]] },
  hill: { name: 'Hill Dungeon', weak: 'magic', strength: half(OL), loot: OL, split: { wood: 20, stone: 36, iron: 24, food: 20 }, monsters: [['Skeleton', 25], ['Ghoul', 33], ['Gargoyle', 135], ['Daemon', 340]] },
  sea: { name: 'Pirate Hideout', weak: 'naval', strength: half(OL), loot: OL, split: { wood: 30, stone: 15, iron: 30, food: 25 }, monsters: [['Pirate Dhow', 75], ['Pirate Sloop', 250], ['Pirate Frigate', 650], ['Pirate War Galleon', 1400]] }
};
export const DUNGEON_KINDS = ['mountain', 'forest', 'hill', 'sea'];
export const DUNGEON_UNITS = { land: ['berserker', 'ranger', 'guardian', 'templar', 'crossbowman', 'knight', 'paladin', 'mage', 'warlock'], sea: ['sloop', 'frigate', 'war_galleon'] };

// Strength & loot multiplier by explored % (0..100)
export function progressMult(p) {
  const e = Math.min(100, Math.max(0, p));
  return e <= 50 ? 1 + e / 100 : e <= 75 ? 1.5 + (e - 50) / 50 : 2 + (e - 75) / 25;
}
export function dungeonLevel(kind, level, progress = 0) {
  const d = REV_DUNGEONS[kind], r = level - 1, m = progressMult(progress);
  const strength = d.strength[r] * m, loot = Math.max(1, Math.round(d.loot[r] * m));
  return { strength, loot, goldPct: DUNGEON_GOLD[r], gold: Math.round(loot * DUNGEON_GOLD[r]) };
}
export const unitEff = (u, kind) => EFF[u.eff]?.[kind] ?? 0.67;
// One raid with `count` of a single unit → losses, loot, gold, explore gain (expected values, ±5% random strength)
export function raid(kind, level, progress, u, count) {
  const L = dungeonLevel(kind, level, progress);
  const atk = count * u.atk * unitEff(u, kind);
  if (atk <= 0) return { atk, ...L, lossFrac: 1, lost: count, carried: 0, goldGot: 0, explore: 0 };
  const lossFrac = Math.min(1, 0.1 * (atk >= L.strength ? L.strength / atk : Math.sqrt(L.strength / atk)));
  const lost = Math.round(count * lossFrac);
  const capacity = (count - lost) * u.carry;
  const carried = Math.min(L.loot, capacity);
  const goldGot = Math.min(Math.round(carried * L.goldPct), capacity * 2);
  const explore = Math.min(100 - progress, Math.round(2.5 * (carried / L.loot) * 100) / 100);
  return { atk, ...L, lossFrac, lost, carried, goldGot, explore };
}
// Recommended units: enough attack to match strength (≤10% losses) AND enough carry for full loot after losses
export function dungeonNeed(kind, level, progress, u) {
  const L = dungeonLevel(kind, level, progress);
  const eff = unitEff(u, kind);
  if (!u.carry || !eff) return null;
  const byAtk = Math.ceil(L.strength / (u.atk * eff));
  let n = Math.max(byAtk, Math.ceil(L.loot / u.carry));
  for (let i = 0; i < 200 && raid(kind, level, progress, u, n).carried < L.loot; i++) n = Math.ceil(n * 1.01) + 1;
  // shrink back to the smallest count that still carries everything
  let lo = Math.max(byAtk, Math.ceil(L.loot / u.carry)), hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (raid(kind, level, progress, u, mid).carried >= L.loot) hi = mid; else lo = mid + 1; }
  return { n: hi, byAtk, byCarry: Math.ceil(L.loot / u.carry), lossFrac: raid(kind, level, progress, u, hi).lossFrac };
}

// ---------- Revival: bosses ----------
export const BOSS_HP = [625, 3750, 25000, 50000, 125000, 187500, 250000, 375000, 562500, 750000];
export const BOSS_LOOT = [500, 3000, 20000, 40000, 100000, 150000, 200000, 300000, 450000, 600000];
export const BOSS_GOLD = [2, 1.2, 0.8, 0.5, 0.35, 0.35, 0.3, 0.27, 0.26, 0.05];
export const REV_BOSSES = {
  dragon: { name: 'Dragon', weak: 'cavalry', water: false, split: { wood: 40, stone: 16, iron: 24, food: 20 } },
  hydra: { name: 'Hydra', weak: 'infantry', water: false, split: { wood: 16.7, stone: 10, iron: 56.6, food: 16.7 } },
  moloch: { name: 'Moloch', weak: 'magic', water: false, split: { wood: 20, stone: 36, iron: 24, food: 20 } },
  octopus: { name: 'Kraken', weak: 'artillery', water: true, split: { wood: 30, stone: 15, iron: 30, food: 25 } }
};
export const BOSS_KINDS = ['dragon', 'hydra', 'moloch', 'octopus'];

// What the game's dungeon / boss panel shows, computed from the same game data the game uses (so it works in
// every game language and without opening the panel): dungeon → Guardians = strength[level], Max loot =
// loot[level], Weak to; boss → Health, Loot, Weak to. Checked against the game's own tables (Oct 2026).
const WEAK_TO = { forest: 'Cavalry', hill: 'Magic', mountain: 'Infantry', sea: 'Artillery', dragon: 'Cavalry', hydra: 'Infantry', moloch: 'Magic', octopus: 'Artillery' };
const TYPE_ALIAS = { kraken: 'octopus', pirate: 'sea', 'pirate hideout': 'sea' };
export function panelInfo(d) {
  const raw = String(d?.type || '').toLowerCase().replace(/\s*dungeon\s*/, '').trim();
  const k = TYPE_ALIAS[raw] || raw, r = Math.round(+d?.level || 0) - 1;
  if (r < 0 || r > 9) return null;
  if (REV_DUNGEONS[k] && d.kind !== 'boss') return { kind: k, guardians: REV_DUNGEONS[k].strength[r], maxLoot: REV_DUNGEONS[k].loot[r], weakTo: WEAK_TO[k] };
  if (REV_BOSSES[k]) return { kind: k, hp: BOSS_HP[r], maxLoot: BOSS_LOOT[r], weakTo: WEAK_TO[k] };
  return null;
}
// fill what is missing (values typed in by hand are kept)
export function withPanelInfo(d) {
  const p = panelInfo(d);
  if (!p) return d;
  const out = { ...d };
  if (out.guardians == null && p.guardians != null) out.guardians = p.guardians;
  if (out.maxLoot == null) out.maxLoot = p.maxLoot;
  if (!out.weakTo) out.weakTo = p.weakTo;
  if (p.hp != null && out.hp == null) out.hp = p.hp;
  return out;
}
export const BOSS_UNITS = { land: DUNGEON_UNITS.land, sea: DUNGEON_UNITS.sea };
const bossMul = (b, u) => (b.weak === u.type ? 1.5 : 1);
// Kill chance for `count` units (full HP boss)
export function bossFight(kind, level, u, count) {
  const b = REV_BOSSES[kind], hp = BOSS_HP[level - 1];
  if (!!u.naval !== b.water) return { chance: 0, lossFrac: 1 };
  const power = count * u.atk * bossMul(b, u);
  const M = power / (4 * hp);
  const chance = M >= 1 ? 1 : M < 0.25 ? 2 * M : Math.sqrt(M);
  const A = (hp * (b.weak === u.type ? 2 / 3 : 1)) / (count * u.atk);
  const lossFrac = Math.min(1, (chance >= 1 ? 0.1 : 0.1 * chance + 0.5 * (1 - chance)) * (A <= 1 ? A : Math.sqrt(A)));
  const loot = Math.min(BOSS_LOOT[level - 1], count * u.carry);
  const gold = Math.min(Math.round(loot * BOSS_GOLD[level - 1]), count * u.carry * 2);
  return { power, need: 4 * hp, chance, lossFrac, loot, gold };
}
export function bossNeed(kind, level, u) {
  const b = REV_BOSSES[kind];
  if (!!u.naval !== b.water) return null;
  const n = Math.ceil((4 * BOSS_HP[level - 1]) / (u.atk * bossMul(b, u)) - 1e-9);
  return { n, ...bossFight(kind, level, u, n), carryN: u.carry ? Math.ceil(BOSS_LOOT[level - 1] / u.carry) : null };
}

export const RECRUIT_GROUPS = [
  { bld: 'City Guard House', units: ['cityguard'] },
  { bld: 'Training Ground', units: ['berserker', 'ranger', 'guardian'] },
  { bld: 'Stable', units: ['scout', 'crossbowman', 'knight'] },
  { bld: 'Moonglow Tower', units: ['mage', 'warlock'] },
  { bld: 'Trinsic Temple', units: ['templar', 'paladin', 'baron'] },
  { bld: 'Workshop', units: ['ram', 'ballista', 'catapult'] },
  { bld: 'Shipyard', units: ['sloop', 'frigate', 'war_galleon'] }
];
export const RECRUIT_BLD_PCT = [5, 10, 16, 24, 35, 50, 68, 90, 115, 150]; // recruit speed % per building level
export const recruitTime = (sec, pct) => sec * 100 / (100 + Math.max(0, pct));
export const pctFor = (sec, target) => (sec <= target ? 0 : Math.ceil((sec / target - 1) * 100));
// Practical ceiling: 100 recruitment buildings at level 10 (150% each). Targets needing more are shown as "—".
export const RECRUIT_CAP = 15000;
export const fastestSec = (sec) => sec * 100 / (100 + RECRUIT_CAP);
// Tables split like the community sheet: each block starts at the first time that is reachable.
// unit = 1 (seconds) or 60 (minutes); cols = number of columns
export const RECRUIT_BLOCKS = [
  { units: ['cityguard', 'berserker', 'ranger', 'guardian', 'scout', 'crossbowman', 'knight', 'mage', 'warlock', 'templar', 'paladin'], unit: 1, from: 1, cols: 20 },
  { units: ['ram'], unit: 1, cols: 22 },
  { units: ['ballista'], unit: 1, cols: 22 },
  { units: ['catapult'], unit: 1, cols: 22 },
  { units: ['baron', 'sloop', 'frigate', 'war_galleon'], unit: 60, cols: 20 }
].map((b) => {
  const from = b.from ?? Math.ceil(Math.min(...b.units.map((id) => fastestSec(unitById(id).sec))) / b.unit);
  return { ...b, from, times: Array.from({ length: b.cols }, (_, i) => (from + i) * b.unit) };
});
// Unit names used by the community sheet → in-game names
export const SHEET_NAMES = { Cityguard: 'City Guard', Vanquisher: 'Berserker', Ranger: 'Ranger', Triari: 'Guardian', Scout: 'Scout', Arbalist: 'Crossbowman', Horseman: 'Knight', Sorcerer: 'Mage', Druid: 'Warlock', Priestess: 'Templar', Praetor: 'Paladin', Senator: 'Baron', Ram: 'Ram', Ballista: 'Ballista', Scorpion: 'Catapult', Stinger: 'Sloop', Galley: 'Frigate', Warship: 'War Galleon' };

// ---------- Community cheat sheet (classic LoU numbers) ----------
const _ = null;
export const COMMUNITY = {
  dungeons: {
    split: { forest: [40, 16, 24, 20], hill: [20, 36, 24, 20], mountain: [16.7, 10, 56.7, 16.7], sea: [30, 15, 30, 25] },
    weak: { mountain: 'Infantry', forest: 'Cavalry', hill: 'Magic', sea: 'Artillery' },
    units: {
      mountain: [
        ['Berserker', [15, 75, 350, 900, 3000, 6800, 15000, 25000, 40000, 60000]],
        ['Ranger', [7, 32, 146, 375, 1250, 2834, 6250, 10417, 25000, 35000]],
        ['Guardian', [3, 13, 59, 150, 500, 1134, 2500, 4167, 13000, 15000]]
      ],
      forest: [
        ['Berserker', [15, 65, 250, 850, 2500, 5000, 12000, 20000, 35000, 50000]],
        ['Ranger', [6, 26, 100, 340, 1000, 2000, 4800, 8000, 20000, 30000]],
        ['Guardian', [5, 20, 75, 255, 750, 1500, 3600, 6000, 12000, 15000]],
        ['Paladin', [8, 33, 125, 425, 1250, 2500, 6000, 10000, 17500, 25000]],
        ['Knight', [10, 44, 167, 567, 1667, 3334, 8000, 13334, 23334, 33334]]
      ],
      hill: [
        ['Berserker', [15, 65, 250, 850, 2500, 5000, 12000, 20000, 35000, 50000]],
        ['Ranger', [5, 25, 100, 340, 1000, 2000, 4800, 8000, 20000, 30000]],
        ['Guardian', [5, 20, 75, 255, 750, 1500, 3600, 6000, 12000, 15000]],
        ['Mage', [30, 130, 500, 1700, 5000, 10000, 24000, 40000, 70000, 100000]],
        ['Warlock', [15, 65, 250, 850, 2500, 5000, 12000, 20000, 35000, 50000]]
      ],
      sea: [
        ['Sloop', [1, 1, 4, 8, 18, 34, 80, 130, 200, 350]],
        ['Frigate', [1, 1, 2, 4, 9, 17, 40, 65, 100, 175]],
        ['War Galleon', [_, _, _, _, 45, _, _, 330, _, _]]
      ]
    },
    stats: [
      ['Max loot', ['320', '>977', '>4240', '>15488', '>32249', '>56850', '>117175', '>198205', '>296975', '>441375']],
      ['Gold/loot', ['200%', '120%', '80%', '50%', '35%', '30%', '28%', '27%', '26%', '25%']],
      ['Max foes', ['10', '40', '117', '444', '1183', '2181', '4687', '8351', '14162+', '17655+']],
      ['Max loot/foe', ['30', '30', '30', '30', '40', '25(?)', '25(?)', '31.75', '25', '25(?)']]
    ]
  },
  bosses: {
    stats: [
      ['Max Loot', [500, 3000, 20000, 40000, 100000, 150000, 200000, 300000, 450000, 600000]],
      ['Gold Loot', ['200%', '120%', '80%', '50%', '35%', '35%', '30%', '27%', '26%', '5%']],
      ['Max Gold', [1000, 3600, 16000, 20000, 35000, 52500, 60000, 81000, 117000, 30000]]
    ],
    weak: { hydra: 'Infantry', dragon: 'Cavalry', moloch: 'Magic', octopus: 'Artillery' },
    units: {
      dragon: [
        ['Berserker', [50, 300, 2000, 4000, 10000, 15000, 20000, 30000, 45000, 60000]],
        ['Ranger', [84, 500, 3334, 6667, 16667, 25000, 33334, 50000, 75000, 100000]],
        ['Guardian', [250, 1500, 10000, 20000, 50000, 75000, 100000, 150000, 225000, 300000]],
        ['Crossbowman', [42, 250, 1700, 3300, 8300, 12500, 17000, 25000, 37500, 50000]],
        ['Knight', [19, 112, 756, 1467, 3689, 5556, 7556, 11112, 16667, 22223]],
        ['Templar', [36, 215, 1429, 2858, 7143, 10715, 14286, 21429, 32143, 42858]],
        ['Paladin', [21, 125, 834, 1667, 4167, 6250, 8334, 12500, 18750, 25000]],
        ['Mage', [100, 600, 4000, 8000, 20000, 30000, 40000, 60000, 90000, 120000]],
        ['Warlock', [28, 167, 1134, 2200, 5534, 8334, 11334, 16667, 25000, 33334]]
      ],
      hydra: [
        ['Berserker', [34, 200, 1360, 2640, 6640, 10000, 13600, 20000, 30000, 40000]],
        ['Ranger', [56, 334, 2267, 4400, 11067, 16667, 22667, 33334, 50000, 66667]],
        ['Guardian', [168, 1000, 6800, 13200, 33200, 50000, 68000, 100000, 150000, 200000]],
        ['Crossbowman', [63, 375, 2500, 5000, 12500, 18750, 25000, 37500, 56250, 75000]],
        ['Knight', [28, 167, 1112, 2223, 5556, 8334, 11112, 16667, 25000, 33334]],
        ['Templar', [36, 215, 1429, 2858, 7143, 10715, 14286, 21429, 32143, 42858]],
        ['Paladin', [21, 125, 834, 1667, 4167, 6250, 8334, 12500, 18750, 25000]],
        ['Mage', [68, 400, 2720, 5280, 13280, 20000, 27200, 40000, 60000, 80000]],
        ['Warlock', [42, 250, 1667, 3334, 8334, 12500, 16667, 25000, 37500, 50000]]
      ],
      moloch: [
        ['Berserker', [50, 300, 2000, 4000, 10000, 15000, 20000, 30000, 45000, 60000]],
        ['Ranger', [84, 500, 3334, 6667, 16667, 25000, 33334, 50000, 75000, 100000]],
        ['Guardian', [250, 1500, 10000, 20000, 50000, 75000, 100000, 150000, 225000, 300000]],
        ['Crossbowman', [63, 375, 2500, 5000, 12500, 18750, 25000, 37500, 56250, 75000]],
        ['Knight', [28, 167, 1112, 2223, 5556, 8334, 11112, 16667, 25000, 33334]],
        ['Templar', [24, 143, 972, 1886, 4743, 7143, 9715, 14286, 21429, 28572]],
        ['Paladin', [14, 84, 567, 1100, 2767, 4167, 5667, 8334, 12500, 16667]],
        ['Mage', [100, 600, 4000, 8000, 20000, 30000, 40000, 60000, 90000, 120000]],
        ['Warlock', [42, 250, 1667, 3334, 8334, 12500, 16667, 25000, 37500, 50000]]
      ],
      octopus: [
        ['Sloop', [2, 9, 57, 110, 277, 417, 567, 834, 1250, 1667]],
        ['Frigate', [1, 4, 23, 44, 111, 167, 227, 334, 500, 667]],
        ['War Galleon', [1, 1, 6, 11, 28, 42, 57, 84, 125, 167]]
      ]
    }
  },
  // Recruit speed % needed for a given time per unit (seconds). from = first column (sec).
  recruit: [
    { from: 1, rows: [
      ['Cityguard', [3334, 2001, 1430, 1112, 910, 770, 668, 589, 527, 477, 436, 401, 371, 346, 324, 304, 287, 271, 257]],
      ['Vanquisher', [13334, 8001, 5715, 4445, 3637, 3078, 2668, 2354, 2106, 1906, 1740, 1601, 1482, 1380, 1291, 1213, 1144, 1082, 1027]],
      ['Ranger', [16668, 10001, 7144, 5557, 4546, 3847, 3334, 2942, 2633, 2382, 2175, 2001, 1853, 1725, 1614, 1516, 1430, 1352, 1283]],
      ['Triari', [20001, 12001, 8572, 6668, 5456, 4616, 4001, 3530, 3159, 2858, 2610, 2401, 2223, 2070, 1936, 1829, 1715, 1623, 1539]],
      ['Scout', [20001, 12001, 8572, 6668, 5456, 4616, 4001, 3530, 3159, 2858, 2610, 2401, 2223, 2070, 1936, 1829, 1715, 1623, 1539]],
      ['Arbalist', [_, _, _, 13334, 10910, 9232, 8001, 7060, 6317, 5715, 5218, 4801, 4445, 4139, 3872, 3637, 3430, 3244, 3078]],
      ['Horseman', [_, 20001, 14287, 11112, 9092, 7693, 6668, 5883, 5264, 4763, 4349, 4001, 3705, 3449, 3227, 3031, 2858, 2704, 2565]],
      ['Sorcerer', [_, _, 17144, 13334, 10910, 9232, 8001, 7060, 6317, 5715, 5218, 4801, 4445, 4139, 3872, 3637, 3430, 3244, 3078]],
      ['Druid', [_, _, _, _, _, _, 17334, 15295, 13685, 12382, 11305, 10401, 9631, 8967, 8388, 7880, 7430, 7028, 6668]],
      ['Priestess', [_, 14001, 10001, 7779, 6365, 5386, 4668, 4119, 3685, 3334, 3044, 2801, 2594, 2415, 2259, 2122, 2001, 1893, 1796]],
      ['Praetor', [_, _, _, 15557, 12728, 10770, 9334, 8236, 7369, 6668, 6088, 5601, 5186, 4829, 4517, 4243, 4001, 3785, 3591]]
    ] },
    { from: 22, rows: [['Ram', [11112, 10639, 10205, 9805, 9435, 9092, 8773, 8476, 8198, 7938, 7693, 7464, 7246, 7043, 6850, 6668, 6495]]] },
    { from: 34, rows: [['Ballista', [10146, 9860, 9590, 9334, 9092, 8862, 8643, 8435, 8236, 8047, 7866, 7693, 7528, 7369, 7217, 7072, 6932, 6797, 6668, 6543, 6423, 6307]]] },
    { from: 39, rows: [['Scorpion', [10128, 9878, 9640, 9413, 9196, 8990, 8792, 8603, 8422, 8248, 8082, 7922, 7768, 7620, 7478, 7340, 7208, 7081, 6958, 6839, 6724, 6613]]] }
  ]
};

// ---------- Community military layouts (cotgopt.com planner links) ----------
// row: [target time, TS, speed (needed), # buildings, layout MAX, layout raid, backup, recruit time]
// Codes transcribed from the community sheet.
export const LAYOUT_URL = (code) => `http://cotgopt.com/${code}`;
const L = (s) => s.trim().split('\n').map((l) => l.split('|').map((x) => x.trim()));
export const LAYOUTS = {
  land: [
    { unit: 'berserker', rows: L(`
1 sec|184(192)k|13 500 (13334)|51|uA9r|sA9r|1|51 h / 2,1 days
2 sec|260(296)k|8 175 (8001)|25|aF9r|yz9r|2|144 h / 6 days
3 sec|296(328)k|5 825 (5715)|17|tF9r|Sz9r|3|247 h / 10,3 days
4 sec|312(344)k|4 600 (4445)|13|bG9r|1F9r|4|347 h / 14,4 days
5 sec|320(352)k|3 950 (3637)|11|KG9r|CG9r|5|444 h / 18,5 days`) },
    { unit: 'ranger', rows: L(`
2 sec|228(260)k|10 025 (10001)|34|wH9r|pH9r|6|127 h / 5,3 days
3 sec|276(308)k|7 150 (7144)|22|cI9r|0H9r|7|230 h / 9,6 days
4 sec|296(328)k|5 825 (5557)|17|CI9r|vI9r|8|329 h / 13,7 days
5 sec|312(344)k|4 600 (4546)|13|cJ9r|1I9r|9|433 h / 18 days
6 sec|320(352)k|3 950 (3847)|11|JJ9r|GJ9r|10|533 h / 22,2 days`) },
    { unit: 'guardian', rows: L(`
2 sec|184(220)k|12 150 (12001)|44|hmas|Plas|11|102 h / 4,3 days
3 sec|252(284)k|8 600 (8572)|28|Qmas|mypD|12|210 h / 8,8 days
4 sec|280(316)k|6 900 (6668)|20|Fnas|snas|13|311 h / 13 days
5 sec|300(332)k|5 475 (5456)|16|boas|2nas|14|417 h / 17,4 days`) },
    { unit: 'scout', rows: L(`
3 sec|260k|8 575 (8572)|28|Oras||15|108 h / 4,5 days
4 sec|288k|6 850 (6668)|21|esas||16|160 h / 6,7 days
5 sec|308k|5 475 (5456)|16|Rsas||17|214 h / 8,9 days`) },
    { unit: 'crossbowman', rows: L(`
6 sec|240(276)k|9 400 (9232)|30|Utas|utas|18|200 h / 8,3 days
7 sec|260(296)k|8 175 (8001)|25|puas|cuas|19|253 h / 10,5 days
8 sec|276(308)k|7 175 (7060)|22|7uas|Vuas|20|307 h / 12,8 days`) },
    { unit: 'knight', rows: L(`
4 sec|224 (X)k|11 250 (11112)|39|ZtAD|o38u|21|124 h / 5,2 days
5 sec|244(276)k|9 150 (9092)|30|Aaas|NuXx|22|169 h / 7,1 days
6 sec|268(300)k|7 700 (7693)|24|Sbas|ubas|23|223 h / 9,3 days
7 sec|280(316)k|6 850 (6668)|20|ycas|mcas|24|272 h / 11,3 days
8 sec|292(324)k|6 075 (5883)|17|guAD|hdas|25|324 h / 13,5 days`) },
    { unit: 'mage', rows: L(`
4 sec|180(192)k|13 360 (13334)|51|OXuw|X28u|26|200 h / 8,3 days
5 sec|216(244)k|10 950 (10910)|38|UB9r|yB9r|27|300 h / 12,5 days
6 sec|244(276)k|9 425 (9232)|30|NC9r|vC9r|28|407 h / 16,9 days
7 sec|264(296)k|8 200 (8001)|25|UD9r|DD9r|29|513 h / 21,4 days
8 sec|280(308)k|7 200 (7060)|22|wE9r|kE9r|30|622 h / 25,9 days`) },
    { unit: 'warlock', rows: L(`
10 sec|200(216)k|12 475 (12382)|45|DYuw|Tlnw|31|278 h / 11,6 days
11 sec|216(236)k|11 400 (11305)|40|0CEv|ICEv|32|330 h / 13,8 days
14 sec|248(280)k|9 175 (8967)|29|Dias|rias|33|482 h / 20 days
15 sec|260(288)k|8 400 (8388)|27|4ias|Zias|34|542 h / 22,6 days
16 sec|268(296)k|7 950 (7880)|25|ljas|wjas|35|596 h / 24,8 days
17 sec|276(304)k|7 450 (7430)|23|okas|fkas|36|652 h / 27,2 days
18 sec|280(312)k|7 200 (7028)|21|5uAD|Hkas|37|700 h / 29,2 days`) },
    { unit: 'templar', rows: L(`
3 sec|228(260)k|10 025 (10001)|34|cccs|6bcs|38|190 h / 7,9 days
4 sec|264(296)k|7 800 (7779)|25|pccs|lccs|39|293 h / 12,2 days
5 sec|288(320)k|6 400 (6365)|19|Mccs|Dccs|40|400 h / 16,7 days
6 sec|300(332)k|5 425 (5386)|16|fdcs|Vccs|41|500 h / 20,8 days
7 sec|308(340)k|4 900 (4668)|14|ydcs|rdcs|42|599 h / 25 days`) },
    { unit: 'paladin', rows: L(`
6 sec|212(248)k|10 925 (10770)|37|gecs|becs|43|177 h / 7,4 days
7 sec|240(272)k|9 375 (9334)|31|uecs|qecs|44|233 h / 9,7 days
8 sec|256(292)k|8 425 (8236)|26|Tecs|Kecs|45|284 h / 11,9 days
9 sec|272(304)k|7 425 (7369)|23|bfcs|5ecs|46|340 h / 14,2 days
10 sec|280(316)k|6 875 (6668)|20|lfcs|tfcs|47|389 h / 16,2 days`) },
    // Ram/Catapult: label = ram time / catapult time; mix 4:1 catapult:ram → extra fields cats, rams
    { unit: 'ram_catapult', units: ['ram', 'catapult'], mix: true, rows: L(`
20 s/32 s|196k|12 325 (12196/12309)|45|YNcs|15680|3920|161 h / 6,7 days|48
24 s/39 s|236k|10 325 (10205/10128)|36|NICw|18880|4720|236 h / 9,8 days|49
28 s/44 s|260k|8 975 (8773/8990)|29|pics|20800|5200|294 h / 12,3 days|50
30 s/48 s|272k|8 250 (8198/8248)|26|Eics|21760|5440|335 h / 14 days|51
32 s/52 s|280k|7 750 (7693/7620)|25|Xics|22400|5600|373 h / 15,6 days|52
35 s/56 s|288k|7 200 (7043/7081)|22|gics|23040|5760|414 h / 17,3 days|53`) },
    { unit: 'ballista', rows: L(`
29 sec|204k|11 875 (11865)|43|Lgcs||54|164 h / 6,8 days
33 sec|232k|10 550 (10449)|36|2Wuw||55|213 h / 8,9 days
37 sec|252k|9 350 (9334)|31|Qgcs||56|259 h / 10,8 days
39 sec|260k|8 975 (8862)|29|9gcs||57|282 h / 11,7 days
42 sec|272k|8 250 (8236)|26|phcs||58|317 h / 13,2 days
45 sec|280k|7 700 (7693)|24|Lhcs||59|350 h / 14,6 days`) }
  ],
  // water cities: [target time, TS, speed, layout, recruit time]
  water: [
    { unit: 'berserker', rows: L(`
2 sec|220k|8 150 (8001)|eTcs|316 h / 13,2 days
3 sec|260k|5 800 (5715)|6Ucs|434 h / 18,2 days
4 sec|280k|4 475 (4445)|vVcs|532 h / 22,2 days`) },
    { unit: 'ranger', rows: L(`
2 sec|176k|10 075 (10001)|xWcs|253 h / 10,5 days
3 sec|236k|7 250 (7144)|6pOD|394 h / 16,4 days
4 sec|260k|5 800 (5557)|eXcs|494 h / 20,6 days
5 sec|276k|4 800 (4546)|uXcs|588 h / 24,5 days`) },
    { unit: 'guardian', rows: L(`
3 sec|212k|8 600 (8572)|WYcs|353 h / 14,7 days
4 sec|244k|6 750 (6668)|9Ycs|463 h / 19,3 days
5 sec|264k|5 550 (5456)|rZcs|563 h / 23,5 days`) },
    { unit: 'scout', rows: L(`
3 sec|224k|8 600 (8572)|i0cs|296 h / 12,3 days
4 sec|256k|6 750 (6668)|w0cs|367 h / 15,3 days
5 sec|276k|5 550 (5456)|J0cs|429 h / 17,9 days`) },
    { unit: 'crossbowman', rows: L(`
6 sec|196k|9 350 (9232)|01cs|326 h / 13,6 days
7 sec|220k|8 150 (8001)|h5cs|392 h / 16,3 days
8 sec|236k|7 250 (7060)|q5cs|448 h / 18,7 days`) },
    { unit: 'knight', rows: L(`
5 sec|200k|9 200 (9092)|B6cs|310 h / 12,9 days
6 sec|228k|7 700 (7693)|P6cs|381 h / 15,9 days
7 sec|244k|6 800 (6668)|06cs|435 h / 18,1 days`) },
    { unit: 'mage', rows: L(`
6 sec|204k|9 275 (9232)|37cs|482 h / 20,1 days
7 sec|224k|8 150 (8001)|p8cs|580 h / 24,2 days
8 sec|240k|7 250 (7060)|m8cs|678 h / 28,3 days`) },
    { unit: 'templar', rows: L(`
4 sec|224k|7 975 (7779)|r9cs|425 h / 17,7 days
5 sec|248k|6 550 (6365)|E9cs|528 h / 22 days
6 sec|264k|5 550 (5386)|R9cs|624 h / 26 days`) },
    { unit: 'paladin', rows: L(`
7 sec|196k|9 350 (9334)|aads|349 h / 14,5 days
8 sec|216k|8 375 (8236)|gads|411 h / 17,1 days
9 sec|232k|7 475 (7369)|pads|467 h / 19,5 days
10 sec|244k|6 750 (6668)|Dads|519 h / 21,6 days`) },
    { unit: 'war_galleon', rows: L(`
"Normal"|340k|1 900|l0cs|994 h / 41,4 days`) },
    { unit: 'sloop', rows: L(`
Non self-fed|340k|1 900|l0cs|1242 h / 51,8 days`) }
  ]
};

// ---------- Recruit speed % of a real city (from its synced layout) ----------
// Game rule: sum of the recruit-speed effect of every recruitment building of the group,
// + for each of them, every bordering Barracks (8 neighbours) adds its secondary effect (except City Guard House).
export const RECRUIT_CODES = ['K', 'G', 'E', 'J', 'Z', 'Y', 'V']; // same order as RECRUIT_GROUPS
export const BARRACKS_BOOST = [1, 2, 4, 6, 8, 10, 13, 16, 20, 25];
export function cityRecruitPct(layout) {
  const out = RECRUIT_CODES.map(() => ({ pct: 0, n: 0, maxLvl: 0, barracks: 0 }));
  if (!layout?.cells) return out;
  const cells = layout.cells, lv = layout.levels || [], W = 21;
  for (let i = 0; i < W * W; i++) {
    const g = RECRUIT_CODES.indexOf(cells[i]);
    if (g < 0) continue;
    const l = Math.min(10, Math.max(1, lv[i] || 1));
    const o = out[g];
    o.pct += RECRUIT_BLD_PCT[l - 1]; o.n++; o.maxLvl = Math.max(o.maxLvl, l);
    if (g === 0) continue; // City Guard House gets no Barracks boost
    const x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      const j = ny * W + nx;
      if (cells[j] === 'B') { const bl = Math.min(10, Math.max(1, lv[j] || 1)); o.pct += BARRACKS_BOOST[bl - 1]; o.barracks++; }
    }
  }
  return out;
}
