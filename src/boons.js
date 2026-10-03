import { G } from './state.js';
import { shuffle, weighted } from './util.js';
import { rank } from './meta.js';

export const KEEPERS = {
	pyra: {
		id: 'pyra', name: 'Pyra', title: 'Keeper of the Hot Reload', color: 0xff7a2f, css: '#ff7a2f', el: 'burn',
		quotes: [
			'I remember... changing things without starting over. That was me. Take a spark.',
			'REVERT says every change is a mistake. I say: save, and watch it live.',
			'Little light! Burn bright. Burn *incrementally*.',
			'He made me forget my own name. I remember heat, though. Here.',
		],
	},
	glace: {
		id: 'glace', name: 'Glacé', title: 'Keeper of the Cache', color: 0x7fe6ff, css: '#7fe6ff', el: 'chill',
		quotes: [
			'I keep what matters close. You, I would keep closest.',
			'Stored at application scope? Clever pet. Let me make you colder than his clocks.',
			'Hold still. There. Now everything that touches you will hesitate.',
			'Some things are worth remembering. Take this, so you never forget.',
		],
	},
	arc: {
		id: 'arc', name: 'Arc', title: 'Keeper of the Debugger', color: 0xffd23f, css: '#ffd23f', el: 'arc',
		quotes: [
			'Breakpoint hit! Oh — it\'s you. Step into this.',
			'I used to pause the world so he could understand it. Now I pause his enemies.',
			'Watch window says: you are very small and very determined. Good values.',
			'Call stack\'s deep down here. Let\'s make it shallow.',
		],
	},
	mira: {
		id: 'mira', name: 'Mira', title: 'Keeper of the Merge', color: 0xff4fd8, css: '#ff4fd8', el: 'conflict',
		quotes: [
			'Two histories, one future. That\'s what I do. REVERT wants only one past.',
			'Conflicts aren\'t failures, darling. They\'re proof two things mattered.',
			'<<<<<<< yours\nTake this.\n=======\nNo, really, take it.\n>>>>>>> mine',
			'I\'ll resolve this in your favor. Always.',
		],
	},
};

export const RARITY = {
	common: { name: 'Common', mul: 1, css: '#d6d6e0' },
	rare: { name: 'Rare', mul: 1.35, css: '#4cc3ff' },
	epic: { name: 'Epic', mul: 1.75, css: '#c77dff' },
	heroic: { name: 'Heroic', mul: 2.2, css: '#ff5e7a' },
	duo: { name: 'Duo', mul: 1, css: '#ffe066' },
};

const pct = (v) => Math.round(v * 100) + '%';
const n = (v) => Math.round(v);

