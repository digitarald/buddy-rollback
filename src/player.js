import * as THREE from 'three';
import { G, writeSave } from './state.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { createBuddy, createHat, heartMesh, sunglassesMesh, starMesh } from './models.js';
import { setFlash, glowMat } from './materials.js';
import { glyphTexture } from './textures.js';
import { burst, dust, ring, slash, ghost, damageNumber, addTransient } from './fx.js';
import { addTrauma, flashScreen, aberrate, punchZoom, aimPoint, flashLight, shockwave } from './render.js';
import { sparks, floorRipple, rumble } from './juice.js';
import { moveCircle, smashBreakables } from './world.js';
import { hitEnemy, aliveEnemies, playerStar, castBreakpoint, fireTrail, zap, addChill, addConflict, explodeAt, EL } from './combat.js';
import { baseMods, BOON_BY_ID, boonPower, RARITY } from './boons.js';
import { applyConfigMods, rank } from './meta.js';
import { clamp, damp, angleDiff, rand, easeOutBack } from './util.js';
import { WEAPONS, createWeaponModel, animateWeapon } from './weapons.js';
import { attackVisual, elementImpact, critFlash, EL_COLOR, slotTier, thrust } from './vfx.js';
import { Projectile, Hazard, zoneMesh } from './combat.js';
import { track } from './meta.js';

const OMEGA_COST = 30;
const OMEGA_STATES = new Set(['spin', 'skewer', 'flurry']);
const _v = new THREE.Vector3();

export class Player {
	constructor() {
		this.variant = G.save.settings.variant || 'stable';
		this.build();
		this.pos = this.root.position;
		this.vel = new THREE.Vector3();
		this.push = new THREE.Vector3();
		this.radius = 0.55;
		this.face = Math.PI / 2;
		this.aim = { x: 0, z: 1 };
		this.aimAngle = Math.PI / 2;
		this.boons = { attack: null, special: null, cast: null, dash: null, passives: [] };
		this.mods = baseMods();
		this.alive = true;
		this.state = 'idle';
		this.sq = 0; this.sqV = 0;
		this.hop = 0;
		this.blinkT = 2;
		this.flashT = 0;
		this.flashColor = 0xffffff;
		this.emotes = [];
		this.slowMul = 1;
		this.respawns = 0;
		this.resetForRun();
	}

	build() {
		if (this.root) G.scene.remove(this.root);
		this.model = createBuddy(this.variant);
		this.root = this.model.root;
		G.scene.add(this.root);
		if (this.pos) this.root.position.copy(this.pos);
		this.pos = this.root.position;
		this.hat = null;
		this.setHat(G.save.hat);
		this.setWeapon(G.save.weapon || 'caret');
	}

	setWeapon(id) {
		if (!WEAPONS[id]) id = 'caret';
		this.weaponId = id;
		this.weapon = WEAPONS[id];
		const M = this.model;
		if (M.caret) this.root.remove(M.caret);
		M.caret = createWeaponModel(id);
		this.root.add(M.caret);
		this.comboStep = 0;
	}

	// Combo step with active Patch modifiers applied.
	swingDef(base) {
		const p = this.patches || new Set();
		const sw = { ...base };
		if (p.has('overclock')) { sw.dur *= 0.78; sw.hitAt *= 0.78; }
		if (p.has('wide_select') && this.weaponId === 'caret') { sw.arc *= 1.35; sw.range *= 1.2; }
		if (p.has('long_line') && this.weaponId === 'lance') sw.range *= 1.35;
		if (sw.shock && p.has('ctrl_combo')) { sw.shock *= 1.6; sw.shockMul = 1.5; }
		sw.base = base;
		return sw;
	}

	setVariant(v) {
		this.variant = v;
		const p = this.pos.clone();
		this.build();
		this.pos.copy(p);
	}

	setHat(id) {
		if (this.hat) { this.model.hatAnchor.remove(this.hat); this.hat = null; }
		if (id) {
			this.hat = createHat(id);
			this.hat.scale.setScalar(0.85);
			this.model.hatAnchor.add(this.hat);
		}
	}

	resetForRun() {
		this.boons = { attack: null, special: null, cast: null, dash: null, passives: [] };
		this.patches = new Set();
		const u = G.save.unlocks;
		this.baseMaxHp = 60 + (u.includes('wildwest') ? 15 : 0);
		this.baseMaxMp = 80 + (u.includes('citizen') ? 25 : 0);
		this.respawns = (u.includes('cook') ? 1 : 0) + (u.includes('draft') ? 1 : 0) + rank('autoStash');
		this.recompute();
		this.hp = this.maxHp;
		this.mp = this.maxMp;
		this.dashCharges = this.dashMax;
		this.castCharges = 1;
		this.castCd = 0;
		this.specialCd = 0;
		this.iframes = 0;
		this.alive = true;
		this.state = 'idle';
		this.comboStep = 0; this.comboWindow = 0;
		this.attackHeld = 0; this.specialHeld = 0; this.charge = 0; this.chargeKind = null;
		this.dashRegen = 0;
		this.damageTaken = 0;
		this.root.visible = true;
		this.model.body.scale.set(1, 1, 1);
	}

	recompute() {
		const m = baseMods();
		const u = G.save.unlocks;
		if (u.includes('shipit')) m.dmgMul += 0.1;
		if (u.includes('citizen')) m.mpRegenMul += 0.3;
		if (u.includes('course')) m.dashChargesAdd += 1;
		applyConfigMods(m, G.save);
		for (const b of this.boonList()) {
			const def = BOON_BY_ID[b.id];
			def.apply(m, boonPower(b));
		}
		this.mods = m;
		const oldMax = this.maxHp || 0;
		this.maxHp = Math.round(this.baseMaxHp + m.maxHpAdd);
		this.maxMp = Math.round(this.baseMaxMp + m.maxMpAdd);
		this.dashMax = 1 + m.dashChargesAdd;
		if (this.hp !== undefined) this.hp = Math.min(this.hp, this.maxHp);
		return oldMax;
	}

