// Translation check (used by `npm test`): every UI text must exist in every dictionary, with the same
// {placeholders} and <tags>. More commands (rename a text everywhere, list/prune unused keys): tools/i18n.mjs
import { check, unused } from '../tools/i18n.mjs';

const problems = await check();
if (process.argv.includes('--unused')) {
  const list = await unused();
  console.log(`\nUnused keys (${list.length}) — remove with: node tools/i18n.mjs prune --yes`);
  for (const k of list) console.log(`   · ${JSON.stringify(k)}`);
}
process.exit(problems ? 1 : 0);