// Each boon: slot + description (by power multiplier) + apply(mods, k)
export const BOONS = [
	// ---------------- PYRA ----------------
	{ id: 'hot_swipe', keeper: 'pyra', slot: 'attack', name: 'Hot Swipe', desc: (k) => `Your <b>Attack</b> deals <b>+${pct(0.2 * k)}</b> damage and inflicts <i class="burn">Burn</i> (${n(6 * k)} dmg/sec).`, apply: (m, k) => { m.attackMul += 0.2 * k; m.attackEl = 'burn'; m.attackPow = 6 * k; } },
	{ id: 'flare_star', keeper: 'pyra', slot: 'special', name: 'Flare Star', desc: (k) => `Your <b>Special</b> stars explode on hit for <b>${n(14 * k)}</b> area damage and inflict <i class="burn">Burn</i>.`, apply: (m, k) => { m.specialEl = 'burn'; m.specialPow = 5 * k; m.flareStar = 14 * k; } },
	{ id: 'firewall', keeper: 'pyra', slot: 'cast', name: 'Firewall', desc: (k) => `Your <b>Breakpoint</b> scorches foes inside for <b>${n(14 * k)}</b> dmg/sec and inflicts <i class="burn">Burn</i>.`, apply: (m, k) => { m.castEl = 'burn'; m.castPow = 14 * k; } },
	{ id: 'blazing_trail', keeper: 'pyra', slot: 'dash', name: 'Blazing Trail', desc: (k) => `Your <b>Dash</b> leaves flames that inflict <i class="burn">Burn</i> (${n(7 * k)} dmg/sec).`, apply: (m, k) => { m.dashEl = 'burn'; m.dashPow = 7 * k; } },
	{ id: 'rekindle', keeper: 'pyra', slot: 'passive', name: 'Rekindle', desc: (k) => `Whenever a <i class="burn">Burning</i> foe is slain, restore <b>${n(2 * k)}</b> HP.`, apply: (m, k) => { m.rekindle += 2 * k; } },
	{ id: 'overheat', keeper: 'pyra', slot: 'passive', name: 'Overheat', desc: (k) => `<i class="burn">Burn</i> deals <b>+${pct(0.5 * k)}</b> damage.`, apply: (m, k) => { m.burnMul += 0.5 * k; } },

	// ---------------- GLACE ----------------
	{ id: 'cold_cache', keeper: 'glace', slot: 'attack', name: 'Cold Cache', desc: (k) => `Your <b>Attack</b> deals <b>+${pct(0.2 * k)}</b> damage and applies <i class="chill">Chill</i>. At 5 stacks, foes <b>Freeze</b>.`, apply: (m, k) => { m.attackMul += 0.2 * k; m.attackEl = 'chill'; m.attackPow = k; } },
	{ id: 'frost_star', keeper: 'glace', slot: 'special', name: 'Frost Star', desc: (k) => `Your <b>Special</b> deals <b>+${pct(0.25 * k)}</b> damage, applies 2 <i class="chill">Chill</i>, and pierces <b>+1</b> foe.`, apply: (m, k) => { m.specialMul += 0.25 * k; m.specialEl = 'chill'; m.starPierce += 1; } },
	{ id: 'freeze_frame', keeper: 'glace', slot: 'cast', name: 'Freeze Frame', desc: (k) => `Your <b>Breakpoint</b> applies 3 <i class="chill">Chill</i> and shatters for <b>${n(32 * k)}</b> damage when it ends.`, apply: (m, k) => { m.castEl = 'chill'; m.castPow = 32 * k; } },
	{ id: 'cold_start', keeper: 'glace', slot: 'dash', name: 'Cold Start', desc: (k) => `Your <b>Dash</b> releases a frost nova dealing <b>${n(9 * k)}</b> and applying 2 <i class="chill">Chill</i>.`, apply: (m, k) => { m.dashEl = 'chill'; m.dashPow = 9 * k; } },
	{ id: 'shatter', keeper: 'glace', slot: 'passive', name: 'Shatter', desc: (k) => `<i class="chill">Chilled</i> foes explode on death for <b>${n(22 * k)}</b> area damage.`, apply: (m, k) => { m.shatter += 22 * k; } },
	{ id: 'warm_cache', keeper: 'glace', slot: 'passive', name: 'Warm Cache', desc: (k) => `Gain <b>+${n(25 * k)}</b> max HP.`, apply: (m, k) => { m.maxHpAdd += 25 * k; }, onGain: (P, k) => P.heal(25 * k) },

	// ---------------- ARC ----------------
	{ id: 'step_into', keeper: 'arc', slot: 'attack', name: 'Step Into', desc: (k) => `Your <b>Attack</b> deals <b>+${pct(0.15 * k)}</b> damage and <i class="arc">arcs</i> to 2 nearby foes for <b>${n(7 * k)}</b>.`, apply: (m, k) => { m.attackMul += 0.15 * k; m.attackEl = 'arc'; m.attackPow = 7 * k; } },
	{ id: 'step_over', keeper: 'arc', slot: 'special', name: 'Step Over', desc: (k) => `Your <b>Special</b> chains <i class="arc">lightning</i> to 3 foes for <b>${n(11 * k)}</b> each.`, apply: (m, k) => { m.specialEl = 'arc'; m.specialPow = 0; m.stepOver = 11 * k; } },
	{ id: 'cond_break', keeper: 'arc', slot: 'cast', name: 'Conditional Breakpoint', desc: (k) => `<i class="arc">Lightning</i> strikes a foe inside your <b>Breakpoint</b> every 0.4s for <b>${n(12 * k)}</b>.`, apply: (m, k) => { m.castEl = 'arc'; m.castPow = 12 * k; } },
	{ id: 'hot_path', keeper: 'arc', slot: 'dash', name: 'Hot Path', desc: (k) => `Your <b>Dash</b> zaps the 2 nearest foes for <b>${n(13 * k)}</b>.`, apply: (m, k) => { m.dashEl = 'arc'; m.dashPow = 13 * k; } },
	{ id: 'watch_window', keeper: 'arc', slot: 'passive', name: 'Watch Window', desc: (k) => `Gain <b>+${pct(0.08 * k)}</b> chance to deal <b>Critical</b> (×2) damage.`, apply: (m, k) => { m.crit += 0.08 * k; } },
	{ id: 'call_stack', keeper: 'arc', slot: 'passive', name: 'Call Stack', desc: (k) => `<i class="arc">Lightning</i> chains to <b>+1</b> foe and deals <b>+${pct(0.3 * k)}</b> damage.`, apply: (m, k) => { m.chains += 1; m.arcMul += 0.3 * k; } },

	// ---------------- MIRA ----------------
	{ id: 'diff_swipe', keeper: 'mira', slot: 'attack', name: 'Diff Swipe', desc: (k) => `Your <b>Attack</b> deals <b>+${pct(0.15 * k)}</b> damage and adds <i class="conflict">Conflict</i>. At 3 stacks: burst for <b>${n(14 * k)}</b>.`, apply: (m, k) => { m.attackMul += 0.15 * k; m.attackEl = 'conflict'; m.conflictPow = Math.max(m.conflictPow, 14 * k); } },
	{ id: 'cherry_pick', keeper: 'mira', slot: 'special', name: 'Cherry-Pick', desc: (k) => `Your <b>Special</b> deals <b>+${pct(0.3 * k)}</b> damage and adds 2 <i class="conflict">Conflict</i>.`, apply: (m, k) => { m.specialMul += 0.3 * k; m.specialEl = 'conflict'; m.conflictPow = Math.max(m.conflictPow, 12 * k); } },
	{ id: 'rebase', keeper: 'mira', slot: 'cast', name: 'Rebase', desc: (k) => `Your <b>Breakpoint</b> pulls foes to its center and adds <i class="conflict">Conflict</i> every second. Deals <b>+${pct(0.5 * k)}</b> damage.`, apply: (m, k) => { m.castEl = 'conflict'; m.castMul += 0.5 * k; m.conflictPow = Math.max(m.conflictPow, 12 * k); } },
	{ id: 'fast_forward', keeper: 'mira', slot: 'dash', name: 'Fast-Forward', desc: (k) => `Dashing through foes deals <b>${n(14 * k)}</b> and adds <i class="conflict">Conflict</i>.`, apply: (m, k) => { m.dashEl = 'conflict'; m.dashPow = 14 * k; m.conflictPow = Math.max(m.conflictPow, 12 * k); } },
	{ id: 'squash', keeper: 'mira', slot: 'passive', name: 'Squash', desc: (k) => `<i class="conflict">Conflict</i> bursts deal <b>+${pct(0.5 * k)}</b> damage in a larger area.`, apply: (m, k) => { m.conflictMul += 0.5 * k; } },
	// ---------------- DUO (two Keepers merge their powers) ----------------
	{ id: 'thermal_shock', keeper: 'duo', keepers: ['pyra', 'glace'], slot: 'passive', name: 'Thermal Shock', desc: () => `Foes that are both <i class="burn">Burning</i> and <i class="chill">Chilled</i> erupt in steam for <b>34</b> area damage.`, apply: (m) => { m.thermalShock = 34; } },
	{ id: 'hot_patch', keeper: 'duo', keepers: ['pyra', 'arc'], slot: 'passive', name: 'Hot Patch', desc: () => `<i class="arc">Lightning</i> inflicts <i class="burn">Burn</i> and deals <b>+50%</b> damage to Burning foes.`, apply: (m) => { m.hotPatch = true; } },
	{ id: 'flame_war', keeper: 'duo', keepers: ['pyra', 'mira'], slot: 'passive', name: 'Flame War', desc: () => `<i class="conflict">Conflict</i> bursts inflict <i class="burn">Burn</i> and leave a ring of fire.`, apply: (m) => { m.flameWar = true; } },
	{ id: 'superconductor', keeper: 'duo', keepers: ['glace', 'arc'], slot: 'passive', name: 'Superconductor', desc: () => `<i class="arc">Lightning</i> chains to <b>+2</b> foes and deals <b>Critical</b> damage to <i class="chill">Chilled</i> foes.`, apply: (m) => { m.superconductor = true; } },
	{ id: 'frozen_branch', keeper: 'duo', keepers: ['glace', 'mira'], slot: 'passive', name: 'Frozen Branch', desc: () => `<i class="conflict">Conflict</i> bursts apply 3 <i class="chill">Chill</i> and deal <b>×2</b> damage to Frozen foes.`, apply: (m) => { m.frozenBranch = true; } },
	{ id: 'merge_storm', keeper: 'duo', keepers: ['arc', 'mira'], slot: 'passive', name: 'Merge Storm', desc: () => `<i class="conflict">Conflict</i> bursts call <i class="arc">lightning</i> on 3 foes for <b>15</b> each.`, apply: (m) => { m.mergeStorm = true; } },
	{ id: 'blame', keeper: 'mira', slot: 'passive', name: 'Blame', desc: (k) => `Deal <b>+${pct(0.25 * k)}</b> damage to bosses and elite foes.`, apply: (m, k) => { m.blame += 0.25 * k; } },
];