	boonList() {
		const b = this.boons;
		return [b.attack, b.special, b.cast, b.dash, ...b.passives].filter(Boolean);
	}

	addBoon(id, rarity) {
		const def = BOON_BY_ID[id];
		const entry = { id, rarity, level: 1 };
		if (def.slot === 'passive') this.boons.passives.push(entry);
		else this.boons[def.slot] = entry;
		this.recompute();
		if (def.onGain) def.onGain(this, boonPower(entry));
		return entry;
	}

	levelUpRandom() {
		const list = this.boonList().filter((b) => b.rarity !== 'duo');
		if (!list.length) return null;
		const b = list[Math.floor(Math.random() * list.length)];
		b.level++;
		this.recompute();
		return b;
	}

	gainMp(v) { this.mp = Math.min(this.maxMp, this.mp + v); }

	heal(v, small = false) {
		if (!this.alive) return;
		const before = this.hp;
		this.hp = Math.min(this.maxHp, this.hp + v);
		const got = this.hp - before;
		if (got > 0.5) {
			damageNumber(this.pos.x, 1.3, this.pos.z, got, { heal: true });
			if (!small) { audio.play('heal'); burst({ x: this.pos.x, z: this.pos.z, y: 0.8, count: 18, color: 0x7dffb0, speed: 2, up: 3, size: 0.2, life: 0.8, gravity: -1 }); }
		}
	}

	externalPush(vx, vz) { this.push.x += vx; this.push.z += vz; }

	computeAim() {
		let ax, az;
		const pad = input.padAim();
		if (input.usingPad) {
			if (pad) { ax = pad.x; az = pad.z; } else {
				const mv = input.move();
				if (Math.hypot(mv.x, mv.z) > 0.2) { ax = mv.x; az = mv.z; } else { ax = Math.cos(this.face); az = Math.sin(this.face); }
			}
		} else {
			const hit = aimPoint(input.mouse.nx, input.mouse.ny, _v);
			if (hit) { ax = hit.x - this.pos.x; az = hit.z - this.pos.z; } else { ax = Math.cos(this.face); az = Math.sin(this.face); }
			this.aimPoint = hit ? { x: hit.x, z: hit.z } : null;
		}
		const l = Math.hypot(ax, az) || 1;
		this.aim = { x: ax / l, z: az / l };
		this.aimAngle = Math.atan2(this.aim.z, this.aim.x);
	}

	update(dt, controls = true) {
		this.slowMulApplied = this.slowMul;
		if (!this.alive) { this.updateDead(dt); this.slowMul = 1; return; }
		this.iframes = Math.max(0, this.iframes - dt);
		this.specialCd = Math.max(0, this.specialCd - dt);
		this.comboWindow = Math.max(0, this.comboWindow - dt);
		this.flashT = Math.max(0, this.flashT - dt * 5);
		if (this.castCharges < 1) { this.castCd -= dt; if (this.castCd <= 0) { this.castCharges = 1; audio.play('ui', { pitch: 1.6, vol: 0.5 }); } }
		if (this.dashCharges < this.dashMax) { this.dashRegen -= dt; if (this.dashRegen <= 0) this.dashCharges = this.dashMax; }
		this.mp = Math.min(this.maxMp, this.mp + 4 * this.mods.mpRegenMul * dt);

		this.computeAim();
		const mv = controls ? input.move() : { x: 0, z: 0 };
		const moving = Math.hypot(mv.x, mv.z) > 0.1;
		const speed = 7.4 * this.mods.speedMul * this.slowMul;

		if (controls) this.handleActions(dt, mv, moving);
		this.stateT = (this.stateT || 0) + dt;

		let vx = 0, vz = 0;
		switch (this.state) {
			case 'idle':
			case 'sprint': {
				const s = this.state === 'sprint' ? speed * 1.5 : speed;
				vx = mv.x * s; vz = mv.z * s;
				if (moving) this.face += clamp(angleDiff(this.face, Math.atan2(mv.z, mv.x)), -18 * dt, 18 * dt);
				if (this.state === 'sprint') {
					if (!input.held('dash') || !moving) this.state = 'idle';
					if (Math.random() < dt * 20) burst({ x: this.pos.x, z: this.pos.z, y: 0.3, count: 1, color: this.model.colors.glow, speed: 1, dir: this.face + Math.PI, spread: 0.6, up: 0.5, size: 0.2, life: 0.3 });
				}
				break;
			}
			case 'attack': this.updateSwing(dt, mv); vx = this.vel.x; vz = this.vel.z; break;
			case 'dash': this.updateDash(dt); vx = this.vel.x; vz = this.vel.z; break;
			case 'spin': this.updateSpin(dt, mv); vx = mv.x * speed * 0.35; vz = mv.z * speed * 0.35; break;
			case 'skewer': this.updateSkewer(dt); vx = this.vel.x; vz = this.vel.z; break;
			case 'flurry': this.updateFlurry(dt); vx = mv.x * speed * 0.25; vz = mv.z * speed * 0.25; break;
			case 'throw':
				vx = mv.x * speed * 0.4; vz = mv.z * speed * 0.4;
				this.face += clamp(angleDiff(this.face, this.aimAngle), -30 * dt, 30 * dt);
				if (this.stateT > 0.14) this.state = 'idle';
				break;
			case 'charge': {
				vx = mv.x * speed * 0.3; vz = mv.z * speed * 0.3;
				this.face += clamp(angleDiff(this.face, this.aimAngle), -20 * dt, 20 * dt);
				break;
			}
		}
		vx += this.push.x; vz += this.push.z;
		this.push.set(0, 0, 0);
		const prevX = this.vel.x, prevZ = this.vel.z;
		moveCircle(G.room, this.pos, vx * dt, vz * dt, this.radius * 0.8);
		if (this.state === 'attack' || this.state === 'dash' || this.state === 'skewer') {
			const d = Math.exp(-(this.state === 'attack' ? 14 : 0) * dt);
			this.vel.x *= d; this.vel.z *= d;
		} else { this.vel.set(vx, 0, vz); }
		this.accel = { x: (this.vel.x - prevX) / Math.max(dt, 0.001), z: (this.vel.z - prevZ) / Math.max(dt, 0.001) };
		this.moving = moving && (this.state === 'idle' || this.state === 'sprint');
		this.slowMul = 1;
	}

