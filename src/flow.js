import * as THREE from 'three';
import { G, writeSave, wipeSave } from './state.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { R, snapCamera, addTrauma, flashScreen, punchZoom, flashLight } from './render.js';
import { buildRoom, disposeRoom, addDoors, openDoors, BIOMES, LAYOUTS, randomSpawnPoint, T } from './world.js';
import { burst, ring, beam, clearFX, damageNumber } from './fx.js';
import { clearCombat } from './combat.js';
import { clearJuice, rumble } from './juice.js';
import { Enemy, clearEnemies, livingCount } from './enemies.js';
import { spawnBoss } from './bosses.js';
import { UI } from './ui.js';
import { KEEPERS, makeOffer, pickKeeper, BOON_BY_ID, BOONS, RARITY, keeperOf } from './boons.js';
import { boonFanfare } from './vfx.js';
import { WEAPONS, PATCHES, PATCH_BY_ID } from './weapons.js';
import { createCaretNPC, createLintNPC, createMessageBubble, createBoard, createWardrobe, rewardIcon, portalMaterial, createHat, createLectern, createConfigTerminal, createToolbox } from './models.js';
import { createWeaponModel } from './weapons.js';
import { track, gainMemories, codexUnread, onCodexUnlock, rank } from './meta.js';
import { glyphTexture } from './textures.js';
import { glowMat } from './materials.js';
import { PROLOGUE, caretDialog, lintDialog, messageDialog, commitDialog, bossIntro, bossOutro, keeperQuote, hasFreshCaret, ENDING, CREDITS, fragmentLevel } from './story.js';
import { pick, rand, weighted, shuffle, easeOutBack } from './util.js';

const WEAPON_ORDER = ['caret', 'lance', 'gauntlets'];
const availablePatches = () => PATCHES.filter((p) => !G.player.patches.has(p.id) && (!p.weapon || p.weapon === G.player.weaponId));
const RUN_BIOMES = ['deprecated', 'legacy', 'deps', 'latent', 'zero'];
const COMBAT_LAYOUTS = ['hall', 'cross', 'ring', 'split', 'long'];
const BOSS_OF = { deprecated: 'deprecata', legacy: 'collector', deps: 'transitive', latent: 'confabula', zero: 'revert' };
const ROOMS_PER_BIOME = { deprecated: 4, legacy: 3, deps: 3, latent: 3, zero: 2 };

const REWARD_COLORS = { heart: 0xe8334a, stars: 0xffcd0f, refactor: 0x7dffb0, snack: 0xd9a066, rest: 0x9fd8ff, boss: 0xff3048, memory: 0x6f8cff, patch: 0xffb000 };
const REWARD_NAMES = { heart: 'Heart', stars: 'Stars', refactor: 'Refactor', snack: 'Coffee', rest: 'Rest', boss: 'Guardian', stairs: 'Descend', memory: 'Memory', patch: 'Patch' };

function makeReward(kind, keeper) {
	if (kind === 'boon') {
		const k = keeper || pickKeeper();
		return { kind, keeper: k, color: KEEPERS[k].color, label: KEEPERS[k].name };
	}
	if (kind === 'stairs') return { kind, color: 0xbfefff, label: 'Descend' };
	return { kind, color: REWARD_COLORS[kind], label: REWARD_NAMES[kind] };
}

class Pickup {
	constructor(reward, x, z) {
		this.reward = reward;
		this.mesh = rewardIcon(reward.kind, reward.color);
		this.mesh.position.set(x, 0, z);
		this.pos = this.mesh.position;
		this.t = 0;
		this.alive = true;
		this.light = new THREE.PointLight(reward.color, 0, 6);
		this.light.position.y = 1.4;
		this.mesh.add(this.light);
		G.scene.add(this.mesh);
		beam({ x, z, r: 0.7, color: reward.color, dur: 1.0 });
		ring({ x, z, r1: 2.5, color: reward.color, dur: 0.5 });
		burst({ x, z, y: 1, count: 30, color: reward.color, color2: 0xffffff, speed: 4, up: 4, size: 0.25, life: 0.8 });
		audio.play('unlock', { vol: 0.6 });
		G.pickups.push(this);
	}
	update(dt) {
		this.t += dt;
		const k = Math.min(1, this.t / 0.6);
		this.mesh.position.y = 1.3 * easeOutBack(k) + Math.sin(this.t * 2.5) * 0.15;
		this.mesh.rotation.y += dt * 1.5;
		this.mesh.scale.setScalar(Math.max(0.01, easeOutBack(k)));
		this.light.intensity = 3 + Math.sin(this.t * 4) * 1;
		if (Math.random() < dt * 6) burst({ x: this.pos.x + rand(-0.4, 0.4), z: this.pos.z + rand(-0.4, 0.4), y: 0.3, count: 1, color: this.reward.color, speed: 0.2, up: 1.5, size: 0.14, life: 0.8, gravity: 0 });
		const P = G.player;
		if (this.t > 0.5 && P.alive && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 1.3) this.collect();
	}
	collect() {
		this.alive = false;
		G.scene.remove(this.mesh);
		burst({ x: this.pos.x, z: this.pos.z, y: 1.2, count: 40, color: this.reward.color, color2: 0xffffff, speed: 6, up: 3, size: 0.25, life: 0.6 });
		ring({ x: this.pos.x, z: this.pos.z, r1: 3, color: this.reward.color, dur: 0.4 });
		audio.play('pickup');
		Flow.onPickup(this.reward);
	}
}

