import * as THREE from 'three';
import { G } from './state.js';
import { audio } from './audio.js';
import { addTrauma, flashLight, flashScreen, punchZoom, aberrate, shockwave } from './render.js';
import { impact, scorch, floorRipple, rumble } from './juice.js';
import { burst, dust, damageNumber, ring, lightning, teleCircle, addTransient, slash } from './fx.js';
import { starMesh } from './models.js';
import { glowMat } from './materials.js';
import { glyphTexture } from './textures.js';
import { moveCircle, smashBreakables } from './world.js';
import { rand, angleDiff } from './util.js';
import { elementImpact, critFlash, EL_COLOR, slotTier } from './vfx.js';

export const EL = {
	burn: { color: 0xff7a2f, css: '#ff7a2f' },
	chill: { color: 0x7fe6ff, css: '#7fe6ff' },
	arc: { color: 0xffd23f, css: '#ffd23f' },
	conflict: { color: 0xff4fd8, css: '#ff4fd8' },
};

export function aliveEnemies() { return G.enemies.filter((e) => e.alive && e.active); }

export function nearestEnemies(x, z, n, maxDist, exclude = null) {
	return aliveEnemies()
		.filter((e) => e !== exclude && !e.invuln && Math.hypot(e.pos.x - x, e.pos.z - z) <= maxDist)
		.sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))
		.slice(0, n);
}

// Central enemy damage pipeline: modifiers, crits, juice, and elemental side effects.
export function hitEnemy(e, base, opts = {}) {
	if (!e.alive || !e.active) return 0;
	const P = G.player;
	const m = P.mods;
	const source = opts.source || 'attack';
	if (e.invuln) {
		if (!opts.silent) {
			damageNumber(e.pos.x, 1.2, e.pos.z, 0, { text: 'IMMUNE', color: '#aaa' });
			audio.play('ui', { pitch: 0.6, vol: 0.5 });
		}
		return 0;
	}
	let dmg = base * m.dmgMul;
	if (source === 'attack' || source === 'omega') dmg *= m.attackMul;
	if (source === 'special') dmg *= m.specialMul;
	if (source === 'cast') dmg *= m.castMul;
	if (source === 'dash') dmg *= m.dashMul;
	if ((e.isBoss || e.elite) && m.blame) dmg *= 1 + m.blame;
	if (e.vulnerable) dmg *= e.vulnerable;
	let crit = false;
	if (source !== 'element' && Math.random() < m.crit) { crit = true; dmg *= 2; }
	dmg = Math.max(1, Math.round(dmg));

	const dir = opts.dir || { x: e.pos.x - P.pos.x, z: e.pos.z - P.pos.z };
	const dl = Math.hypot(dir.x, dir.z) || 1;
	e.takeDamage(dmg, { x: dir.x / dl, z: dir.z / dl }, opts.knock ?? 4);

	const color = opts.color ?? (crit ? 0xffe066 : 0xffffff);
	if (!opts.silent) {
		damageNumber(e.pos.x, e.height * 0.7, e.pos.z, dmg, { crit, color: opts.numColor });
		burst({ x: e.pos.x, z: e.pos.z, y: e.height * 0.5, count: crit ? 16 : 9, color, color2: opts.color2 ?? P.model.colors.glow, speed: crit ? 7 : 5, dir: Math.atan2(dir.z, dir.x), spread: 1.8, up: 2, size: 0.2, life: 0.35 });
		if (source !== 'element') {
			audio.play(crit ? 'crit' : 'hit', { vol: opts.vol ?? 1 });
			G.hitstop = Math.max(G.hitstop, opts.hitstop ?? (crit ? 0.085 : 0.045));
			addTrauma(opts.shake ?? (crit ? 0.22 : 0.1));
			if (crit) { flashLight(e.pos, 0xffe066, 40, 0.12); aberrate(0.012); critFlash(e.pos.x, e.height * 0.7, e.pos.z, opts.critColor ?? 0xffe066); }
			const big = crit || (opts.hitstop ?? 0) > 0.06;
			impact(e.pos.x, e.pos.z, { y: e.height * 0.55, color: crit ? 0xffe066 : (opts.color ?? P.model.colors.glow), color2: 0xffffff, dir: Math.atan2(dir.z, dir.x), power: big ? 1.4 : 0.7, chunk: big && !e.isBoss ? 3 : 0, ripple: big ? 0.35 : 0 });
			rumble(big ? 0.45 : 0.18, big ? 0.6 : 0.3, big ? 90 : 50);
		}
	}
	if (source === 'attack' || source === 'omega') P.gainMp(3);

	// elements
	const el = source === 'attack' || source === 'omega' ? m.attackEl : source === 'special' ? m.specialEl : null;
	if (el && !opts.silent) {
		const tier = Math.max(0, slotTier(P, source === 'special' ? 'special' : 'attack'));
		elementImpact(el, e.pos.x, e.height * 0.55, e.pos.z, Math.atan2(dir.z, dir.x), 0.8 + tier * 0.2 + (crit ? 0.3 : 0));
	}
	if (el && e.alive) {
		const pow = source === 'special' ? m.specialPow : m.attackPow;
		applyElement(e, el, pow, source);
	}
	return dmg;
}

