# LoU Revival Helper (browser extension: Chrome · Edge · Firefox · Safari)

🇬🇧 English · [Bahasa Indonesia](README.id.md)

Version 1.18.0 · made by **ardhie** · ardhie.andro@gmail.com

A helper for **Lord of Ultima: Revival** (lordofultima.me):

1. **City Overview**: resources, capacity, production per hour, when the warehouse fills up or food runs out, and the build queue status of every city. Includes desktop notifications and a **🔁 Transfer** plan that suggests resource shipments between your cities (amount, carts, travel time).
2. **Layout Planner**: a 21×21 map identical to the game (walls, towers, roads, Town Hall, water cities). Production is calculated with the official game formulas. The active city's layout syncs automatically from the game, with real building levels and the build queue (share strings from the City planner are accepted too). Includes **🧠 Recommendation** (an optimizer that places production, processing buildings & Cottages around natural nodes for maximum output: max wood/stone/iron/food, balanced, or a custom ratio; optionally removes natural nodes when each node adds production above a threshold), a "best tiles" heatmap, plan vs city comparison (what to build/demolish), per-building levels, **📋 build steps** (what to demolish/build/upgrade, in order, with cost & time), **🧩 templates** (military city with max recruit speed for a unit group and a troop-space target, storage/trade hub, economy), **⚖️ side-by-side comparison** of two plans, undo/redo, and share-string export that can be *Import*ed directly in the game.
3. **Movements**: all moving armies (raid/return/attack/support…, cargo, countdown), ⚠️ incoming attacks (desktop notification), trade/Market convoys (outgoing, returning, incoming deliveries), and the troop training queue + troops in each city.
4. **Dungeons & Bosses**: every dungeon/boss loaded on the Region map is saved automatically (level & explored %); guardians/max loot are filled in when its panel is opened. Includes filters, distance to the nearest city, a raid calculator (carrying units, travel time, loot per hour), and raid notes/statistics. **🎯 Raid Planner**: pick a city and get the nearest dungeons that fit its troops, the number of troops per dungeon (Revival formulas), loot per hour, and how many raids until 100% explored — troops are split automatically. The list shows which dungeons are being raided, an estimated current explored %, and a ⭐ priority score.
5. **📈 Statistics**: raid loot per day and per city, total production, score and troops per city over time (recorded hourly).
6. **👥 Players**: players & alliances seen on the map, your relation tags & notes, and the incoming-attack history per player.
7. **📜 Cheat Sheet**: *Dungeons*, *Bosses*, *Recruit %*, *Troops Stats*, and *Layouts* tabs (military city layouts, Land & Sea/Water). Minimum/recommended troops for every dungeon and boss type & level (calculated from the Revival game formulas, including Explored %), raid & boss calculators (losses, loot, kill chance), recruit speed per unit (your city's recruit speed % is filled in automatically from its synced layout), and the stats of every unit. **🧱 Buildings** (cost & build time per level with your construction speed) and **⚔️ Battle** (attack/defense simulator with the game's combat rules). The community cheat sheet tables (classic LoU) are available as a reference too.
8. **🎯 Operations**: attack planner (send times so waves land together, continent/Frigate checks) and defense assistant (which cities can still support an attacked city, battle estimate). **🎩 Set Ministers**: the Build, Defense, War and Trade minister settings of every city on one screen, with recommendations and an *Apply to game* button.

## Preview

**City Overview — list table**

![City Overview — list table](docs/screenshots/city-overview.png)

**City Layout Planner — auto-synced in-game layout with real levels**

![City Layout Planner — auto-synced in-game layout with real levels](docs/screenshots/layout-planner.png)

**Movements & Training**

![Movements & Training](docs/screenshots/movements.png)

## Installation

Every browser gets its own package (all built from the same source, see *Development*):

| Browser | File | Minimum version |
|---|---|---|
| Google Chrome (also Brave, Opera, Vivaldi) | `lou-helper-<version>-chrome.zip` | Chrome 111 |
| Microsoft Edge | `lou-helper-<version>-edge.zip` | Edge 111 |
| Mozilla Firefox | `lou-helper-<version>-firefox.xpi` | Firefox 128 |
| Apple Safari (macOS) | `lou-helper-<version>-safari.zip` | Safari 17 + Xcode |

After installing in any browser: pin the castle icon in the toolbar, then open (or refresh) the game tab. The dashboard opens from the extension popup.

### Google Chrome
1. Extract `lou-helper-<version>-chrome.zip` into a folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the extracted folder (the one that contains `manifest.json`).
4. Click the puzzle icon 🧩 → pin **LoU Revival Helper**.

To update: overwrite the folder with the new version, then click ↻ on the extension card.

### Microsoft Edge
1. Extract `lou-helper-<version>-edge.zip` into a folder.
2. Open `edge://extensions` and turn on **Developer mode** (left sidebar, or bottom left).
3. Click **Load unpacked** and select the extracted folder.
4. Click the puzzle icon 🧩 → the eye icon next to **LoU Revival Helper** to show it in the toolbar.

To update: overwrite the folder, then click **Reload** on the extension card. If Edge shows a "turn off developer-mode extensions" warning at startup, choose to keep it.

### Mozilla Firefox
Firefox only installs add-ons permanently when they are signed by Mozilla.

**Try it out (temporary, removed when Firefox closes)**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `lou-helper-<version>-firefox.xpi` (or the `manifest.json` inside the extracted `firefox` folder).

