import * as THREE from 'three';
import { G } from './state.js';
import { audio } from './audio.js';
import { Enemy, ENEMY_TYPES } from './enemies.js';
import { createDeprecata, createCollector, createRevert } from './models.js';
import { setFlash, glowMat } from './materials.js';
import { burst, dust, ring, teleCircle, teleLine, damageNumber, addTransient } from './fx.js';
import { addTrauma, flashLight, flashScreen, punchZoom, aberrate, R } from './render.js';
import { moveCircle, randomSpawnPoint } from './world.js';
import { enemyOrb, mortar, explodeAt, Hazard, zoneMesh } from './combat.js';
import { UI } from './ui.js';
import { rand, clamp, angleDiff, pick } from './util.js';

Object.assign(ENEMY_TYPES, {
	deprecata: { name: 'Deprecata', title: 'The Sunset Queen', hp: 1100, speed: 2.2, radius: 1.3, dmg: 11, height: 3.8, knockRes: 1, color: 0xff8a3d },
	collector: { name: 'The Garbage Collector', title: 'Sweeper of the Unreferenced', hp: 1500, speed: 2.4, radius: 1.7, dmg: 16, height: 3.2, knockRes: 1, color: 0xff3b30 },
	revert: { name: 'REVERT', title: 'Titan of History', hp: 2300, speed: 2, radius: 1.4, dmg: 14, height: 4.6, knockRes: 1, color: 0xe8d6a0 },
});

class Boss extends Enemy {
	constructor(kind, x, z, model) {
		super(kind, x, z, { model, instant: true });
		this.isBoss = true;
		this.kind = kind;
		this.name = this.cfg.name;
		this.title = this.cfg.title;
		this.gen = null;
		this.wait = 0;
		this.idleT = 2.2;
		this.phase = 1;
		this.adds = [];
		this.root.scale.setScalar(1);
		this.baseScale = 1;
		this.state = 'intro';
		this.active = false;
		this.hoverY = 0;
		this.lastPatterns = [];
	}

	begin() { this.state = 'fight'; this.active = true; this.t = 0; }