export function applyElement(e, el, pow, source) {
	const m = G.player.mods;
	switch (el) {
		case 'burn': {
			applyBurn(e, pow * m.burnMul, 3);
			break;
		}
		case 'chill': addChill(e, source === 'special' ? 2 : 1); break;
		case 'arc': chainLightning(e, pow, 2 + m.chains); break;
		case 'conflict': addConflict(e, source === 'special' ? 2 : 1); break;
	}
}

export function applyBurn(e, dps, t = 3) {
	if (!e.alive) return;
	if (!e.status.burn || e.status.burn.dps <= dps) e.status.burn = { dps, t, tick: 0 };
	else e.status.burn.t = Math.max(e.status.burn.t, t);
	thermalShock(e);
}

// Duo (Pyra + Glacé): foes both Burning and Chilled erupt in steam.
function thermalShock(e) {
	const m = G.player.mods;
	if (!m.thermalShock || !e.alive || !e.status.burn || e.status.chill <= 0) return;
	if ((e.steamCd || 0) > G.time) return;
	e.steamCd = G.time + 0.9;
	const x = e.pos.x, z = e.pos.z;
	burst({ x, z, y: 0.8, count: 30, color: 0xffffff, color2: 0xbff4ff, speed: 3, up: 3, size: 0.6, sizeEnd: 1.2, life: 0.8, gravity: 1, drag: 3 });
	burst({ x, z, y: 0.5, count: 14, color: 0xff7a2f, color2: 0x7fe6ff, speed: 6, size: 0.25, life: 0.4 });
	damageNumber(x, e.height + 0.6, z, 0, { text: 'THERMAL SHOCK', color: '#ffd9c0' });
	setTimeout(() => explodeAt(x, z, 2.4, m.thermalShock, { color: 0xffd9c0, source: 'element', shake: 0.2 }), 0);
}

export function addChill(e, stacks) {
	if (!e.alive) return;
	const s = e.status;
	s.chill = Math.min(5, s.chill + stacks);
	s.chillT = 4;
	thermalShock(e);
	burst({ x: e.pos.x, z: e.pos.z, y: e.height * 0.6, count: 5, color: 0xbff4ff, speed: 2, size: 0.18, life: 0.5, gravity: -2 });
	if (s.chill >= 5 && !e.isBoss) {
		s.chill = 0;
		s.stun = Math.max(s.stun, 1.4);
		e.frozen = 1.4;
		audio.play('freeze');
		ring({ x: e.pos.x, z: e.pos.z, r1: 1.6, color: 0x7fe6ff, dur: 0.3 });
	}
}

