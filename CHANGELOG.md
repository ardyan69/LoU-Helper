# Change Log — LoU Revival Helper

🇬🇧 English · [Bahasa Indonesia](CHANGELOG.id.md)

Made by **ardhie** (ardhie.andro@gmail.com).

## v1.24.2 — 2026-10-31

- 🐞 Fix: no more "Extension context invalidated" error on the game page after the extension is updated or reloaded while the game tab is open. The old copy of the script in that tab now stops quietly (all readers, timers and observers switched off) and asks for F5 if no new copy has taken over.

## v1.24.1 — 2026-10-31

- 📐 Layout Planner: a wider page on large screens and a wider Plan result column; warehouse capacity, total resources and remaining resources now show as a tidy row of icons (no more wrapping in the middle of a number), trade carts/ships with their load per trip on a line of their own.
- 🩺 Diagnostics: every data source that is not OK now has a 👉 hint on what to open in the game so its status fills in, plus an explanation of "Not used yet" / "Attention" / "Problem". The page checks again automatically every 5 seconds while it is open.

## v1.24.0 — 2026-10-31

- ✅ New: To-do tab — one list for all cities, most urgent first: incoming attacks, food running out, full warehouses, empty or almost finished building queues, empty recruitment queues, idle troops, dungeons almost fully explored; every item can be snoozed for 1 or 8 hours, and the number of urgent ones shows in the menu and the popup.
- 🔎 Incoming attacks with hidden troops: the unit type is guessed from the speed (an army moves as fast as its slowest unit) — in Movements and in the notification. 📈 Players: score, 7-day change, active / inactive status from the scores seen on the map, a score chart, and the "Target: inactive & nearest" sorting.
- 🗓️ New: Timeline tab — a Gantt chart per city on one time axis: incoming attacks, troops out & back, trade carts/ships (sent, returning, incoming deliveries), construction and recruitment queues; 3–48 hour range. Layout Planner: Plan result shows trade carts (Marketplace) and trade ships (Harbor) with what they carry per trip, and the total resources for all buildings (from an empty city and still needed from the city as it is now); 🧠 Recommendation now has a mini map of the result, and the tiles of every mini map are real squares.

## v1.23.0 — 2026-10-31

- 🐞 City Overview: the stock of cities not open in the game no longer stands still. The game only keeps each city's stock at one moment (possibly hours ago) and adds production/h itself; the extension now does the same — production/h comes from the city's layout when there is no real number from the game yet (marked ≈). Refresh all cities no longer replaces the game's real production/h with an estimate, no longer overwrites data that just came in, and the Update column now shows when the stock was last exact (↗ = projected), not only when it synced.
- ✨ Interface: grouped menu (City · Military · Intel · Tools), global search Ctrl+K / ⌘K / "/" for cities, players, player cities, dungeons, coordinates, layouts & menu, Alt+1…0 to switch tabs, the server clock in the header, light / dark / follow-system theme (Settings), and a popup with quick links (empty queues, warehouses almost full, defense assistant) — clicking a city in the popup opens it in City Overview, reusing an open dashboard tab.

## v1.22.0 — 2026-10-31

- 🌐 No longer depends on the game language: building & node icons are captured through the game's own icon keys (e.g. building:farm), so they are read in any language; city groups are read from the game state; guardians, max loot & weakness of dungeons/bosses are computed from the game's data tables (the same values the game's panel shows) without opening the panel.
- 🐞 Fix: the military/hub layout templates no longer fail when the area they use is still completely empty.
- 🧰 Development: ESLint and type checking (TypeScript through JSDoc) for lib/ & background; a translation tool (rename a text in every language and in the code at once, detect reworded texts, check placeholders & HTML tags, remove unused keys); the version comes from the Change Log; CI & automatic GitHub releases (packages for every browser + release notes); the extension's name & description show in the browser's language (_locales).

## v1.21.0 — 2026-10-31

- 🩺 New: About → Diagnostics — the status of every source of game data (game state, city data, movements, layouts, map, resource bar, Construction panel, city list, dungeon panel, icons, storage, errors) with when it was last read and details; detects when the game state's structure changed after a game update; Copy report & Send to developer buttons. The "data not updating" banner in City Overview now links here.
- 🌐 More robust against game languages & updates: each city's score and total troops are now read from the game state (before: only from the English city list); the city list and dungeon panels are recognised in any game language (through your own cities' coordinates or dungeons known from the map); numbers with dot, comma or space thousands separators (e.g. French) are read correctly; all game-page selectors & labels are collected in lib/game-dom.js and tested against sample game HTML.