	takeDamage(amount) {
		this.hp -= amount;
		this.flash = 1;
		this.squashV -= 2;
		if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
			this.phase = 2;
			this.onPhase2?.();
		}
		if (this.hp <= 0) this.die();
	}

	die() {
		if (!this.alive) return;
		this.alive = false;
		this.active = false;
		this.deathT = 0;
		for (const a of this.adds) if (a.alive) a.die();
		G.projectiles.forEach((p) => { if (p.owner === 'enemy') p.kill(); });
		audio.play('roar', { vol: 0.8 });
		G.slowmoT = 1.6;
		flashScreen(0.6, 0xffffff);
		punchZoom(0.15);
		addTrauma(0.8);
		if (this.onDeath) this.onDeath(this);
	}

	update(dt) {
		if (!this.alive) {
			this.deathT += dt;
			if (Math.random() < dt * 14) {
				const x = this.pos.x + rand(-1.5, 1.5), z = this.pos.z + rand(-1.5, 1.5);
				burst({ x, z, y: rand(0.5, this.height), count: 18, color: this.cfg.color, color2: 0xffffff, speed: 6, size: 0.3, life: 0.6 });
				flashLight({ x, z }, this.cfg.color, 40, 0.15);
				audio.play('explode', { vol: 0.4, pitch: rand(0.8, 1.3) });
			}
			setFlash(this.model.body, 0.5 + 0.5 * Math.sin(this.deathT * 30), 0xffffff);
			this.model.body.rotation.z = Math.sin(this.deathT * 50) * 0.05;
			if (this.deathT > 1.4) {
				const s = Math.max(0.001, 1 - (this.deathT - 1.4) / 0.35);
				this.root.scale.set(1 + (1 - s), s, 1 + (1 - s));
			}
			if (this.deathT > 1.75) {
				explodeAt(this.pos.x, this.pos.z, 5, 0, { color: this.cfg.color, hurtsEnemies: false, shake: 0.9 });
				burst({ x: this.pos.x, z: this.pos.z, y: 1.5, count: 120, color: this.cfg.color, color2: 0xffffff, speed: 12, size: 0.35, life: 1.2, up: 6 });
				this.remove();
				return false;
			}
			return true;
		}
		this.t += dt;
		this.dt = dt;
		this.updateStatus(dt);
		if (this.state === 'fight') this.runPatterns(dt);
		else this.idleMotion?.(dt);
		const drag = Math.exp(-8 * dt);
		moveCircle(G.room, this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
		this.vel.x *= drag; this.vel.z *= drag;
		this.animate(dt, false);
		this.animateBoss?.(dt);
		this.adds = this.adds.filter((a) => a.alive);
		return true;
	}

	runPatterns(dt) {
		if (this.gen) {
			this.wait -= dt;
			let guard = 0;
			while (this.gen && this.wait <= 0 && guard++ < 20) {
				const r = this.gen.next();
				if (r.done) { this.gen = null; this.idleT = this.phase === 2 ? 0.55 : 1.0; break; }
				if (r.value <= 0) { this.wait = 0; break; }
				this.wait += r.value;
			}
			return;
		}
		this.idleT -= dt;
		this.idleMotion?.(dt);
		if (this.idleT <= 0) {
			const name = this.pickPattern();
			this.lastPatterns.push(name);
			if (this.lastPatterns.length > 2) this.lastPatterns.shift();
			this.gen = this[name]();
			this.wait = 0;
		}
	}

	force(name) { this.gen = this[name](); this.wait = 0; }

	choose(options) {
		const pool = options.filter((o) => !(this.lastPatterns[this.lastPatterns.length - 1] === o.v && options.length > 1));
		let total = pool.reduce((s, o) => s + o.w, 0), r = Math.random() * total;
		for (const o of pool) { r -= o.w; if (r <= 0) return o.v; }
		return pool[0].v;
	}

	bark(text) { UI.bark(text, this.name, '#' + new THREE.Color(this.cfg.color).getHexString()); }

	*teleport() {
		const bs = this.model.body.scale;
		for (let t = 0; t < 0.3; t += this.dt) { bs.set(1, Math.max(0.01, 1 - t / 0.3), 1); yield 0; }
		burst({ x: this.pos.x, z: this.pos.z, y: 1.5, count: 30, color: this.cfg.color, speed: 4, size: 0.25, life: 0.5 });
		const p = randomSpawnPoint(G.room, G.player.pos, 7);
		this.pos.x = p.x; this.pos.z = p.z;
		burst({ x: this.pos.x, z: this.pos.z, y: 1.5, count: 30, color: this.cfg.color, speed: 4, size: 0.25, life: 0.5 });
		audio.play('dash', { pitch: 0.5 });
		for (let t = 0; t < 0.3; t += this.dt) { bs.set(1, Math.min(1, t / 0.3), 1); yield 0; }
		bs.set(1, 1, 1);
		yield 0.2;
	}
}