export function addConflict(e, stacks) {
	if (!e.alive) return;
	const m = G.player.mods;
	e.status.conflict += stacks;
	if (e.status.conflict >= 3) {
		e.status.conflict = 0;
		const r = 2.2 + (m.conflictMul > 1 ? 0.8 : 0);
		const dmg = (m.conflictPow || 12) * m.conflictMul;
		audio.play('conflict');
		ring({ x: e.pos.x, z: e.pos.z, r1: r, color: 0xff4fd8, dur: 0.35, intensity: 2.5 });
		burst({ x: e.pos.x, z: e.pos.z, y: 0.8, count: 22, color: 0xff4fd8, color2: 0x7dff9a, speed: 6, size: 0.22, life: 0.45 });
		flashLight(e.pos, 0xff4fd8, 30, 0.15);
		const ex = e.pos.clone();
		if (m.conflictMul > 1) ring({ x: ex.x, z: ex.z, r0: r * 0.3, r1: r * 1.25, color: 0x7dff9a, dur: 0.4, intensity: 2 });
		for (const o of aliveEnemies()) {
			if (Math.hypot(o.pos.x - ex.x, o.pos.z - ex.z) > r + o.radius) continue;
			const frozen = m.frozenBranch && o.frozen > 0;
			hitEnemy(o, dmg * (frozen ? 2 : 1), { source: 'element', knock: 3, dir: { x: o.pos.x - ex.x, z: o.pos.z - ex.z }, numColor: frozen ? '#bff4ff' : EL.conflict.css });
			if (m.flameWar && o.alive) applyBurn(o, 10 * m.burnMul, 3);
			if (m.frozenBranch && o.alive) addChill(o, 3);
		}
		if (m.flameWar) {
			for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; fireTrail(ex.x + Math.cos(a) * r * 0.6, ex.z + Math.sin(a) * r * 0.6, 8); }
			burst({ x: ex.x, z: ex.z, y: 0.5, count: 24, color: 0xff7a2f, color2: 0xff4fd8, speed: 5, up: 4, size: 0.3, life: 0.6, gravity: 1 });
		}
		if (m.frozenBranch) burst({ x: ex.x, z: ex.z, y: 0.6, count: 20, color: 0xbff4ff, color2: 0xff4fd8, speed: 5, size: 0.2, life: 0.5, gravity: -2 });
		if (m.mergeStorm) zap(ex.x, ex.z, 15, 3);
	}
}

// Lightning strike with Duo modifiers (Hot Patch, Superconductor) applied.
function arcStrike(target, dmg, from) {
	const m = G.player.mods;
	let d = dmg * m.arcMul;
	let crit = false;
	if (m.hotPatch && target.status.burn) d *= 1.5;
	if (m.superconductor && target.status.chill > 0) { d *= 2; crit = true; }
	const width = 0.14 + m.chains * 0.03 + (crit ? 0.06 : 0);
	lightning(from, target.pos, { color: m.hotPatch ? 0xffb347 : crit ? 0xbff4ff : 0xffe066, width });
	if (m.chains > 0) lightning(from, target.pos, { color: 0xffffff, width: width * 0.4, jag: 0.8 });
	hitEnemy(target, d, { source: 'element', knock: 1.2, numColor: crit ? '#bff4ff' : EL.arc.css, color: 0xffe066 });
	if (crit) critFlash(target.pos.x, target.height * 0.7, target.pos.z, 0xbff4ff);
	if (m.hotPatch && target.alive) applyBurn(target, 8 * m.burnMul, 2.5);
}

export function chainLightning(from, dmg, count) {
	const m = G.player.mods;
	if (m.superconductor) count += 2;
	let prev = from;
	const hit = new Set([from]);
	audio.play('zap');
	for (let i = 0; i < count; i++) {
		const next = aliveEnemies().filter((e) => !hit.has(e) && !e.invuln).sort((a, b) => a.pos.distanceTo(prev.pos) - b.pos.distanceTo(prev.pos))[0];
		if (!next || next.pos.distanceTo(prev.pos) > 7) break;
		arcStrike(next, dmg, prev.pos);
		hit.add(next);
		prev = next;
	}
}

