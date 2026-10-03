// Shared mutable game context. Modules read from it at runtime to avoid import cycles.
export const G = {
	time: 0,
	dt: 0,
	timeScale: 1,
	slowmoT: 0,
	hitstop: 0,
	mode: 'title', // title | hub | run | ending
	paused: false,
	modal: null, // 'dialog' | 'boon' | 'board' | 'wardrobe' | 'pause' | 'dead' | null
	scene: null,
	camera: null,
	renderer: null,
	player: null,
	enemies: [],
	projectiles: [],
	pickups: [],
	hazards: [],
	interactables: [],
	boss: null,
	room: null,
	run: null,
	save: null,
};

const SAVE_KEY = 'buddy-rollback-save-v1';

export function defaultSave() {
	return {
		stars: 0,
		memories: 0,
		config: {},
		codex: {},
		codexRead: {},
		unlocks: [],
		hat: null,
		runs: 0,
		deaths: 0,
		wins: 0,
		fragments: 0,
		commitIdx: 0,
		seen: {},
		flags: {},
		bossKills: { deprecata: 0, collector: 0, transitive: 0, confabula: 0, revert: 0 },
		lastDeath: null,
		settings: { music: 0.55, sfx: 0.8, shake: 1, rumble: 1, variant: 'stable' },
	};
}

export function loadSave() {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return defaultSave();
		const d = JSON.parse(raw);
		const def = defaultSave();
		return { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, bossKills: { ...def.bossKills, ...(d.bossKills || {}) }, config: { ...(d.config || {}) }, codex: { ...(d.codex || {}) }, codexRead: { ...(d.codexRead || {}) } };
	} catch {
		return defaultSave();
	}
}

export function writeSave() {
	try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch { /* storage unavailable */ }
}

export function wipeSave() {
	try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
	G.save = defaultSave();
}
