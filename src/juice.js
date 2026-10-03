// Shader-driven feedback layer: floor ripples, spark streaks, debris, scorch decals,
// projectile lighting and controller rumble.
import * as THREE from 'three';
import { G } from './state.js';
import { R } from './render.js';
import { input } from './input.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rand, clamp } from './util.js';

export const J = { time: 0, sparks: null, chunks: null, decals: [], decalIdx: 0, projLights: [], pvel: { x: 0, z: 0 }, lastP: null };

// Smoothed player velocity, used by enemies that predict where Buddy is heading.
export function playerVelocity() { return J.pvel; }

// ---------------- floor ripples ----------------
const RIPPLES = 6;
export const floorUniforms = {
	uJTime: { value: 0 },
	uRipples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
	uRipColor: { value: new THREE.Color(1, 1, 1) },
	uTrace: { value: new THREE.Color(0.3, 0.3, 0.5) },
	uTraceK: { value: 0.25 },
	uPlayer: { value: new THREE.Vector3(0, -100, 0) },
	uPlayerColor: { value: new THREE.Color(0x4cc3ff) },
};
let rippleIdx = 0;

export function floorRipple(x, z, strength = 1) {
	floorUniforms.uRipples.value[rippleIdx++ % RIPPLES].set(x, z, J.time, strength);
	G.room?.dressing?.impulse?.(x, z, strength);
}

const RIPPLE_GLSL = /* glsl */`
	uniform float uJTime;
	uniform vec4 uRipples[${RIPPLES}];
	float rippleAt(vec2 p) {
		float acc = 0.0;
		for (int i = 0; i < ${RIPPLES}; i++) {
			vec4 r = uRipples[i];
			float age = uJTime - r.z;
			if (age < 0.0 || age > 1.6) continue;
			float rad = age * 13.0;
			float d = distance(p, r.xy);
			float x = (d - rad) * 0.9;
			float band = exp(-x * x);
			acc += band * r.w * exp(-age * 2.6);
		}
		return acc;
	}
`;

// Tiles pop upward as a ring passes; the top faces glow with circuit traces and Buddy's light.
export function floorify(mat) {
	mat.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, floorUniforms);
		shader.vertexShader = RIPPLE_GLSL + 'varying float vRip; varying vec3 vWorldF; varying float vTop;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			#ifdef USE_INSTANCING
				vec3 tileC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
			#else
				vec3 tileC = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
			#endif
			vRip = rippleAt(tileC.xz);
			transformed.y += vRip * 0.38;
			vTop = step(0.55, objectNormal.y);
			#ifdef USE_INSTANCING
				vWorldF = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			#else
				vWorldF = (modelMatrix * vec4(transformed, 1.0)).xyz;
			#endif
		`);
		shader.fragmentShader = 'uniform float uJTime; uniform vec3 uRipColor; uniform vec3 uTrace; uniform float uTraceK; uniform vec3 uPlayer; uniform vec3 uPlayerColor; varying float vRip; varying vec3 vWorldF; varying float vTop;\n' +
			shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				vec2 cell = floor(vWorldF.xz * 0.5 + 0.5);
				vec2 f = fract(vWorldF.xz * 0.5 + 0.5);
				float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
				float lane = h > 0.5 ? f.x : f.y;
				float across = h > 0.5 ? f.y : f.x;
				float wire = smoothstep(0.035, 0.0, abs(across - (0.25 + 0.5 * fract(h * 7.0))));
				float pulse = pow(fract(lane - uJTime * (0.25 + h * 0.35) + h * 3.0), 14.0);
				float trace = wire * (0.18 + pulse * 1.6) * step(0.45, fract(h * 13.0));
				float pd = distance(vWorldF.xz, uPlayer.xz);
				float pool = exp(-pd * pd * 0.32) * 0.18;
				totalEmissiveRadiance += vTop * (uTrace * trace * uTraceK + uPlayerColor * pool) + uRipColor * vRip * (0.45 + vTop * 0.9);
			`);
	};
	mat.customProgramCacheKey = () => 'floorify';
	return mat;
}