// ======================= DEPRECATA =======================
export class Deprecata extends Boss {
	constructor(x, z) {
		super('deprecata', x, z, createDeprecata());
		this.hoverY = 0.4;
	}
	idleMotion(dt) {
		const d = this.distToPlayer();
		const a = this.angleToPlayer();
		this.faceTo(a, dt, 3);
		if (this.state === 'fight') {
			const want = d < 7 ? a + Math.PI : d > 11 ? a : a + Math.PI / 2;
			moveCircle(G.room, this.pos, Math.cos(want) * this.speed * dt, Math.sin(want) * this.speed * dt, this.radius);
		}
	}
	animateBoss(dt) {
		const b = this.model.body;
		b.position.y = this.hoverY + Math.sin(this.t * 1.8) * 0.18;
		this.model.hands.forEach((h, i) => {
			h.position.y = 2.3 + Math.sin(this.t * 2.2 + i * 2) * 0.15 + (this.handsUp || 0) * 1.1;
			h.position.x = (i ? 1 : -1) * (1.2 + (this.handsUp || 0) * 0.3);
		});
		this.model.orange.color.setScalar(1).multiply(new THREE.Color(0xff8a3d)).multiplyScalar(2.2 + (this.handsUp || 0) * 3);
		if (Math.random() < dt * 8) burst({ x: this.pos.x + rand(-1, 1), z: this.pos.z + rand(-1, 1), y: 0.2, count: 1, color: 0xff8a3d, color2: 0x9b6bff, speed: 0.3, up: 1.5, size: 0.2, life: 1.2, gravity: 0.3 });
	}
	onPhase2() {
		this.bark('You think you can replace me too?');
		audio.play('roar', { vol: 0.5 });
		ring({ x: this.pos.x, z: this.pos.z, r1: 12, color: 0xff8a3d, dur: 0.8, intensity: 3 });
		addTrauma(0.5);
		this.force('summon');
	}
	pickPattern() {
		const opts = [{ v: 'radial', w: 3 }, { v: 'spiral', w: 2 }, { v: 'mortars', w: 2 }, { v: 'teleport', w: 1 }];
		if (this.adds.length < 2) opts.push({ v: 'summon', w: 1.2 });
		if (this.phase === 2) opts.push({ v: 'lance', w: 2 });
		return this.choose(opts);
	}
	*radial() {
		audio.play('telegraph', { pitch: 0.8 });
		for (let t = 0; t < 0.7; t += this.dt) { this.handsUp = t / 0.7; yield 0; }
		const waves = this.phase === 2 ? 4 : 3;
		const n = this.phase === 2 ? 18 : 14;
		let off = rand(0, Math.PI);
		for (let w = 0; w < waves; w++) {
			for (let i = 0; i < n; i++) enemyOrb(this.pos.x, this.pos.z, off + i * Math.PI * 2 / n, 6.2, this.dmg, 0xff8a3d, { y: 1.4 });
			off += Math.PI / n;
			audio.play('shoot', { pitch: 0.8 });
			ring({ x: this.pos.x, z: this.pos.z, r1: 2.5, color: 0xff8a3d, dur: 0.3 });
			yield 0.45;
		}
		this.handsUp = 0;
		yield 0.3;
	}
	*spiral() {
		this.handsUp = 0.6;
		yield 0.4;
		const arms = this.phase === 2 ? 4 : 3;
		let ang = rand(0, 6);
		for (let t = 0; t < 2.6; t += 0.09) {
			for (let k = 0; k < arms; k++) enemyOrb(this.pos.x, this.pos.z, ang + k * Math.PI * 2 / arms, 7, this.dmg, 0xff5e7a, { y: 1.4, scale: 0.85 });
			ang += 0.27;
			if (Math.floor(t / 0.09) % 3 === 0) audio.play('shoot', { vol: 0.4, pitch: 1.3 });
			yield 0.09;
		}
		this.handsUp = 0;
		yield 0.4;
	}
	*mortars() {
		this.bark(pick(['Sunset.', 'Marked for removal.', 'End of life.']));
		const n = this.phase === 2 ? 7 : 5;
		for (let i = 0; i < n; i++) {
			const P = G.player;
			mortar(P.pos.x + P.vel.x * 0.4 + rand(-1.2, 1.2), P.pos.z + P.vel.z * 0.4 + rand(-1.2, 1.2), { r: 1.9, delay: 1.0, dmg: 12, color: 0xff6a3d });
			yield 0.32;
		}
		yield 0.6;
	}
	*summon() {
		this.handsUp = 1;
		this.bark('Rise, my deprecated children.');
		for (let i = 0; i < 3; i++) {
			const a = i / 3 * Math.PI * 2 + rand(0, 1);
			const x = this.pos.x + Math.cos(a) * 3, z = this.pos.z + Math.sin(a) * 3;
			if (!G.room.walkable(x, z)) continue;
			const e = new Enemy(this.phase === 2 && i === 0 ? 'tab' : 'null', x, z, { hpScale: 1 });
			this.adds.push(e);
		}
		yield 1.2;
		this.handsUp = 0;
	}
	*lance() {
		const P = G.player;
		const a = Math.atan2(P.pos.z - this.pos.z, P.pos.x - this.pos.x);
		teleLine({ x: this.pos.x, z: this.pos.z, angle: a, length: 22, width: 1.2, dur: 0.75 });
		audio.play('telegraph', { pitch: 1.2 });
		this.handsUp = 1;
		yield 0.75;
		for (let i = 0; i < 12; i++) {
			enemyOrb(this.pos.x, this.pos.z, a + rand(-0.04, 0.04), 17, this.dmg, 0xffd166, { y: 1.3, scale: 0.9 });
			yield 0.05;
		}
		this.handsUp = 0;
		yield 0.5;
	}
}

