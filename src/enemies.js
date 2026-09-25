import * as THREE from 'three';
import { G } from './state.js';
import { audio } from './audio.js';
import { createEnemyModel } from './models.js';
import { setFlash } from './materials.js';
import { burst, dust, ring, teleCircle, teleLine, beam, damageNumber } from './fx.js';
import { addTrauma, flashLight } from './render.js';
import { moveCircle } from './world.js';
import { hitEnemy, enemyOrb, explodeAt, aliveEnemies } from './combat.js';
import { rand, angleDiff, easeOutBack, clamp } from './util.js';

export const ENEMY_TYPES = {
	null: { name: 'Null', hp: 26, speed: 3.6, radius: 0.5, dmg: 9, height: 1.1, knockRes: 0, color: 0xff4d88 },
	tab: { name: 'Stale Tab', hp: 20, speed: 2.8, radius: 0.55, dmg: 8, height: 1.4, knockRes: 0.2, color: 0xb48cff },
	regression: { name: 'Regression', hp: 80, speed: 2.1, radius: 0.9, dmg: 16, height: 1.5, knockRes: 0.75, color: 0xff8a3d },
	warning: { name: 'Warning', hp: 14, speed: 4.6, radius: 0.5, dmg: 16, height: 1.2, knockRes: 0, color: 0xffc21a },
	leak: { name: 'Memory Leak', hp: 36, speed: 2.9, radius: 0.6, dmg: 10, height: 1.1, knockRes: 0.1, color: 0x9b6bff },
	leaklet: { name: 'Leaklet', hp: 12, speed: 4.0, radius: 0.38, dmg: 6, height: 0.7, knockRes: 0, color: 0x9b6bff, model: 'leak', scale: 0.6 },
	commit: { name: 'Commit', hp: 60, speed: 0, radius: 0.8, dmg: 0, height: 2.2, knockRes: 1, color: 0xffe7a0 },
};

export class Enemy {
	constructor(type, x, z, opts = {}) {
		const cfg = ENEMY_TYPES[type];
		this.type = type;
		this.cfg = cfg;
		const model = opts.model || createEnemyModel(cfg.model || type, cfg.color);
		this.model = model;
		this.root = model.root;
		this.pos = this.root.position;
		this.pos.set(x, 0, z);
		this.baseScale = (cfg.scale || 1) * (opts.elite ? 1.25 : 1) * (opts.scale || 1);
		const hpScale = opts.hpScale ?? 1;
		this.maxHp = this.hp = Math.round((opts.hp ?? cfg.hp) * hpScale * (opts.elite ? 1.8 : 1));
		this.radius = cfg.radius * this.baseScale;
		this.height = cfg.height * this.baseScale;
		this.speed = cfg.speed * (opts.speedMul ?? 1);
		this.dmg = Math.round(cfg.dmg * (opts.dmgScale ?? 1));
		this.knockRes = cfg.knockRes;
		this.elite = !!opts.elite;
		this.isBoss = false;
		this.vel = new THREE.Vector3();
		this.status = { burn: null, chill: 0, chillT: 0, conflict: 0, root: 0, stun: 0 };
		this.state = 'spawn';
		this.t = 0;
		this.cd = rand(0.6, 1.8);
		this.flash = 0;
		this.face = Math.PI / 2;
		this.alive = true;
		this.active = false;
		this.invuln = false;
		this.squash = 0; this.squashV = 0;
		this.spawnDur = opts.instant ? 0.01 : 0.9;
		this.root.scale.setScalar(0.001);
		G.scene.add(this.root);
		if (this.elite) {
			for (const m of model.mats) if (m.userData.u) { m.userData.u.uRimColor.value.set(0xffcd0f); m.userData.u.uRimStrength.value = 1.1; }
		}
		if (!opts.instant) {
			teleCircle({ x, z, r: this.radius * 1.8 + 0.4, dur: this.spawnDur, color: 0xb04dff });
			beam({ x, z, r: this.radius + 0.2, color: 0xb04dff, dur: this.spawnDur + 0.2 });
			audio.play('spawn', { vol: 0.5 });
		}
		G.enemies.push(this);
	}