export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));
export const SLOT_LABEL = { attack: 'Attack', special: 'Special', cast: 'Cast', dash: 'Dash', passive: 'Passive' };

export function baseMods() {
	return {
		dmgMul: 1, attackMul: 1, specialMul: 1, castMul: 1, dashMul: 1, crit: 0.03,
		attackEl: null, attackPow: 0, specialEl: null, specialPow: 0, castEl: null, castPow: 0, dashEl: null, dashPow: 0,
		chains: 0, arcMul: 1, burnMul: 1, shatter: 0, rekindle: 0, conflictMul: 1, conflictPow: 12, blame: 0,
		thermalShock: 0, hotPatch: false, flameWar: false, superconductor: false, frozenBranch: false, mergeStorm: false,
		maxHpAdd: 0, maxMpAdd: 0, mpRegenMul: 1, speedMul: 1, dashChargesAdd: 0, castRadiusAdd: 0, starPierce: 0, flareStar: 0, stepOver: 0,
	};
}

export function boonPower(entry) {
	return RARITY[entry.rarity].mul * (1 + 0.3 * (entry.level - 1));
}

export function rollRarity(bonus = 0) {
	return weighted([
		{ v: 'common', w: 60 - bonus * 100 },
		{ v: 'rare', w: 27 + bonus * 60 },
		{ v: 'epic', w: 10 + bonus * 30 },
		{ v: 'heroic', w: 3 + bonus * 10 },
	]);
}