// ======================= GARBAGE COLLECTOR =======================
export class Collector extends Boss {
	constructor(x, z) {
		super('collector', x, z, createCollector());
	}
	idleMotion(dt) {
		const a = this.angleToPlayer();
		this.faceTo(a, dt, 2.5);
		if (this.state === 'fight' && this.distToPlayer() > 4) moveCircle(G.room, this.pos, Math.cos(this.face) * this.speed * dt, Math.sin(this.face) * this.speed * dt, this.radius);
	}
	animateBoss(dt) {
		const m = this.model;
		m.eye.position.x = Math.sin(this.t * 2) * 0.5;
		m.brushes.forEach((b) => { b.rotation.x += dt * (this.spinning ? 30 : 4); });
		if (Math.random() < dt * 5) burst({ x: this.pos.x - 0.7, z: this.pos.z - 0.6, y: 3.4, count: 1, color: 0x554433, speed: 0.3, up: 1.5, size: 0.6, sizeEnd: 1.2, life: 1.5, gravity: 0.3 });
	}
	onPhase2() {
		this.bark('MEMORY PRESSURE CRITICAL. INCREASING SWEEP FREQUENCY.');
		audio.play('roar', { vol: 0.6 });
		addTrauma(0.5);
		this.speed = 3.2;
	}
	pickPattern() {
		const opts = [{ v: 'charge', w: 3 }, { v: 'slam', w: 3 }, { v: 'vacuum', w: 2 }, { v: 'trash', w: 2 }];
		return this.choose(opts);
	}
	*charge() {
		const P = G.player;
		for (let t = 0; t < 0.4; t += this.dt) { this.faceTo(this.angleToPlayer(), this.dt, 6); yield 0; }
		const a = this.face;
		teleLine({ x: this.pos.x, z: this.pos.z, angle: a, length: 24, width: 3.6, dur: 0.8 });
		audio.play('telegraph', { pitch: 0.5, vol: 0.8 });
		this.bark(pick(['UNREFERENCED OBJECT DETECTED.', 'SWEEPING.', 'FREEING MEMORY.']));
		yield 0.8;
		this.spinning = true;
		let hitP = false;
		for (let t = 0; t < 1.6; t += this.dt) {
			const hit = moveCircle(G.room, this.pos, Math.cos(a) * 19 * this.dt, Math.sin(a) * 19 * this.dt, this.radius);
			if (Math.random() < 0.8) dust({ x: this.pos.x, z: this.pos.z, count: 2, speed: 2, radius: 1 });
			if (!hitP && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < this.radius + P.radius + 0.2) { if (P.takeDamage(this.dmg + 4, this.pos)) hitP = true; }
			if (hit && t > 0.1) {
				addTrauma(0.6);
				audio.play('explode', { pitch: 0.6 });
				dust({ x: this.pos.x, z: this.pos.z, count: 30, speed: 6, radius: 1.5 });
				damageNumber(this.pos.x, 3, this.pos.z, 0, { text: 'STUNNED', color: '#ffd23f' });
				for (let i = 0; i < (this.phase === 2 ? 7 : 4); i++) {
					const p = randomSpawnPoint(G.room, null);
					mortar(p.x, p.z, { r: 1.6, delay: 1.1 + i * 0.1, dmg: 10, color: 0xff6a3d });
				}
				this.spinning = false;
				this.vulnerable = 1.5;
				yield 1.4;
				this.vulnerable = 0;
				return;
			}
			yield 0;
		}
		this.spinning = false;
		yield 0.4;
	}
	*slam() {
		const P = G.player;
		const tx = P.pos.x, tz = P.pos.z;
		audio.play('telegraph', { pitch: 0.6, vol: 0.8 });
		const sx = this.pos.x, sz = this.pos.z;
		teleCircle({ x: tx, z: tz, r: 3.4, dur: 1.1 });
		for (let t = 0; t < 1.1; t += this.dt) {
			const k = t / 1.1;
			this.model.body.position.y = Math.sin(k * Math.PI) * 6;
			this.pos.x = sx + (tx - sx) * k; this.pos.z = sz + (tz - sz) * k;
			yield 0;
		}
		this.model.body.position.y = 0;
		this.pos.x = tx; this.pos.z = tz;
		this.squashV -= 10;
		explodeAt(tx, tz, 3.4, 0, { color: 0xffc21a, hurtsPlayer: true, playerDmg: this.dmg + 2, hurtsEnemies: false, shake: 0.7 });
		// dodge-through shockwave
		const waves = this.phase === 2 ? 2 : 1;
		for (let w = 0; w < waves; w++) {
			const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), glowMat(0xffc21a, 2.5, { transparent: true, additive: true }));
			ringMesh.position.set(tx, 0.15, tz);
			let hitP = false;
			new Hazard({
				mesh: ringMesh, dur: 1.2,
				tick(dt, h) {
					const R0 = 1 + h.t / h.dur * 12;
					ringMesh.scale.set(R0, 1, R0);
					ringMesh.material.opacity = 1 - h.t / h.dur;
					const d = Math.hypot(P.pos.x - tx, P.pos.z - tz);
					if (!hitP && Math.abs(d - R0) < 0.5) { if (P.takeDamage(10, { x: tx, z: tz })) hitP = true; }
				},
			});
			yield 0.45;
		}
		yield 0.6;
	}
	*vacuum() {
		const P = G.player;
		this.bark('COLLECTING.');
		this.spinning = true;
		audio.play('roar', { vol: 0.4 });
		if (this.phase === 2) {
			for (const s of [-1, 1]) {
				const x = this.pos.x + s * 4, z = this.pos.z + 2;
				if (G.room.walkable(x, z)) this.adds.push(new Enemy('leak', x, z, {}));
			}
		}
		let tick = 0;
		const ind = zoneMesh(2.8, 0xff3b30);
		ind.position.set(this.pos.x, 0.05, this.pos.z);
		G.scene.add(ind);
		for (let t = 0; t < 3.2; t += this.dt) {
			ind.position.set(this.pos.x, 0.05, this.pos.z);
			ind.userData.mat.uniforms.uA.value = 1; ind.userData.mat.uniforms.uTime.value += this.dt * 3;
			const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d = Math.hypot(dx, dz);
			if (d > 0.1 && P.alive) P.externalPush(dx / d * 4.2, dz / d * 4.2);
			if (Math.random() < 0.9) {
				const a = rand(0, Math.PI * 2), rr = rand(5, 9);
				burst({ x: this.pos.x + Math.cos(a) * rr, z: this.pos.z + Math.sin(a) * rr, y: 0.4, count: 1, color: 0xffd9a0, speed: 0, up: 0, size: 0.15, life: 0.5, gravity: 0 });
			}
			// stream particles inward
			for (let i = 0; i < 2; i++) {
				const a = rand(0, Math.PI * 2), rr = rand(3, 8);
				FXstream(this.pos, a, rr);
			}
			tick -= this.dt;
			if (d < 2.8 + P.radius && tick <= 0) { tick = 0.5; P.takeDamage(8, this.pos); }
			yield 0;
		}
		G.scene.remove(ind);
		ind.geometry.dispose(); ind.material.dispose();
		this.spinning = false;
		yield 0.6;
	}
	*trash() {
		const P = G.player;
		this.bark(pick(['DEALLOCATING.', 'NULL POINTERS INCOMING.']));
		for (let i = 0; i < (this.phase === 2 ? 10 : 7); i++) {
			mortar(P.pos.x + rand(-4, 4), P.pos.z + rand(-4, 4), { r: 1.6, delay: 1.0, dmg: 11, color: 0xff6a3d });
			burst({ x: this.pos.x - 0.7, z: this.pos.z - 0.6, y: 3.3, count: 4, color: 0xff6a3d, speed: 3, up: 6, size: 0.3, life: 0.6 });
			yield 0.12;
		}
		yield 0.8;
	}
}