// ---------------- spark streaks ----------------
class Sparks {
	constructor(max) {
		this.max = max;
		this.count = 0;
		const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
		const geo = new THREE.InstancedBufferGeometry();
		geo.index = base.index;
		geo.attributes.position = base.attributes.position;
		this.head = new Float32Array(max * 3);
		this.velA = new Float32Array(max * 3);
		this.colA = new Float32Array(max * 4);
		this.vel = new Float32Array(max * 3);
		this.life = new Float32Array(max);
		this.maxLife = new Float32Array(max);
		this.grav = new Float32Array(max);
		this.width = new Float32Array(max);
		this.base = new Float32Array(max * 3);
		geo.setAttribute('aHead', new THREE.InstancedBufferAttribute(this.head, 3).setUsage(THREE.DynamicDrawUsage));
		geo.setAttribute('aVel', new THREE.InstancedBufferAttribute(this.velA, 3).setUsage(THREE.DynamicDrawUsage));
		geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(this.colA, 4).setUsage(THREE.DynamicDrawUsage));
		geo.instanceCount = 0;
		this.geo = geo;
		this.mat = new THREE.ShaderMaterial({
			vertexShader: /* glsl */`
				attribute vec3 aHead; attribute vec3 aVel; attribute vec4 aCol;
				varying vec4 vCol; varying vec2 vUv;
				void main() {
					vCol = aCol; vUv = uv;
					vec3 tail = aHead - aVel * 0.055;
					vec3 dir = aHead - tail;
					vec3 view = normalize(cameraPosition - aHead);
					vec3 cr = cross(dir, view);
					vec3 side = dot(cr, cr) > 1e-10 ? normalize(cr) : vec3(1.0, 0.0, 0.0);
					vec3 p = mix(tail, aHead, position.y) + side * position.x * aCol.a;
					gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
				}`,
			fragmentShader: /* glsl */`
				varying vec4 vCol; varying vec2 vUv;
				void main() {
					float across = clamp(1.0 - abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
					float a = across * across * smoothstep(0.0, 0.35, vUv.y);
					gl_FragColor = vec4(vCol.rgb * a, 1.0);
				}`,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
		});
		this.mesh = new THREE.Mesh(geo, this.mat);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 12;
	}

	emit({ x, y = 0.8, z, count = 10, speed = 12, dir = 0, spread = Math.PI * 2, up = 3, color = 0xffffff, color2 = null, life = 0.3, width = 0.07, gravity = -16 }) {
		const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 ?? color);
		for (let n = 0; n < count; n++) {
			if (this.count >= this.max) return;
			const i = this.count++;
			const a = dir + (Math.random() - 0.5) * spread;
			const s = speed * rand(0.45, 1.15);
			this.head[i * 3] = x; this.head[i * 3 + 1] = y; this.head[i * 3 + 2] = z;
			this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * rand(0.2, 1.4); this.vel[i * 3 + 2] = Math.sin(a) * s;
			const t = Math.random();
			this.base[i * 3] = c1.r + (c2.r - c1.r) * t; this.base[i * 3 + 1] = c1.g + (c2.g - c1.g) * t; this.base[i * 3 + 2] = c1.b + (c2.b - c1.b) * t;
			this.maxLife[i] = this.life[i] = life * rand(0.6, 1.3);
			this.grav[i] = gravity;
			this.width[i] = width * rand(0.7, 1.3);
		}
	}

	_kill(i) {
		const j = --this.count;
		if (i === j) return;
		for (let k = 0; k < 3; k++) { this.head[i * 3 + k] = this.head[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; this.base[i * 3 + k] = this.base[j * 3 + k]; }
		this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.grav[i] = this.grav[j]; this.width[i] = this.width[j];
	}

	update(dt) {
		const dr = Math.exp(-3 * dt);
		for (let i = 0; i < this.count; i++) {
			this.life[i] -= dt;
			if (this.life[i] <= 0) { this._kill(i); i--; continue; }
			const k = this.life[i] / this.maxLife[i];
			this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
			this.vel[i * 3 + 1] += this.grav[i] * dt;
			for (let a = 0; a < 3; a++) this.head[i * 3 + a] += this.vel[i * 3 + a] * dt;
			if (this.head[i * 3 + 1] < 0.04) { this.head[i * 3 + 1] = 0.04; this.vel[i * 3 + 1] *= -0.35; }
			for (let a = 0; a < 3; a++) this.velA[i * 3 + a] = this.vel[i * 3 + a];
			const glow = 1.4 + k * 2.2;
			this.colA[i * 4] = this.base[i * 3] * glow * k; this.colA[i * 4 + 1] = this.base[i * 3 + 1] * glow * k; this.colA[i * 4 + 2] = this.base[i * 3 + 2] * glow * k;
			this.colA[i * 4 + 3] = this.width[i];
		}
		this.geo.instanceCount = this.count;
		for (const n of ['aHead', 'aVel', 'aCol']) this.geo.attributes[n].needsUpdate = true;
	}

	clear() { this.count = 0; this.geo.instanceCount = 0; }
}