export function zap(x, z, dmg, n) {
	const targets = nearestEnemies(x, z, n + (G.player.mods.superconductor ? 1 : 0), 8);
	if (targets.length) audio.play('zap');
	for (const t of targets) arcStrike(t, dmg, { x, z });
}

export function explodeAt(x, z, r, dmg, { color = 0xff7a2f, hurtsPlayer = false, playerDmg = 0, hurtsEnemies = true, source = 'element', el = null, pow = 0, shake = 0.3 } = {}) {
	ring({ x, z, r1: r, color, dur: 0.35, intensity: 2.2 });
	ring({ x, z, r1: r * 0.6, color: 0xffffff, dur: 0.2, intensity: 1.5 });
	burst({ x, z, y: 0.6, count: 34, color, color2: 0xffffff, speed: r * 3, size: 0.28, life: 0.5, up: 3 });
	dust({ x, z, count: 10, speed: r * 1.5, radius: 0.5, color: 0x2a2233 });
	flashLight({ x, z }, color, 60, 0.2, r * 4);
	addTrauma(shake);
	audio.play('explode', { vol: 0.8 });
	scorch(x, z, r * 0.9, color);
	floorRipple(x, z, Math.min(1.6, 0.5 + r * 0.25));
	impact(x, z, { y: 0.5, color, color2: 0xffffff, spread: Math.PI * 2, power: Math.min(2, r * 0.5), chunk: r > 2 ? 4 : 0 });
	if (r >= 2.4) shockwave({ x, y: 0.4, z }, Math.min(1.4, r * 0.3));
	smashBreakables(x, z, r);
	if (hurtsEnemies) {
		for (const e of aliveEnemies()) {
			if (Math.hypot(e.pos.x - x, e.pos.z - z) <= r + e.radius) {
				hitEnemy(e, dmg, { source, knock: 6, dir: { x: e.pos.x - x, z: e.pos.z - z } });
				if (el && e.alive) applyElement(e, el, pow, source);
			}
		}
	}
	if (hurtsPlayer) {
		const P = G.player;
		if (Math.hypot(P.pos.x - x, P.pos.z - z) <= r + P.radius * 0.5) P.takeDamage(playerDmg, { x, z });
	}
}

// ---------------- projectiles ----------------
const orbGeo = new THREE.SphereGeometry(0.22, 12, 10); orbGeo.userData.shared = true;
const orbCore = new THREE.SphereGeometry(0.12, 8, 6); orbCore.userData.shared = true;

export class Projectile {
	constructor(o) {
		Object.assign(this, { r: 0.3, dmg: 10, owner: 'enemy', life: 3, pierce: 0, hit: new Set(), spin: 0, trail: null, onHit: null, onEnd: null, homing: 0, bounce: 0 }, o);
		this.pos = new THREE.Vector3(o.x, o.y ?? 0.9, o.z);
		this.vel = new THREE.Vector3(o.vx, 0, o.vz);
		this.mesh = o.mesh;
		this.mesh.position.copy(this.pos);
		G.scene.add(this.mesh);
		this.alive = true;
		G.projectiles.push(this);
	}