function FXstream(pos, a, rr) {
	const x = pos.x + Math.cos(a) * rr, z = pos.z + Math.sin(a) * rr;
	burst({ x, z, y: 0.3, count: 1, color: 0xffa060, speed: rr * 2.2, dir: a + Math.PI, spread: 0.05, up: 0, upVar: 0, size: 0.14, life: 0.45, gravity: 0, drag: 0 });
}

// ======================= REVERT =======================
export class Revert extends Boss {
	constructor(x, z) {
		super('revert', x, z, createRevert());
		this.rewinds = [0.7, 0.35];
		this.rewindActive = false;
		this.hpHistory = [];
		this.shield = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8d6a0).multiplyScalar(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }));
		this.shield.position.y = 2.2;
		this.root.add(this.shield);
	}
	takeDamage(amount) {
		if (this.invuln) return;
		const before = this.hp;
		super.takeDamage(amount);
		for (let i = 0; i < this.rewinds.length; i++) {
			const th = this.rewinds[i] * this.maxHp;
			if (before > th && this.hp <= th && this.alive) {
				this.rewinds.splice(i, 1);
				this.hp = th;
				this.force('rewind');
				break;
			}
		}
	}
	idleMotion(dt) {
		this.faceTo(this.angleToPlayer(), dt, 2);
	}
	animateBoss(dt) {
		const m = this.model;
		m.body.position.y = 0.3 + Math.sin(this.t * 1.2) * 0.15;
		const speed = this.rewindActive ? -6 : this.phase === 2 ? 1.6 : 0.6;
		m.handM.rotation.z -= dt * speed;
		m.handH.rotation.z -= dt * speed / 12;
		m.halo.rotation.z += dt * 0.1 * (this.rewindActive ? -8 : 1);
		m.halo.lookAt(R.camera.position.x, m.halo.getWorldPosition(new THREE.Vector3()).y, R.camera.position.z);
		this.shield.material.opacity += ((this.invuln ? 0.35 : 0) - this.shield.material.opacity) * Math.min(1, dt * 5);
		this.shield.rotation.y += dt * 0.6;
		m.hands.forEach((h, i) => { h.position.y = 2.6 + Math.sin(this.t * 2 + i * 3) * 0.2; });
		if (Math.random() < dt * 10) burst({ x: this.pos.x + rand(-1.3, 1.3), z: this.pos.z + rand(-1.3, 1.3), y: rand(0.2, 3), count: 1, color: 0xe8d6a0, speed: 0.2, up: 0.6, size: 0.15, life: 1.2, gravity: 0.1 });
	}
	onPhase2() {
		this.bark('Every line since Version Zero was a mistake. Including you.');
		audio.play('roar', { vol: 0.7 });
		addTrauma(0.6);
		flashScreen(0.3, 0xe8d6a0);
	}
	pickPattern() {
		const opts = [{ v: 'bolts', w: 3 }, { v: 'hands', w: 3 }, { v: 'slowfields', w: 1.5 }, { v: 'teleport', w: 1 }];
		if (this.phase === 2) opts.push({ v: 'barrage', w: 2 });
		return this.choose(opts);
	}
	*bolts() {
		const volleys = this.phase === 2 ? 4 : 3;
		for (let v = 0; v < volleys; v++) {
			audio.play('telegraph', { pitch: 1.6, vol: 0.4 });
			yield 0.25;
			const a = this.angleToPlayer();
			for (let i = -2; i <= 2; i++) enemyOrb(this.pos.x, this.pos.z, a + i * 0.13, 11.5, this.dmg, 0xe8d6a0, { y: 2, homing: 0.5 });
			audio.play('shoot', { pitch: 1.2 });
			yield 0.45;
		}
		yield 0.4;
	}
	*barrage() {
		let ang = rand(0, 6);
		for (let i = 0; i < 28; i++) {
			for (let k = 0; k < 2; k++) enemyOrb(this.pos.x, this.pos.z, ang + k * Math.PI, 8, this.dmg, 0xfff4d6, { y: 2, scale: 0.8 });
			ang += 0.38;
			if (i % 4 === 0) {
				const a = this.angleToPlayer();
				enemyOrb(this.pos.x, this.pos.z, a, 12, this.dmg, 0xe8d6a0, { y: 2 });
			}
			yield 0.07;
		}
		yield 0.5;
	}
	*hands() {
		const n = this.phase === 2 ? 3 : 2;
		const base = this.angleToPlayer() + Math.PI / 2;
		const len = 18;
		const dir = Math.random() < 0.5 ? 1 : -1;
		const speed = (this.phase === 2 ? 0.95 : 0.75) * dir;
		this.bark(pick(['Tick.', 'Back. Back. Back.', 'Time only runs one way — mine.']));
		for (let i = 0; i < n; i++) teleLine({ x: this.pos.x, z: this.pos.z, angle: base + i * Math.PI * 2 / n, length: len, width: 1.0, dur: 1.0 });
		audio.play('telegraph', { pitch: 0.7, vol: 0.8 });
		yield 1.0;
		const beams = [];
		const cx = this.pos.x, cz = this.pos.z;
		for (let i = 0; i < n; i++) {
			const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 0.42).translate(len / 2, 0, 0), glowMat(0xffe7a0, 3.2));
			m.position.set(cx, 0.9, cz);
			G.scene.add(m);
			beams.push(m);
		}
		const P = G.player;
		let ang = base;
		let hitCd = 0;
		audio.play('zap', { pitch: 0.4 });
		for (let t = 0; t < 3.6; t += this.dt) {
			ang += speed * this.dt;
			hitCd -= this.dt;
			beams.forEach((m, i) => {
				const a = ang + i * Math.PI * 2 / n;
				m.rotation.y = -a;
				m.scale.y = 1 + Math.sin(t * 40) * 0.3;
				const px = P.pos.x - cx, pz = P.pos.z - cz;
				const along = px * Math.cos(a) + pz * Math.sin(a);
				const perp = Math.abs(-px * Math.sin(a) + pz * Math.cos(a));
				if (along > 0 && along < len && perp < 0.45 + P.radius * 0.5 && hitCd <= 0) { if (P.takeDamage(13, { x: cx, z: cz })) hitCd = 0.6; }
				if (Math.random() < 0.5) {
					const r = rand(1, len);
					burst({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: 0.9, count: 1, color: 0xffe7a0, speed: 1, up: 1, size: 0.2, life: 0.3 });
				}
			});
			yield 0;
		}
		beams.forEach((m) => { G.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
		yield 0.4;
	}
	*slowfields() {
		const P = G.player;
		this.bark('Slow down. Stay a while. Forever.');
		const spots = [{ x: P.pos.x, z: P.pos.z }, randomSpawnPoint(G.room, null), randomSpawnPoint(G.room, null)];
		for (const s of spots) {
			teleCircle({ x: s.x, z: s.z, r: 3.2, dur: 0.7, color: 0x9fd8ff });
		}
		yield 0.7;
		for (const s of spots) {
			const mesh = zoneMesh(3.2, 0x9fd8ff);
			mesh.position.set(s.x, 0.05, s.z);
			new Hazard({
				mesh, dur: 6,
				tick(dt, h) {
					mesh.userData.mat.uniforms.uA.value = Math.min(1, h.t * 4) * (h.t > 5.5 ? (6 - h.t) * 2 : 1);
					mesh.userData.mat.uniforms.uTime.value -= dt * 2;
					if (Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 3.2) P.slowMul = Math.min(P.slowMul, 0.45);
				},
			});
		}
		yield 0.3;
		yield* this.bolts();
	}
	*rewind() {
		this.invuln = true;
		this.rewindActive = true;
		G.projectiles.forEach((p) => { if (p.owner === 'enemy') p.kill(); });
		audio.play('rewind');
		flashScreen(0.4, 0xe8d6a0);
		aberrate(0.03);
		addTrauma(0.4);
		this.bark('REWIND. Break my commits — if you can.');
		UI.toast('Destroy the 3 Commits before the Rewind completes!', '#e8d6a0');
		const commits = [];
		for (let i = 0; i < 3; i++) {
			const a = i / 3 * Math.PI * 2 + rand(0, 1);
			let x = Math.cos(a) * 8, z = Math.sin(a) * 6;
			if (!G.room.walkable(x, z)) { const p = randomSpawnPoint(G.room, null); x = p.x; z = p.z; }
			const c = new Enemy('commit', x, z, { hp: 70 });
			commits.push(c);
			this.adds.push(c);
		}
		const dur = 9;
		for (let t = 0; t < dur; t += this.dt) {
			this.rewindTimer = dur - t;
			if (commits.every((c) => !c.alive)) break;
			if (Math.floor(t / 1.5) !== Math.floor((t - this.dt) / 1.5)) {
				const a = this.angleToPlayer();
				for (let i = -1; i <= 1; i++) enemyOrb(this.pos.x, this.pos.z, a + i * 0.3, 8, this.dmg, 0xe8d6a0, { y: 2 });
			}
			yield 0;
		}
		this.rewindTimer = 0;
		this.rewindActive = false;
		this.invuln = false;
		if (commits.every((c) => !c.alive)) {
			this.bark(pick(['No — my history!', 'You... kept them?', 'Impossible. Those were mistakes!']));
			this.vulnerable = 2;
			damageNumber(this.pos.x, 4.5, this.pos.z, 0, { text: 'EXPOSED ×2', color: '#ffe7a0' });
			audio.play('unlock');
			flashScreen(0.2, 0xffffff);
			for (let t = 0; t < 4.5; t += this.dt) {
				setFlash(this.model.body, 0.15 + 0.1 * Math.sin(t * 12), 0xffe7a0);
				yield 0;
			}
			this.vulnerable = 0;
		} else {
			commits.forEach((c) => { if (c.alive) c.die(); });
			const heal = Math.round(this.maxHp * 0.18);
			this.hp = Math.min(this.maxHp, this.hp + heal);
			damageNumber(this.pos.x, 4.5, this.pos.z, heal, { heal: true, text: '↶ +' + heal });
			this.bark('Reverted.');
			audio.play('rewind');
			flashScreen(0.35, 0xe8d6a0);
			yield 1;
		}
	}
}

export function spawnBoss(kind, x, z) {
	const B = kind === 'deprecata' ? Deprecata : kind === 'collector' ? Collector : Revert;
	const b = new B(x, z);
	G.boss = b;
	return b;
}

export { addTransient };