// ---------------- physical debris ----------------
class Chunks {
	constructor(max) {
		this.max = max;
		this.items = [];
		const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
		const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.12 });
		this.mesh = new THREE.InstancedMesh(geo, mat, max);
		this.mesh.castShadow = true;
		this.mesh.frustumCulled = false;
		this.mesh.count = 0;
		this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
		this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color();
	}

	emit({ x, y = 0.6, z, count = 6, color = 0xffffff, color2 = null, speed = 6, size = 0.18, up = 6, life = 1.4 }) {
		const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 ?? color);
		for (let i = 0; i < count; i++) {
			if (this.items.length >= this.max) this.items.shift();
			const a = rand(0, Math.PI * 2), s = speed * rand(0.4, 1.1);
			this.items.push({
				x, y, z, vx: Math.cos(a) * s, vy: up * rand(0.5, 1.2), vz: Math.sin(a) * s,
				rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), sx: rand(-12, 12), sy: rand(-12, 12), sz: rand(-12, 12),
				size: size * rand(0.6, 1.4), life: life * rand(0.75, 1.25), t: 0,
				col: c1.clone().lerp(c2, Math.random()),
			});
		}
	}

	update(dt) {
		const room = G.room;
		let n = 0;
		for (let i = this.items.length - 1; i >= 0; i--) {
			const c = this.items[i];
			c.t += dt;
			if (c.t >= c.life) { this.items.splice(i, 1); continue; }
			c.vy -= 24 * dt;
			c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
			const overFloor = !room || room.walkable(c.x, c.z);
			const floor = overFloor ? c.size * 0.5 : -40;
			if (c.y < floor) {
				c.y = floor;
				if (c.vy < -1.5) { c.vy *= -0.38; c.sx *= 0.6; c.sy *= 0.6; c.sz *= 0.6; } else c.vy = 0;
				c.vx *= 0.7; c.vz *= 0.7;
			}
			c.rx += c.sx * dt; c.ry += c.sy * dt; c.rz += c.sz * dt;
			const fade = c.t > c.life - 0.35 ? (c.life - c.t) / 0.35 : 1;
			this._e.set(c.rx, c.ry, c.rz);
			this._q.setFromEuler(this._e);
			this._s.setScalar(Math.max(0.001, c.size * fade));
			this._p.set(c.x, c.y, c.z);
			this._m.compose(this._p, this._q, this._s);
			this.mesh.setMatrixAt(n, this._m);
			this.mesh.setColorAt(n, c.col);
			n++;
		}
		this.mesh.count = n;
		this.mesh.instanceMatrix.needsUpdate = true;
		this.mesh.instanceColor.needsUpdate = true;
	}

	clear() { this.items.length = 0; this.mesh.count = 0; }
}

// ---------------- scorch decals ----------------
const decalVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const decalFS = /* glsl */`
	uniform float uAge; uniform vec3 uEmber; uniform float uSeed;
	varying vec2 vUv;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1)) + uSeed) * 45758.5453); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
	void main() {
		vec2 p = vUv - 0.5;
		float d = length(p) * 2.0;
		float n = noise(p * 7.0) * 0.55 + noise(p * 15.0) * 0.3;
		float shape = smoothstep(1.0, 0.45, d + n * 0.45);
		if (shape < 0.01) discard;
		float fade = 1.0 - smoothstep(3.5, 6.0, uAge);
		float hot = exp(-uAge * 1.7) * smoothstep(0.25, 0.85, n + (1.0 - d) * 0.35);
		vec3 col = mix(vec3(0.02, 0.015, 0.03), uEmber * 2.5, hot);
		gl_FragColor = vec4(col, shape * fade * 0.72);
	}`;