	update(dt) {
		this.life -= dt;
		if (this.homing && this.owner === 'enemy') {
			const P = G.player;
			const want = Math.atan2(P.pos.z - this.pos.z, P.pos.x - this.pos.x);
			const cur = Math.atan2(this.vel.z, this.vel.x);
			const sp = Math.hypot(this.vel.x, this.vel.z);
			const na = cur + Math.max(-this.homing * dt, Math.min(this.homing * dt, angleDiff(cur, want)));
			this.vel.set(Math.cos(na) * sp, 0, Math.sin(na) * sp);
		}
		if (this.returning) {
			const P = G.player;
			const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
			const sp = Math.max(16, Math.hypot(this.vel.x, this.vel.z));
			this.vel.set(dx / (d || 1) * sp, 0, dz / (d || 1) * sp);
			if (d < 0.8) return this.kill();
		}
		this.pos.x += this.vel.x * dt;
		this.pos.z += this.vel.z * dt;
		this.mesh.position.copy(this.pos);
		if (this.spin) this.mesh.rotation.y += this.spin * dt;
		this.onTick?.(dt, this);
		if (this.trail && Math.random() < 0.9) burst({ x: this.pos.x, z: this.pos.z, y: this.pos.y, count: 1, color: this.trail, speed: 0.3, up: 0, upVar: 0.2, size: this.owner === 'player' ? 0.3 : 0.35, sizeEnd: 0, life: 0.25, gravity: 0 });
		const room = G.room;
		if (this.boomerang && !this.returning && this.life <= 0) {
			this.returning = true;
			this.life = 1.4;
			this.hit.clear();
			this.pierce = 99;
			ring({ x: this.pos.x, z: this.pos.z, y: this.pos.y, r1: 1, color: this.trail || 0xffffff, dur: 0.2 });
		}
		if (this.life <= 0 || (!this.returning && room && !room.walkable(this.pos.x, this.pos.z))) {
			if (room && !room.walkable(this.pos.x, this.pos.z) && this.pos.y > 0) burst({ x: this.pos.x, z: this.pos.z, y: this.pos.y, count: 6, color: this.trail || 0xffffff, speed: 3, size: 0.18, life: 0.3 });
			return this.kill();
		}
		if (this.owner === 'player') {
			if (smashBreakables(this.pos.x, this.pos.z, this.r) && !this.returning) return this.kill();
			for (const e of G.enemies) {
				if (!e.alive || !e.active || this.hit.has(e)) continue;
				if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < e.radius + this.r) {
					this.hit.add(e);
					if (this.onHit) this.onHit(e, this);
					if (this.pierce-- <= 0) return this.kill();
				}
			}
		} else {
			const P = G.player;
			if (P.alive && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < P.radius * 0.8 + this.r) {
				if (P.takeDamage(this.dmg, { x: this.pos.x - this.vel.x, z: this.pos.z - this.vel.z })) {
					burst({ x: this.pos.x, z: this.pos.z, y: this.pos.y, count: 10, color: this.trail || 0xff3366, speed: 4, size: 0.2, life: 0.3 });
					return this.kill();
				}
			}
		}
	}

	kill() {
		if (!this.alive) return;
		this.alive = false;
		if (this.onEnd) this.onEnd(this);
		G.scene.remove(this.mesh);
		this.mesh.traverse((o) => {
			if (o.material && !o.material.userData.shared) o.material.dispose();
			if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
		});
	}
}

const orbMats = new Map();
function orbMat(color, k) {
	const key = color + ':' + k;
	if (!orbMats.has(key)) { const m = glowMat(color, k); m.userData.shared = true; orbMats.set(key, m); }
	return orbMats.get(key);
}

export function enemyOrb(x, z, angle, speed, dmg, color = 0xff3366, opts = {}) {
	const g = new THREE.Group();
	g.add(new THREE.Mesh(orbGeo, orbMat(color, 2.2)));
	g.add(new THREE.Mesh(orbCore, orbMat(0xffffff, 2.5)));
	const s = opts.scale ?? 1;
	g.scale.setScalar(s);
	return new Projectile({ x, z, y: opts.y ?? 0.9, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, dmg, r: 0.26 * s, owner: 'enemy', mesh: g, trail: color, life: opts.life ?? 4, homing: opts.homing ?? 0 });
}