**Permanent install**
- *Signed .xpi (recommended):* sign the package once as an unlisted (self-distributed) add-on at [addons.mozilla.org](https://addons.mozilla.org/developers/) — or with `npx web-ext sign --channel=unlisted --source-dir dist/firefox --api-key … --api-secret …` — then drag the signed `.xpi` onto a Firefox window and click **Add**.
- *Firefox Developer Edition / Nightly / ESR only:* set `xpinstall.signatures.required` to `false` in `about:config`, then `about:addons` → ⚙️ → **Install Add-on From File…** → pick the `.xpi`.

**Allow access to the game (required).** Firefox does not grant website access automatically. Click the extension icon and press **Allow access to lordofultima.me**, or go to `about:addons` → LoU Revival Helper → **Permissions** and turn on *lordofultima.me*. Then refresh the game tab.

To update: load/install the new `.xpi` (a temporary add-on: click **Reload** in `about:debugging`).

### Apple Safari (macOS)
Safari only runs extensions that are packaged in a macOS app, so you build that app once with Xcode (free, from the Mac App Store).

1. Extract `lou-helper-<version>-safari.zip` into a folder, e.g. `~/lou-helper-safari`.
2. In Terminal run:
   ```sh
   xcrun safari-web-extension-converter ~/lou-helper-safari --app-name "LoU Revival Helper" --bundle-identifier id.ardhie.louhelper --macos-only
   ```
   Xcode opens the generated project.
3. In Xcode select the app target → **Signing & Capabilities** → choose your **Team** (a free *Personal Team* works), then **Product → Run** (⌘R). The small helper app starts; you can close it.
4. In Safari: **Settings → Advanced** → turn on **Show features for web developers** (older Safari: *Show Develop menu in menu bar*), then **Develop → Allow Unsigned Extensions** (needed again after every Safari restart unless the app is signed with a paid developer account).
5. **Settings → Extensions** → tick **LoU Revival Helper**, then under *Edit Websites* set **lordofultima.me** to **Allow**.
6. Refresh the game tab.

Desktop notifications (full warehouse, incoming attacks) are not available in Safari — the warnings still show in the dashboard and popup. To update: replace the folder contents, run the converter again (or just **Product → Run** in the existing project after copying the new files into it).

## Usage
- **City data:** open the game and switch to each city once. Also open the city list (click the city name at the top left) so all cities are recorded.
- **Queue finish times:** open the *Construction* panel once per city.
- **Dungeons:** on the *Region* tab, click a dungeon or boss icon. A small "Saved" message appears.
- **City layouts:** synced automatically for all cities at once. They appear in the Layout Planner as "🏰 city name — in-game state" (read-only). Click *Duplicate* to make an editable plan.
- The dashboard opens from the extension popup, or right-click the icon and choose *Options* (Firefox: *Manage Extension* → *Preferences*).

## Language
Settings → 🌐 Language: Bahasa Indonesia, English, Español, Français, Deutsch, Italiano, Magyar, Ελληνικά, or **Follow game language** (uses the language selected in the game). Building names & game terms keep the in-game names.

## Building icons
Building icons & names in the Layout Planner are taken from the game when you open the **Build bar**, **Guide → Your city & the grid** (natural nodes), and the **Town Hall** panel. Icons are stored locally in the browser (not bundled with the extension); until they are captured, emoji are used as a fallback.

## Safety
The extension **reads** data that is already on the game page (on-screen text and the game's own city data). It does not click anything and does not automate gameplay. There is one exception, and it only happens when you click it and confirm: **🎩 Set Ministers → Apply to game** sends minister settings (Build, Defense, War, Trade, and switching a minister on or off) with the same commands the game's own Ministers screen uses. Nothing else is ever sent to the game. All data is stored locally in your browser's extension storage (`chrome.storage` / `browser.storage`).

## Notes
- Layouts from a share string carry no levels (assumed level 10); auto-synced layouts use the real levels. Research bonuses are estimated from the city's real production.
- Unit carry, base speed and power in Settings come from the Revival game data. Minutes/field are calibrated automatically from your troop movements (can be turned off in Settings).
- Gold is account-wide in Revival (every city shows the total of all cities), so it is never summed over cities.
- City data is read language-independently: resources, build queue and troops of all cities come from the game data; production/h and capacity from the resource bar of the active city.
- If the game's interface changes (updates), the data readers may need adjusting. The logic lives in `content.js`.

## Development
Node 18+. The source folder itself is the Chrome/Edge extension (load it unpacked, no build needed); Firefox and Safari need a small build step.

- `npm install` — once (esbuild for the Firefox/Safari background bundle, web-ext for the Firefox lint).
- `npm run build` — builds `dist/chrome`, `dist/edge`, `dist/firefox` and `dist/safari` plus `dist/lou-helper-<version>-<browser>.zip` (Firefox: `.xpi`). One browser only: `node tools/build.mjs firefox`.
- `npm run lint:firefox` — checks the Firefox package with Mozilla's linter.
- `npm test` — tests for the game formulas (production, storage, troop space, recruit %), layout templates, build order, operations & ministers, and the translation check (every UI text must exist in all language files; `node tests/i18n-check.mjs --unused` also lists keys no longer found in the code).

What the build changes per browser: Firefox gets a background *event page* (bundled `background.js`) and a `browser_specific_settings.gecko` id; Safari gets a classic background service worker, no `notifications` permission, and the page hook is injected by `content.js` instead of a `world: "MAIN"` content script. `lib/compat.js` maps `chrome.*` to `browser.*` where needed.

## Credit
- Made by **ardhie** — ardhie.andro@gmail.com
- Suggestions, bug reports, or feature ideas: send an email and include the extension version.
- LoU Revival Helper is a player-made tool and is not affiliated with the developers of *Lord of Ultima: Revival*. The game name, icons, and other assets belong to their respective owners.

## Change Log
See [CHANGELOG.md](CHANGELOG.md) (Indonesian: [CHANGELOG.id.md](CHANGELOG.id.md)), or the **ℹ️ About → 📝 Change Log** tab in the dashboard.