function makeDecal() {
	const mat = new THREE.ShaderMaterial({
		uniforms: { uAge: { value: 99 }, uEmber: { value: new THREE.Color(0xff7a2f) }, uSeed: { value: 0 } },
		vertexShader: decalVS, fragmentShader: decalFS,
		transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
	});
	const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
	m.visible = false;
	m.renderOrder = 3;
	return m;
}

export function scorch(x, z, r = 1.5, color = 0xff7a2f) {
	if (G.room && !G.room.walkable(x, z)) return;
	const d = J.decals[J.decalIdx++ % J.decals.length];
	d.visible = true;
	d.position.set(x, 0.016, z);
	d.rotation.y = rand(0, Math.PI * 2);
	d.scale.set(r, 1, r);
	d.material.uniforms.uAge.value = 0;
	d.material.uniforms.uEmber.value.set(color);
	d.material.uniforms.uSeed.value = rand(0, 100);
}

// ---------------- public emitters ----------------
export function sparks(opts) { J.sparks?.emit(opts); }
export function chunks(opts) { J.chunks?.emit(opts); }

export function rumble(strong, weak = strong, ms = 120) {
	input.rumble(strong * (G.save?.settings.rumble ?? 1), weak * (G.save?.settings.rumble ?? 1), ms);
}

// A compact "impact" bundle so hits feel consistent everywhere.
export function impact(x, z, { y = 0.8, color = 0xffffff, color2 = null, dir = 0, spread = 1.6, power = 1, chunk = 0, ripple = 0 } = {}) {
	sparks({ x, y, z, count: Math.round(6 + power * 8), speed: 9 + power * 6, dir, spread, color, color2: color2 ?? 0xffffff, life: 0.22 + power * 0.08, width: 0.05 + power * 0.03 });
	if (chunk) chunks({ x, y, z, count: chunk, color, color2, speed: 4 + power * 2 });
	if (ripple) floorRipple(x, z, ripple);
}

// ---------------- lifecycle ----------------
export function initJuice() {
	J.sparks = new Sparks(700);
	J.chunks = new Chunks(180);
	R.scene.add(J.sparks.mesh, J.chunks.mesh);
	for (let i = 0; i < 28; i++) { const d = makeDecal(); J.decals.push(d); R.scene.add(d); }
	J.projLights = R.projLights;
}

const _pl = [];
export function updateJuice(dt, realDt) {
	J.time += dt;
	floorUniforms.uJTime.value = J.time;
	J.sparks.update(dt);
	J.chunks.update(dt);
	for (const d of J.decals) {
		if (!d.visible) continue;
		d.material.uniforms.uAge.value += dt;
		if (d.material.uniforms.uAge.value > 6) d.visible = false;
	}
	const P = G.player;
	if (P) {
		if (J.lastP && dt > 0) {
			const vx = (P.pos.x - J.lastP.x) / dt, vz = (P.pos.z - J.lastP.z) / dt;
			const ok = Math.hypot(vx, vz) < 40;
			const k = 1 - Math.exp(-10 * dt);
			J.pvel.x += ((ok ? vx : 0) - J.pvel.x) * k;
			J.pvel.z += ((ok ? vz : 0) - J.pvel.z) * k;
		}
		J.lastP = { x: P.pos.x, z: P.pos.z };
		floorUniforms.uPlayer.value.set(P.pos.x, 0, P.pos.z);
		floorUniforms.uPlayerColor.value.set(P.model.colors.glow);
	}
	// Enemy projectiles closest to Buddy light the floor around them.
	_pl.length = 0;
	if (P) for (const p of G.projectiles) if (p.alive && p.owner === 'enemy') _pl.push(p);
	if (_pl.length > J.projLights.length) _pl.sort((a, b) => Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) - Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z));
	J.projLights.forEach((l, i) => {
		const p = _pl[i];
		if (!p) { l.intensity = Math.max(0, l.intensity - realDt * 40); return; }
		l.position.set(p.pos.x, p.pos.y + 0.35, p.pos.z);
		l.color.set(p.trail || 0xff3366);
		l.intensity = 7;
	});
}

export function clearJuice() {
	J.sparks?.clear();
	J.chunks?.clear();
	for (const d of J.decals) d.visible = false;
	for (const r of floorUniforms.uRipples.value) r.z = -100;
	J.projLights.forEach((l) => { l.intensity = 0; });
}

export { clamp };
