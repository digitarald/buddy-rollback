import * as THREE from 'three';
import { G } from './state.js';
import { R } from './render.js';
import { rand, clamp } from './util.js';

// ---------------- particles ----------------
class Particles {
	constructor(max, additive) {
		this.max = max;
		this.count = 0;
		const geo = new THREE.BufferGeometry();
		this.pos = new Float32Array(max * 3);
		this.col = new Float32Array(max * 3);
		this.size = new Float32Array(max);
		this.alpha = new Float32Array(max);
		this.vel = new Float32Array(max * 3);
		this.life = new Float32Array(max);
		this.maxLife = new Float32Array(max);
		this.grav = new Float32Array(max);
		this.drag = new Float32Array(max);
		this.s0 = new Float32Array(max);
		this.s1 = new Float32Array(max);
		this.base = new Float32Array(max * 3);
		geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
		geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
		geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
		geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
		geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
		this.mat = new THREE.ShaderMaterial({
			uniforms: { uScale: { value: 400 } },
			vertexShader: /* glsl */`
				attribute float size; attribute float alpha; attribute vec3 color;
				varying vec3 vColor; varying float vAlpha;
				uniform float uScale;
				void main() {
					vColor = color; vAlpha = alpha;
					vec4 mv = modelViewMatrix * vec4(position, 1.0);
					gl_PointSize = size * uScale / -mv.z;
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: additive ? /* glsl */`
				varying vec3 vColor; varying float vAlpha;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					if (d > 0.5) discard;
					float a = smoothstep(0.5, 0.0, d); a *= a;
					gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
				}` : /* glsl */`
				varying vec3 vColor; varying float vAlpha;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					if (d > 0.5) discard;
					float a = smoothstep(0.5, 0.15, d);
					gl_FragColor = vec4(vColor, a * vAlpha);
				}`,
			transparent: true,
			depthWrite: false,
			blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		this.points = new THREE.Points(geo, this.mat);
		this.points.frustumCulled = false;
		this.points.renderOrder = 10;
		this.geo = geo;
	}

	emit({ x, y = 0.5, z, count = 10, speed = 4, speedVar = 0.5, spread = Math.PI * 2, dir = 0, up = 2, upVar = 1, color = 0xffffff, color2 = null, size = 0.25, sizeEnd = 0, life = 0.5, lifeVar = 0.3, gravity = -6, drag = 2, radius = 0 }) {
		const c1 = new THREE.Color(color), c2 = color2 !== null ? new THREE.Color(color2) : c1;
		for (let n = 0; n < count; n++) {
			if (this.count >= this.max) return;
			const i = this.count++;
			const a = dir + (Math.random() - 0.5) * spread;
			const s = speed * (1 - speedVar + Math.random() * speedVar * 2);
			const ox = radius ? (Math.random() - 0.5) * 2 * radius : 0;
			const oz = radius ? (Math.random() - 0.5) * 2 * radius : 0;
			this.pos[i * 3] = x + ox; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z + oz;
			this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up + (Math.random() - 0.5) * upVar * 2; this.vel[i * 3 + 2] = Math.sin(a) * s;
			const t = Math.random();
			this.base[i * 3] = c1.r + (c2.r - c1.r) * t; this.base[i * 3 + 1] = c1.g + (c2.g - c1.g) * t; this.base[i * 3 + 2] = c1.b + (c2.b - c1.b) * t;
			this.maxLife[i] = this.life[i] = life * (1 - lifeVar + Math.random() * lifeVar * 2);
			this.grav[i] = gravity; this.drag[i] = drag;
			this.s0[i] = size * (0.7 + Math.random() * 0.6); this.s1[i] = sizeEnd;
		}
	}

	_kill(i) {
		const j = --this.count;
		if (i === j) return;
		for (let k = 0; k < 3; k++) {
			this.pos[i * 3 + k] = this.pos[j * 3 + k];
			this.vel[i * 3 + k] = this.vel[j * 3 + k];
			this.base[i * 3 + k] = this.base[j * 3 + k];
		}
		this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
		this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
		this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
	}

	update(dt) {
		for (let i = 0; i < this.count; i++) {
			this.life[i] -= dt;
			if (this.life[i] <= 0) { this._kill(i); i--; continue; }
			const k = 1 - this.life[i] / this.maxLife[i];
			const dr = Math.exp(-this.drag[i] * dt);
			this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
			this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr + this.grav[i] * dt;
			this.pos[i * 3] += this.vel[i * 3] * dt;
			this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
			this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
			if (this.pos[i * 3 + 1] < 0.03) { this.pos[i * 3 + 1] = 0.03; this.vel[i * 3 + 1] *= -0.3; }
			this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
			const fade = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
			this.alpha[i] = fade;
			this.col[i * 3] = this.base[i * 3]; this.col[i * 3 + 1] = this.base[i * 3 + 1]; this.col[i * 3 + 2] = this.base[i * 3 + 2];
		}
		this.geo.setDrawRange(0, this.count);
		for (const n of ['position', 'color', 'size', 'alpha']) this.geo.attributes[n].needsUpdate = true;
	}

	clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}

export const FX = {
	glow: null, dust: null, transients: [], numbers: [], layer: null,
};

export function initFX() {
	FX.glow = new Particles(3000, true);
	FX.dust = new Particles(1200, false);
	R.scene.add(FX.glow.points, FX.dust.points);
	FX.layer = document.getElementById('fx-layer');
}

export function burst(opts) { FX.glow.emit(opts); }
export function dust(opts) { FX.dust.emit({ color: 0x3a3048, size: 0.5, sizeEnd: 0.9, gravity: 0.5, drag: 4, life: 0.7, up: 0.8, ...opts }); }

function transient(obj, dur, onUpdate, onEnd) {
	R.scene.add(obj);
	FX.transients.push({ obj, t: 0, dur, onUpdate, onEnd });
	return obj;
}

export function updateFX(dt, realDt) {
	const h = R.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
	const scale = h * R.camera.projectionMatrix.elements[5] * 0.5;
	FX.glow.mat.uniforms.uScale.value = scale;
	FX.dust.mat.uniforms.uScale.value = scale;
	FX.glow.update(dt);
	FX.dust.update(dt);
	for (let i = FX.transients.length - 1; i >= 0; i--) {
		const tr = FX.transients[i];
		tr.t += tr.real ? realDt : dt;
		const k = clamp(tr.t / tr.dur, 0, 1);
		if (tr.onUpdate) tr.onUpdate(k, dt, tr);
		if (tr.t >= tr.dur) {
			R.scene.remove(tr.obj);
			if (tr.onEnd) tr.onEnd();
			disposeObj(tr.obj);
			FX.transients.splice(i, 1);
		}
	}
	updateNumbers(realDt);
}

export function clearFX() {
	for (const tr of FX.transients) { R.scene.remove(tr.obj); disposeObj(tr.obj); }
	FX.transients.length = 0;
	FX.glow.clear(); FX.dust.clear();
	for (const n of FX.numbers) n.el.remove();
	FX.numbers.length = 0;
}

function disposeObj(o) {
	o.traverse((c) => {
		if (c.userData.keepGeo) return;
		if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose();
		if (c.material && !c.material.userData.shared) c.material.dispose();
	});
}

// ---------------- slash trail ----------------
const slashVS = /* glsl */`
	attribute float aT; attribute float aR;
	varying float vT; varying float vR;
	void main() { vT = aT; vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const slashFS = /* glsl */`
	uniform float uHead; uniform float uFade; uniform vec3 uColor; uniform vec3 uCore;
	varying float vT; varying float vR;
	void main() {
		if (vT > uHead) discard;
		float tail = smoothstep(uHead - 0.75, uHead, vT);
		float edge = pow(vR, 3.0);
		float core = smoothstep(0.82, 1.0, vR);
		vec3 c = mix(uColor, uCore, core) * (0.35 + edge * 1.8);
		float a = tail * uFade * (0.08 + edge * 0.9);
		gl_FragColor = vec4(c * a, 1.0);
	}`;

export function slash({ x, z, y = 0.55, angle, arc = Math.PI * 0.9, r0 = 0.4, r1 = 2.2, color = 0x4cc3ff, core = 0xffffff, dur = 0.2, dirSign = 1, intensity = 1.6, tilt = 0 }) {
	const N = 28;
	const pos = new Float32Array((N + 1) * 2 * 3);
	const aT = new Float32Array((N + 1) * 2);
	const aR = new Float32Array((N + 1) * 2);
	const idx = [];
	for (let i = 0; i <= N; i++) {
		const t = i / N;
		const a = angle - dirSign * arc / 2 + dirSign * arc * t;
		const ca = Math.cos(a), sa = Math.sin(a);
		const rr1 = r1 * (0.85 + 0.15 * Math.sin(t * Math.PI));
		pos.set([ca * r0, 0, sa * r0], i * 6);
		pos.set([ca * rr1, 0, sa * rr1], i * 6 + 3);
		aT[i * 2] = t; aT[i * 2 + 1] = t;
		aR[i * 2] = 0; aR[i * 2 + 1] = 1;
		if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
	geo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
	geo.setIndex(idx);
	const mat = new THREE.ShaderMaterial({
		uniforms: { uHead: { value: 0 }, uFade: { value: 1 }, uColor: { value: new THREE.Color(color).multiplyScalar(intensity * 0.55) }, uCore: { value: new THREE.Color(core).multiplyScalar(intensity * 0.6) } },
		vertexShader: slashVS, fragmentShader: slashFS,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.set(x, y, z);
	mesh.rotation.x = tilt;
	mesh.renderOrder = 11;
	transient(mesh, dur, (k) => {
		mat.uniforms.uHead.value = Math.min(1.35, k * 2.6);
		mat.uniforms.uFade.value = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
	});
	return mesh;
}

// ---------------- rings / shockwaves ----------------
const ringGeo = new THREE.RingGeometry(0.86, 1, 64); ringGeo.rotateX(-Math.PI / 2); ringGeo.userData.shared = true;
export function ring({ x, z, y = 0.08, r0 = 0.2, r1 = 3, color = 0xffffff, dur = 0.35, intensity = 2, width = null }) {
	const geo = width ? new THREE.RingGeometry(1 - width, 1, 64).rotateX(-Math.PI / 2) : ringGeo;
	const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
	const m = new THREE.Mesh(geo, mat);
	m.position.set(x, y, z);
	m.renderOrder = 9;
	transient(m, dur, (k) => {
		const e = 1 - Math.pow(1 - k, 3);
		const s = r0 + (r1 - r0) * e;
		m.scale.set(s, 1, s);
		mat.opacity = 1 - k;
	});
	return m;
}

// ---------------- telegraphs ----------------
const teleCircleFS = /* glsl */`
	uniform float uP; uniform vec3 uColor; uniform float uA; uniform float uTime;
	varying vec2 vUv;
	void main() {
		float d = length(vUv - 0.5) * 2.0;
		if (d > 1.0) discard;
		float rim = smoothstep(0.9, 0.96, d) * (1.0 - smoothstep(0.98, 1.0, d));
		float fill = step(d, uP) * (0.22 + 0.5 * smoothstep(uP - 0.08, uP, d));
		float dash = step(0.5, fract(atan(vUv.y - 0.5, vUv.x - 0.5) * 6.0 + uTime * 2.0));
		float a = (rim * (0.6 + 0.4 * dash) + fill + 0.06) * uA;
		gl_FragColor = vec4(uColor * a, 1.0);
	}`;
const teleVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const teleLineFS = /* glsl */`
	uniform float uP; uniform vec3 uColor; uniform float uA;
	varying vec2 vUv;
	void main() {
		float side = min(vUv.x, 1.0 - vUv.x);
		float rim = 1.0 - smoothstep(0.0, 0.08, side);
		float fill = step(vUv.y, uP) * (0.25 + 0.5 * smoothstep(uP - 0.06, uP, vUv.y));
		float a = (rim * 0.8 + fill + 0.05) * uA;
		gl_FragColor = vec4(uColor * a, 1.0);
	}`;

export const TELE_RED = 0xff3048;

export function teleCircle({ x, z, r, dur, color = TELE_RED, onDone = null, follow = null }) {
	const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
	const mat = new THREE.ShaderMaterial({
		uniforms: { uP: { value: 0 }, uColor: { value: new THREE.Color(color).multiplyScalar(1.4) }, uA: { value: 0 }, uTime: { value: 0 } },
		vertexShader: teleVS, fragmentShader: teleCircleFS,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const m = new THREE.Mesh(geo, mat);
	m.position.set(x, 0.06, z);
	m.scale.set(r, 1, r);
	m.renderOrder = 8;
	const tr = transient(m, dur, (k, dt) => {
		mat.uniforms.uP.value = k;
		mat.uniforms.uA.value = Math.min(1, k * 6);
		mat.uniforms.uTime.value += dt;
		if (follow) m.position.set(follow.x, 0.06, follow.z);
	}, onDone);
	return tr;
}

export function teleLine({ x, z, angle, length, width, dur, color = TELE_RED, onDone = null }) {
	const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
	// after rotateX, local +y (length) maps to -z; rotate so it points along angle
	const mat = new THREE.ShaderMaterial({
		uniforms: { uP: { value: 0 }, uColor: { value: new THREE.Color(color).multiplyScalar(1.4) }, uA: { value: 0 } },
		vertexShader: teleVS, fragmentShader: teleLineFS,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const m = new THREE.Mesh(geo, mat);
	m.position.set(x, 0.07, z);
	m.scale.set(width, 1, length);
	m.rotation.y = -angle - Math.PI / 2;
	m.renderOrder = 8;
	transient(m, dur, (k) => {
		mat.uniforms.uP.value = k;
		mat.uniforms.uA.value = Math.min(1, k * 6);
	}, onDone);
	return m;
}

// ---------------- lightning ----------------
export function lightning(a, b, { color = 0xffe066, width = 0.14, dur = 0.18, y = 0.9, jag = 0.5 } = {}) {
	const pts = [];
	const segs = Math.max(4, Math.floor(Math.hypot(b.x - a.x, b.z - a.z) * 1.6));
	const nx = -(b.z - a.z), nz = b.x - a.x;
	const nl = Math.hypot(nx, nz) || 1;
	for (let i = 0; i <= segs; i++) {
		const t = i / segs;
		const off = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * jag * 2;
		pts.push([a.x + (b.x - a.x) * t + nx / nl * off, y + Math.random() * 0.2, a.z + (b.z - a.z) * t + nz / nl * off]);
	}
	const pos = [], idx = [];
	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
		let dx = q[0] - o[0], dz = q[2] - o[2];
		const l = Math.hypot(dx, dz) || 1;
		const px = -dz / l * width, pz = dx / l * width;
		pos.push(p[0] + px, p[1], p[2] + pz, p[0] - px, p[1], p[2] - pz);
		if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setIndex(idx);
	const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
	const m = new THREE.Mesh(geo, mat);
	m.renderOrder = 12;
	transient(m, dur, (k) => { mat.opacity = (1 - k) * (Math.random() < 0.7 ? 1 : 0.3); });
}

// ---------------- beam (spawn pillar / pickups) ----------------
const beamFS = /* glsl */`
	uniform vec3 uColor; uniform float uA; varying vec2 vUv;
	void main() {
		float a = pow(1.0 - vUv.y, 2.0) * uA * (0.6 + 0.4 * sin(vUv.x * 40.0));
		gl_FragColor = vec4(uColor * a, 1.0);
	}`;
export function beam({ x, z, r = 0.6, h = 7, color = 0xff3048, dur = 0.9, grow = true }) {
	const geo = new THREE.CylinderGeometry(r, r, h, 20, 1, true).translate(0, h / 2, 0);
	const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2) }, uA: { value: 0 } }, vertexShader: teleVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
	const m = new THREE.Mesh(geo, mat);
	m.position.set(x, 0, z);
	transient(m, dur, (k) => {
		mat.uniforms.uA.value = Math.sin(k * Math.PI);
		const s = grow ? 0.3 + k * 0.9 : 1 - k * 0.8;
		m.scale.set(s, 1, s);
	});
	return m;
}

// ---------------- afterimage ----------------
export function ghost(source, color = 0x4cc3ff, dur = 0.28, opacity = 0.45) {
	const group = new THREE.Group();
	source.updateWorldMatrix(true, true);
	source.traverse((o) => {
		if (!o.isMesh || o.userData.isOutline || !o.visible) return;
		const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
		const m = new THREE.Mesh(o.geometry, mat);
		m.userData.keepGeo = true;
		o.matrixWorld.decompose(m.position, m.quaternion, m.scale);
		group.add(m);
	});
	transient(group, dur, (k) => {
		group.traverse((o) => { if (o.material) o.material.opacity = opacity * (1 - k); });
	});
}

// generic helpers exposed for other modules
export function addTransient(obj, dur, onUpdate, onEnd, real = false) {
	const o = transient(obj, dur, onUpdate, onEnd);
	FX.transients[FX.transients.length - 1].real = real;
	return o;
}

// ---------------- damage numbers ----------------
const _v = new THREE.Vector3();
export function damageNumber(x, y, z, value, { crit = false, color = null, heal = false, text = null } = {}) {
	if (!FX.layer) return;
	const el = document.createElement('div');
	el.className = 'dmg' + (crit ? ' crit' : '') + (heal ? ' heal' : '');
	el.textContent = text ?? (heal ? '+' + Math.round(value) : Math.round(value));
	if (color) el.style.color = color;
	FX.layer.appendChild(el);
	FX.numbers.push({ el, x: x + rand(-0.3, 0.3), y: y + 1.4, z, t: 0, vx: rand(-0.6, 0.6), dur: crit ? 1.0 : 0.75 });
}

function updateNumbers(dt) {
	const w = window.innerWidth, h = window.innerHeight;
	for (let i = FX.numbers.length - 1; i >= 0; i--) {
		const n = FX.numbers[i];
		n.t += dt;
		const k = n.t / n.dur;
		if (k >= 1) { n.el.remove(); FX.numbers.splice(i, 1); continue; }
		n.x += n.vx * dt;
		_v.set(n.x, n.y + k * 1.2, n.z).project(R.camera);
		const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
		const pop = k < 0.15 ? 1 + (1 - k / 0.15) * 0.6 : 1;
		n.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop})`;
		n.el.style.opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
	}
}

export function worldToScreen(x, y, z) {
	_v.set(x, y, z).project(R.camera);
	return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight, visible: _v.z < 1 };
}

export { G as _G };
