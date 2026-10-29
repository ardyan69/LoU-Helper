# LoU Revival Helper (Chrome extension)

🇬🇧 English · [Bahasa Indonesia](README.id.md)

Version 1.12.0 · made by **ardhie** · ardhie.andro@gmail.com

A helper for **Lord of Ultima: Revival** (lordofultima.me):

1. **City Overview**: resources, capacity, production per hour, when the warehouse fills up or food runs out, and the build queue status of every city. Includes desktop notifications.
2. **Layout Planner**: a 21×21 map identical to the game (walls, towers, roads, Town Hall, water cities). Production is calculated with the official game formulas. The active city's layout syncs automatically from the game, with real building levels and the build queue (share strings from the City planner are accepted too). Includes **🧠 Recommendation** (an optimizer that places production, processing buildings & Cottages around natural nodes for maximum output: max wood/stone/iron/food, balanced, or a custom ratio; optionally removes natural nodes when each node adds production above a threshold), a "best tiles" heatmap, plan vs city comparison (what to build/demolish), per-building levels, undo/redo, and share-string export that can be *Import*ed directly in the game.
3. **Movements**: all moving armies (raid/return/attack/support…, cargo, countdown), ⚠️ incoming attacks (desktop notification), trade/Market convoys (outgoing, returning, incoming deliveries), and the troop training queue + troops in each city.
4. **Dungeons & Bosses**: every dungeon/boss loaded on the Region map is saved automatically (level & explored %); guardians/max loot are filled in when its panel is opened. Includes filters, distance to the nearest city, a raid calculator (carrying units, travel time, loot per hour), and raid notes/statistics. **🎯 Raid Planner**: pick a city and get the nearest dungeons that fit its troops, the number of troops per dungeon (Revival formulas), loot per hour, and how many raids until 100% explored — troops are split automatically.
5. **📜 Cheat Sheet**: *Dungeons*, *Bosses*, *Recruit %*, *Troops Stats*, and *Layouts* tabs (military city layouts, Land & Sea/Water). Minimum/recommended troops for every dungeon and boss type & level (calculated from the Revival game formulas, including Explored %), raid & boss calculators (losses, loot, kill chance), recruit speed per unit (your city's recruit speed % is filled in automatically from its synced layout), and the stats of every unit. The community cheat sheet tables (classic LoU) are available as a reference too.

## Preview

**City Overview — list table**

![City Overview — list table](docs/screenshots/city-overview.png)

**City Layout Planner — auto-synced in-game layout with real levels**

![City Layout Planner — auto-synced in-game layout with real levels](docs/screenshots/layout-planner.png)

**Movements & Training**

![Movements & Training](docs/screenshots/movements.png)

## Installation
1. Extract the ZIP into a folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `lou-helper` folder.
4. Pin the castle icon in the toolbar. Open/refresh the game tab.

To update: overwrite the folder with the new version, then click ↻ on the extension card.

## Usage
- **City data:** open the game and switch to each city once. Also open the city list (click the city name at the top left) so all cities are recorded.
- **Queue finish times:** open the *Construction* panel once per city.
- **Dungeons:** on the *Region* tab, click a dungeon or boss icon. A small "Saved" message appears.
- **City layouts:** synced automatically for all cities at once. They appear in the Layout Planner as "🏰 city name — in-game state" (read-only). Click *Duplicate* to make an editable plan.
- The dashboard opens from the extension popup, or right-click the icon and choose *Options*.

## Language
Settings → 🌐 Language: Bahasa Indonesia, English, Español, Français, Deutsch, Italiano, Magyar, Ελληνικά, or **Follow game language** (uses the language selected in the game). Building names & game terms keep the in-game names.

## Building icons
Building icons & names in the Layout Planner are taken from the game when you open the **Build bar**, **Guide → Your city & the grid** (natural nodes), and the **Town Hall** panel. Icons are stored locally in the browser (not bundled with the extension); until they are captured, emoji are used as a fallback.

## Safety
The extension only **reads** data that is already on the game page (on-screen text and the city data being displayed). It does not click anything, does not send commands to the game server, and does not automate actions. All data is stored locally in `chrome.storage` in your browser.

## Notes
- Layouts from a share string carry no levels (assumed level 10); auto-synced layouts use the real levels. Research bonuses are estimated from the city's real production.
- Unit carry, base speed and power in Settings come from the Revival game data. Minutes/field are calibrated automatically from your troop movements (can be turned off in Settings).
- City data is read language-independently: resources, build queue and troops of all cities come from the game data; production/h and capacity from the resource bar of the active city.
- If the game's interface changes (updates), the data readers may need adjusting. The logic lives in `content.js`.

## Credit
- Made by **ardhie** — ardhie.andro@gmail.com
- Suggestions, bug reports, or feature ideas: send an email and include the extension version.
- LoU Revival Helper is a player-made tool and is not affiliated with the developers of *Lord of Ultima: Revival*. The game name, icons, and other assets belong to their respective owners.

## Change Log
See [CHANGELOG.md](CHANGELOG.md) (Indonesian: [CHANGELOG.id.md](CHANGELOG.id.md)), or the **ℹ️ About → 📝 Change Log** tab in the dashboard.