	handleActions(dt, mv, moving) {
		// dash (cancels most things)
		if (input.pressed('dash') && this.dashCharges > 0 && !OMEGA_STATES.has(this.state)) {
			this.startDash(moving ? Math.atan2(mv.z, mv.x) : this.face);
			return;
		}
		// attack
		if (input.held('attack')) this.attackHeld += dt; else this.attackHeld = 0;
		if (input.pressed('attack')) {
			const W = this.weapon;
			if (this.state === 'dash' || (this.state === 'idle' && this.sinceDash < 0.12)) { this.startSwing(W.dash, true); return; }
			if (this.state === 'sprint') { this.startSwing(W.dash, true); return; }
			if (this.state === 'attack') this.queued = true;
			else if (this.state === 'idle' || this.state === 'throw') this.startSwing(W.combo[this.comboWindow > 0 ? this.comboStep : 0]);
		}
		// omega attack charge
		if (this.state === 'idle' && input.held('attack') && this.attackHeld > 0.3) { this.state = 'charge'; this.chargeKind = 'attack'; this.charge = 0; this.stateT = 0; }
		if (this.state === 'charge' && this.chargeKind === 'attack') {
			this.charge += dt;
			this.chargeFx(dt);
			if (!input.held('attack')) {
				if (this.charge >= 0.4 && this.mp >= OMEGA_COST) this.startOmega();
				else { this.state = 'idle'; if (this.charge >= 0.4) this.noMagick(); }
			}
		}
		// special
		if (input.held('special')) this.specialHeld += dt; else this.specialHeld = 0;
		if (input.pressed('special') && this.specialCd <= 0 && (this.state === 'idle' || this.state === 'sprint' || this.state === 'attack' && this.swingT > this.swing.hitAt)) this.throwStar();
		if ((this.state === 'idle' || this.state === 'throw') && input.held('special') && this.specialHeld > 0.3) { this.state = 'charge'; this.chargeKind = 'special'; this.charge = 0; this.stateT = 0; }
		if (this.state === 'charge' && this.chargeKind === 'special') {
			this.charge += dt;
			this.chargeFx(dt);
			if (!input.held('special')) {
				if (this.charge >= 0.4 && this.mp >= OMEGA_COST) this.starfall();
				else { this.state = 'idle'; if (this.charge >= 0.4) this.noMagick(); }
			}
		}
		// cast
		if (input.pressed('cast') && !OMEGA_STATES.has(this.state)) {
			if (this.castCharges > 0) this.cast();
			else { damageNumber(this.pos.x, 1.6, this.pos.z, 0, { text: 'recharging…', color: '#aaa' }); audio.play('ui', { pitch: 0.5 }); }
		}
		this.sinceDash = (this.sinceDash ?? 9) + dt;
	}

	noMagick() {
		damageNumber(this.pos.x, 1.6, this.pos.z, 0, { text: 'not enough magick', color: '#7fb6ff' });
		audio.play('ui', { pitch: 0.5 });
	}

	chargeFx(dt) {
		const k = Math.min(1, this.charge / 0.4);
		const col = this.chargeKind === 'special' ? 0xffcd0f : this.model.colors.glow;
		if (Math.random() < dt * 40) {
			const a = rand(0, Math.PI * 2), r = 1.6 - k;
			burst({ x: this.pos.x + Math.cos(a) * r, z: this.pos.z + Math.sin(a) * r, y: 0.5, count: 1, color: col, speed: 3, dir: a + Math.PI, spread: 0.1, up: 0.5, size: 0.2, life: 0.25, gravity: 0, drag: 0 });
		}
		if (k >= 1 && !this.chargeReady) {
			this.chargeReady = true;
			if (this.mp >= OMEGA_COST) {
				ring({ x: this.pos.x, z: this.pos.z, r0: 2, r1: 0.6, color: col, dur: 0.2 });
				audio.play('ui', { pitch: 2, vol: 0.8 });
				this.flashT = 0.6; this.flashColor = col;
			}
		}
		if (k < 1) this.chargeReady = false;
	}

	startSwing(base, dashStrike = false) {
		const sw = this.swingDef(base);
		this.state = 'attack';
		this.stateT = 0;
		this.swing = sw;
		this.swingT = 0;
		this.hitDone = false;
		this.queued = false;
		this.face = this.aimAngle;
		this.vel.x = this.aim.x * sw.lunge; this.vel.z = this.aim.z * sw.lunge;
		const combo = this.weapon.combo;
		if (!dashStrike) this.comboStep = (combo.indexOf(base) + 1) % combo.length;
		this.isDashStrike = dashStrike;
		attackVisual(this, sw, this.face);
		audio.play(sw.sfx, { pitch: sw.style === 'punch' ? 1.3 + Math.random() * 0.2 : sw.style === 'thrust' ? 0.85 : undefined });
		this.sqV += sw.big ? 5 : 3;
		this.antennaKick(sw.dir * 6);
	}

