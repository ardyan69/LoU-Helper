# Privacy Policy — LoU Revival Helper

🇬🇧 English · [Bahasa Indonesia](PRIVACY.id.md)

**Effective date:** 30 October 2026 · applies to version 1.18.1 and later

**Developer:** ardhie — ardhie.andro@gmail.com

LoU Revival Helper ("the extension") is a browser extension for Chrome, Edge, Firefox and Safari that helps players of the browser game **Lord of Ultima: Revival** (`lordofultima.me`). Its single purpose is to show and plan your own game data: city overview, layout planner, troop movements, dungeons, operations and minister settings.

**In short:** everything the extension reads is stored **only in your own browser**. The developer has no server, receives none of your data, and does not sell, share, track or advertise. The only thing the extension ever sends anywhere is minister settings you choose to apply, sent to the game itself.

## 1. What data the extension handles

### a) Game data read from lordofultima.me
The extension only runs on pages of `https://lordofultima.me/`. There it reads data that the game already shows you or already holds in the page:

- **Your cities:** names, coordinates, resources, storage capacity, production, buildings and layouts, building levels and build queues.
- **Your army and account progress:** troops, recruitment queues, army movements (raids, attacks, supports, returns), trade convoys, research levels and minister settings.
- **Map data:** dungeons and bosses (type, level, explored %), and other players' cities seen on the map (city name, coordinates, the player's in-game name and alliance tag, score).
- **Incoming attacks:** time, target, attacker's in-game name and visible troops, kept as an attack history.
- **Game interface data:** game icons and building names (to draw the layout planner), the game's language and the server time offset.

The extension does **not** read or store: your password or login details, cookies, session tokens, email address, payment details, in-game chat or messages, or any page outside `lordofultima.me`. It does not record your browsing history.

### b) Data you enter yourself
Layout plans, notes and relation tags for players, raid notes, attack/defense plans, minister drafts, settings (language, notifications, unit values) and the inputs of the dashboard tools.

### c) Derived data
Statistics calculated from the above, such as hourly snapshots of score, troops and production (up to 60 days), raid loot logs and speed calibration.

## 2. How the data is used
Only to provide the features you see in the extension: overviews, calculations, recommendations, countdowns and desktop notifications (for example a full warehouse, an incoming attack, or finished training). It is never used for advertising, profiling, credit or lending decisions, or any purpose unrelated to these features.

## 3. Where the data is stored
- In your browser's extension storage (`chrome.storage.local` / `browser.storage.local`) and, for a few dashboard tool inputs, in the extension page's local storage.
- Data does **not** sync to other devices and is **not** uploaded to any server owned by the developer or anyone else.
- There are no analytics, telemetry, crash reporting, cookies, advertising or third-party scripts.

## 4. What data is sent or shared
- **To the developer:** nothing.
- **To third parties:** nothing. Your data is not sold, rented or transferred.
- **To the game (lordofultima.me):** only when you click **🎩 Set Ministers → Apply to game** and confirm. The extension then sends the minister settings shown in the dialog (Build, Defense, War and Trade minister settings, and switching a minister on or off) over the game's own connection, using the same commands as the game's Ministers screen. Nothing else is ever sent to the game.
- **Backups:** **Settings → Export backup** saves a JSON file to your own device when you click it. Where that file goes afterwards is up to you.
- **External links:** some reference tables link to community websites (for example `cotgopt.com`). They open only when you click them, and those sites have their own privacy policies.

## 5. Permissions and why they are needed

| Permission | Why |
|---|---|
| Access to `https://lordofultima.me/*` | Read game data on the game's pages and apply minister settings when you ask. No other website is accessed. |
| `storage` | Save the data described above locally in your browser. |
| `alarms` | Schedule reminders (full warehouse, finished training, arriving convoys). |
| `notifications` | Show those reminders as desktop notifications (not used in Safari). |
| `scripting` | Re-attach the extension to an already-open game tab after an install or update, so you don't have to reload the game. |

## 6. Keeping and deleting your data
Data stays in your browser until you delete it. You can:
- delete everything at once with **Settings → Delete all data**;
- clear the raid statistics or individual plans from their own screens;
- remove the extension: the browser then deletes all of its stored data.

Because the developer never receives your data, there is nothing stored elsewhere to request, correct or delete.

## 7. Security
Data never leaves your device except for the minister settings described above, which travel over the game's own secure (HTTPS/WSS) connection. The extension contains no remotely loaded code: everything it runs is included in the installed package.

## 8. Children
The extension is a tool for players of Lord of Ultima: Revival. It does not knowingly collect any personal information, from children or anyone else.

## 9. Chrome Web Store Limited Use
The use of information received from the game page by LoU Revival Helper adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), including the Limited Use requirements:
- data is used only to provide the extension's single purpose and its user-facing features;
- data is not transferred to anyone, except the minister settings you explicitly apply to the game;
- data is not used or transferred for personalized advertising;
- no human reads your data, since the developer never receives it.

## 10. Changes to this policy
If the extension starts handling data differently, this policy is updated before that version is released, and the change is listed in the Change Log (**ℹ️ About → 📝 Change Log**) with a new effective date.

## 11. Contact
Questions about privacy: **ardhie** — ardhie.andro@gmail.com

*LoU Revival Helper is a player-made tool. It is not affiliated with the developers of Lord of Ultima: Revival.*
