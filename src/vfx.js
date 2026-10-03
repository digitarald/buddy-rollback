// Style layer: weapon-specific attack visuals, element signatures, rarity escalation and passive cues.
import * as THREE from 'three';
import { G } from './state.js';
import { R, flashLight, shockwave } from './render.js';
import { burst, ring, slash, lightning, addTransient } from './fx.js';
import { sparks, chunks, scorch, floorRipple } from './juice.js';
import { glowMat } from './materials.js';
import { glyphTexture } from './textures.js';
import { rand } from './util.js';

export const EL_COLOR = { burn: 0xff7a2f, chill: 0x7fe6ff, arc: 0xffd23f, conflict: 0xff4fd8 };
export const RARITY_RANK = { common: 0, rare: 1, epic: 2, heroic: 3, duo: 3 };
const HEROIC_GOLD = 0xffe066;

// Visual tier of a slot: how loud its effects should be.
export function slotTier(P, slot) {
	const b = P.boons?.[slot];
	return b ? RARITY_RANK[b.rarity] ?? 0 : -1;
}

// ---------------- weapon attack visuals ----------------
export function attackVisual(P, sw, angle) {
	const el = P.mods.attackEl;
	const tier = Math.max(0, slotTier(P, 'attack'));
	const col = el ? EL_COLOR[el] : P.model.colors.glow;
	const heroic = tier >= 3;
	const core = heroic ? HEROIC_GOLD : 0xffffff;
	const boost = 1 + tier * 0.2;
	const x = P.pos.x, z = P.pos.z;
	if (sw.style === 'thrust') thrust(x, z, angle, sw.range, col, core, sw.dur, boost, sw.big);
	else if (sw.style === 'punch') punchWind(x, z, angle, sw, col, boost);
	else slash({ x, z, angle, arc: sw.arc, r1: sw.range + 0.2 + tier * 0.12, color: col, core, dur: sw.dur * 0.95, dirSign: sw.dir, intensity: (sw.big ? 2 : 1.5) * boost });
	if (el) elementTrail(el, x, z, angle, sw, tier);
	if (el === 'conflict' && sw.style !== 'punch') {
		// a mirrored "diff" echo in the merge's second colour
		if (sw.style === 'thrust') thrust(x, z, angle + 0.06, sw.range * 0.9, 0x7dff9a, 0xffffff, sw.dur * 0.9, boost * 0.7, false);
		else slash({ x, z, angle: angle + 0.08 * sw.dir, arc: sw.arc * 0.92, r1: sw.range * 0.88, color: 0x7dff9a, core: 0xffffff, dur: sw.dur, dirSign: -sw.dir, intensity: 1.1 });
	}
	if (heroic && sw.big) {
		sparks({ x: x + Math.cos(angle) * 1.2, y: 0.8, z: z + Math.sin(angle) * 1.2, count: 16, speed: 14, dir: angle, spread: 1.4, color: HEROIC_GOLD, color2: 0xffffff, life: 0.3 });
		flashLight(P.pos, HEROIC_GOLD, 28, 0.15);
	}
}

const thrustFS = /* glsl */`
	uniform vec3 uColor; uniform vec3 uCore; uniform float uK; varying vec2 vUv;
	void main() {
		float across = clamp(1.0 - abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
		float head = smoothstep(uK - 0.55, uK, vUv.y) * step(vUv.y, uK + 0.02);
		float body = pow(across, 1.8) * head;
		float coreL = pow(across, 10.0) * head;
		vec3 c = uColor * body * 1.4 + uCore * coreL * 2.0;
		gl_FragColor = vec4(c * (1.0 - smoothstep(0.55, 1.0, uK) * 0.8), 1.0);
	}`;
const thrustVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function thrust(x, z, angle, len, color, core = 0xffffff, dur = 0.24, boost = 1, big = false) {
	const width = (big ? 1.1 : 0.75) * (0.85 + boost * 0.15);
	const geo = new THREE.PlaneGeometry(width, len + 0.6).translate(0, (len + 0.6) / 2, 0).rotateX(-Math.PI / 2);
	const mat = new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.1 * boost) }, uCore: { value: new THREE.Color(core).multiplyScalar(boost) }, uK: { value: 0 } },
		vertexShader: thrustVS, fragmentShader: thrustFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	const m = new THREE.Mesh(geo, mat);
	m.position.set(x + Math.cos(angle) * 0.3, 0.65, z + Math.sin(angle) * 0.3);
	m.rotation.y = -angle - Math.PI / 2;
	m.renderOrder = 11;
	addTransient(m, dur, (k) => { mat.uniforms.uK.value = Math.min(1.2, k * 2.4); });
	sparks({ x: x + Math.cos(angle) * len * 0.8, y: 0.65, z: z + Math.sin(angle) * len * 0.8, count: big ? 10 : 5, speed: 12, dir: angle, spread: 0.5, up: 0.5, color, color2: core, life: 0.18, width: 0.05 });
}

