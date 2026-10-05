# BUDDY: ROLLBACK

*Nothing is ever truly deleted.*

A 3D isometric action roguelite starring **Buddy**, the chat pet from [`microsoft/vscode`](https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/chat/browser/widget) (`chatPetWidget.ts`). The gameplay loop is inspired by Hades II.

## Play

Download [`dist/index.html`](dist/index.html) and open it in a modern desktop browser. It's a single self-contained file, so it runs straight from disk with no server or install. Turn sound on: every sound is synthesized live.

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move | WASD / Arrows | Left stick |
| Attack · **hold** for the weapon's charged move | LMB / J | X |
| Throw Star · **hold** for *Starfall* | RMB / K | Y |
| Cast *Breakpoint* (roots foes) | Q / L | B / RB |
| Dash (i-frames) · **hold** to sprint · attack after a dash = dash-strike | Space / Shift | A / RT |
| Interact | E | A |
| Boon list | hold Tab | Select |
| Pause / settings (volume, screen shake, rumble) | Esc | Start |

## The story

REVERT, Titan of History, rolled the Maintainer's whole world back to Version Zero. The Keepers (Hot Reload, Cache, Debugger, Merge) forgot their names, and the Maintainer stopped opening the window. Buddy survived because pets are stored at `APPLICATION` scope.

Descend through **The Deprecated**, **The Legacy Stack**, **node_modules**, **The Latent Space** and **Version Zero**. The story unfolds across runs:

- **Caret, Lint and the bosses:** dialogue that reacts to your deaths and victories. Buddy can't talk, so Buddy answers with emotes (♥ / ! / ▀▀).
- **The Unsent Message:** a chat bubble in the hub that fills in a little more each milestone.
- **The commit log:** in rest rooms, the Maintainer's history slowly reveals where REVERT came from.
- **README.md:** a codex in the hub with 88 lore entries. Characters, places, Keepers, foes and Guardians reveal deeper entries as you meet, defeat and choose them across many runs.

### Stage III: node_modules

When the rollback destroyed the lockfile, four thousand packages stopped knowing which version they were. **Transitive, Hydra of node_modules**, is what their guessing became.

- **Peer Dependency** foes spawn in tethered pairs; the beam between them hurts. Kill one and the other becomes an enraged **UNMET PEER**.
- **Typosquats** hide among breakable files under labels like `lodahs` and `reqeusts`, then bite when Buddy gets close.
- **Transitive's** heads armor its body. A severed head regrows as two unless you pin its stump with a Breakpoint. Every pin locks the version, deals heavy damage and exposes the body.

### Stage IV: The Latent Space

On the night he gave up, the Maintainer asked a model to make everything perfect so he would never have to try again. Something answered. **Confabula, Oracle of Plausible Answers**, offers Buddy a generated Maintainer who never doubts and a better pet who is enabled by default. Her arc is about grounding, honest uncertainty, and AI as a collaborator rather than a replacement.

- **Ghost Text** predicts Buddy's movement and autocompletes into that spot. Change direction after its warning line.
- **Modal Dialog** traps focus with a slowing field, then slams out a square shockwave you can dash through.
- **Confabula** streams predictive tokens, fires multi-head attention beams, collapses the context window, samples chaotic high-temperature bursts, and conjures hallucinations. Only the real Confabula casts a shadow.

## Arsenal

Choose Buddy's tool at the hub **Toolbox**. New tools unlock as Guardians fall:

| Tool | Style | Hold attack | Unlock |
|---|---|---|---|
| **Caret Blade** | Balanced sweeping arcs | *Rare Spin* | Start |
| **Cursor Lance** | Long piercing thrusts and a lunging dash strike | *Skewer*: dash through a line of foes | Defeat Deprecata |
| **Terminal Gauntlets** | Five-hit punch combo; the finisher shockwave is `Enter` | *Keyboard Mash*: punch flurry ending in a blast | Defeat the Garbage Collector |

**Patches** are the Maintainer's unmerged pull requests behind gold doors, at most one per stage. They change how attacks behave: *Triple Star*, *Return Statement* (boomerang stars), *Echo Dash*, *Overclock*, and weapon-specific Patches such as *Multi-Cursor*, *Pointer Fling* and *Ctrl+Combo*.

**Duo boons** appear once you hold boons from two Keepers. All six pairings have a signature combo:

| Duo | Keepers | Effect |
|---|---|---|
| Thermal Shock | Pyra + Glacé | Burning and Chilled foes erupt in steam |
| Hot Patch | Pyra + Arc | Lightning burns and hits Burning foes harder |
| Flame War | Pyra + Mira | Conflict bursts burn and leave a ring of fire |
| Superconductor | Glacé + Arc | Lightning chains further and crits Chilled foes |
| Frozen Branch | Glacé + Mira | Conflict bursts chill and double damage against Frozen foes |
| Merge Storm | Arc + Mira | Conflict bursts call lightning |

## Systems

- **Boons:** 24 boons from 4 Keepers (Burn / Chill→Freeze / chain lightning / Conflict bursts) across Attack, Special, Cast, Dash and passive slots. Rarities run Common → Heroic, and *Refactor* upgrades a boon.
- **Doors:** each exit shows its reward: boon, heart, stars, refactor, coffee, rest or boss.
- **Bosses:** Deprecata (bullet rings, summons, lances), the Garbage Collector (charges, leap slam with a shockwave you dash through, vacuum), Transitive (regrowing heads, dependency-tree eruptions, installs, audits), Confabula (predictive streams, attention beams, context collapse, hallucinations), and REVERT (clock-hand beams, slow fields, and *Rewind*: break his 3 commits or he heals).
- **Breakable files:** combat rooms contain shader-lit files that shatter into physical debris and sometimes leak Stars or a little health.
- **Rising difficulty:** each stage multiplies enemy health and damage, elites arrive earlier, and later stages combine more dangerous foes. A first run is not expected to reach Version Zero.
- **Memories ◆ and settings.json:** Memory doors, elite foes and Guardians drop Memories. Spend them at the hub's `settings.json` terminal on eight ranked permanent upgrades. New keys unlock as you progress through the story, like Hades' Mirror of Night.
- **Meta progression:** the Achievement Board uses the pet's real achievement names and awards its hats (Cowboy, Hard Hat, Chef, Crown, Wizard, Top Hat & Monocle…). Stable Blue and Insiders Teal color variants are available.
- **Juice:** hit-stop, trauma-based screen shake, gamepad rumble, squash & stretch, spring-driven antennae, dash afterimages, slash trails, damage numbers, slow-mo on room clear and kills, bloom, color grade, chromatic aberration on hits, and a low-HP vignette. Screen shake and rumble can be adjusted in the pause menu.
- **Visual identity for every build:** each weapon has its own model, animation, trails and sounds. Stars become flaming meteors, ice shards, crackling lightning stars or twin pink-and-green diff stars. Each element has its own impact effect, and Rare, Epic and Heroic boons make trails brighter, thicker and eventually gold. Crits flash a starburst, Rekindle sends healing embers back to Buddy, Shatter scatters ice, Blame marks bosses with `git blame`, and Duo pickups trigger a twin-colour helix.
- **Shader effects:** floor tiles physically ripple from impacts, circuit traces pulse through the floor, screen-space shockwaves refract the image, glitch distortion marks AI attacks, and scorch decals cool from embers to soot.
- **The Deprecated:** a never-ending striped sunset, parting fog, waving `v1 API` banners, `@deprecated` signposts, crumbling edges, and drifting documentation pages that scatter from impacts. Defeated foes leave struck-through function names.
- **Dynamic detail:** spark streaks, bouncing instanced debris, projectile-lit floors, Buddy's moving light pool, edge light curtains, volumetric shafts, holographic code panels, and a neural-network backdrop in the Latent Space.

## Develop

```bash
npm install
npm run build    # minified → dist/index.html
npm run dev      # readable build
npm run watch    # rebuild on change
```

Pushes to `main` publish the production build to GitHub Pages. The workflow can also be run manually from the Actions tab.

Source lives in `src/`. Start at `main.js` (loop), `flow.js` (game flow), `player.js`, `enemies.js`, `bosses.js`, `boons.js`, `story.js`, `juice.js` (shader-driven feedback), `meta.js` (permanent progression), `lore.js` (codex), `weapons.js` (arsenal and Patches) and `vfx.js` (style layer). All art is procedural: Buddy's palette and silhouette are traced from the sprites in the VS Code repo.

## Open source and attribution

BUDDY: ROLLBACK is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Microsoft.

Buddy is based on the Visual Studio Code chat pet. Visual Studio Code is Copyright (c) Microsoft Corporation and is available under the [MIT License](https://github.com/microsoft/vscode/blob/main/LICENSE.txt). Microsoft, Visual Studio Code, and related names and marks are trademarks of Microsoft Corporation.

The original code in this repository is released under the [MIT License](LICENSE). See [NOTICE](NOTICE) for complete attribution.
