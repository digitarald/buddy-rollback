// Long-term progression: Memories (◆), ranked settings.json upgrades, and codex tracking.
import { G, writeSave } from './state.js';
import { CODEX } from './lore.js';

// Hades' Mirror of Night, reimagined as the Maintainer's settings.json.
// Keys unlock as the story advances, so power and narrative grow together.
export const CONFIG = [
	{ id: 'fontSize', key: 'editor.fontSize', name: 'Bigger Buddy', costs: [2, 4, 7, 11, 16], desc: (r) => `+${r * 6} Max HP`, per: '+6 Max HP', unlock: () => true },
	{ id: 'tabSize', key: 'editor.tabSize', name: 'Wider Swings', costs: [3, 6, 10, 15, 21], desc: (r) => `+${r * 4}% damage`, per: '+4% damage', unlock: () => true },
	{ id: 'hotExit', key: 'files.hotExit', name: 'Hot Exit', costs: [5, 10, 17], desc: (r) => `Heal ${r * 3} HP entering each chamber`, per: 'Heal +3 HP per chamber', unlock: (s) => s.flags.reachedBoss1, hint: 'Reach Deprecata' },
	{ id: 'trim', key: 'files.trimTrailingWhitespace', name: 'Thick Skin', costs: [6, 12, 20], desc: (r) => `−${r * 5}% damage taken`, per: '−5% damage taken', unlock: (s) => s.bossKills.deprecata >= 1, hint: 'Defeat Deprecata' },
	{ id: 'breakpoints', key: 'debug.allowBreakpointsEverywhere', name: 'Quick Breakpoints', costs: [5, 10, 16], desc: (r) => `Cast recharges ${r * 15}% faster`, per: '−15% Cast cooldown', unlock: (s) => s.flags.reachedLegacy, hint: 'Reach the Legacy Stack' },
	{ id: 'autoUpdate', key: 'extensions.autoUpdate', name: 'Auto Update', costs: [8, 14, 22], desc: (r) => `+${r * 6}% chance of Rare+ boons`, per: '+6% Rare+ chance', unlock: (s) => s.bossKills.collector >= 1, hint: 'Defeat the Garbage Collector' },
	{ id: 'autoStash', key: 'git.autoStash', name: 'Auto Stash', costs: [30], desc: () => 'Respawn once more per run', per: '+1 respawn per run', unlock: (s) => s.bossKills.transitive >= 1, hint: 'Defeat Transitive' },
	{ id: 'formatOnSave', key: 'editor.formatOnSave', name: 'Format On Save', costs: [12, 24], desc: (r) => `+${r * 15}% damage to Guardians and elites`, per: '+15% vs Guardians/elites', unlock: (s) => s.bossKills.confabula >= 1, hint: 'Defeat Confabula' },
];

export const rank = (id) => (G.save?.config?.[id] || 0);

export function applyConfigMods(m, save) {
	const r = (id) => save.config?.[id] || 0;
	m.maxHpAdd += r('fontSize') * 6;
	m.dmgMul += r('tabSize') * 0.04;
	m.blame = (m.blame || 0) + r('formatOnSave') * 0.15;
	return m;
}

export function buyConfig(id) {
	const c = CONFIG.find((x) => x.id === id);
	const s = G.save;
	const r = s.config[id] || 0;
	if (!c || r >= c.costs.length || !c.unlock(s) || s.memories < c.costs[r]) return false;
	s.memories -= c.costs[r];
	s.config[id] = r + 1;
	writeSave();
	return true;
}

export function gainMemories(n) {
	G.save.memories = (G.save.memories || 0) + n;
	if (G.run) G.run.memories = (G.run.memories || 0) + n;
	writeSave();
}

// ---------------- codex ----------------
export function codexValue(s, key) {
	if (key === 'runs') return s.runs;
	if (key === 'deaths') return s.deaths;
	if (key === 'wins') return s.wins;
	if (key === 'commits') return s.commitIdx;
	return s.codex[key] || 0;
}

export function unlockedTiers(s, entry) {
	return entry.tiers.filter((t) => codexValue(s, t.key || entry.key) >= t.need);
}

export function codexUnread(s) {
	let n = 0;
	for (const e of CODEX) if (unlockedTiers(s, e).length > (s.codexRead[e.id] || 0)) n++;
	return n;
}

let notify = null;
export function onCodexUnlock(fn) { notify = fn; }

// Increments a codex counter and announces any lore that just became readable.
export function track(key, n = 1) {
	const s = G.save;
	if (!s) return;
	const before = CODEX.filter((e) => (e.key === key || e.tiers.some((t) => t.key === key))).map((e) => [e, unlockedTiers(s, e).length]);
	s.codex[key] = (s.codex[key] || 0) + n;
	for (const [e, was] of before) {
		if (unlockedTiers(s, e).length > was) notify?.(e);
	}
}

export function trackAll() {
	// Commit- and run-based entries change outside track(); used to refresh hub markers only.
	return codexUnread(G.save);
}