	updateSwing(dt, mv) {
		this.swingT += dt;
		const sw = this.swing;
		if (!this.hitDone && this.swingT >= sw.hitAt) {
			this.hitDone = true;
			const hits = this.hitArc(this.face, sw);
			if (hits && sw.big) punchZoom(0.03);
			smashBreakables(this.pos.x, this.pos.z, sw.range, { angle: this.face, arc: sw.arc });
			this.finisherExtras(sw);
		}
		if (this.queued && this.swingT > sw.dur * 0.6 && !this.isDashStrike) {
			this.startSwing(this.weapon.combo[this.comboStep]);
			return;
		}
		if (this.swingT >= sw.dur) {
			this.state = 'idle';
			this.stateT = 0;
			this.comboWindow = 0.35;
			if (this.isDashStrike) this.comboStep = 0;
		}
	}

	// Hit everything inside an arc (or a thin line for thrusts) in front of Buddy.
	hitArc(angle, sw, dmgMul = 1, exclude = null) {
		let hits = 0;
		this.lastHits = new Set();
		const one2 = this.patches?.has('one_two') && sw.style === 'punch';
		for (const e of aliveEnemies()) {
			const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
			const d = Math.hypot(dx, dz);
			if (d > sw.range + e.radius) continue;
			const ad = Math.abs(angleDiff(angle, Math.atan2(dz, dx)));
			if (ad > sw.arc / 2 + Math.atan2(e.radius, Math.max(d, 0.1)) && d > e.radius + 0.4) continue;
			if (exclude?.has(e)) continue;
			exclude?.add(e);
			this.lastHits.add(e);
			hitEnemy(e, sw.dmg * dmgMul, { source: 'attack', knock: sw.knock, dir: { x: dx, z: dz }, hitstop: sw.big ? 0.075 : 0.045, shake: sw.big ? 0.2 : 0.1 });
			if (one2 && e.alive && Math.random() < 0.3) {
				hitEnemy(e, sw.dmg * 0.7, { source: 'attack', knock: 1, dir: { x: dx, z: dz }, hitstop: 0.02, shake: 0.05, color: 0x7dffb0 });
				sparks({ x: e.pos.x, y: e.height * 0.6, z: e.pos.z, count: 6, speed: 10, dir: Math.atan2(dz, dx), spread: 1, color: 0x7dffb0, life: 0.15 });
			}
			hits++;
		}
		return hits;
	}