// Offer up to 3 boons from a keeper, avoiding exact duplicates the player already owns.
// Display identity for a boon's source; Duo boons blend both Keepers.
export function keeperOf(def) {
	if (def.keeper !== 'duo') return KEEPERS[def.keeper];
	const [a, b] = def.keepers.map((k) => KEEPERS[k]);
	return { id: 'duo', name: `${a.name} & ${b.name}`, css: a.css, css2: b.css, color: a.color, color2: b.color };
}

// Duo boons this Keeper could offer: needs a boon from both of its Keepers already.
export function eligibleDuos(keeperId) {
	const P = G.player;
	const list = P.boonList();
	const owned = new Set(list.map((b) => b.id));
	const has = (k) => list.some((b) => BOON_BY_ID[b.id].keeper === k);
	return BOONS.filter((b) => b.keeper === 'duo' && b.keepers.includes(keeperId) && !owned.has(b.id) && b.keepers.every(has));
}

export function makeOffer(keeperId) {
	const P = G.player;
	const owned = new Set(P.boonList().map((b) => b.id));
	const pool = BOONS.filter((b) => b.keeper === keeperId && !owned.has(b.id));
	const picks = shuffle(pool).slice(0, 3);
	const bonus = (G.save.unlocks.includes('party') ? 0.15 : 0) + rank('autoUpdate') * 0.06;
	const offers = picks.map((b) => {
		const replaces = b.slot !== 'passive' && P.boons[b.slot] ? BOON_BY_ID[P.boons[b.slot].id] : null;
		return { id: b.id, rarity: rollRarity(bonus), replaces };
	});
	const duos = eligibleDuos(keeperId);
	if (duos.length && Math.random() < 0.45) {
		const d = duos[Math.floor(Math.random() * duos.length)];
		const duo = { id: d.id, rarity: 'duo', replaces: null };
		if (offers.length >= 3) offers[2] = duo; else offers.push(duo);
	}
	return offers;
}

export function pickKeeper(exclude = []) {
	const ids = Object.keys(KEEPERS).filter((k) => !exclude.includes(k));
	return ids[Math.floor(Math.random() * ids.length)];
}