function punchWind(x, z, angle, sw, color, boost) {
	const fx = x + Math.cos(angle) * sw.range * 0.75, fz = z + Math.sin(angle) * sw.range * 0.75;
	// speed lines converge into the fist's impact point
	sparks({ x: x + Math.cos(angle) * 0.3, y: 0.6, z: z + Math.sin(angle) * 0.3, count: sw.big ? 12 : 6, speed: 16, dir: angle, spread: 0.35, up: 0.2, color, color2: 0xffffff, life: 0.12, width: 0.04 * boost, gravity: 0 });
	ring({ x: fx, z: fz, y: 0.6, r0: 0.1, r1: sw.big ? 1.6 : 0.8, color, dur: 0.14, intensity: 2 * boost });
	if (sw.big) {
		const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 6).rotateX(-Math.PI / 2), glowMat(0xffffff, 2.2, { transparent: true, additive: true }));
		disc.position.set(fx, 0.6, fz);
		addTransient(disc, 0.12, (k) => { disc.scale.setScalar(0.5 + k * 1.8); disc.material.opacity = 1 - k; disc.rotation.y += 0.4; });
	}
}

// Particles that ride along the attack shape and sell its element.
function elementTrail(el, x, z, angle, sw, tier) {
	const pts = [];
	const n = sw.style === 'arc' ? 7 : 5;
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		if (sw.style === 'arc') {
			const a = angle - sw.dir * sw.arc / 2 + sw.dir * sw.arc * t;
			pts.push({ x: x + Math.cos(a) * sw.range * 0.85, z: z + Math.sin(a) * sw.range * 0.85 });
		} else {
			const r = sw.range * (0.3 + 0.7 * t);
			pts.push({ x: x + Math.cos(angle) * r, z: z + Math.sin(angle) * r });
		}
	}
	const k = 1 + tier * 0.4;
	if (el === 'burn') {
		for (const p of pts) burst({ x: p.x, z: p.z, y: 0.7, count: Math.round(2 * k), color: 0xff7a2f, color2: 0xffd166, speed: 0.6, up: 2.6, size: 0.24 * k, life: 0.45, gravity: 1.5 });
	} else if (el === 'chill') {
		for (const p of pts) burst({ x: p.x, z: p.z, y: 0.7, count: Math.round(2 * k), color: 0xbff4ff, color2: 0xffffff, speed: 1, up: -0.5, size: 0.14 * k, life: 0.6, gravity: -3 });
		chunks({ x: pts[pts.length >> 1].x, y: 0.7, z: pts[pts.length >> 1].z, count: Math.round(2 * k), color: 0xbff4ff, color2: 0x7fe6ff, speed: 3, size: 0.09, up: 2, life: 0.8 });
	} else if (el === 'arc') {
		for (let i = 0; i < pts.length - 1; i += 2) lightning(pts[i], pts[i + 1], { color: 0xffe066, width: 0.06 + tier * 0.02, dur: 0.1, y: 0.7, jag: 0.3 });
	} else if (el === 'conflict') {
		pts.forEach((p, i) => burst({ x: p.x, z: p.z, y: 0.7, count: 1, color: i % 2 ? 0xff4fd8 : 0x7dff9a, speed: 1.5, up: 1, size: 0.22 * k, life: 0.35 }));
	}
}

// ---------------- element impacts ----------------
const mergeTex = () => glyphTexture('<<<|>>>', { size: 256, font: 'bold 64px ui-monospace, monospace', glow: 12 });
export function elementImpact(el, x, y, z, dir = 0, power = 1) {
	switch (el) {
		case 'burn':
			burst({ x, z, y, count: Math.round(10 * power), color: 0xff7a2f, color2: 0xffd166, speed: 2.5, up: 4, size: 0.3, life: 0.5, gravity: 2 });
			ring({ x, z, y: 0.1, r1: 1.2 * power, color: 0xff7a2f, dur: 0.25, intensity: 1.8 });
			if (power > 1.1) scorch(x, z, 0.9 * power, 0xff7a2f);
			break;
		case 'chill':
			chunks({ x, y, z, count: Math.round(4 * power), color: 0xdffaff, color2: 0x7fe6ff, speed: 4, size: 0.11, up: 3, life: 0.9 });
			sparks({ x, y, z, count: 6, speed: 8, dir, spread: 2.5, color: 0xbff4ff, color2: 0xffffff, life: 0.2 });
			ring({ x, z, y: 0.1, r1: 1.1 * power, color: 0x7fe6ff, dur: 0.3, intensity: 1.6 });
			break;
		case 'arc':
			sparks({ x, y, z, count: Math.round(10 * power), speed: 13, spread: Math.PI * 2, color: 0xffe066, color2: 0xffffff, life: 0.18, width: 0.04 });
			for (let i = 0; i < 2; i++) {
				const a = rand(0, Math.PI * 2), r = rand(0.8, 1.6) * power;
				lightning({ x, z }, { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }, { color: 0xffe066, width: 0.05, dur: 0.1, y, jag: 0.25 });
			}
			flashLight({ x, z }, 0xffe066, 14 * power, 0.08, 5);
			break;
		case 'conflict': {
			const mat = new THREE.MeshBasicMaterial({ map: mergeTex(), transparent: true, depthWrite: false, color: new THREE.Color(1.8, 1.0, 1.7) });
			const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), mat);
			m.position.set(x, y + 0.6, z);
			m.renderOrder = 13;
			addTransient(m, 0.45, (k) => { m.quaternion.copy(R.camera.quaternion); m.scale.set(0.6 + k * 0.6, 1, 1); mat.opacity = 1 - k; m.position.y += 0.02; });
			burst({ x, z, y, count: 6, color: 0xff4fd8, color2: 0x7dff9a, speed: 3, size: 0.2, life: 0.3 });
			break;
		}
	}
}

