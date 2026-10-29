// Account research read from the game (player.research levels, 0–12). Revival research lines:
// wood / stone / iron / food / gold production, construction speed, trade (carts & ships),
// military strength (attack & defence in battles against cities). There is no recruit-speed research.
// The game applies production research to each resource total (after adjacency bonuses), before troop upkeep.
import { researchPct } from './gamedata.js';

export const RESEARCH_KEYS = ['wood', 'stone', 'iron', 'food', 'gold', 'construction', 'trade', 'military'];
export const researchLevels = (state) => state?.movements?.research || null;
export const rpct = (state, key) => researchPct(researchLevels(state)?.[key] || 0);
// production multipliers per resource (1 = no research known)
export function prodFactors(state) {
  const f = {};
  for (const k of ['wood', 'stone', 'iron', 'food', 'gold']) f[k] = 1 + rpct(state, k) / 100;
  return f;
}