	get slow() { return this.status.chill * 0.1; }
	get player() { return G.player; }

	distToPlayer() { return Math.hypot(this.player.pos.x - this.pos.x, this.player.pos.z - this.pos.z); }
	angleToPlayer() { return Math.atan2(this.player.pos.z - this.pos.z, this.player.pos.x - this.pos.x); }

	takeDamage(amount, dir, knock) {
		this.hp -= amount;
		this.flash = 1;
		this.squashV -= 6;
		const k = knock * (1 - this.knockRes);
		this.vel.x += dir.x * k * 2.2;
		this.vel.z += dir.z * k * 2.2;
		if (this.state === 'windup' && knock >= 5 && !this.elite && this.type !== 'regression') { this.state = 'recover'; this.t = 0; }
		if (this.hp <= 0) this.die();
	}

	die() {
		if (!this.alive) return;
		this.alive = false;
		const P = G.player;
		const m = P.mods;
		const c = this.cfg.color;
		burst({ x: this.pos.x, z: this.pos.z, y: this.height * 0.5, count: 28, color: c, color2: 0xffffff, speed: 6, up: 3, size: 0.26, life: 0.55 });
		dust({ x: this.pos.x, z: this.pos.z, count: 8, speed: 2.5, radius: 0.4 });
		ring({ x: this.pos.x, z: this.pos.z, r1: this.radius * 3, color: c, dur: 0.3 });
		flashLight(this.pos, c, 25, 0.15);
		audio.play('kill');
		addTrauma(0.12);
		// boon-driven death effects
		if (this.status.burn && m.rekindle) P.heal(m.rekindle, true);
		if (this.status.chill > 0 && m.shatter) {
			const x = this.pos.x, z = this.pos.z;
			setTimeout(() => explodeAt(x, z, 2.5, m.shatter, { color: 0x7fe6ff, source: 'element', shake: 0.15 }), 60);
		}
		if (this.type === 'leak') {
			for (const s of [-1, 1]) {
				const e = new Enemy('leaklet', this.pos.x + s * 0.6, this.pos.z, { instant: true, hpScale: G.run ? G.run.hpScale : 1 });
				e.vel.set(s * 6, 0, rand(-3, 3));
			}
		}
		if (this.onDeath) this.onDeath(this);
		if (this.tele) this.tele.visible = false;
		this.deathT = 0;
	}

	remove() {
		G.scene.remove(this.root);
		this.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
	}

	updateStatus(dt) {
		const s = this.status;
		if (s.burn) {
			s.burn.t -= dt; s.burn.tick -= dt;
			if (s.burn.tick <= 0) {
				s.burn.tick = 0.5;
				hitEnemy(this, s.burn.dps * 0.5, { source: 'element', knock: 0, numColor: '#ff9a4f', silent: false, color: 0xff7a2f });
			}
			if (Math.random() < dt * 12) burst({ x: this.pos.x + rand(-0.3, 0.3), z: this.pos.z + rand(-0.3, 0.3), y: this.height * 0.6, count: 1, color: 0xff7a2f, color2: 0xffd166, speed: 0.4, up: 2.5, size: 0.28, life: 0.45, gravity: 1 });
			if (s.burn && s.burn.t <= 0) s.burn = null;
		}
		if (s.chillT > 0) { s.chillT -= dt; if (s.chillT <= 0) s.chill = 0; }
		if (s.root > 0) s.root -= dt;
		if (s.stun > 0) s.stun -= dt;
		if (this.frozen > 0) this.frozen -= dt;
	}