// ---------------- crits ----------------
const critGeo = (() => {
	const shape = new THREE.Shape();
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2, r = i % 2 ? 0.28 : 1;
		if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	const g = new THREE.ShapeGeometry(shape);
	g.userData.shared = true;
	return g;
})();
export function critFlash(x, y, z, color = 0xffe066) {
	const mat = glowMat(color, 2.6, { transparent: true, additive: true });
	const m = new THREE.Mesh(critGeo, mat);
	m.userData.keepGeo = true;
	m.position.set(x, y, z);
	m.renderOrder = 14;
	const spin = rand(-1, 1);
	addTransient(m, 0.18, (k) => {
		m.quaternion.copy(R.camera.quaternion);
		m.rotateZ(spin + k * 0.6);
		m.scale.setScalar(0.5 + k * 1.4);
		mat.opacity = 1 - k * k;
	});
	shockwave({ x, y, z }, 0.35);
}

// ---------------- boon acquisition ----------------
export function boonFanfare(P, rarity, color, color2 = null) {
	const tier = RARITY_RANK[rarity] ?? 0;
	const x = P.pos.x, z = P.pos.z;
	ring({ x, z, r1: 3 + tier * 1.2, color, dur: 0.5 + tier * 0.1, intensity: 2 + tier });
	burst({ x, z, y: 0.8, count: 40 + tier * 25, color, color2: color2 ?? 0xffffff, speed: 5 + tier, up: 4 + tier, size: 0.25, life: 0.9 });
	flashLight(P.pos, color, 30 + tier * 15, 0.4);
	if (tier >= 2) {
		shockwave({ x, y: 0.8, z }, 0.6 + tier * 0.25);
		floorRipple(x, z, 0.8 + tier * 0.3);
		sparks({ x, y: 0.8, z, count: 30, speed: 16, color, color2: color2 ?? 0xffffff, life: 0.4 });
	}
	if (color2 !== null) {
		// Duo: twin helix rising around Buddy
		for (let i = 0; i < 24; i++) {
			const a = (i / 24) * Math.PI * 4;
			burst({ x: x + Math.cos(a) * 1.1, z: z + Math.sin(a) * 1.1, y: 0.2 + i * 0.12, count: 1, color: i % 2 ? color : color2, speed: 0.3, up: 1.5, size: 0.3, life: 1, gravity: 0 });
		}
	}
}

// ---------------- passive cues ----------------
const blameMat = () => new THREE.MeshBasicMaterial({ map: glyphTexture('git blame', { size: 256, font: 'bold 44px ui-monospace, monospace', glow: 10 }), transparent: true, depthWrite: false, color: new THREE.Color(1.9, 0.5, 0.45) });
export function updateBlameMark(e) {
	const show = G.player?.mods.blame > 0 && (e.isBoss || e.elite) && e.alive && e.active && e.type !== 'head';
	if (!show) { if (e.blameMark) e.blameMark.visible = false; return; }
	if (!e.blameMark) {
		e.blameMark = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), blameMat());
		e.blameMark.renderOrder = 12;
		G.scene.add(e.blameMark);
		const prevRemove = e.remove.bind(e);
		e.remove = () => { G.scene.remove(e.blameMark); e.blameMark.material.dispose(); e.blameMark.geometry.dispose(); prevRemove(); };
	}
	const m = e.blameMark;
	m.visible = true;
	m.position.set(e.pos.x, e.height + 0.9 + Math.sin(performance.now() / 300) * 0.06, e.pos.z);
	m.quaternion.copy(R.camera.quaternion);
}

// Rekindle: a healing ember flies from the burning foe back into Buddy.
export function healMote(from, amount, color = 0x7dffb0, onArrive) {
	const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMat(color, 3));
	const sx = from.x, sz = from.z;
	m.position.set(sx, 1, sz);
	addTransient(m, 0.45, (k) => {
		const P = G.player;
		const e = k * k * (3 - 2 * k);
		m.position.set(sx + (P.pos.x - sx) * e, 1 + Math.sin(k * Math.PI) * 1.4, sz + (P.pos.z - sz) * e);
		if (Math.random() < 0.6) burst({ x: m.position.x, z: m.position.z, y: m.position.y, count: 1, color, speed: 0.1, up: 0, size: 0.2, life: 0.25, gravity: 0 });
	}, () => onArrive?.(amount));
}