// Builds a star whose shape and trail reflect the Special's element.
function starVisual(el, scale, angle) {
	const holder = new THREE.Group();
	let trail = 0xffcd0f, spin = 18, onTick = null;
	if (el === 'chill') {
		const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32 * scale, 0), new THREE.MeshPhysicalMaterial({ color: 0xbff4ff, emissive: 0x3fb8e0, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.1, flatShading: true, clearcoat: 1 }));
		shard.scale.set(0.7, 0.7, 2.4);
		const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 * scale, 0), glowMat(0xffffff, 2.4));
		holder.add(shard, tip);
		holder.rotation.y = -angle + Math.PI / 2;
		trail = 0x7fe6ff; spin = 0;
		onTick = (dt, p) => { shard.rotation.z += dt * 14; if (Math.random() < 0.5) burst({ x: p.pos.x, z: p.pos.z, y: p.pos.y, count: 1, color: 0xffffff, speed: 0.5, up: -0.5, size: 0.1, life: 0.5, gravity: -3 }); };
	} else {
		const color = el === 'burn' ? 0xff8a3d : el === 'arc' ? 0xfff07a : 0xffcd0f;
		const star = starMesh(0.9 * scale, color, el ? 1.6 : 1.1);
		star.rotation.x = -Math.PI / 2.6;
		holder.add(star);
		if (el === 'burn') {
			const core = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 12, 8), glowMat(0xffd166, 3, { transparent: true, additive: true, opacity: 0.8 }));
			holder.add(core);
			trail = 0xff7a2f;
			onTick = (dt, p) => { if (Math.random() < 0.9) burst({ x: p.pos.x, z: p.pos.z, y: p.pos.y, count: 2, color: 0xff7a2f, color2: 0xffd166, speed: 0.6, up: 1.8, size: 0.32 * scale, life: 0.35, gravity: 1 }); };
		} else if (el === 'arc') {
			trail = 0xffe066;
			let t = 0;
			onTick = (dt, p) => {
				t -= dt;
				if (t > 0) return;
				t = 0.05;
				const a = rand(0, Math.PI * 2), r = rand(0.5, 1.1) * scale;
				lightning({ x: p.pos.x, z: p.pos.z }, { x: p.pos.x + Math.cos(a) * r, z: p.pos.z + Math.sin(a) * r }, { color: 0xffe066, width: 0.04, dur: 0.06, y: p.pos.y, jag: 0.2 });
			};
		} else if (el === 'conflict') {
			holder.remove(star);
			const a1 = starMesh(0.6 * scale, 0xff4fd8, 1.6), a2 = starMesh(0.6 * scale, 0x7dff9a, 1.6);
			a1.rotation.x = a2.rotation.x = -Math.PI / 2.6;
			holder.add(a1, a2);
			trail = 0xff4fd8; spin = 0;
			let ph = 0;
			onTick = (dt) => { ph += dt * 26; a1.position.set(Math.cos(ph) * 0.3, 0, Math.sin(ph) * 0.3); a2.position.set(-Math.cos(ph) * 0.3, 0, -Math.sin(ph) * 0.3); a1.rotation.y += dt * 18; a2.rotation.y -= dt * 18; };
		}
	}
	return { holder, trail, spin, onTick };
}

export function playerStar(x, z, angle, { speed = 19, dmg = 16, scale = 1, life = 0.7, source = 'special' } = {}) {
	const P = G.player;
	const m = P.mods;
	const tier = Math.max(0, slotTier(P, 'special'));
	const vis = starVisual(m.specialEl, scale * (1 + tier * 0.1), angle);
	return new Projectile({
		x, z, y: 0.8, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, dmg, r: 0.45 * scale, owner: 'player', mesh: vis.holder, trail: vis.trail, life, pierce: 1 + m.starPierce, spin: vis.spin, onTick: vis.onTick,
		boomerang: P.patches?.has('boomerang'),
		onHit: (e, pr) => {
			hitEnemy(e, pr.dmg, { source, knock: 3.5, dir: { x: pr.vel.x, z: pr.vel.z }, color: 0xffe066, hitstop: 0.03 });
			if (m.specialEl === 'burn' && m.flareStar) explodeAt(pr.pos.x, pr.pos.z, 1.8, m.flareStar, { color: 0xff7a2f, source: 'element', el: 'burn', pow: m.specialPow, shake: 0.12 });
			if (m.specialEl === 'arc' && m.stepOver) chainLightning(e, m.stepOver, 3 + m.chains);
		},
	});
}