	update(dt) {
		if (!this.alive) {
			this.deathT += dt;
			const k = this.deathT / 0.18;
			this.root.scale.set(this.baseScale * (1 + k * 0.4), this.baseScale * Math.max(0.01, 1 - k), this.baseScale * (1 + k * 0.4));
			if (k >= 1) { this.remove(); return false; }
			return true;
		}
		this.t += dt;
		if (this.state === 'spawn') {
			const k = clamp(this.t / this.spawnDur, 0, 1);
			this.root.scale.setScalar(this.baseScale * Math.max(0.001, k < 0.6 ? 0.001 : easeOutBack((k - 0.6) / 0.4)));
			if (k >= 1) { this.state = 'idle'; this.t = 0; this.active = true; burst({ x: this.pos.x, z: this.pos.z, y: 0.5, count: 14, color: 0xb04dff, speed: 3, size: 0.2, life: 0.4 }); }
			return true;
		}
		this.updateStatus(dt);
		if (!this.alive) return true;
		const disabled = this.status.stun > 0 || this.frozen > 0;
		const rooted = this.status.root > 0;
		if (!disabled) this.think(dt, rooted);
		// knockback / velocity integration
		const hitWall = moveCircle(G.room, this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
		this.onMoved?.(hitWall);
		const drag = Math.exp(-10 * dt);
		this.vel.x *= drag; this.vel.z *= drag;
		// separation
		for (const o of G.enemies) {
			if (o === this || !o.alive) continue;
			const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
			const d = Math.hypot(dx, dz), min = this.radius + o.radius;
			const k = o.isBoss ? 1 : 0.5;
			if (d < min && d > 0.001) moveCircle(G.room, this.pos, dx / d * (min - d) * k, dz / d * (min - d) * k, this.radius);
		}
		this.animate(dt, disabled);
		return true;
	}

	moveToward(angle, speed, dt, rooted) {
		if (rooted) return;
		const s = speed * (1 - this.slow);
		moveCircle(G.room, this.pos, Math.cos(angle) * s * dt, Math.sin(angle) * s * dt, this.radius);
	}

	faceTo(angle, dt, rate = 10) {
		this.face += clamp(angleDiff(this.face, angle), -rate * dt, rate * dt);
	}

	animate(dt, disabled) {
		this.flash = Math.max(0, this.flash - dt * 7);
		const frozenTint = this.frozen > 0;
		setFlash(this.model.body, frozenTint ? 0.55 : this.flash, frozenTint ? 0x9fefff : (this.telegraphing ? 0xff3048 : 0xffffff));
		if (this.telegraphing && !frozenTint) setFlash(this.model.body, Math.max(this.flash, 0.25 + 0.25 * Math.sin(this.t * 30)), 0xff3048);
		this.squashV += (-this.squash * 180 - this.squashV * 12) * dt;
		this.squash += this.squashV * dt;
		const sq = clamp(this.squash, -0.4, 0.4);
		const bs = this.baseScale;
		this.root.scale.set(bs * (1 - sq * 0.5), bs * (1 + sq), bs * (1 - sq * 0.5));
		this.root.rotation.y = Math.PI / 2 - this.face;
		if (disabled && !frozenTint) this.model.body.rotation.z = Math.sin(this.t * 40) * 0.08;
		else this.model.body.rotation.z = 0;
	}

	lungeHit(range) {
		const P = this.player;
		if (this.hitDone) return;
		if (Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < this.radius + P.radius + range) {
			if (P.takeDamage(this.dmg, this.pos)) this.hitDone = true;
		}
	}

	think(dt, rooted) {
		switch (this.type) {
			case 'null': case 'leak': case 'leaklet': return this.thinkMelee(dt, rooted);
			case 'tab': return this.thinkRanged(dt, rooted);
			case 'regression': return this.thinkCharger(dt, rooted);
			case 'warning': return this.thinkBomber(dt, rooted);
			case 'commit': this.model.body.rotation.y += dt * 1.5; return;
		}
	}

	thinkMelee(dt, rooted) {
		const d = this.distToPlayer(), a = this.angleToPlayer();
		this.cd -= dt;
		switch (this.state) {
			case 'idle':
				this.faceTo(a, dt);
				if (d > 1.9) {
					this.moveToward(a + Math.sin(this.t * 2 + this.pos.x) * 0.3, this.speed, dt, rooted);
					this.model.body.position.y = Math.abs(Math.sin(this.t * 9)) * 0.15;
				}
				if (d < 2.4 && this.cd <= 0) { this.state = 'windup'; this.t = 0; this.telegraphing = true; audio.play('telegraph', { vol: 0.4, pitch: 1.4 }); }
				break;
			case 'windup':
				this.faceTo(a, dt, 6);
				this.model.body.position.z = -Math.sin(Math.min(1, this.t / 0.5) * Math.PI / 2) * 0.25;
				if (this.t > (this.elite ? 0.4 : 0.5)) { this.state = 'lunge'; this.t = 0; this.telegraphing = false; this.hitDone = false; this.lungeA = this.face; this.model.body.position.z = 0; this.squashV += 5; }
				break;
			case 'lunge':
				if (!rooted) { this.vel.x = Math.cos(this.lungeA) * 11; this.vel.z = Math.sin(this.lungeA) * 11; }
				this.lungeHit(0.3);
				if (this.t > 0.22) { this.state = 'recover'; this.t = 0; }
				break;
			case 'recover':
				this.model.body.position.y = 0;
				if (this.t > 0.6) { this.state = 'idle'; this.t = 0; this.cd = rand(0.4, 1.2); }
				break;
		}
	}

	thinkRanged(dt, rooted) {
		const d = this.distToPlayer(), a = this.angleToPlayer();
		this.cd -= dt;
		this.model.body.position.y = Math.sin(this.t * 2.5) * 0.12;
		switch (this.state) {
			case 'idle': {
				this.faceTo(a, dt);
				let move = 0;
				if (d < 6) move = a + Math.PI;
				else if (d > 10) move = a;
				else move = a + Math.PI / 2 * (Math.sin(this.t * 0.7 + this.pos.z) > 0 ? 1 : -1);
				this.moveToward(move, this.speed, dt, rooted);
				if (this.cd <= 0 && d < 16) { this.state = 'windup'; this.t = 0; this.telegraphing = true; audio.play('telegraph', { vol: 0.35, pitch: 1.8 }); }
				break;
			}
			case 'windup':
				this.faceTo(a, dt);
				if (this.model.eyeMat) this.model.eyeMat.color.setScalar(1).multiplyScalar(2 + this.t * 6).multiply(new THREE.Color(this.cfg.color));
				if (this.t > 0.6) {
					this.telegraphing = false;
					const n = this.elite ? 5 : 3;
					for (let i = 0; i < n; i++) enemyOrb(this.pos.x, this.pos.z, a + (i - (n - 1) / 2) * 0.22, 7.5, this.dmg, 0xc47dff);
					audio.play('shoot');
					this.squashV += 4;
					this.state = 'recover'; this.t = 0;
				}
				break;
			case 'recover':
				if (this.model.eyeMat) this.model.eyeMat.color.set(this.cfg.color).multiplyScalar(2.2);
				if (this.t > 0.5) { this.state = 'idle'; this.t = 0; this.cd = rand(1.8, 2.8); }
				break;
		}
	}

	thinkCharger(dt, rooted) {
		const d = this.distToPlayer(), a = this.angleToPlayer();
		this.cd -= dt;
		switch (this.state) {
			case 'idle':
				this.faceTo(a, dt, 4);
				if (d > 3) this.moveToward(a, this.speed, dt, rooted);
				if (this.cd <= 0 && d < 11) {
					this.state = 'aim'; this.t = 0; this.telegraphing = true;
					audio.play('telegraph', { vol: 0.6, pitch: 0.7 });
				}
				break;
			case 'aim':
				if (this.t < 0.35) this.faceTo(a, dt, 8);
				if (!this.teleShown && this.t >= 0.35) {
					this.teleShown = true;
					this.chargeA = this.face;
					teleLine({ x: this.pos.x, z: this.pos.z, angle: this.chargeA, length: 13, width: this.radius * 2 + 0.4, dur: 0.55 });
				}
				this.model.body.rotation.x = -0.2;
				if (this.t > 0.9) { this.state = 'charge'; this.t = 0; this.telegraphing = false; this.teleShown = false; this.hitDone = false; this.model.body.rotation.x = 0.25; }
				break;
			case 'charge':
				if (!rooted) { this.vel.x = Math.cos(this.chargeA) * 16; this.vel.z = Math.sin(this.chargeA) * 16; }
				this.lungeHit(0.2);
				if (Math.random() < 0.6) dust({ x: this.pos.x, z: this.pos.z, count: 1, speed: 1, radius: 0.5 });
				if (this.t > 0.8) { this.state = 'recover'; this.t = 0; this.model.body.rotation.x = 0; }
				break;
			case 'stunned':
				this.model.body.rotation.x = 0;
				this.vulnerable = 1.5;
				if (this.t > 1.3) { this.state = 'idle'; this.t = 0; this.cd = rand(1.5, 2.5); this.vulnerable = 0; }
				break;
			case 'recover':
				if (this.t > 0.7) { this.state = 'idle'; this.t = 0; this.cd = rand(1.4, 2.4); }
				break;
		}
	}

	onMoved(hitWall) {
		if (this.type === 'regression' && this.state === 'charge' && hitWall && this.t > 0.08) {
			this.state = 'stunned'; this.t = 0;
			this.vel.set(-Math.cos(this.chargeA) * 5, 0, -Math.sin(this.chargeA) * 5);
			addTrauma(0.3);
			audio.play('land', { pitch: 0.5, vol: 2 });
			dust({ x: this.pos.x, z: this.pos.z, count: 16, speed: 4, radius: 0.6 });
			damageNumber(this.pos.x, 2, this.pos.z, 0, { text: 'STUNNED', color: '#ffd23f' });
		}
	}

	thinkBomber(dt, rooted) {
		const d = this.distToPlayer(), a = this.angleToPlayer();
		this.model.body.rotation.y += dt * (this.state === 'arm' ? 18 : 4);
		switch (this.state) {
			case 'idle':
				this.moveToward(a, this.speed, dt, rooted);
				this.model.body.position.y = Math.abs(Math.sin(this.t * 10)) * 0.2;
				if (d < 2.2) {
					this.state = 'arm'; this.t = 0; this.telegraphing = true;
					this.bombR = 2.6;
					this.tele = teleCircle({ x: this.pos.x, z: this.pos.z, r: this.bombR, dur: 0.95, follow: this.pos });
					audio.play('telegraph', { vol: 0.6, pitch: 2 });
				}
				break;
			case 'arm':
				this.squash = Math.sin(this.t * 40) * 0.1 * (this.t / 0.95);
				if (this.t > 0.95) {
					this.alive = false;
					explodeAt(this.pos.x, this.pos.z, this.bombR, 30, { color: 0xffc21a, hurtsPlayer: true, playerDmg: this.dmg, hurtsEnemies: true, source: 'element', shake: 0.35 });
					this.deathT = 0;
					this.onDeath?.(this);
				}
				break;
		}
	}
}

export function updateEnemies(dt) {
	for (let i = G.enemies.length - 1; i >= 0; i--) {
		const e = G.enemies[i];
		const keep = e.update(dt);
		if (!keep) G.enemies.splice(i, 1);
	}
}

export function clearEnemies() {
	for (const e of G.enemies) e.remove();
	G.enemies.length = 0;
}

export function livingCount() {
	return G.enemies.filter((e) => e.alive).length;
}

export { aliveEnemies };