	finisherExtras(sw) {
		const p = this.patches || new Set();
		const col = this.mods.attackEl ? EL_COLOR[this.mods.attackEl] : this.weapon.color;
		if (sw.shock) {
			const fx = this.pos.x + Math.cos(this.face) * 1.4, fz = this.pos.z + Math.sin(this.face) * 1.4;
			explodeAt(fx, fz, sw.shock, 18 * (sw.shockMul || 1), { color: col, source: 'attack', shake: 0.35 });
			shockwave({ x: fx, y: 0.5, z: fz }, 0.8);
			rumble(0.6, 0.8, 160);
		}
		if (!sw.finisher) return;
		if (p.has('multi_cursor') && this.weaponId === 'caret') {
			const already = new Set(this.lastHits || []);
			for (const off of [-1.1, 1.1]) {
				const a = this.face + off;
				slash({ x: this.pos.x, z: this.pos.z, angle: a, arc: sw.arc * 0.6, r1: sw.range * 0.9, color: 0xbfeaff, core: 0xffffff, dur: sw.dur, dirSign: -sw.dir, intensity: 1.3 });
				this.hitArc(a, { ...sw, arc: sw.arc * 0.6, range: sw.range * 0.9 }, 0.6, already);
			}
		}
		if (p.has('fling') && this.weaponId === 'lance') {
			const mesh = new THREE.Group();
			const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 4).rotateZ(-Math.PI / 2), glowMat(col, 3));
			mesh.add(bolt);
			mesh.rotation.y = -this.face;
			new Projectile({
				x: this.pos.x, z: this.pos.z, y: 0.7, vx: Math.cos(this.face) * 26, vz: Math.sin(this.face) * 26, dmg: 26, r: 0.5, owner: 'player', mesh, trail: col, life: 0.6, pierce: 99,
				onHit: (e, pr) => hitEnemy(e, pr.dmg, { source: 'attack', knock: 5, dir: { x: pr.vel.x, z: pr.vel.z }, hitstop: 0.03 }),
			});
		}
	}

	startOmega() {
		const kind = this.weapon.omega;
		if (kind === 'skewer') return this.startSkewer();
		if (kind === 'flurry') return this.startFlurry();
		return this.startSpin();
	}

	startSkewer() {
		this.mp -= OMEGA_COST;
		this.state = 'skewer'; this.stateT = 0;
		this.face = this.aimAngle;
		this.vel.set(Math.cos(this.face) * 30, 0, Math.sin(this.face) * 30);
		this.iframes = Math.max(this.iframes, 0.4);
		this.skewerHit = new Set();
		this.skewerStart = { x: this.pos.x, z: this.pos.z };
		audio.play('spin', { pitch: 1.4 });
		audio.play('dash', { pitch: 0.7 });
		flashLight(this.pos, this.weapon.color, 30, 0.3);
		this.sqV += 6;
	}

	updateSkewer(dt) {
		const col = this.mods.attackEl ? EL_COLOR[this.mods.attackEl] : this.weapon.color;
		if (Math.random() < 0.8) ghost(this.model.body, col, 0.2, 0.35);
		for (const e of aliveEnemies()) {
			if (this.skewerHit.has(e)) continue;
			if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < e.radius + 1.2) {
				this.skewerHit.add(e);
				const side = Math.sign(-(e.pos.x - this.pos.x) * Math.sin(this.face) + (e.pos.z - this.pos.z) * Math.cos(this.face)) || 1;
				hitEnemy(e, 34, { source: 'omega', knock: 7, dir: { x: -Math.sin(this.face) * side, z: Math.cos(this.face) * side }, hitstop: 0.05, shake: 0.2 });
			}
		}
		smashBreakables(this.pos.x, this.pos.z, 1.2);
		if (this.stateT > 0.26) {
			const len = Math.hypot(this.pos.x - this.skewerStart.x, this.pos.z - this.skewerStart.z);
			thrust(this.skewerStart.x, this.skewerStart.z, this.face, len, col, 0xffffff, 0.4, 1.6, true);
			ring({ x: this.pos.x, z: this.pos.z, r1: 2.4, color: col, dur: 0.3 });
			shockwave({ x: this.pos.x, y: 0.6, z: this.pos.z }, 0.6);
			floorRipple(this.pos.x, this.pos.z, 0.7);
			this.vel.multiplyScalar(0.1);
			this.state = 'idle'; this.stateT = 0;
		}
	}

	startFlurry() {
		this.mp -= OMEGA_COST;
		this.state = 'flurry'; this.stateT = 0;
		this.flurryT = 0; this.flurryN = 0; this.flurryDone = false;
		this.face = this.aimAngle;
		audio.play('spin', { pitch: 1.8 });
		this.sqV += 5;
	}

	updateFlurry(dt) {
		this.face += clamp(angleDiff(this.face, this.aimAngle), -10 * dt, 10 * dt);
		const col = this.mods.attackEl ? EL_COLOR[this.mods.attackEl] : this.weapon.color;
		this.flurryT -= dt;
		if (this.flurryT <= 0 && this.stateT < 0.8) {
			this.flurryT = 0.065;
			this.flurryN++;
			const a = this.face + rand(-0.45, 0.45);
			const r = rand(1.2, 2.5);
			const px = this.pos.x + Math.cos(a) * r, pz = this.pos.z + Math.sin(a) * r;
			ring({ x: px, z: pz, y: 0.6, r0: 0.1, r1: 0.7, color: col, dur: 0.1, intensity: 2.2 });
			sparks({ x: this.pos.x, y: 0.6, z: this.pos.z, count: 3, speed: 15, dir: a, spread: 0.2, color: col, color2: 0xffffff, life: 0.1, gravity: 0 });
			for (const e of aliveEnemies()) {
				if (Math.hypot(e.pos.x - px, e.pos.z - pz) < 1.0 + e.radius) hitEnemy(e, 6, { source: 'omega', knock: 1, dir: { x: Math.cos(a), z: Math.sin(a) }, hitstop: 0.012, shake: 0.04, vol: 0.5 });
			}
			audio.play('swing', { pitch: 1.4 + Math.random() * 0.4, vol: 0.5 });
			this.sqV += 1.5;
		}
		if (this.stateT >= 0.85 && !this.flurryDone) {
			this.flurryDone = true;
			const fx = this.pos.x + Math.cos(this.face) * 1.2, fz = this.pos.z + Math.sin(this.face) * 1.2;
			explodeAt(fx, fz, 3.6, 30, { color: col, source: 'omega', shake: 0.5 });
			shockwave({ x: fx, y: 0.5, z: fz }, 1.2);
			rumble(0.8, 0.9, 260);
			punchZoom(0.05);
			this.sqV -= 8;
		}
		if (this.stateT > 1.0) { this.state = 'idle'; this.stateT = 0; this.flurryDone = false; }
	}

	startSpin() {
		this.mp -= OMEGA_COST;
		this.state = 'spin'; this.stateT = 0; this.spinHits = 0;
		audio.play('spin');
		flashLight(this.pos, this.model.colors.glow, 30, 0.3);
		this.sqV += 6;
	}

	updateSpin(dt) {
		const t = this.stateT;
		const times = [0.08, 0.26, 0.44];
		const col = this.mods.attackEl ? EL[this.mods.attackEl].color : this.model.colors.glow;
		while (this.spinHits < times.length && t >= times[this.spinHits]) {
			this.spinHits++;
			slash({ x: this.pos.x, z: this.pos.z, angle: this.face + this.spinHits * 2.1, arc: Math.PI * 2, r1: 3.5, color: col, dur: 0.22, intensity: 1.8 });
			ring({ x: this.pos.x, z: this.pos.z, r0: 0.5, r1: 3.6, color: col, dur: 0.25 });
			for (const e of aliveEnemies()) {
				const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
				if (d < 3.5 + e.radius) hitEnemy(e, 16, { source: 'omega', knock: this.spinHits === 3 ? 10 : 3, hitstop: 0.05, shake: 0.18 });
			}
			smashBreakables(this.pos.x, this.pos.z, 3.5);
			floorRipple(this.pos.x, this.pos.z, 0.5);
			if (this.spinHits === 3) shockwave({ x: this.pos.x, y: 0.6, z: this.pos.z }, 0.7);
			audio.play('swing', { pitch: 0.8 + this.spinHits * 0.15 });
		}
		if (t > 0.55) { this.state = 'idle'; this.stateT = 0; }
	}

	throwStar() {
		this.state = 'throw'; this.stateT = 0;
		this.face = this.aimAngle;
		this.specialCd = 0.42;
		if (this.patches?.has('triple_star')) {
			for (const off of [-0.22, 0, 0.22]) playerStar(this.pos.x + this.aim.x * 0.6, this.pos.z + this.aim.z * 0.6, this.aimAngle + off, { dmg: 16 * 0.7 });
		} else playerStar(this.pos.x + this.aim.x * 0.6, this.pos.z + this.aim.z * 0.6, this.aimAngle, { dmg: 16 });
		audio.play('star');
		this.sqV += 3;
		this.antennaKick(-4);
		const sc = this.mods.specialEl ? EL_COLOR[this.mods.specialEl] : 0xffcd0f;
		burst({ x: this.pos.x + this.aim.x * 0.8, z: this.pos.z + this.aim.z * 0.8, y: 0.8, count: 8 + Math.max(0, slotTier(this, 'special')) * 4, color: sc, speed: 4, dir: this.aimAngle, spread: 1, size: 0.18, life: 0.25 });
	}

	starfall() {
		this.mp -= OMEGA_COST;
		this.state = 'throw'; this.stateT = 0;
		this.specialCd = 0.6;
		const n = 10;
		for (let i = 0; i < n; i++) {
			const a = this.aimAngle + (i / n) * Math.PI * 2;
			playerStar(this.pos.x, this.pos.z, a, { dmg: 18, speed: 15, life: 0.9, scale: 1.15 });
		}
		ring({ x: this.pos.x, z: this.pos.z, r1: 4, color: 0xffcd0f, dur: 0.35, intensity: 2.5 });
		flashLight(this.pos, 0xffcd0f, 40, 0.25);
		shockwave({ x: this.pos.x, y: 0.7, z: this.pos.z }, 0.8);
		floorRipple(this.pos.x, this.pos.z, 0.9);
		audio.play('star', { pitch: 0.7 });
		audio.play('unlock', { vol: 0.5 });
		addTrauma(0.2);
		this.sqV += 7;
	}

	cast() {
		let tx = this.aimPoint ? this.aimPoint.x : this.pos.x + this.aim.x * 4;
		let tz = this.aimPoint ? this.aimPoint.z : this.pos.z + this.aim.z * 4;
		const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
		if (d > 7) { tx = this.pos.x + dx / d * 7; tz = this.pos.z + dz / d * 7; }
		if (G.room && !G.room.walkable(tx, tz)) { tx = this.pos.x; tz = this.pos.z; }
		castBreakpoint(tx, tz, false);
		this.castCharges = 0;
		this.castCd = 6 * (1 - 0.15 * rank('breakpoints'));
		this.sqV += 4;
	}

	startDash(angle) {
		this.state = 'dash';
		this.stateT = 0;
		this.dashAngle = angle;
		this.face = angle;
		this.vel.set(Math.cos(angle) * 27, 0, Math.sin(angle) * 27);
		this.iframes = Math.max(this.iframes, 0.24);
		this.dashCharges--;
		this.dashRegen = 0.5;
		this.ghostT = 0;
		this.trailT = 0;
		this.dashHit = new Set();
		audio.play('dash');
		dust({ x: this.pos.x, z: this.pos.z, count: 6, speed: 2.5, dir: angle + Math.PI, spread: 1.4, radius: 0.2, color: 0x4a4058 });
		sparks({ x: this.pos.x, y: 0.2, z: this.pos.z, count: 8, speed: 8, dir: angle + Math.PI, spread: 1.1, up: 1, color: this.model.colors.glow, color2: 0xffffff, life: 0.18, width: 0.05 });
		floorRipple(this.pos.x, this.pos.z, 0.25);
		rumble(0.08, 0.25, 60);
		this.antennaKick(8);
		const m = this.mods;
		if (m.dashEl === 'arc') zap(this.pos.x, this.pos.z, m.dashPow, 2);
		if (this.patches?.has('echo_dash')) this.dropEcho();
	}

	dropEcho() {
		const x = this.pos.x, z = this.pos.z;
		const col = this.mods.dashEl ? EL_COLOR[this.mods.dashEl] : this.model.colors.glow;
		ghost(this.model.body, col, 0.55, 0.7);
		const mesh = zoneMesh(2.1, col);
		mesh.position.set(x, 0.05, z);
		new Hazard({
			mesh, dur: 0.5,
			tick(dt, h) { mesh.userData.mat.uniforms.uA.value = 0.4 + h.t * 1.4; mesh.userData.mat.uniforms.uTime.value += dt * 6; },
			end: () => {
				explodeAt(x, z, 2.1, 22, { color: col, source: 'dash', el: this.mods.dashEl, pow: this.mods.dashPow, shake: 0.18 });
			},
		});
	}

	updateDash(dt) {
		this.ghostT -= dt;
		const dcol = this.mods.dashEl ? EL_COLOR[this.mods.dashEl] : this.model.colors.glow;
		if (this.ghostT <= 0) { this.ghostT = 0.03; ghost(this.model.body, dcol, 0.25, 0.4 + Math.max(0, slotTier(this, 'dash')) * 0.08); }
		const m = this.mods;
		if (m.dashEl === 'burn') {
			this.trailT -= dt;
			if (this.trailT <= 0) { this.trailT = 0.06; fireTrail(this.pos.x, this.pos.z, m.dashPow); }
		}
		if (m.dashEl === 'conflict') {
			for (const e of aliveEnemies()) {
				if (this.dashHit.has(e)) continue;
				if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < e.radius + 0.9) {
					this.dashHit.add(e);
					hitEnemy(e, m.dashPow, { source: 'dash', knock: 3, color: 0xff4fd8, hitstop: 0.02 });
					if (e.alive) addConflict(e, 1);
				}
			}
		}
		if (this.stateT >= 0.17) {
			this.state = input.held('dash') && Math.hypot(input.move().x, input.move().z) > 0.1 ? 'sprint' : 'idle';
			this.stateT = 0;
			this.sinceDash = 0;
			this.vel.multiplyScalar(0.2);
			this.sqV -= 4;
			if (m.dashEl === 'chill') {
				ring({ x: this.pos.x, z: this.pos.z, r1: 2.6, color: 0x7fe6ff, dur: 0.3 });
				burst({ x: this.pos.x, z: this.pos.z, y: 0.5, count: 20, color: 0xbff4ff, speed: 5, size: 0.2, life: 0.4 });
				audio.play('freeze', { vol: 0.6 });
				for (const e of aliveEnemies()) {
					if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 2.6 + e.radius) {
						hitEnemy(e, m.dashPow, { source: 'dash', knock: 3, color: 0x7fe6ff, hitstop: 0.02 });
						if (e.alive) addChill(e, 2);
					}
				}
			}
		}
	}

	takeDamage(amount, from) {
		if (!this.alive || this.iframes > 0 || G.mode !== 'run') return false;
		const dmg = Math.max(1, Math.round(amount * (G.run?.dmgTakenMul ?? 1)));
		this.hp -= dmg;
		this.damageTaken += dmg;
		this.iframes = 0.85;
		this.flashT = 1; this.flashColor = 0xff3048;
		const dx = this.pos.x - (from?.x ?? this.pos.x), dz = this.pos.z - (from?.z ?? this.pos.z);
		const d = Math.hypot(dx, dz) || 1;
		this.vel.set(dx / d * 8, 0, dz / d * 8);
		if (this.state !== 'attack' && this.state !== 'dash') { this.state = 'idle'; }
		moveCircle(G.room, this.pos, dx / d * 0.4, dz / d * 0.4, this.radius * 0.8);
		G.hitstop = Math.max(G.hitstop, 0.09);
		addTrauma(0.45);
		rumble(0.85, 0.7, 220);
		sparks({ x: this.pos.x, y: 0.7, z: this.pos.z, count: 14, speed: 11, color: 0xff3048, color2: 0xffffff, life: 0.28 });
		flashScreen(0.18, 0xff2040);
		aberrate(0.025);
		audio.play('hurt');
		damageNumber(this.pos.x, 1.2, this.pos.z, dmg, { color: '#ff4a5a' });
		burst({ x: this.pos.x, z: this.pos.z, y: 0.7, count: 14, color: 0xff3048, color2: this.model.colors.body, speed: 5, size: 0.2, life: 0.4 });
		this.sqV -= 6;
		this.antennaKick(12);
		if (this.hp <= 0) {
			if (this.respawns > 0) this.respawn();
			else this.die();
		} else if (this.hp < this.maxHp * 0.3 && Math.random() < 0.5) this.emote('worry');
		return true;
	}

	respawn() {
		this.respawns--;
		this.hp = Math.round(this.maxHp * 0.45);
		this.iframes = 2.5;
		audio.play('respawn');
		flashScreen(0.5, this.model.colors.glow);
		ring({ x: this.pos.x, z: this.pos.z, r1: 6, color: this.model.colors.glow, dur: 0.6, intensity: 3 });
		burst({ x: this.pos.x, z: this.pos.z, y: 0.5, count: 60, color: this.model.colors.glow, color2: 0xffffff, speed: 8, up: 4, size: 0.3, life: 0.8 });
		damageNumber(this.pos.x, 2, this.pos.z, 0, { text: 'RESPAWNED', color: '#8fe0ff', crit: true });
		for (const e of aliveEnemies()) {
			const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
			if (d < 6 && !e.isBoss) { e.vel.x += dx / d * 14; e.vel.z += dz / d * 14; }
		}
		G.slowmoT = 0.8;
	}

	die() {
		this.alive = false;
		this.state = 'dead';
		this.deadT = 0;
		this.hp = 0;
		audio.play('death');
		G.slowmoT = 1.4;
		flashScreen(0.35, 0xff2040);
		punchZoom(0.12);
		addTrauma(0.6);
	}

	updateDead(dt) {
		this.deadT += dt;
		const k = Math.min(1, this.deadT / 0.25);
		this.model.body.scale.set(1 + k * 0.6, Math.max(0.12, 1 - k * 0.88), 1 + k * 0.6);
		this.model.body.position.y = 0;
		if (this.deadT > 0.3 && !this.splatted) {
			this.splatted = true;
			burst({ x: this.pos.x, z: this.pos.z, y: 0.2, count: 30, color: this.model.colors.body, color2: this.model.colors.dark, speed: 5, up: 2, size: 0.3, life: 0.7 });
		}
	}

	antennaKick(v) {
		for (const a of this.model.antennae) { a.vel += v * (Math.random() * 0.5 + 0.75); a.velX += v * 0.5 * (Math.random() - 0.5); }
	}

	emote(kind) {
		const root = this.root;
		let obj;
		const dur = kind === 'cool' ? 3 : 1.6;
		if (kind === 'love') { obj = heartMesh(0.9); obj.position.set(0, 2.1, 0); }
		else if (kind === 'cool') { obj = sunglassesMesh(); obj.position.set(0, 0.47, 0.6); this.model.body.add(obj); }
		else if (kind === 'worry' || kind === 'sing' || kind === 'dots') {
			const txt = kind === 'worry' ? '!' : kind === 'sing' ? '♪' : '…';
			const col = kind === 'worry' ? 0xffd23f : kind === 'sing' ? 0x9fd8ff : 0xffffff;
			obj = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: glyphTexture(txt, { font: 'bold 100px sans-serif' }), transparent: true, depthWrite: false, color: new THREE.Color(col).multiplyScalar(2) }));
			obj.position.set(kind === 'sing' ? 0.6 : 0, 2.1, 0);
		}
		if (!obj) return;
		if (kind !== 'cool') root.add(obj);
		this.emotes.push({ obj, t: 0, dur, kind, parent: kind === 'cool' ? this.model.body : root });
		if (kind === 'love') audio.play('pickup', { vol: 0.4 });
		if (kind === 'cool') audio.play('select', { vol: 0.4 });
		if (kind === 'sing') audio.play('boon', { vol: 0.3 });
	}

	updateAnim(dt, realDt) {
		const M = this.model;
		const body = M.body;
		this.root.rotation.y = Math.PI / 2 - this.face;
		// squash spring
		this.sqV += (-this.sq * 240 - this.sqV * 13) * dt;
		this.sq += this.sqV * dt;
		const sq = clamp(this.sq, -0.45, 0.45);
		if (!this.alive) { this.updateEmotes(dt); return; }
		let sx = 1, sy = 1, sz = 1;
		if (this.state === 'dash') { sy = 0.72; sz = 1.5; sx = 0.85; }
		else if (this.state === 'sprint') { sz = 1.12; sy = 0.95; }
		else if (this.state === 'charge') { const k = Math.min(1, this.charge / 0.4); sy = 1 - k * 0.2; sx = sz = 1 + k * 0.12; }
		body.scale.set((1 - sq * 0.5) * sx, (1 + sq) * sy, (1 - sq * 0.5) * sz);
		// hop
		if (this.moving) {
			const prev = Math.sin(this.hop);
			this.hop += dt * (this.state === 'sprint' ? 17 : 12.5);
			const cur = Math.sin(this.hop);
			body.position.y = Math.abs(cur) * 0.2;
			if (Math.sign(prev) !== Math.sign(cur)) {
				this.sqV -= 2.2;
				if (Math.random() < 0.7) dust({ x: this.pos.x, z: this.pos.z, count: 2, speed: 0.8, radius: 0.2, size: 0.35, life: 0.45 });
			}
		} else {
			body.position.y = damp(body.position.y, 0.02 + Math.sin(G.time * 2.6) * 0.025, 12, dt);
		}
		const leanTarget = this.state === 'dash' ? 0.45 : this.state === 'sprint' ? 0.3 : this.moving ? 0.16 : this.state === 'attack' ? 0.22 : 0;
		body.rotation.x = damp(body.rotation.x, leanTarget, 12, dt);
		let twist = 0;
		if (this.state === 'attack') { const k = this.swingT / this.swing.dur; twist = Math.sin(k * Math.PI) * 0.5 * this.swing.dir; }
		if (this.state === 'spin') twist = this.stateT * Math.PI * 2 * 3.6;
		body.rotation.y = this.state === 'spin' ? twist : damp(body.rotation.y, -twist, 20, dt);
		// antennae springs driven by acceleration
		const acc = this.accel || { x: 0, z: 0 };
		const c = Math.cos(this.face), s = Math.sin(this.face);
		const lat = -acc.x * s + acc.z * c;
		const fwd = acc.x * c + acc.z * s;
		for (const a of M.antennae) {
			a.vel += (-a.ang * 120 - a.vel * 7) * dt + clamp(-lat * 0.004, -3, 3);
			a.ang += a.vel * dt;
			a.velX += (-a.angX * 120 - a.velX * 7) * dt + clamp(-fwd * 0.004, -3, 3);
			a.angX += a.velX * dt;
			a.pivot.rotation.z = a.base + clamp(a.ang, -0.8, 0.8);
			a.pivot.rotation.x = clamp(a.angX, -0.8, 0.8);
		}
		// blink
		this.blinkT -= dt;
		const blink = this.blinkT < 0.1 && this.blinkT > 0;
		if (this.blinkT <= 0) this.blinkT = rand(1.4, 3.4);
		for (const e of M.eyes) e.scale.y = damp(e.scale.y, blink || this.state === 'charge' ? 0.15 : 1, 30, dt);
		// eyes glance toward aim
		const look = clamp(angleDiff(this.face, this.aimAngle), -0.6, 0.6);
		M.eyes.forEach((e) => { e.position.x = damp(e.position.x, -look * 0.03, 10, dt); });
		// arms
		M.arms.forEach((a, i) => {
			const side = i ? 1 : -1;
			let target = 0.26 + Math.sin(G.time * 3 + i) * 0.02;
			if (this.state === 'attack') target += 0.12;
			if (this.moving) target += Math.sin(this.hop + i * Math.PI) * 0.06;
			a.position.y = damp(a.position.y, target, 14, dt);
			a.position.x = damp(a.position.x, 0.63 * side * (this.state === 'charge' ? 1.1 : 1), 14, dt);
		});
		// weapon
		const cw = M.caret;
		animateWeapon(this, cw, dt);
		const cm = cw.userData.mat;
		const busy = this.state === 'attack' || OMEGA_STATES.has(this.state);
		const tier = Math.max(0, slotTier(this, 'attack'));
		const glow = (busy ? 4 : 2.4 + Math.sin(G.time * 3) * 0.3) * (1 + tier * 0.15);
		const baseCol = this.mods.attackEl ? EL[this.mods.attackEl].color : this.weapon.color;
		cm.color.set(baseCol).multiplyScalar(glow);
		// light
		M.light.intensity = damp(M.light.intensity, busy ? 6 : 3.2, 10, dt);
		if (tier >= 3 && busy && Math.random() < dt * 30) burst({ x: this.pos.x + rand(-0.5, 0.5), z: this.pos.z + rand(-0.5, 0.5), y: 0.8, count: 1, color: 0xffe066, speed: 0.4, up: 1.6, size: 0.14, life: 0.5, gravity: 0 });
		// flash / iframes
		let fl = this.flashT;
		if (this.iframes > 0 && this.flashT <= 0.05 && this.state !== 'dash') fl = 0.25 + 0.25 * Math.sin(G.time * 40);
		setFlash(body, fl, this.flashColor);
		if (this.hat?.userData.spin) this.hat.userData.spin.rotation.y += dt * (this.moving ? 30 : 8);
		this.updateEmotes(dt);
	}

	updateEmotes(dt) {
		for (let i = this.emotes.length - 1; i >= 0; i--) {
			const e = this.emotes[i];
			e.t += dt;
			const k = e.t / e.dur;
			if (e.kind === 'cool') {
				e.obj.position.y = 0.47 + Math.max(0, 1 - e.t / 0.25) * 0.8;
			} else {
				const pop = e.t < 0.25 ? easeOutBack(e.t / 0.25) : 1;
				e.obj.scale.setScalar(Math.max(0.001, pop * (k > 0.8 ? (1 - k) / 0.2 : 1)));
				e.obj.position.y = 2.1 + e.t * 0.3;
				e.obj.rotation.y = -this.root.rotation.y;
				if (e.kind === 'sing') e.obj.position.x = 0.6 + Math.sin(e.t * 6) * 0.2;
			}
			if (k >= 1) {
				e.parent.remove(e.obj);
				this.emotes.splice(i, 1);
			}
		}
	}
}