## v1.20.2 — 2026-10-31

- ⚡ Lighter: language dictionaries load on demand (only the active language + English, not all seven), so the popup loads ±160–330 KB of JavaScript instead of ±920 KB and opens about 2× faster; the popup also reads only city, settings & movement data.
- ⚡ The dashboard updates straight from the data that changed instead of re-reading all data every few seconds (about half the work while the game is open), and tabs that are not open are no longer re-rendered.
- ⚡ Less work while the game is open: all cities from one game reading are saved in one write (before: one per city — 80 cities: 240 → 2 writes per 20 seconds), and so are all city layouts (80 → 1); the reader in the game page only rebuilds the parts of the game data that changed, reads every 10 seconds while the game tab is hidden, and slows its search down while the game is not loaded; the background only runs speed calibration, the loot log & notification scheduling when the data they use changed.

## v1.20.1 — 2026-10-31

- 🗄️ Safer storage: the unlimitedStorage permission so big accounts don't hit the browser's 10 MB limit; statistics history is condensed (hourly for 7 days, then one point per day up to 60 days — about 6× smaller); other players' cities not seen on the map for 90 days are forgotten (notes are kept). Settings → Storage shows the usage per kind of data and a Tidy up now button. When saving fails, the data reader no longer stops silently: a message appears in the game and the data is retried.
- ⏰ Notifications use a single alarm (before: one per city × resource, which could exceed the browser's alarm limit on accounts with many cities).
- 🔔 Grouped notifications: incoming attacks become one notification per target city & attacker, updated with every new wave (number of attacks, mission types, arrival time range in local time, stays until closed); warehouse almost full is one notification per city with all its resources; more than 3 cities at once are summarised in one notification.
- 💾 Import backup now restores all data (statistics, players & notes, attack history, loot log, icons), not only cities, dungeons, layouts & settings. The README version line and CHANGELOG.md are now generated from the Change Log and checked by the tests.

## v1.20.0 — 2026-10-30

- 🌿 Layout Planner → 🧠 Recommendation: new goal Automatic from natural nodes (auto ratio). The extension works out the maximum potential of wood, stone, iron and food from the city's natural nodes, uses those potentials as the ratio, and finds the layout with the largest total production. The result shows each resource's potential, the ratio used and the share of the potential reached; food can be included or left out.

## v1.19.0 — 2026-10-30

- 💰 Layout Planner → 🧠 Recommendation: new goal Max gold. Townhouses, Marketplaces and (in water cities) Harbors are arranged for the most gold per hour — every bordering L10 Marketplace adds +20% to a Townhouse, a Harbor +50%. It can rearrange the economy buildings, fill empty plots only, or start from scratch, with the option to clear nodes when each node adds enough gold. The result shows gold/h, the average per Townhouse, carts, and the change in resource production.

## v1.18.1 — 2026-10-30

- 📄 Privacy policy for the Chrome Web Store and other browsers: what data is read, where it is stored (only locally in your browser), what is sent (only minister settings to the game, when you click), why each permission is needed, and how to delete your data. Open it from the popup (Privacy) and About → Security & privacy; also available as PRIVACY.md / PRIVACY.id.md.

## v1.18.0 — 2026-10-30

- 🌐 Now available for Chrome, Edge, Firefox & Safari: one source built per browser with npm run build (Firefox as an .xpi, Safari through the Xcode converter). The popup shows an Allow access button when the browser has not granted access to lordofultima.me yet, notifications are skipped automatically in browsers that do not support them, and the README explains how to install it in each browser.

## v1.17.1 — 2026-10-30

- ⚡ Set Ministers → Apply to game is much faster: all settings are sent at once (not one by one), count as done as soon as the game answers or its data has changed, and the view updates right away. ⚔️ War: max level & raid count are chosen so almost all raiding troops are used (with a loot/h estimate), troops out raiding are counted, raids switch off while an attack is incoming, frontline cities only send attackers, and the radius comes from dungeons around the max level. 🛒 Trade: one hub per continent (carts only travel over land) picked by capacity, carts & position; cities alone on a continent request by sea if they have ships; military cities' food target comes from army upkeep at full TS; a L10 Moonglow Tower purifies surplus; the minimum shipment follows the hub's carts.

## v1.17.0 — 2026-10-30

- 🎩 New Set Ministers menu: Build, Defense, War (automatic raids) & Trade minister settings for every city on one screen — read from the game, editable per city, with recommendations (build plan from the Layout Planner in the smart order, wall, garrison/troop space, raid level & radius from troop strength, trade targets with a hub city), an Apply to game button, and on/off for each minister. This is the first feature that sends something to the game: only minister settings, only when you click and confirm.

## v1.16.1 — 2026-10-30

- 🧰 Layout Planner: Clear nodes button, plan list grouped & sorted (in-game state, plans, military plans, others, empty layouts). City Overview: 🔄 Refresh all cities button (asks the game for the latest data, then computes each city's production/h & capacity from its layout + research), one-line summary cards (+ troops, incoming attacks, cities with negative food), and production/h columns in the List table. Operations: the arrival time input matches the other inputs.

## v1.16.0 — 2026-10-29

- 🎯 New Operations tab → Attack planner: pick a target & cities; send times are worked out so everything lands together or in waves (gap in seconds), with checks for other continents/Frigates, Castle, slowest unit, countdowns, and a plan text to copy.
- 🛡️ Operations → Defense assistant: for each incoming attack, which cities can still send support (units, latest send time, including riding Frigates), a battle estimate with wall/towers/traps & your military research, and the attacker's likely army from their history; a 🛡️ Support button in Movements, plus a simulation mode.
- 🔬 Account research read from the game: Plan result uses production research (wood/stone/iron/food/gold) and Construction; the Town Hall now counts (+300 wood/h & its storage) and the real Town Hall level is synced (more accurate build steps).
- 🌾 Army food balance: City Overview → Army food (production vs upkeep of troops in the city, time until empty, when all troops are home & with full TS) and a food-with-full-TS line in Plan result.

## v1.15.0 — 2026-10-29

- 📋 Smarter build steps: Cottages first when the time saved is larger, the Town Hall only when needed (level & slot requirements), then the step with the largest gain per hour; old buildings are demolished right before their tile is used; times use the construction speed that rises along the way, plus a Gain column and a comparison with the usual order.
- ⚖️ The Comparison card shows the total cost & build time from the city to the plan; the side-by-side table shows the recruit time of each unit.
- 🧩 Templates: a second unit group with a % share, hybrid economy slots (Cottage & Warehouse; hub: Cottage), the mini map marks changed tiles, and the calculation runs in the background with a progress bar & Cancel button.
- 🧪 Automatic tests for game formulas, templates & build order (node --test tests/*.test.mjs), and a translation check (node tests/i18n-check.mjs).

## v1.14.2 — 2026-10-29

- ⚔️ Layout Planner → Plan result: when the plan has military buildings, it shows Troop space (TS), recruit speed % per recruitment building group (including bordering Barracks), and the recruit time of each unit (e.g. Training Ground → Berserker, Ranger, Guardian) with the time to fill TS; locked units show the building level they need.

## v1.14.1 — 2026-10-29

- 🧩 Better military & hub templates: layouts are searched much more thoroughly (higher recruit % and storage), building slots default to 100 (Town Hall L10) instead of the city's current slots, extra Barracks beyond the TS target when they raise recruit %, an option to remove natural nodes, and Harbors for hubs in water cities.

## v1.14.0 — 2026-10-29

- Fix: gold production is no longer summed per city — in Revival gold is already the total of all cities (account).
- 🧩 Layout Planner → Templates: military city (max recruit speed % for one unit group with a troop-space target), hub city (storage & carts), and economy (Recommendation) — also straight from Cheat Sheet → Layouts.
- ⚖️ Layout Planner → Compare side by side: two plans with mini maps and a difference table (production, capacity, recruit %, troop space, carts).

## v1.13.0 — 2026-10-29

- 📈 Statistics tab: charts of raid loot per day, loot per city, total production, score, and troops per city (recorded automatically every hour).
- 👥 Players tab: players & alliances seen on the map, relation status & notes, and incoming attack history per player.
- 🔁 City Overview → Transfer: suggested resource shipments between cities (amount, carts, travel time).
- 📋 Layout Planner → Build steps: ordered demolish/build/upgrade steps from the city to the plan, with cost & time.
- Cheat Sheet → 🧱 Buildings: cost & build time per level (game data) with your city's construction speed; ⚔️ Battle: attack/defense simulator with the game rules.
- Dungeons: marks dungeons being raided, estimated current explored %, a ⭐ Priority column, and max loot estimated from the game formula.
- Two-row dashboard header so all tabs fit.

## v1.12.0 — 2026-10-29

- 🎯 Raid Planner on the Dungeon tab: pick a city and the extension suggests the nearest dungeons that fit its troops, troops per dungeon (Revival formulas), loot per hour, and how many raids until 100% explored.
- Cheat Sheet → Recruit %: recruit speed % is filled in automatically from the city layout (recruitment buildings + bordering Barracks, game formula).
- Automatic speed calibration: each unit's minutes/field is calculated from the troop movements read from the game (can be turned off in Settings).
- City Overview no longer depends on the game language; resources & queues of all cities also update from the game data without opening each city.
- Default raid prepare/unload time is now 0 (Revival raids go straight there and back).

## v1.11.1 — 2026-10-29

- Settings → Units now use real Revival game data: carry, base speed (minutes/field), and power (attack ÷ 50); Sloop, Frigate and War Galleon added. Old settings are upgraded automatically (calibrated speeds are kept).
- README.md and CHANGELOG.md are now in English (Indonesian versions: README.id.md, CHANGELOG.id.md).

## v1.11.0 — 2026-10-29

- Cheat Sheet: new 🏗️ Layouts tab (Land & Sea / Water) with community military city layouts per unit & target recruit time, with cotgopt.com links.
- ⚙️ Revival column: estimated recruit time per unit & time to fill the whole TS in Revival for each layout.

## v1.10.1 — 2026-10-29

- Cheat Sheet → Recruit %: the Game formulas table is split per unit group with reachable time ranges (like the community tables).
- Unit names in the community tables now match the in-game names (Vanquisher → Berserker, Triari → Guardian, etc.).

## v1.10.0 — 2026-10-29

- New tab 📜 Cheat Sheet: Dungeons, Bosses, Recruit %, and Troops Stats.
- Minimum/recommended troops for every dungeon and boss type & level, calculated from the Revival game formulas (strength, max loot, explored %, weakness).
- Raid & boss calculator: losses, loot, gold, kill chance, and explored gain.
- Recruit %: recruit time per unit for your city's recruit speed %, and the % needed for a target time.
- The community cheat sheet tables (classic LoU) are still available as a reference.
- Default Guardian carry capacity fixed to 20 (as in the game).

## v1.9.0 — 2026-10-29

- Language options in Settings: Bahasa Indonesia, English, Español, Français, Deutsch, Italiano, Magyar, Ελληνικά, or follow the game language.
- Dashboard, popup, desktop notifications, and in-game messages follow the selected language.

## v1.8.0 — 2026-10-29

- New ℹ️ About tab: ReadMe, Credit, and Change Log.
- Extension version shown in the dashboard & popup header.

## v1.7.0 — 2026-10-29

- 🚩 Movements tab: all moving troops (mission, cargo, countdown), ⚠️ incoming attacks, trade convoys/Market, and troop training queues.
- Desktop notifications: incoming attacks, training finished, trade shipments arrived.
- All city layouts synced at once (no need to switch cities).
- All dungeons & bosses on the Region map are added to the Dungeon tab automatically.
- Popup: incoming attack warnings & movement summary.

## v1.6.1 — 2026-10-29

- In-game message when a new icon is saved successfully.

## v1.6.0 — 2026-10-29

- Building & natural node icons use the original game icons (Build bar, Guide, Town Hall panel), stored locally.
- Building & node names use English as in the game (Forest, Rocks, Ore Deposit, Lake).

## v1.5.0 — 2026-10-29

- 🧠 Recommendation: option to remove natural nodes when each node adds production above the threshold.

## v1.4.0 — 2026-10-29

- 🧠 Automatic placement recommendation: production, processing & Cottage buildings for maximum production (max per resource, balanced, or custom ratio).
- Result vs current state compared at the same level.

## v1.3.0 — 2026-10-29

- City layouts synced automatically from the game, complete with actual levels & building queue.
- The "in-game state" layout is read-only; Duplicate compares directly with the actual city.
- City research bonus estimated from actual production.
- Building queue finish times are read automatically in City Overview.

## v1.2.1 — 2026-10-29

- Fixed city card display in the popup.

## v1.2.0 — 2026-10-29

- City Overview: choose between Cards, List table, and Detail table views (sortable by column).

## v1.1.1 — 2026-10-29

- After an update, the data reader is re-attached to the game tab automatically (no refresh needed).
- Warning banner when city data is not updating.

## v1.1.0 — 2026-10-29

- Layout Planner v2: 21×21 map identical to the game (walls, roads, Town Hall, water cities).
- Production calculated with the game's official formulas; best-tile heatmap; compare plans; undo/redo.
- Import/export share strings (LoU City Planner) — can be imported directly in the game.

## v1.0.0 — 2026-10-29

- First release: City Overview (resources, capacity, when warehouses fill, queues), Layout Planner, Dungeon tracker & raid calculator.
- Desktop notifications for full warehouse / food running out / queue finished.
