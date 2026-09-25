# BUDDY: ROLLBACK

*Nothing is ever truly deleted.*

A 3D isometric action roguelite starring **Buddy**, the chat pet from [`microsoft/vscode`](https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/chat/browser/widget) (`chatPetWidget.ts`). The gameplay loop is inspired by Hades II.

## Play

Download [`dist/index.html`](dist/index.html) and open it in a modern desktop browser. It's a single self-contained file, so it runs straight from disk with no server or install. Turn sound on: every sound is synthesized live.

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move | WASD / Arrows | Left stick |
| Attack (3-hit combo) · **hold** for *Rare Spin* | LMB / J | X |
| Throw Star · **hold** for *Starfall* | RMB / K | Y |
| Cast *Breakpoint* (roots foes) | Q / L | B / RB |
| Dash (i-frames) · **hold** to sprint · attack after a dash = dash-strike | Space / Shift | A / RT |
| Interact | E | A |
| Boon list | hold Tab | Select |
| Pause / settings | Esc | Start |

## The story

REVERT, Titan of History, rolled the Maintainer's whole world back to Version Zero. The Keepers (Hot Reload, Cache, Debugger, Merge) forgot their names, and the Maintainer stopped opening the window. Buddy survived because pets are stored at `APPLICATION` scope.

Descend through **The Deprecated**, **The Legacy Stack** and **Version Zero**. The story unfolds across runs:

- **Caret, Lint and the bosses:** dialogue that reacts to your deaths and victories. Buddy can't talk, so Buddy answers with emotes (♥ / ! / ▀▀).
- **The Unsent Message:** a chat bubble in the hub that fills in a little more each milestone.
- **The commit log:** in rest rooms, the Maintainer's history slowly reveals where REVERT came from.

## Systems

- **Boons:** 24 boons from 4 Keepers (Burn / Chill→Freeze / chain lightning / Conflict bursts) across Attack, Special, Cast, Dash and passive slots. Rarities run Common → Heroic, and *Refactor* upgrades a boon.
- **Doors:** each exit shows its reward: boon, heart, stars, refactor, coffee, rest or boss.
- **Bosses:** Deprecata (bullet rings, summons, lances), the Garbage Collector (charges, leap slam with a shockwave you dash through, vacuum), and REVERT (clock-hand beams, slow fields, and *Rewind*: break his 3 commits or he heals).
- **Meta progression:** the Achievement Board uses the pet's real achievement names and awards its hats (Cowboy, Hard Hat, Chef, Crown, Wizard, Top Hat & Monocle…). Stable Blue and Insiders Teal color variants are available.
- **Juice:** hit-stop, trauma-based screen shake, squash & stretch, spring-driven antennae, dash afterimages, slash trails, damage numbers, slow-mo on room clear and kills, bloom, color grade, chromatic aberration on hits, and a low-HP vignette. Screen shake can be adjusted in the pause menu.

## Develop

```bash
npm install
npm run build    # minified → dist/index.html
npm run dev      # readable build
npm run watch    # rebuild on change
```

Source lives in `src/`. Start at `main.js` (loop), `flow.js` (game flow), `player.js`, `enemies.js`, `bosses.js`, `boons.js` and `story.js`. All art is procedural: Buddy's palette and silhouette are traced from the sprites in the VS Code repo.

## Open source and attribution

BUDDY: ROLLBACK is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Microsoft.

Buddy is based on the Visual Studio Code chat pet. Visual Studio Code is Copyright (c) Microsoft Corporation and is available under the [MIT License](https://github.com/microsoft/vscode/blob/main/LICENSE.txt). Microsoft, Visual Studio Code, and related names and marks are trademarks of Microsoft Corporation.

The original code in this repository is released under the [MIT License](LICENSE). See [NOTICE](NOTICE) for complete attribution.