// ---------------- hazards (ground zones) ----------------
export class Hazard {
	constructor(o) {
		Object.assign(this, { t: 0, dur: 1, alive: true }, o);
		G.hazards.push(this);
		if (this.mesh) G.scene.add(this.mesh);
	}
	update(dt) {
		this.t += dt;
		if (this.tick) this.tick(dt, this);
		if (this.t >= this.dur) this.kill();
	}
	kill() {
		if (!this.alive) return;
		this.alive = false;
		if (this.end) this.end(this);
		if (this.mesh) {
			G.scene.remove(this.mesh);
			this.mesh.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
		}
	}
}

const zoneFS = /* glsl */`
	uniform vec3 uColor; uniform float uA; uniform float uTime; varying vec2 vUv;
	void main() {
		vec2 p = vUv - 0.5; float d = length(p) * 2.0;
		if (d > 1.0) discard;
		float rim = smoothstep(0.86, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d));
		float a = atan(p.y, p.x);
		float ticks = step(0.92, fract(a / 6.2831 * 24.0)) * step(0.75, d);
		float swirl = 0.5 + 0.5 * sin(a * 4.0 + d * 10.0 - uTime * 4.0);
		float fill = (0.12 + 0.12 * swirl) * (1.0 - d * 0.3);
		gl_FragColor = vec4(uColor * (rim * 1.6 + ticks + fill) * uA, 1.0);
	}`;
const zoneVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function zoneMesh(r, color) {
	const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.3) }, uA: { value: 0 }, uTime: { value: 0 } }, vertexShader: zoneVS, fragmentShader: zoneFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
	const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
	m.scale.set(r, 1, r);
	m.renderOrder = 7;
	m.userData.mat = mat;
	return m;
}

// Buddy's Cast: a Breakpoint circle that roots foes (Hades II binding-circle homage).
export function castBreakpoint(x, z, omega = false) {
	const P = G.player;
	const m = P.mods;
	const r = (omega ? 4.4 : 3.0) + m.castRadiusAdd;
	const color = m.castEl ? EL[m.castEl].color : 0xff5a6e;
	const mesh = zoneMesh(r, color);
	mesh.position.set(x, 0.05, z);
	const glyph = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glyphTexture('●', { font: 'bold 90px sans-serif' }), color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
	glyph.position.y = 0.02;
	mesh.add(glyph);
	audio.play('cast');
	ring({ x, z, r0: r * 1.4, r1: r, color, dur: 0.3, intensity: 2.5 });
	burst({ x, z, count: 30, color, radius: r * 0.6, speed: 1.2, up: 3, size: 0.2, life: 0.7, gravity: -1 });
	flashLight({ x, z }, color, 25, 0.25, r * 3);
	addTrauma(0.12);
	G.boss?.onCast?.(x, z, r);
	const dur = omega ? 3.5 : 2.6;
	const inside = (e) => Math.hypot(e.pos.x - x, e.pos.z - z) <= r + e.radius * 0.5;
	for (const e of aliveEnemies()) {
		if (inside(e)) {
			hitEnemy(e, omega ? 30 : 8, { source: 'cast', knock: 0, silent: false, hitstop: 0.02 });
			if (!e.isBoss) e.status.root = Math.max(e.status.root, dur);
			if (m.castEl === 'chill') addChill(e, 3);
		}
	}
	let tickT = 0, rootT = 0;
	new Hazard({
		mesh, dur,
		tick(dt, h) {
			const k = h.t / h.dur;
			mesh.userData.mat.uniforms.uA.value = Math.min(1, h.t * 8) * (k > 0.85 ? (1 - k) / 0.15 : 1);
			mesh.userData.mat.uniforms.uTime.value += dt;
			glyph.rotation.y += dt * 0.8;
			tickT -= dt; rootT -= dt;
			if (rootT <= 0) {
				rootT = 0.25;
				for (const e of aliveEnemies()) if (inside(e) && !e.isBoss) e.status.root = Math.max(e.status.root, 0.3);
			}
			if (m.castEl === 'burn' && tickT <= 0) {
				tickT = 0.33;
				for (const e of aliveEnemies()) if (inside(e)) { hitEnemy(e, m.castPow * 0.33, { source: 'element', knock: 0, numColor: EL.burn.css, silent: true }); e.status.burn = { dps: m.castPow * 0.3, t: 1.5, tick: 0 }; }
				burst({ x: x + rand(-r, r) * 0.7, z: z + rand(-r, r) * 0.7, count: 3, color: 0xff7a2f, color2: 0xffd166, speed: 0.5, up: 3, size: 0.3, life: 0.6, gravity: 1 });
			}
			if (m.castEl === 'arc' && tickT <= 0) {
				tickT = 0.4;
				const inn = aliveEnemies().filter(inside);
				if (inn.length) {
					const t = inn[Math.floor(Math.random() * inn.length)];
					lightning({ x: t.pos.x + rand(-0.5, 0.5), z: t.pos.z - 6 }, t.pos, { color: 0xffe066, width: 0.2 });
					hitEnemy(t, m.castPow, { source: 'element', knock: 1, numColor: EL.arc.css, color: 0xffe066 });
					audio.play('zap');
				}
			}
			if (m.castEl === 'conflict') {
				for (const e of aliveEnemies()) {
					if (!inside(e) || e.isBoss) continue;
					const dx = x - e.pos.x, dz = z - e.pos.z, d = Math.hypot(dx, dz);
					if (d > 0.4) moveCircle(G.room, e.pos, dx / d * 3 * dt, dz / d * 3 * dt, e.radius);
				}
				if (tickT <= 0) { tickT = 1; for (const e of aliveEnemies()) if (inside(e)) addConflict(e, 1); }
			}
		},
		end() {
			if (m.castEl === 'chill') {
				explodeAt(x, z, r, m.castPow, { color: 0x7fe6ff, source: 'element', shake: 0.2 });
				audio.play('freeze');
			}
		},
	});
}