export const Flow = {
	busy: false,
	interactables: [],
	hubProps: null,

	// ---------------- title ----------------
	async boot() {
		onCodexUnlock((e) => UI.toast(`<code>README.md</code> updated · <b>${e.name}</b>`, '#9fd8ff'));
		G.mode = 'title';
		this.loadHubScene();
		G.player.face = Math.PI / 2;
		R.cinematic = { target: { x: G.player.pos.x, z: G.player.pos.z - 3.2 }, zoom: 0.7, speed: 2 };
		const title = document.getElementById('title-screen');
		title.classList.add('show');
		const hasSave = G.save.runs > 0 || G.save.seen.caret_intro;
		document.getElementById('t-continue').style.display = hasSave ? '' : 'none';
		document.getElementById('t-begin').textContent = hasSave ? 'New Game' : 'Begin';
		await new Promise((resolve) => {
			const start = (fresh) => {
				audio.init();
				audio.setVolumes(G.save.settings.music, G.save.settings.sfx);
				audio.play('select');
				if (fresh && hasSave) {
					if (!confirm('Start over? This erases your progress.')) return;
					wipeSave();
					G.player.setHat(null);
				}
				title.classList.remove('show');
				document.body.classList.remove('title');
				resolve();
			};
			document.getElementById('t-begin').onclick = () => start(true);
			document.getElementById('t-continue').onclick = () => start(false);
			const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { window.removeEventListener('keydown', onKey); start(!hasSave ? true : false); } };
			window.addEventListener('keydown', onKey);
			audio.setMood('title');
		});
		input.endFrame();
		if (!G.save.seen.prologue) {
			audio.setMood('title');
			await UI.fadeOut(600);
			await UI.narrate(PROLOGUE);
			G.save.seen.prologue = true;
			writeSave();
		}
		await this.enterHub(false);
	},

	// ---------------- hub ----------------
	loadHubScene() {
		this.clearWorld();
		const room = buildRoom('hub', 'hub');
		G.room = room;
		const m = room.markers;
		const add = (obj, p) => { obj.position.set(p.x, 0, p.z); room.group.add(obj); return obj; };
		const caret = add(createCaretNPC(), m.C);
		const lint = add(createLintNPC(), m.L);
		const msg = add(createMessageBubble(), m.M);
		const board = add(createBoard(), m.A);
		const wardrobe = add(createWardrobe(), m.W);
		const lectern = add(createLectern(), m.R);
		const terminal = add(createConfigTerminal(), m.G);
		const toolbox = add(createToolbox(), m.T);
		this.refreshToolbox(toolbox);
		// exit portal
		const portal = new THREE.Group();
		const pm = portalMaterial(0x9b6bff);
		pm.uniforms.uOpen.value = 1;
		const plane = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48).rotateX(-Math.PI / 2), pm);
		plane.position.y = 0.05;
		portal.add(plane);
		const ringM = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 8, 48).rotateX(Math.PI / 2), glowMat(0xb48cff, 2.5));
		ringM.position.y = 0.1;
		portal.add(ringM);
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: glyphTexture('THE STACK ↓', { size: 256, font: 'bold 34px ui-monospace, monospace', glow: 10 }), transparent: true, color: new THREE.Color(0xd9c4ff).multiplyScalar(1.6), depthWrite: false }));
		sign.position.set(0, 3.0, -0.8);
		portal.add(sign);
		add(portal, m.X);
		const bang = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: glyphTexture('!', { font: 'bold 110px sans-serif' }), transparent: true, depthWrite: false, color: new THREE.Color(0xffd23f).multiplyScalar(2.2) }));
		bang.position.set(m.C.x, 3.6, m.C.z);
		room.group.add(bang);
		// untitled tab sign on the back wall
		const tab = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1), new THREE.MeshBasicMaterial({ map: glyphTexture('● Untitled-1', { size: 512, font: 'bold 64px ui-monospace, monospace', glow: 14 }), transparent: true, color: new THREE.Color(0xffd9a8).multiplyScalar(1.4), depthWrite: false }));
		tab.position.set(m.X.x - 7, 4.2, m.X.z - 1.6);
		room.group.add(tab);
		const readmeBang = bang.clone();
		readmeBang.material = bang.material.clone();
		readmeBang.material.color.set(0x9fd8ff).multiplyScalar(2.2);
		readmeBang.position.set(m.R.x, 3.2, m.R.z);
		room.group.add(readmeBang);
		this.hubProps = { caret, lint, msg, board, wardrobe, portal, pm, bang, lectern, terminal, readmeBang, toolbox };
		if (!G.player) {
			// created by main
		}
		G.player.pos.set(room.start.x, 0, room.start.z);
		G.player.face = Math.PI / 2;
		snapCamera(G.player.pos);
		this.interactables = [
			{ pos: m.C, r: 2.4, label: 'Talk to Caret', action: () => this.talk(caretDialog(G.save)) },
			{ pos: m.L, r: 2.4, label: 'Talk to Lint', action: () => this.talk(lintDialog(G.save)) },
			{ pos: m.M, r: 2.4, label: 'Read the Unsent Message', action: () => this.talk(messageDialog(G.save)) },
			{ pos: m.A, r: 2.2, label: 'Achievement Board', action: () => this.openBoard() },
			{ pos: m.W, r: 2.2, label: 'Wardrobe', action: () => this.openWardrobe() },
			{ pos: m.R, r: 2.2, label: 'Read README.md', action: () => this.openCodex() },
			{ pos: m.G, r: 2.2, label: 'Edit settings.json', action: () => this.openConfig() },
			{ pos: m.T, r: 2.2, label: 'Open the Toolbox', action: () => this.openArsenal() },
		];
		this.portalPos = m.X;
	},

	async enterHub(fromDeath) {
		this.busy = true;
		G.mode = 'hub';
		G.run = null;
		G.boss = null;
		await UI.fadeOut(300);
		this.loadHubScene();
		G.player.resetForRun();
		G.player.recompute();
		G.player.hp = G.player.maxHp;
		R.cinematic = null;
		UI.showHUD(false);
		UI.setLocation('');
		audio.setMood('hub');
		await UI.fadeIn(700);
		UI.banner('The Scratch Buffer', 'Untitled-1 · never saved, so never reverted', '#ffd9a8');
		this.busy = false;
		if (hasFreshCaret(G.save) && (!G.save.seen.caret_intro || fromDeath || G.save.wins > 0)) {
			await this.wait(900);
			if (G.mode === 'hub' && !G.modal && !this.busy) await this.talk(caretDialog(G.save));
		}
	},

	async talk(lines) {
		if (!lines || !lines.length) return;
		this.busy = true;
		await UI.dialog(lines);
		this.busy = false;
	},

	async openBoard() {
		this.busy = true;
		await UI.openBoard((a) => {
			G.player.resetForRun();
			G.player.setHat(G.save.hat);
			G.player.emote('cool');
			UI.toast(`Achievement unlocked: <b>${a.title}</b>`, '#ffcd0f');
		});
		this.busy = false;
		if (G.save.unlocks.length === 1 && !G.save.seen.lint_first_buy) await this.talk(lintDialog(G.save));
	},

	async openWardrobe() {
		this.busy = true;
		await UI.openWardrobe((c) => {
			if (c.variant) { G.player.setVariant(c.variant); UI.refreshPortrait(); }
			G.player.setHat(G.save.hat);
			G.player.emote('love');
		});
		this.busy = false;
	},

	refreshToolbox(tb) {
		WEAPON_ORDER.forEach((id, i) => {
			const slot = tb.userData.slots[i];
			slot.clear();
			if (!WEAPONS[id].unlock(G.save)) {
				const q = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: glyphTexture('?', { font: 'bold 100px sans-serif' }), transparent: true, depthWrite: false, color: new THREE.Color(0x887766) }));
				slot.add(q);
				return;
			}
			const w = createWeaponModel(id);
			if (id === 'lance') { w.rotation.x = -Math.PI / 2; w.scale.setScalar(0.6); }
			if (id === 'gauntlets') { w.userData.fists.forEach((f, k) => f.position.set((k ? 1 : -1) * 0.16, 0, 0)); w.scale.setScalar(0.8); }
			if (id === 'caret') w.scale.setScalar(1.1);
			w.userData.mat.color.set(WEAPONS[id].color).multiplyScalar(id === (G.save.weapon || 'caret') ? 3.2 : 1.4);
			slot.add(w);
		});
	},

	async openArsenal() {
		this.busy = true;
		await UI.openArsenal((id) => {
			G.save.weapon = id;
			writeSave();
			G.player.setWeapon(id);
			G.player.emote('cool');
			this.refreshToolbox(this.hubProps.toolbox);
			const P = G.player;
			ring({ x: P.pos.x, z: P.pos.z, r1: 3, color: WEAPONS[id].color, dur: 0.5, intensity: 3 });
			burst({ x: P.pos.x, z: P.pos.z, y: 0.8, count: 40, color: WEAPONS[id].color, color2: 0xffffff, speed: 5, up: 3, size: 0.22, life: 0.7 });
		});
		this.busy = false;
	},

	async openCodex() {
		this.busy = true;
		await UI.openCodex();
		this.busy = false;
	},

	async openConfig() {
		this.busy = true;
		await UI.openConfig((c) => {
			G.player.recompute();
			G.player.hp = G.player.maxHp;
			G.player.emote('cool');
			UI.toast(`<code>${c.key}</code> updated`, '#9fb4ff');
		});
		this.busy = false;
		if (!G.save.seen.lint_config && Object.keys(G.save.config).length) await this.talk(lintDialog(G.save));
	},

	updateHub(dt, realDt) {
		const hp = this.hubProps;
		if (!hp) return;
		const t = G.time + performance.now() / 1000;
		hp.readmeBang.visible = codexUnread(G.save) > 0;
		hp.readmeBang.position.y = 3.2 + Math.sin(t * 4 + 1) * 0.12;
		hp.readmeBang.lookAt(R.camera.position);
		hp.lectern.userData.pages.rotation.z = Math.sin(t * 1.4) * 0.06;
		hp.lectern.userData.glow.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.2;
		hp.terminal.userData.panel.position.y = 2.1 + Math.sin(t * 1.3) * 0.08;
		hp.terminal.userData.mat.uniforms.uTime.value = t;
		hp.terminal.userData.gear.rotation.z += realDt * 0.8;
		hp.toolbox.userData.slots.forEach((sl, i) => { sl.position.y = 1.25 + Math.sin(t * 1.6 + i) * 0.05; if (sl.children[0]) sl.children[0].rotation.y += realDt * 0.6; });
		// Caret blinks
		const cm = hp.caret.userData.caret.userData.mat;
		const on = Math.sin(t * 3.2) > -0.3;
		cm.color.set(0xfff1d0).multiplyScalar(on ? 2.4 : 0.6);
		hp.caret.position.y = Math.sin(t * 1.5) * 0.08;
		hp.lint.userData.tube.rotation.x = Math.sin(t * 2) * 0.15;
		hp.lint.position.x = this.interactables[1].pos.x + Math.sin(t * 0.6) * 0.8;
		hp.lint.userData.head.rotation.y = Math.sin(t * 1.3) * 0.4;
		hp.msg.userData.dots.forEach((d, i) => { d.position.y = 2.2 + Math.max(0, Math.sin(t * 5 - i * 0.7)) * 0.15; });
		hp.msg.position.y = Math.sin(t * 1.1) * 0.1;
		hp.board.userData.cards.forEach((c, i) => { c.position.y = 1.7 + Math.sin(t * 1.5 + i) * 0.08; });
		hp.pm.uniforms.uTime.value = t;
		hp.bang.visible = hasFreshCaret(G.save);
		hp.bang.position.y = 3.6 + Math.sin(t * 4) * 0.12;
		hp.bang.lookAt(R.camera.position);
		if (Math.random() < realDt * 12) burst({ x: this.portalPos.x + rand(-1.4, 1.4), z: this.portalPos.z + rand(-1.4, 1.4), y: 0.1, count: 1, color: 0xb48cff, speed: 0.2, up: 2, size: 0.2, life: 1, gravity: 0.3 });

		if (G.modal || this.busy || G.mode !== 'hub') { UI.prompt(null); return; }
		const P = G.player;
		let near = null, best = 1e9;
		for (const it of this.interactables) {
			const d = Math.hypot(P.pos.x - it.pos.x, P.pos.z - it.pos.z);
			if (d < it.r && d < best) { best = d; near = it; }
		}
		if (near) {
			UI.prompt(`<kbd>E</kbd> ${near.label}`, { x: near.pos.x, y: 3.2, z: near.pos.z });
			if (input.pressed('interact')) { UI.prompt(null); near.action(); }
		} else UI.prompt(null);
		if (Math.hypot(P.pos.x - this.portalPos.x, P.pos.z - this.portalPos.z) < 1.5) this.startRun();
	},

	// ---------------- runs ----------------
	async startRun() {
		if (this.busy) return;
		this.busy = true;
		G.save.runs++;
		writeSave();
		const P = G.player;
		P.resetForRun();
		const wid = G.save.weapon && WEAPONS[G.save.weapon]?.unlock(G.save) ? G.save.weapon : 'caret';
		if (P.weaponId !== wid) P.setWeapon(wid);
		track('weapon_run:' + wid);
		G.run = { biomeIdx: 0, roomInBiome: 0, depth: 0, kills: 0, stars: 0, memories: 0, hpScale: 1, dmgScale: 1, dmgTakenMul: 1 - 0.05 * rank('trim'), lastLayout: null };
		audio.play('door');
		ring({ x: P.pos.x, z: P.pos.z, r1: 4, color: 0xb48cff, dur: 0.6 });
		await this.enterRoom({ kind: 'combat', reward: makeReward('boon'), first: true });
		if (G.save.unlocks.includes('builder')) {
			const b = pick(BOONS.filter((x) => x.slot !== 'passive'));
			P.addBoon(b.id, 'common');
			UI.toast(`Skilled Builder: began with <b>${b.name}</b>`, KEEPERS[b.keeper].css);
		}
	},

	get biome() { return RUN_BIOMES[G.run.biomeIdx]; },

	nextKind() {
		const r = G.run;
		const n = ROOMS_PER_BIOME[this.biome];
		if (r.roomInBiome < n) return 'combat';
		if (r.roomInBiome === n) return 'rest';
		return 'boss';
	},

	async enterRoom(def) {
		this.busy = true;
		G.mode = 'run';
		const run = G.run;
		this.waves = null;
		this.pendingSpawns = [];
		this.restFont = null;
		await UI.fadeOut(def.first ? 500 : 320);
		this.clearWorld();
		this.hubProps = null;
		this.interactables = [];
		const biomeId = this.biome;
		const biome = BIOMES[biomeId];
		let layout;
		if (def.kind === 'rest') layout = 'rest';
		else if (def.kind === 'boss') layout = 'boss';
		else { do { layout = pick(COMBAT_LAYOUTS); } while (layout === run.lastLayout); run.lastLayout = layout; }
		const room = buildRoom(layout, biomeId);
		G.room = room;
		this.roomDef = def;
		this.cleared = false;
		this.rewardTaken = false;
		this.damageAtStart = G.player.damageTaken;
		const P = G.player;
		P.pos.set(room.start.x, 0, room.start.z);
		P.face = -Math.PI / 2;
		P.state = 'idle';
		P.vel.set(0, 0, 0);
		P.dashCharges = P.dashMax;
		snapCamera(P.pos);
		// Each stage hits harder; permanent upgrades are what let Buddy keep pace.
		run.hpScale = 1 + run.depth * 0.055 + run.biomeIdx * 0.25;
		run.dmgScale = 1 + run.biomeIdx * 0.2;
		room.onBreak = (b) => this.breakableDrop(b);
		UI.showHUD(true);
		const roomNo = run.roomInBiome + 1;
		UI.setLocation(`${biome.name} · ${def.kind === 'boss' ? 'Guardian' : def.kind === 'rest' ? 'Rest' : 'Chamber ' + roomNo}`);
		if (def.kind === 'boss') audio.setMood('none'); else if (def.kind === 'rest') audio.setMood('calm'); else audio.setMood(biome.music);
		await UI.fadeIn(420);
		if (run.roomInBiome === 0 && def.kind === 'combat') UI.banner(biome.name, biome.sub, '#' + new THREE.Color(biome.glyph).getHexString());
		this.busy = false;
		if (biomeId === 'legacy' && !G.save.flags.reachedLegacy) { G.save.flags.reachedLegacy = true; writeSave(); }
		if (biomeId === 'latent' && !G.save.flags.reachedLatent) { G.save.flags.reachedLatent = true; writeSave(); }
		if (biomeId === 'deps' && !G.save.flags.reachedDeps) { G.save.flags.reachedDeps = true; writeSave(); }
		if (run.roomInBiome === 0 && def.kind === 'combat') track('reach:' + biomeId);
		const vit = rank('hotExit') * 3;
		if (vit && !def.first && P.hp < P.maxHp) P.heal(vit, true);

		if (def.kind === 'combat') this.startCombat(def);
		else if (def.kind === 'rest') this.startRest();
		else if (def.kind === 'boss') this.startBoss();
	},

	startCombat(def) {
		const run = G.run;
		const d = run.depth;
		const nWaves = def.first ? 1 : d > 5 ? (Math.random() < 0.5 ? 3 : 2) : 2;
		this.waves = [];
		for (let i = 0; i < nWaves; i++) this.waves.push(def.first ? 3.2 : 4 + d * 0.9 + run.biomeIdx * 2 + i * 1.2);
		this.waveIdx = -1;
		this.waveDelay = 0.9;
		this.pendingSpawns = [];
	},

	spawnWave(budget) {
		const biome = BIOMES[this.biome];
		const COST = { null: 1, tab: 1.3, warning: 1, regression: 2.8, leak: 1.8, ghost: 1.6, modal: 2.6, peer: 3.4, typosquat: 1.4 };
		const run = G.run;
		let t = 0;
		while (budget > 0.5) {
			let type = weighted(biome.enemies);
			if (run.depth < 2 && type === 'regression') type = 'null';
			if (type === 'modal' && this.pendingSpawns.filter((s) => s.type === 'modal').length >= 2) type = 'ghost';
			if (type === 'peer' && this.pendingSpawns.filter((s) => s.type === 'peer').length >= 2) type = 'typosquat';
			budget -= COST[type];
			const elite = run.depth >= 3 && Math.random() < 0.05 + run.biomeIdx * 0.06;
			this.pendingSpawns.push({ type, t, elite });
			t += 0.18;
		}
	},

	updateCombat(dt) {
		if (this.cleared || !this.waves) return;
		for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
			const s = this.pendingSpawns[i];
			s.t -= dt;
			if (s.t <= 0) {
				const p = randomSpawnPoint(G.room, G.player.pos, s.type === 'typosquat' ? 7 : 5.5);
				const opts = { hpScale: G.run.hpScale, dmgScale: G.run.dmgScale, elite: s.elite, instant: s.type === 'typosquat' };
				const onDeath = (e) => {
					G.run.kills++;
					if (e.elite) {
						gainMemories(1);
						damageNumber(e.pos.x, 2, e.pos.z, 0, { text: '◆ +1', color: '#9fb4ff' });
					}
				};
				const e = new Enemy(s.type, p.x, p.z, opts);
				e.onDeath = onDeath;
				if (s.type === 'peer') {
					let q = randomSpawnPoint(G.room, G.player.pos, 5);
					for (let k = 0; k < 12 && Math.hypot(q.x - p.x, q.z - p.z) < 5; k++) q = randomSpawnPoint(G.room, G.player.pos, 5);
					const mate = new Enemy('peer', q.x, q.z, opts);
					mate.onDeath = onDeath;
					e.partner = mate; mate.partner = e;
				}
				this.pendingSpawns.splice(i, 1);
			}
		}
		if (this.pendingSpawns.length || livingCount() > 0) return;
		this.waveDelay -= dt;
		if (this.waveDelay > 0) return;
		this.waveIdx++;
		if (this.waveIdx < this.waves.length) {
			this.spawnWave(this.waves[this.waveIdx]);
			this.waveDelay = 0.8;
		} else this.onRoomCleared();
	},

	onRoomCleared() {
		this.cleared = true;
		G.slowmoT = 0.45;
		audio.play('clear');
		punchZoom(0.04);
		const P = G.player;
		if (P.damageTaken === this.damageAtStart && !this.roomDef.first) setTimeout(() => P.emote('cool'), 300);
		audio.setMood('explore');
		const rw = this.roomDef.reward;
		setTimeout(() => {
			if (G.mode !== 'run' || !P.alive) return;
			const spot = this.rewardSpot();
			new Pickup(rw, spot.x, spot.z);
		}, 500);
	},

	// Breakable files occasionally leak a little loot, like urns in a dungeon.
	breakableDrop(b) {
		const P = G.player;
		const r = Math.random();
		if (r < 0.28) {
			const n = 1 + (Math.random() < 0.3 ? 1 : 0);
			G.save.stars += n;
			if (G.run) G.run.stars += n;
			damageNumber(b.x, 1.2, b.z, n, { text: '★ +' + n, color: '#ffcd0f' });
			burst({ x: b.x, z: b.z, y: 1, count: 12, color: 0xffcd0f, color2: 0xffffff, speed: 3, up: 4, size: 0.2, life: 0.6 });
			audio.play('pickup', { vol: 0.5 });
		} else if (r < 0.4 && P.hp < P.maxHp) {
			P.heal(3, true);
		}
	},

	rewardSpot() {
		const room = G.room;
		const P = G.player;
		let best = null, bd = 1e9;
		for (const c of room.cells) {
			if (c.ch !== '.' && c.ch !== 'F') continue;
			if (!room.walkable(c.x + 1.2, c.z) || !room.walkable(c.x - 1.2, c.z) || !room.walkable(c.x, c.z + 1.2) || !room.walkable(c.x, c.z - 1.2)) continue;
			const d = Math.hypot(c.x - (P.pos.x * 0.3), c.z - (P.pos.z * 0.3 - 1));
			if (d < bd) { bd = d; best = c; }
		}
		return best || { x: 0, z: 0 };
	},

	async onPickup(rw) {
		const P = G.player;
		const run = G.run;
		switch (rw.kind) {
			case 'boon': {
				const offers = makeOffer(rw.keeper);
				if (!offers.length) { G.save.stars += 5; UI.toast('The Keeper has nothing left to give — ★ +5', '#ffcd0f'); break; }
				this.busy = true;
				const quote = keeperQuote(rw.keeper, KEEPERS[rw.keeper]);
				const choice = await UI.chooseBoon(rw.keeper, offers, quote);
				track('keeper:' + rw.keeper);
				const entry = P.addBoon(choice.id, choice.rarity);
				const def = BOON_BY_ID[choice.id];
				const kk = keeperOf(def);
				UI.toast(`<b>${def.name}</b> · ${RARITY[entry.rarity].name}`, kk.css);
				boonFanfare(P, entry.rarity, kk.color, kk.color2 ?? null);
				if (def.keeper === 'duo') { track('duo:' + def.id); G.save.flags['duo_' + def.id] = true; }
				P.emote(Math.random() < 0.5 ? 'love' : 'cool');
				this.busy = false;
				break;
			}
			case 'heart': {
				P.baseMaxHp += 10;
				P.recompute();
				// The Guardian's heart is a breather before the next stage, like Hades' post-boss fountain.
				const fromBoss = this.roomDef?.kind === 'boss';
				P.heal(fromBoss ? 10 + Math.round(P.maxHp * 0.35) : 10);
				UI.toast(fromBoss ? 'Guardian\'s Heart · <b>+10 Max HP</b> and healed' : 'Heart · <b>+10 Max HP</b>', '#ff5e7a');
				P.emote('love');
				break;
			}
			case 'stars': {
				const n = 5 + Math.floor(run.depth / 2) + Math.floor(Math.random() * 4);
				G.save.stars += n; run.stars += n;
				writeSave();
				UI.toast(`★ <b>+${n}</b> Stars`, '#ffcd0f');
				break;
			}
			case 'refactor': {
				const b = P.levelUpRandom();
				if (b) UI.toast(`Refactor · <b>${BOON_BY_ID[b.id].name}</b> → Lv.${b.level}`, '#7dffb0');
				else { P.baseMaxHp += 5; P.recompute(); P.heal(5); UI.toast('Nothing to refactor · +5 Max HP', '#7dffb0'); }
				break;
			}
			case 'snack':
				P.heal(Math.round(P.maxHp * 0.35));
				UI.toast('Coffee break · <b>healed</b>', '#d9a066');
				break;
			case 'patch': {
				const offers = shuffle(availablePatches()).slice(0, 3);
				if (!offers.length) { G.save.stars += 5; break; }
				run.patchThisBiome = true;
				this.busy = true;
				const pick = await UI.choosePatch(offers);
				P.patches.add(pick.id);
				track('patch:' + pick.id);
				UI.toast(`Patch merged · <b>${pick.name}</b>`, '#ffb000');
				boonFanfare(P, 'epic', 0xffb000, null);
				this.busy = false;
				break;
			}
			case 'memory': {
				const n = rw.amount || (2 + run.biomeIdx + Math.floor(Math.random() * 3));
				gainMemories(n);
				UI.toast(`◆ <b>+${n}</b> Memories · spend them in <code>settings.json</code>`, '#9fb4ff');
				P.emote('love');
				break;
			}
		}
		this.rewardTaken = true;
		if (this.roomDef.kind === 'boss') return;
		this.showDoors();
	},

	showDoors() {
		const run = G.run;
		const next = this.nextAfterThis();
		let rewards;
		if (next === 'rest') rewards = [makeReward('rest')];
		else if (next === 'boss') rewards = [makeReward('boss')];
		else if (next === 'stairs') rewards = [makeReward('stairs')];
		else {
			const n = Math.random() < 0.45 ? 3 : 2;
			const usedKeepers = [];
			rewards = [];
			for (let i = 0; i < n; i++) {
				let kind = weighted([
					{ v: 'boon', w: i === 0 ? 100 : 40 },
					{ v: 'stars', w: 16 },
					{ v: 'heart', w: 12 },
					{ v: 'refactor', w: G.player.boonList().some((b) => b.rarity !== 'duo') ? 16 : 0 },
					{ v: 'snack', w: G.player.hp < G.player.maxHp * 0.7 ? 14 : 5 },
					{ v: 'memory', w: 15 },
					{ v: 'patch', w: run.biomeIdx >= 1 && !run.patchThisBiome && availablePatches().length ? 14 : 0 },
				]);
				if (kind !== 'boon' && rewards.some((r) => r.kind === kind)) kind = 'boon';
				if (kind === 'boon') {
					const k = pickKeeper(usedKeepers);
					if (!k) kind = 'stars';
					else { usedKeepers.push(k); rewards.push(makeReward('boon', k)); continue; }
				}
				rewards.push(makeReward(kind));
			}
			rewards = shuffle(rewards);
		}
		addDoors(G.room, rewards);
		openDoors(G.room);
		audio.play('door');
	},

	nextAfterThis() {
		const run = G.run;
		const n = ROOMS_PER_BIOME[this.biome];
		const cur = run.roomInBiome;
		if (this.roomDef.kind === 'boss') return 'stairs';
		if (cur + 1 < n) return 'combat';
		if (cur + 1 === n) return 'rest';
		return 'boss';
	},

	checkDoors() {
		const room = G.room;
		if (!room || this.busy) return;
		const P = G.player;
		for (const d of room.doors) {
			if (!d.open) continue;
			if (Math.abs(P.pos.x - d.x) < 1.3 && P.pos.z < d.z + 1.6) {
				this.takeDoor(d);
				return;
			}
		}
	},

	async takeDoor(d) {
		this.busy = true;
		const run = G.run;
		audio.play('door');
		flashScreen(0.2, d.reward.color);
		if (d.reward.kind === 'stairs') {
			run.biomeIdx++;
			run.roomInBiome = 0;
			run.patchThisBiome = false;
			run.depth++;
			await this.enterRoom({ kind: 'combat', reward: makeReward('boon') });
			return;
		}
		run.roomInBiome++;
		run.depth++;
		const kind = d.reward.kind === 'rest' ? 'rest' : d.reward.kind === 'boss' ? 'boss' : 'combat';
		await this.enterRoom({ kind, reward: kind === 'combat' ? d.reward : null });
	},

	// ---------------- rest ----------------
	startRest() {
		const room = G.room;
		const f = room.markers.F;
		const font = new THREE.Group();
		const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.6, 20), room.stoneMat);
		bowl.position.y = 0.3; bowl.castShadow = true;
		const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32).rotateX(-Math.PI / 2), glowMat(0x6fd8ff, 1.6));
		water.position.y = 0.58;
		font.add(bowl, water);
		const card = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshBasicMaterial({ map: glyphTexture('git log', { size: 256, font: 'bold 44px ui-monospace, monospace' }), transparent: true, color: new THREE.Color(0x8fe0a0).multiplyScalar(1.8), depthWrite: false }));
		card.position.y = 2.4;
		font.add(card);
		font.position.set(f.x, 0, f.z);
		room.group.add(font);
		room.colliders.push({ x: f.x, z: f.z, r: 1.2 });
		this.restFont = { pos: f, used: false, card };
		this.cleared = true;
		this.rewardTaken = true;
		this.showDoors();
	},

	updateRest() {
		if (!this.restFont || this.restFont.used || this.busy || G.modal || !G.player.alive) { UI.prompt(null); return; }
		const P = G.player;
		const f = this.restFont.pos;
		this.restFont.card.lookAt(R.camera.position);
		if (Math.hypot(P.pos.x - f.x, P.pos.z - f.z) < 2.6) {
			UI.prompt('<kbd>E</kbd> Rest & read the commit log', { x: f.x, y: 3.2, z: f.z });
			if (input.pressed('interact')) {
				UI.prompt(null);
				this.restFont.used = true;
				P.heal(Math.round(P.maxHp * 0.4));
				P.emote('sing');
				this.talk(commitDialog(G.save));
			}
		} else UI.prompt(null);
	},

	// ---------------- boss ----------------
	async startBoss() {
		const kind = BOSS_OF[this.biome];
		const room = G.room;
		this.busy = true;
		const bx = 0, bz = -((room.h - 1) / 2) * T + 7;
		const boss = spawnBoss(kind, bx, bz);
		boss.onDeath = () => this.onBossDefeated(boss);
		if (kind === 'deprecata') G.save.flags.reachedBoss1 = true;
		rumble(0.7, 0.9, 600);
		G.player.face = -Math.PI / 2;
		track('meet:' + kind);
		UI.letterbox(true);
		R.cinematic = { target: { x: bx, z: bz + 1 }, zoom: 0.62, speed: 2.2 };
		await this.wait(900);
		audio.play('roar');
		addTrauma(0.35);
		const color = '#' + new THREE.Color(boss.cfg.color).getHexString();
		await UI.bossCard(boss.name, boss.title, color);
		await UI.dialog(bossIntro(kind, G.save));
		R.cinematic = null;
		UI.letterbox(false);
		writeSave();
		audio.setMood(kind === 'confabula' ? 'boss2' : kind === 'transitive' ? 'boss3' : 'boss');
		boss.begin();
		this.busy = false;
		this.cleared = false;
	},

	async onBossDefeated(boss) {
		const kind = boss.kind;
		this.cleared = true;
		await this.wait(2400);
		if (!G.player.alive) return;
		G.boss = null;
		audio.setMood('calm');
		await UI.dialog(bossOutro(kind, G.save));
		const firstKill = !(G.save.bossKills[kind] > 0);
		G.save.bossKills[kind] = (G.save.bossKills[kind] || 0) + 1;
		track('boss:' + kind);
		writeSave();
		if (kind === 'revert') {
			gainMemories(firstKill ? 25 : 10);
			return this.ending();
		}
		const room = G.room;
		new Pickup(makeReward('heart'), -3, 0);
		new Pickup(makeReward('stars'), 3, 0);
		const mem = makeReward('memory');
		mem.amount = (firstKill ? 12 : 4) + G.run.biomeIdx * 2;
		new Pickup(mem, 0, 1.5);
		this.bossRewards = 2;
		this.roomDef.kind = 'boss';
		setTimeout(() => this.showDoors(), 1200);
	},

	// ---------------- death ----------------
	async onPlayerDeath() {
		if (this.dying) return;
		this.dying = true;
		UI.prompt(null);
		await this.wait(1600);
		const run = G.run;
		const s = G.save;
		s.deaths++;
		s.lastDeath = G.boss && G.boss.alive ? G.boss.kind : this.biome;
		writeSave();
		UI.showHUD(false);
		const biome = BIOMES[this.biome];
		await UI.deathScreen({
			where: `${biome.name}${this.roomDef.kind === 'boss' ? ' · Guardian' : ' · Chamber ' + (run.roomInBiome + 1)}`,
			kills: run.kills, stars: run.stars, memories: run.memories || 0, boons: G.player.boonList().length,
		});
		this.dying = false;
		await this.enterHub(true);
	},

	// ---------------- ending ----------------
	async ending() {
		this.busy = true;
		const s = G.save;
		s.wins++;
		if (!s.hat) s.hat = 'party';
		writeSave();
		audio.setMood('ending');
		await UI.fadeOut(1800, '#fff');
		UI.showHUD(false);
		document.getElementById('narration').classList.add('white');
		await UI.narrate(ENDING, { hold: true });
		document.getElementById('narration').classList.remove('white');
		await UI.narrate(CREDITS.map((c) => c), { hold: true });
		s.hat = 'party';
		G.player.setHat('party');
		writeSave();
		UI.hideNarration();
		this.busy = false;
		await this.enterHub(true);
	},

	// ---------------- shared ----------------
	clearWorld() {
		clearEnemies();
		clearCombat();
		clearFX();
		clearJuice();
		for (const p of G.pickups) G.scene.remove(p.mesh);
		G.pickups.length = 0;
		disposeRoom(G.room);
		G.room = null;
		G.boss = null;
		UI.prompt(null);
	},

	wait(ms) { return new Promise((r) => setTimeout(r, ms)); },

	update(dt, realDt) {
		for (let i = G.pickups.length - 1; i >= 0; i--) {
			const p = G.pickups[i];
			if (p.alive) p.update(dt);
			if (!p.alive) G.pickups.splice(i, 1);
		}
		if (G.mode === 'hub') { this.updateHub(dt, realDt); return; }
		if (G.mode !== 'run' || !G.run) return;
		if (!G.player.alive) { this.onPlayerDeath(); return; }
		if (this.roomDef?.kind === 'combat') this.updateCombat(dt);
		if (this.roomDef?.kind === 'rest') this.updateRest();
		this.checkDoors();
	},
};