export function fireTrail(x, z, dps) {
	const mesh = zoneMesh(0.9, 0xff7a2f);
	mesh.position.set(x, 0.04, z);
	let tick = 0;
	new Hazard({
		mesh, dur: 2.2,
		tick(dt, h) {
			mesh.userData.mat.uniforms.uA.value = Math.min(1, h.t * 10) * (1 - h.t / h.dur);
			mesh.userData.mat.uniforms.uTime.value += dt;
			if (Math.random() < dt * 8) burst({ x: x + rand(-0.5, 0.5), z: z + rand(-0.5, 0.5), count: 1, color: 0xff7a2f, color2: 0xffd166, speed: 0.3, up: 2.5, size: 0.25, life: 0.5, gravity: 1 });
			tick -= dt;
			if (tick <= 0) {
				tick = 0.3;
				for (const e of aliveEnemies()) {
					if (Math.hypot(e.pos.x - x, e.pos.z - z) < 1 + e.radius) {
						e.status.burn = { dps: dps * G.player.mods.burnMul, t: 2, tick: 0 };
					}
				}
			}
		},
	});
}

// Lobbed enemy shell: telegraph circle, then an explosion that hurts the player.
export function mortar(x, z, { r = 1.8, delay = 1.0, dmg = 12, color = 0xff3048 } = {}) {
	teleCircle({ x, z, r, dur: delay, color, onDone: () => explodeAt(x, z, r, 0, { color: 0xff6a3d, hurtsPlayer: true, playerDmg: dmg, hurtsEnemies: false, shake: 0.18 }) });
}

export function updateCombat(dt) {
	for (let i = G.projectiles.length - 1; i >= 0; i--) {
		const p = G.projectiles[i];
		if (p.alive) p.update(dt);
		if (!p.alive) G.projectiles.splice(i, 1);
	}
	for (let i = G.hazards.length - 1; i >= 0; i--) {
		const h = G.hazards[i];
		if (h.alive) h.update(dt);
		if (!h.alive) G.hazards.splice(i, 1);
	}
}

export function clearCombat() {
	for (const p of G.projectiles) p.kill();
	G.projectiles.length = 0;
	for (const h of G.hazards) { h.end = null; h.kill(); }
	G.hazards.length = 0;
}

export { slash, addTransient, flashScreen, punchZoom };
