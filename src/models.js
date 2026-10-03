import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rimify, toon, addOutline, glowMat } from './materials.js';
import { glyphTexture, textTexture } from './textures.js';

export const BUDDY_COLORS = {
	stable: { body: 0x23a8f2, mid: 0x0077b8, dark: 0x004e7c, glow: 0x47b8ff },
	insiders: { body: 0x24bfa5, mid: 0x1a9c87, dark: 0x0f6b5c, glow: 0x3fe0c0 },
};

// ---------- voxel helpers (homage to the pet's pixel sprites) ----------
export function voxelGeometry(rows, px = 0.1, depth = 0.1) {
	const geos = [];
	const h = rows.length, w = Math.max(...rows.map((r) => r.length));
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < rows[y].length; x++) {
			if (rows[y][x] === '.' || rows[y][x] === ' ') continue;
			const g = new THREE.BoxGeometry(px, px, depth);
			g.translate((x - (w - 1) / 2) * px, ((h - 1) / 2 - y) * px, 0);
			geos.push(g);
		}
	}
	const m = mergeGeometries(geos);
	geos.forEach((g) => g.dispose());
	return m;
}
export const STAR_ROWS = ['..#..', '.###.', '#####', '.#.#.', '#...#'];
export const HEART_ROWS = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const starGeo = voxelGeometry(STAR_ROWS, 0.12, 0.12); starGeo.userData.shared = true;
const heartGeo = voxelGeometry(HEART_ROWS, 0.1, 0.1); heartGeo.userData.shared = true;
export function starMesh(scale = 1, color = 0xffcd0f, emissive = 0.6) {
	const m = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4, metalness: 0.2 }));
	m.scale.setScalar(scale);
	return m;
}
export function heartMesh(scale = 1) {
	const m = new THREE.Mesh(heartGeo, new THREE.MeshStandardMaterial({ color: 0xe8334a, emissive: 0xe8334a, emissiveIntensity: 0.7, roughness: 0.4 }));
	m.scale.setScalar(scale);
	return m;
}

// ---------- Buddy ----------
function dropletProfile() {
	const raw = [[0.0, 0.0], [0.46, 0.0], [0.6, 0.05], [0.66, 0.16], [0.65, 0.3], [0.58, 0.48], [0.46, 0.66], [0.32, 0.84], [0.17, 1.0], [0.06, 1.12], [0.0, 1.16]];
	const curve = new THREE.SplineCurve(raw.map(([x, y]) => new THREE.Vector2(x, y)));
	return curve.getPoints(36);
}

export function createBuddy(variant = 'stable') {
	const C = BUDDY_COLORS[variant] || BUDDY_COLORS.stable;
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);

	const bodyMat = rimify(new THREE.MeshPhysicalMaterial({ color: C.body, emissive: C.body, emissiveIntensity: 0.16, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.6, sheenColor: new THREE.Color(0xbfeaff), sheenRoughness: 0.4 }), 0x8fe0ff, 0.5, 2.3);
	const bodyGeo = new THREE.LatheGeometry(dropletProfile(), 48);
	const shell = new THREE.Mesh(bodyGeo, bodyMat);
	shell.castShadow = true;
	shell.userData.part = 'shell';
	addOutline(shell, 0.035);
	body.add(shell);

	// eyes: dark pills with a glint
	const eyeMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.15, metalness: 0.1 });
	const eyeGeo = new THREE.CapsuleGeometry(0.058, 0.1, 4, 12);
	const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
	const eyes = [];
	for (const s of [-1, 1]) {
		const pivot = new THREE.Group();
		pivot.position.set(0.17 * s, 0.44, 0);
		pivot.rotation.y = 0.3 * s;
		const eye = new THREE.Mesh(eyeGeo, eyeMat);
		eye.position.z = 0.545;
		eye.scale.z = 0.45;
		const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), glintMat);
		glint.position.set(-0.02, 0.05, 0.03);
		eye.add(glint);
		pivot.add(eye);
		body.add(pivot);
		eyes.push(eye);
	}

	// antennae: V from the tip, pixel-cube ends
	const antMat = rimify(new THREE.MeshStandardMaterial({ color: C.mid, roughness: 0.4, emissive: C.mid, emissiveIntensity: 0.25 }), 0x8fe0ff, 0.4);
	const antennae = [];
	for (const s of [-1, 1]) {
		const pivot = new THREE.Group();
		pivot.position.set(0.02 * s, 1.08, 0);
		pivot.rotation.z = -0.62 * s;
		const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.42, 6), antMat);
		stalk.position.y = 0.21;
		const tip = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.1, 0.1, 1, 0.015), antMat);
		tip.position.y = 0.44;
		tip.castShadow = true;
		pivot.add(stalk, tip);
		body.add(pivot);
		antennae.push({ pivot, base: -0.62 * s, ang: 0, vel: 0, angX: 0, velX: 0 });
	}

	// little arm nubs (seen in the sleep sprite)
	const armMat = rimify(new THREE.MeshStandardMaterial({ color: C.mid, roughness: 0.35 }), 0x8fe0ff, 0.4);
	const arms = [];
	for (const s of [-1, 1]) {
		const a = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), armMat);
		a.scale.set(1, 0.8, 0.9);
		a.position.set(0.63 * s, 0.26, 0.06);
		a.castShadow = true;
		body.add(a);
		arms.push(a);
	}

	// hat anchor
	const hatAnchor = new THREE.Group();
	hatAnchor.position.set(0, 0.98, 0);
	body.add(hatAnchor);

	// the Caret: Buddy's floating I-beam weapon
	const caret = createCaretWeapon();
	root.add(caret);

	const light = new THREE.PointLight(C.glow, 3.2, 6, 1.6);
	light.position.set(0, 1.4, 0.4);
	root.add(light);

	return { root, body, shell, eyes, antennae, arms, caret, hatAnchor, light, bodyMat, colors: C };
}

export function createCaretWeapon(scale = 1, color = 0xbfeaff) {
	const g = new THREE.Group();
	const mat = glowMat(color, 2.6);
	const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), mat);
	const top = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.07), mat);
	top.position.y = 0.45;
	const bot = top.clone(); bot.position.y = -0.45;
	g.add(bar, top, bot);
	g.scale.setScalar(scale);
	g.userData.mat = mat;
	return g;
}

// ---------- hats ----------
const std = (color, o = {}) => rimify(new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1 }), o.rim ?? 0xffffff, 0.25);

export const HATS = {
	cowboy: { name: 'Cowboy Hat' },
	hardhat: { name: 'Construction Hard Hat' },
	sailor: { name: 'Dark Sailor Hat' },
	propeller: { name: 'Propeller Hat' },
	chef: { name: 'White Chef Hat' },
	crown: { name: 'Crown' },
	wizard: { name: 'Wizard Hat' },
	tophat: { name: 'Grand Top Hat & Monocle' },
	party: { name: 'Pink Party Hat' },
};

export function createHat(id) {
	const g = new THREE.Group();
	const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
	switch (id) {
		case 'cowboy': {
			const brown = std(0x8b5a2b), band = std(0x3b2414);
			const brim = add(new THREE.CylinderGeometry(0.5, 0.52, 0.04, 28), brown, 0, 0.02, 0);
			brim.scale.z = 0.85;
			add(new THREE.CylinderGeometry(0.2, 0.25, 0.26, 20), brown, 0, 0.17, 0);
			add(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 20), band, 0, 0.07, 0);
			g.rotation.z = 0.12;
			break;
		}
		case 'hardhat': {
			const y = std(0xffc21a, { r: 0.35 });
			add(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), y, 0, 0.02, 0);
			const brim = add(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 24), y, 0, 0.02, 0.05);
			brim.scale.z = 0.9;
			add(new THREE.BoxGeometry(0.06, 0.08, 0.5), y, 0, 0.28, 0);
			break;
		}
		case 'sailor': {
			const navy = std(0x1b2440), white = std(0xf2f2f2);
			add(new THREE.CylinderGeometry(0.3, 0.26, 0.12, 24), navy, 0, 0.08, 0);
			add(new THREE.CylinderGeometry(0.265, 0.265, 0.04, 24), white, 0, 0.03, 0);
			const top = add(new THREE.CylinderGeometry(0.36, 0.34, 0.05, 24), navy, 0, 0.16, 0);
			top.rotation.x = -0.12;
			const bill = add(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), std(0x111111), 0, 0.03, 0.18);
			bill.rotation.x = 0.15;
			break;
		}
		case 'propeller': {
			const cols = [0xe8334a, 0xffcd0f, 0x23a8f2, 0x3ecf6e];
			for (let i = 0; i < 4; i++) {
				add(new THREE.SphereGeometry(0.27, 10, 8, i * Math.PI / 2, Math.PI / 2, 0, Math.PI / 2), std(cols[i]), 0, 0, 0);
			}
			add(new THREE.CylinderGeometry(0.02, 0.02, 0.18), std(0x888888, { m: 0.8 }), 0, 0.33, 0);
			const prop = new THREE.Group();
			prop.position.y = 0.42;
			const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 0.08), std(0xe8334a));
			const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; blade2.material = std(0x23a8f2);
			prop.add(blade, blade2);
			g.add(prop);
			g.userData.spin = prop;
			break;
		}
		case 'chef': {
			const w = std(0xffffff, { r: 0.8 });
			add(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 20), w, 0, 0.1, 0);
			for (let i = 0; i < 5; i++) {
				const a = i / 5 * Math.PI * 2;
				add(new THREE.SphereGeometry(0.16, 12, 10), w, Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14);
			}
			add(new THREE.SphereGeometry(0.18, 12, 10), w, 0, 0.38, 0);
			break;
		}
		case 'crown': {
			const gold = std(0xffcd0f, { r: 0.25, m: 0.9, e: 0x553300, ei: 0.4 });
			add(new THREE.CylinderGeometry(0.27, 0.25, 0.12, 20, 1, true), gold, 0, 0.06, 0).material.side = THREE.DoubleSide;
			for (let i = 0; i < 6; i++) {
				const a = i / 6 * Math.PI * 2;
				add(new THREE.ConeGeometry(0.06, 0.18, 6), gold, Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
				const gem = add(new THREE.OctahedronGeometry(0.04), glowMat(i % 2 ? 0xe8334a : 0x23a8f2, 1.5), Math.cos(a) * 0.27, 0.06, Math.sin(a) * 0.27);
				gem.castShadow = false;
			}
			break;
		}
		case 'wizard': {
			const p = std(0x4b31b8), s = glowMat(0xffcd0f, 2);
			const brim = add(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 28), p, 0, 0.02, 0);
			brim.scale.z = 0.9;
			const cone = add(new THREE.ConeGeometry(0.28, 0.75, 20), p, 0.04, 0.4, 0);
			cone.rotation.z = -0.25;
			const st = new THREE.Mesh(starGeo, s); st.scale.setScalar(0.35); st.position.set(0.02, 0.32, 0.22); g.add(st);
			break;
		}
		case 'tophat': {
			const b = std(0x15151a, { r: 0.35 }), band = std(0x8a1c2c);
			add(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 28), b, 0, 0.02, 0);
			add(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 24), b, 0, 0.27, 0);
			add(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 24), band, 0, 0.08, 0);
			const mono = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 20), std(0xffcd0f, { m: 0.9, r: 0.2 }));
			mono.position.set(0.17, -0.54, 0.6);
			mono.rotation.y = 0.3;
			g.add(mono);
			break;
		}
		case 'party': {
			const pink = std(0xff5fa2, { e: 0x401020, ei: 0.4 });
			const cone = add(new THREE.ConeGeometry(0.2, 0.5, 20), pink, 0, 0.25, 0);
			cone.rotation.z = 0.2;
			add(new THREE.SphereGeometry(0.07, 10, 8), glowMat(0xffe066, 1.6), -0.05, 0.5, 0);
			break;
		}
	}
	return g;
}

// ---------- enemies ----------
export function createEnemyModel(type, biomeTint = 0xff3366) {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const mats = [];
	const reg = (m) => { mats.push(m); return m; };
	let eyeMat = null;
	switch (type) {
		case 'null': {
			const m = reg(toon(0x3a2a58, { flat: true, roughness: 0.35, metalness: 0.2, rim: 0xff4d88, rimStrength: 1.3, rimPower: 2 }));
			const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), m);
			core.position.y = 0.55; core.castShadow = true;
			addOutline(core, 0.04);
			body.add(core);
			eyeMat = glowMat(biomeTint, 3);
			const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), eyeMat);
			eye.rotation.z = Math.PI / 2;
			eye.position.set(0, 0.62, 0.42);
			body.add(eye);
			for (const s of [-1, 1]) {
				const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 4), m);
				horn.position.set(0.25 * s, 1.0, 0); horn.rotation.z = -0.5 * s;
				body.add(horn);
			}
			break;
		}
		case 'tab': {
			const m = reg(toon(0x4a4068, { roughness: 0.5, rim: 0xc9a6ff, rimStrength: 1.1, rimPower: 2 }));
			const slab = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.72, 0.16, 3, 0.06), m);
			slab.position.y = 1.0; slab.castShadow = true;
			addOutline(slab, 0.035);
			body.add(slab);
			const strip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.02), glowMat(0x8a5cff, 1.6));
			strip.position.set(0, 1.28, 0.09);
			body.add(strip);
			eyeMat = new THREE.MeshBasicMaterial({ map: glyphTexture('×', { font: 'bold 110px ui-monospace, monospace' }), transparent: true, color: new THREE.Color(biomeTint).multiplyScalar(2.2), depthWrite: false });
			const x = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), eyeMat);
			x.position.set(0, 0.98, 0.1);
			body.add(x);
			break;
		}
		case 'regression': {
			const m = reg(toon(0x4a3a40, { roughness: 0.45, metalness: 0.3, rim: 0xff8a3d, rimStrength: 1.1, rimPower: 2 }));
			const slab = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.15, 1.4, 3, 0.14), m);
			slab.position.y = 0.75; slab.castShadow = true;
			addOutline(slab, 0.045);
			body.add(slab);
			for (const s of [-1, 1]) {
				const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 5), m);
				horn.position.set(0.55 * s, 1.45, 0.3); horn.rotation.set(0.5, 0, -0.6 * s);
				body.add(horn);
			}
			eyeMat = new THREE.MeshBasicMaterial({ map: glyphTexture('↶', { font: 'bold 100px ui-monospace, monospace' }), transparent: true, color: new THREE.Color(0xff8a3d).multiplyScalar(2.4), depthWrite: false });
			const g1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), eyeMat);
			g1.position.set(0, 0.8, 0.71);
			body.add(g1);
			break;
		}
		case 'warning': {
			const m = reg(toon(0xffc21a, { roughness: 0.4, emissive: 0x402a00, rim: 0xffee88, rimStrength: 0.5 }));
			const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 3), m);
			tri.rotation.x = Math.PI / 2;
			tri.rotation.y = Math.PI / 2;
			tri.position.y = 0.8; tri.castShadow = true;
			addOutline(tri, 0.04);
			body.add(tri);
			eyeMat = new THREE.MeshBasicMaterial({ map: glyphTexture('!', { font: 'bold 110px ui-monospace, monospace' }), transparent: true, color: 0x111111, depthWrite: false });
			const ex = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), eyeMat);
			ex.position.set(0, 0.74, 0.13);
			body.add(ex);
			break;
		}
		case 'leak': {
			const m = reg(new THREE.MeshPhysicalMaterial({ color: 0x7a3cff, roughness: 0.15, transmission: 0.0, clearcoat: 1, emissive: 0x2a0a66, emissiveIntensity: 0.8 }));
			rimify(m, 0xd3a6ff, 0.8, 2);
			const blob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), m);
			blob.position.y = 0.55; blob.castShadow = true;
			addOutline(blob, 0.04);
			body.add(blob);
			eyeMat = glowMat(0xffffff, 2.5);
			for (const s of [-1, 1]) {
				const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat);
				e.position.set(0.18 * s, 0.7, 0.47);
				body.add(e);
			}
			break;
		}
		case 'ghost': {
			// Ghost Text: greyed autocomplete words that lunge where you are about to be.
			const m = reg(toon(0x6a7090, { roughness: 0.3, rim: 0x58f0ff, rimStrength: 1.4, rimPower: 1.8, transparent: true, opacity: 0.82 }));
			const widths = [0.5, 0.34, 0.6];
			let x = -0.62;
			widths.forEach((w, i) => {
				const word = new THREE.Mesh(new RoundedBoxGeometry(w, 0.3, 0.16, 2, 0.06), m);
				word.position.set(x + w / 2, 0.85 + (i === 1 ? 0.05 : 0), 0);
				word.rotation.z = -0.08;
				word.castShadow = true;
				body.add(word);
				x += w + 0.08;
			});
			eyeMat = glowMat(0x58f0ff, 3);
			const cursor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.06), eyeMat);
			cursor.position.set(x + 0.04, 0.86, 0);
			body.add(cursor);
			const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ map: glyphTexture('Tab ↹', { size: 128, font: 'bold 38px ui-monospace, monospace', glow: 8 }), transparent: true, depthWrite: false, color: new THREE.Color(0xbfeaff).multiplyScalar(1.4) }));
			tab.position.set(0, 1.28, 0.02);
			body.add(tab);
			break;
		}
		case 'modal': {
			// Modal Dialog: a UX dark pattern that traps focus and slams the floor.
			const frame = reg(toon(0xe6e9f2, { roughness: 0.35, rim: 0x7aa2ff, rimStrength: 0.7 }));
			const win = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.15, 0.16, 3, 0.07), frame);
			win.position.y = 1.35; win.castShadow = true;
			addOutline(win, 0.035);
			body.add(win);
			const bar = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.24, 0.2, 2, 0.06), glowMat(0x3b82f6, 1.5));
			bar.position.set(0, 1.86, 0);
			body.add(bar);
			const close = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ map: glyphTexture('✕', { font: 'bold 96px sans-serif', glow: 8 }), transparent: true, depthWrite: false, color: new THREE.Color(0xff4058).multiplyScalar(2) }));
			close.position.set(0.7, 1.86, 0.11);
			body.add(close);
			const text = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({ map: textTexture(['Are you sure', 'you want to leave?'], { w: 512, h: 144, font: 'bold 46px ui-sans-serif, system-ui, sans-serif', color: '#20263a' }), transparent: true, depthWrite: false }));
			text.position.set(0, 1.45, 0.085);
			body.add(text);
			eyeMat = glowMat(0x3b82f6, 2.2);
			const ok = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.2, 0.08, 2, 0.04), eyeMat);
			ok.position.set(0.35, 1.0, 0.09);
			const nope = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.2, 0.08, 2, 0.04), reg(toon(0x9aa2b8, { roughness: 0.5 })));
			nope.position.set(-0.32, 1.0, 0.09);
			body.add(ok, nope);
			break;
		}
		case 'peer': {
			// Peer Dependency: a hexagonal package with a socket that its partner's tether plugs into.
			const m = reg(toon(0x2e4a34, { roughness: 0.35, metalness: 0.3, rim: 0x7dff6a, rimStrength: 1.1, rimPower: 2 }));
			const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 6), m);
			hex.position.y = 0.85; hex.castShadow = true;
			addOutline(hex, 0.04);
			body.add(hex);
			eyeMat = glowMat(0x7dff6a, 2.6);
			const socket = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 16), eyeMat);
			socket.position.set(0, 1.35, 0); socket.rotation.x = Math.PI / 2;
			body.add(socket);
			const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), eyeMat);
			eye.rotation.z = Math.PI / 2; eye.position.set(0, 0.95, 0.5);
			body.add(eye);
			const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: glyphTexture('peer', { size: 128, font: 'bold 40px ui-monospace, monospace', glow: 8 }), transparent: true, depthWrite: false, color: new THREE.Color(0x7dff6a).multiplyScalar(1.6) }));
			tag.position.set(0, 0.62, 0.49);
			body.add(tag);
			break;
		}
		case 'typosquat': {
			// Typosquat: disguised as a breakable file until it opens its lid-mouth.
			const m = reg(toon(0x6b5236, { roughness: 0.75, rim: 0xcb3837, rimStrength: 0.25 }));
			const box = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.8, 1.0, 2, 0.08), m);
			box.position.y = 0.4; box.castShadow = true;
			body.add(box);
			const lid = new THREE.Group();
			lid.position.set(0, 0.8, -0.5);
			const lidM = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.32, 1.04, 2, 0.08), m);
			lidM.position.set(0, 0.16, 0.5); lidM.castShadow = true;
			lid.add(lidM);
			const teethM = toon(0xf2efe6, { roughness: 0.3 });
			for (let i = 0; i < 6; i++) {
				const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), teethM);
				t.position.set(-0.4 + i * 0.16, -0.02, 0.98); t.rotation.x = Math.PI;
				lid.add(t);
				const b = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), teethM);
				b.position.set(-0.4 + i * 0.16, 0.78, 0.48);
				body.add(b);
			}
			body.add(lid);
			eyeMat = glowMat(0xff3048, 3);
			const eyes = new THREE.Group();
			for (const s of [-1, 1]) {
				const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat);
				e.position.set(0.18 * s, 0.86, 0.32);
				eyes.add(e);
			}
			eyes.visible = false;
			body.add(eyes);
			const label = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.36), new THREE.MeshBasicMaterial({ map: glyphTexture(['lodahs', 'reqeusts', 'colours', 'expres', 'reakt', 'left-pda'][Math.floor(Math.random() * 6)], { size: 128, font: 'bold 26px ui-monospace, monospace', glow: 6 }), transparent: true, depthWrite: false, color: new THREE.Color(0x7dff6a).multiplyScalar(1.5) }));
			label.position.set(0, 0.42, 0.51);
			body.add(label);
			root.userData.lid = lid;
			root.userData.eyes = eyes;
			break;
		}
		case 'head': {
			// One of Transitive's heads: a package crate on a snake jaw, wearing its name tag.
			const m = reg(toon(0x35553a, { roughness: 0.4, metalness: 0.25, rim: 0x7dff6a, rimStrength: 0.9, rimPower: 2 }));
			const skull = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.75, 1.3, 3, 0.16), m);
			skull.position.set(0, 1.6, 0.1); skull.castShadow = true;
			addOutline(skull, 0.04);
			body.add(skull);
			const jaw = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.25, 1.1, 2, 0.08), m);
			jaw.position.set(0, 1.12, 0.2);
			body.add(jaw);
			eyeMat = glowMat(0x7dff6a, 3);
			for (const s of [-1, 1]) {
				const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), eyeMat);
				e.position.set(0.28 * s, 1.78, 0.76); e.rotation.z = Math.PI / 2 + 0.4 * s;
				body.add(e);
			}
			const fang = toon(0xf2efe6, { roughness: 0.3 });
			for (const s of [-1, 1]) {
				const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 4), fang);
				f.position.set(0.3 * s, 1.3, 0.72); f.rotation.x = Math.PI;
				body.add(f);
			}
			const name = ['left-pad', 'is-even', 'is-odd', 'colors', 'event-stream', 'core-js', 'leftpad2', 'lodash'][Math.floor(Math.random() * 8)];
			const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.36), new THREE.MeshBasicMaterial({ map: glyphTexture(name, { size: 256, font: 'bold 44px ui-monospace, monospace', glow: 10 }), transparent: true, depthWrite: false, color: new THREE.Color(0xd8ffd0).multiplyScalar(1.5) }));
			tag.position.set(0, 2.25, 0.2);
			body.add(tag);
			root.userData.jaw = jaw;
			root.userData.tag = tag;
			break;
		}
		case 'decoy': {
			const m = createConfabula({ decoy: true });
			return { ...m, eyeMat: m.coreMat };
		}
		case 'commit': {
			const m = reg(toon(0xf3e6c0, { roughness: 0.2, metalness: 0.3, emissive: 0x806020, emissiveIntensity: 0.8, rim: 0xffffff, rimStrength: 1 }));
			const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), m);
			c.scale.y = 1.6; c.position.y = 1.2; c.castShadow = true;
			addOutline(c, 0.04);
			body.add(c);
			eyeMat = glowMat(0xffe7a0, 2);
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 32), eyeMat);
			ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
			body.add(ring);
			break;
		}
	}
	return { root, body, mats, eyeMat };
}

// ---------- bosses ----------
export function createDeprecata() {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const mats = [];
	const purple = toon(0x4a2d7a, { roughness: 0.4, rim: 0xff8ad8, rimStrength: 0.8, emissive: 0x150525 });
	const pale = toon(0xf2dcc0, { roughness: 0.5, rim: 0xffb070, rimStrength: 0.6 });
	mats.push(purple, pale);
	const orange = glowMat(0xff8a3d, 2.2);
	// dress: stacked tapered rings like pages of old docs
	for (let i = 0; i < 5; i++) {
		const r = 1.25 - i * 0.18;
		const ring = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.12, r, 0.42, 24, 1, true), purple);
		ring.material.side = THREE.DoubleSide;
		ring.position.y = 0.3 + i * 0.38;
		ring.castShadow = true;
		body.add(ring);
		const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 40), orange);
		trim.rotation.x = Math.PI / 2; trim.position.y = 0.1 + i * 0.38;
		body.add(trim);
	}
	const torso = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 20), purple);
	torso.position.y = 2.55; torso.rotation.x = Math.PI; torso.castShadow = true;
	body.add(torso);
	const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16), pale);
	head.position.y = 3.35; head.castShadow = true;
	addOutline(head, 0.03);
	body.add(head);
	for (const s of [-1, 1]) {
		const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), glowMat(0xff5e7a, 3));
		e.position.set(0.13 * s, 3.38, 0.33);
		body.add(e);
	}
	const gold = rimify(new THREE.MeshStandardMaterial({ color: 0xffb347, metalness: 0.9, roughness: 0.25, emissive: 0x552200 }), 0xffffff, 0.4);
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2;
		const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38 + (i % 2) * 0.2, 5), gold);
		sp.position.set(Math.cos(a) * 0.3, 3.78, Math.sin(a) * 0.3);
		body.add(sp);
	}
	// the strikethrough across her crown
	const strike = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.07), glowMat(0xff3048, 3));
	strike.position.set(0, 3.82, 0.1); strike.rotation.z = 0.15;
	body.add(strike);
	const hands = [];
	for (const s of [-1, 1]) {
		const h = new THREE.Group();
		const palm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), pale);
		const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glowMat(0xff8a3d, 3));
		orb.position.y = 0.3;
		h.add(palm, orb);
		h.position.set(1.2 * s, 2.3, 0.3);
		body.add(h);
		hands.push(h);
	}
	return { root, body, mats, hands, orange };
}

function stripesTexture() {
	const c = document.createElement('canvas'); c.width = 128; c.height = 32;
	const g = c.getContext('2d');
	g.fillStyle = '#ffc21a'; g.fillRect(0, 0, 128, 32);
	g.fillStyle = '#1a1410';
	for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 16, 0); g.fill(); }
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3;
	return t;
}

export function createCollector() {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const rust = toon(0x8a6a3a, { roughness: 0.7, metalness: 0.5, rim: 0xffb060, rimStrength: 0.5 });
	const dark = toon(0x2a2622, { roughness: 0.6, metalness: 0.6, rim: 0xff8040, rimStrength: 0.4 });
	const mats = [rust, dark];
	const treads = [];
	for (const s of [-1, 1]) {
		const t = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.7, 2.6, 3, 0.25), dark);
		t.position.set(1.25 * s, 0.35, 0); t.castShadow = true;
		body.add(t); treads.push(t);
	}
	const hull = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.7, 2.4, 3, 0.2), rust);
	hull.position.y = 1.5; hull.castShadow = true;
	addOutline(hull, 0.05);
	body.add(hull);
	const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.3), new THREE.MeshStandardMaterial({ map: stripesTexture(), roughness: 0.6 }));
	stripe.position.set(0, 0.8, 1.21);
	body.add(stripe);
	const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 0.1), glowMat(0xff3b30, 1.8));
	mouth.position.set(0, 1.2, 1.21);
	body.add(mouth);
	const teeth = [];
	for (let i = 0; i < 7; i++) {
		const t = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), toon(0xdddddd, { metalness: 0.8, roughness: 0.3 }));
		t.position.set(-0.78 + i * 0.26, 1.42, 1.25); t.rotation.x = Math.PI;
		body.add(t); teeth.push(t);
	}
	const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), glowMat(0xff3b30, 3.5));
	eye.position.set(0, 2.2, 1.0);
	body.add(eye);
	const visor = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 8, 24), dark);
	visor.position.copy(eye.position); visor.position.z += 0.05;
	body.add(visor);
	const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.0, 12), dark);
	stack.position.set(-0.7, 2.8, -0.6); stack.castShadow = true;
	body.add(stack);
	const brushes = [];
	for (const s of [-1, 1]) {
		const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 10), toon(0x6b4bd6, { rim: 0xffffff, rimStrength: 0.3 }));
		b.rotation.z = Math.PI / 2;
		b.position.set(0.9 * s, 0.35, 1.5);
		body.add(b); brushes.push(b);
	}
	return { root, body, mats, eye, treads, brushes, stack, mouth };
}

export function createRevert() {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const robe = toon(0x0c0a12, { roughness: 0.75, metalness: 0.1, rim: 0xe8d6a0, rimStrength: 0.55, rimPower: 3.2 });
	const trimM = glowMat(0xe8d6a0, 1.8);
	const mats = [robe];
	const skirt = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.2, 28, 1, true), robe);
	skirt.material.side = THREE.DoubleSide;
	skirt.position.y = 1.9; skirt.castShadow = true;
	body.add(skirt);
	const trim = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.04, 6, 48), trimM);
	trim.rotation.x = Math.PI / 2; trim.position.y = 0.32;
	body.add(trim);
	const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), robe);
	shoulders.scale.y = 0.5; shoulders.position.y = 3.3;
	body.add(shoulders);
	const hood = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), robe);
	hood.position.y = 3.85; hood.scale.set(1, 1.1, 1);
	addOutline(hood, 0.03);
	body.add(hood);
	const faceMat = new THREE.MeshBasicMaterial({ map: glyphTexture('↶', { font: 'bold 110px ui-monospace, monospace', glow: 24 }), transparent: true, color: new THREE.Color(0xfff4d6).multiplyScalar(3), depthWrite: false });
	const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), faceMat);
	face.position.set(0, 3.85, 0.56);
	body.add(face);
	// halo clock
	const halo = new THREE.Group();
	halo.position.set(0, 3.9, -0.5);
	const ringM = rimify(new THREE.MeshStandardMaterial({ color: 0xe8d6a0, metalness: 1, roughness: 0.25, emissive: 0x6b5520, emissiveIntensity: 0.8 }), 0xffffff, 0.5);
	halo.add(new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 10, 64), ringM));
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		const tick = new THREE.Mesh(new THREE.BoxGeometry(0.08, i % 3 === 0 ? 0.42 : 0.24, 0.08), trimM);
		tick.position.set(Math.cos(a) * 1.72, Math.sin(a) * 1.72, 0);
		tick.rotation.z = a - Math.PI / 2;
		halo.add(tick);
	}
	const handH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.05).translate(0, 0.55, 0), trimM);
	const handM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.05).translate(0, 0.77, 0), trimM);
	halo.add(handH, handM);
	body.add(halo);
	const hands = [];
	for (const s of [-1, 1]) {
		const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8d6a0, emissive: 0xe8d6a0, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 }));
		h.position.set(1.35 * s, 2.6, 0.4);
		body.add(h);
		hands.push(h);
	}
	body.scale.setScalar(1.2);
	return { root, body, mats, halo, handH, handM, hands, faceMat, trimM };
}

// Transitive: package.json body; heads are separate enemies connected by animated necks.
export function createTransitive() {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const card = toon(0x7a5a3a, { roughness: 0.8, rim: 0x7dff6a, rimStrength: 0.45 });
	const dark = toon(0x1c2a20, { roughness: 0.5, metalness: 0.4, rim: 0x7dff6a, rimStrength: 0.7 });
	const mats = [card, dark];
	const crate = new THREE.Mesh(new RoundedBoxGeometry(3.0, 2.2, 2.6, 3, 0.2), card);
	crate.position.y = 1.15; crate.castShadow = true;
	addOutline(crate, 0.05);
	body.add(crate);
	const tape = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.3, 0.5), toon(0xcb3837, { roughness: 0.5 }));
	tape.position.set(0, 2.2, 0);
	body.add(tape);
	const label = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ map: textTexture(['package.json', '"deps": 4096'], { w: 512, h: 220, font: 'bold 52px ui-monospace, monospace', color: '#1c2a20', bg: '#efe6cf' }) }));
	label.position.set(0, 1.0, 1.31);
	body.add(label);
	const coreMat = glowMat(0x7dff6a, 2.4);
	const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), coreMat);
	core.position.set(0, 2.8, 0);
	body.add(core);
	const sockets = [];
	for (let i = 0; i < 6; i++) {
		const sk = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 16), dark);
		const a = -Math.PI / 2 + (i - 2.5) * 0.5;
		sk.position.set(Math.cos(a) * 1.3, 2.2, Math.sin(a) * -1.0 + 0.3);
		sk.rotation.x = Math.PI / 2;
		body.add(sk);
		sockets.push(sk);
	}
	return { root, body, mats, core, coreMat, sockets };
}

const neckGeo = new THREE.CylinderGeometry(0.22, 0.32, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
neckGeo.userData.shared = true;
export function createNeck() {
	const m = new THREE.Mesh(neckGeo, toon(0x2f4a33, { roughness: 0.45, metalness: 0.2, rim: 0x7dff6a, rimStrength: 0.8 }));
	m.castShadow = true;
	return m;
}

// Confabula: a faceted glass oracle with an attention halo and orbiting tokens.
export function createConfabula({ decoy = false } = {}) {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const glass = rimify(new THREE.MeshPhysicalMaterial({
		color: decoy ? 0x5a1a58 : 0x1f1850, roughness: 0.12, metalness: 0.35, iridescence: 1, iridescenceIOR: 1.6,
		clearcoat: 1, flatShading: true, transparent: true, opacity: decoy ? 0.74 : 0.86, emissive: decoy ? 0x3a0830 : 0x0a0830, emissiveIntensity: 0.9,
	}), decoy ? 0xff4fd8 : 0x58f0ff, 1.0, 2.0);
	const mats = [glass];
	const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), glass);
	shell.position.y = 2.7; shell.scale.set(1, 1.15, 1); shell.castShadow = !decoy;
	body.add(shell);
	const skirt = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.3, 6, 1, true), glass);
	skirt.rotation.x = Math.PI; skirt.position.y = 1.15; skirt.castShadow = !decoy;
	body.add(skirt);
	const coreMat = glowMat(decoy ? 0xff4fd8 : 0x58f0ff, 2.6);
	const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), coreMat);
	core.position.y = 2.7;
	body.add(core);
	const pupil = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 10), new THREE.MeshBasicMaterial({ color: 0x07040f }));
	pupil.position.set(0, 2.72, 0.43);
	body.add(pupil);
	const rings = [];
	[[0x58f0ff, 1.65, 0.5], [0xff4fd8, 1.95, -0.7]].forEach(([c, r, tilt]) => {
		const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 72), glowMat(decoy ? 0xff4fd8 : c, 2.4));
		ring.position.y = 2.7; ring.rotation.set(Math.PI / 2 + tilt * 0.4, tilt, 0);
		body.add(ring);
		rings.push(ring);
	});
	const tokens = [];
	const tokGeo = new RoundedBoxGeometry(0.2, 0.2, 0.2, 1, 0.04);
	for (let i = 0; i < 10; i++) {
		const t = new THREE.Mesh(tokGeo, glowMat(i % 2 ? 0xff4fd8 : 0x58f0ff, 2.2));
		t.userData.a = (i / 10) * Math.PI * 2;
		t.userData.r = 1.6 + (i % 3) * 0.25;
		t.userData.y = 2.2 + (i % 4) * 0.35;
		body.add(t);
		tokens.push(t);
	}
	const hands = [];
	for (const [s, ch] of [[-1, '{'], [1, '}']]) {
		const h = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshBasicMaterial({ map: glyphTexture(ch, { font: 'bold 120px ui-monospace, monospace', glow: 22 }), transparent: true, depthWrite: false, color: new THREE.Color(0xff4fd8).multiplyScalar(2.2) }));
		h.position.set(1.55 * s, 2.3, 0.4);
		body.add(h);
		hands.push(h);
	}
	return { root, body, mats, core, coreMat, rings, tokens, hands, shell };
}

// ---------- NPCs & props ----------
export function createCaretNPC() {
	const g = new THREE.Group();
	const c = createCaretWeapon(2.4, 0xfff1d0);
	c.position.y = 1.4;
	g.add(c);
	const eyeM = new THREE.MeshBasicMaterial({ color: 0x241a10 });
	for (const s of [-1, 1]) {
		const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.05), eyeM);
		e.position.set(0.14 * s, 2.35, 0.1);
		g.add(e);
	}
	const l = new THREE.PointLight(0xffe0a0, 6, 7, 1.6);
	l.position.set(0, 1.8, 0.6);
	g.add(l);
	g.userData.caret = c;
	return g;
}

export function createLintNPC() {
	const g = new THREE.Group();
	const pts = [];
	for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3(-0.9 + i * 0.1125, 0.35 + Math.sin(i * 1.3) * 0.12, 0));
	const curve = new THREE.CatmullRomCurve3(pts);
	const mat = toon(0xe5c14b, { roughness: 0.35, emissive: 0x3a2a00, rim: 0xfff0a0, rimStrength: 0.5 });
	const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.1, 10, false), mat);
	tube.castShadow = true;
	addOutline(tube, 0.03);
	g.add(tube);
	const head = new THREE.Group();
	head.position.set(0.95, 0.45, 0);
	const hm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat);
	head.add(hm);
	for (const s of [-1, 1]) {
		const w = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
		w.position.set(0.08, 0.06, 0.12 * s + 0.05);
		const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
		p.position.set(0.05, 0, 0.03);
		w.add(p);
		head.add(w);
	}
	g.add(head);
	g.userData.tube = tube;
	g.userData.head = head;
	return g;
}

export function createMessageBubble() {
	const g = new THREE.Group();
	const mat = new THREE.MeshPhysicalMaterial({ color: 0x6fc8ff, roughness: 0.1, transmission: 0.0, transparent: true, opacity: 0.55, emissive: 0x1a5a90, emissiveIntensity: 1.2, clearcoat: 1 });
	const b = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.0, 0.3, 4, 0.3), mat);
	b.position.y = 2.2;
	g.add(b);
	const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 4), mat);
	tail.position.set(-0.45, 1.6, 0); tail.rotation.z = -2.6;
	g.add(tail);
	const dots = [];
	for (let i = 0; i < 3; i++) {
		const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), glowMat(0xffffff, 2.2));
		d.position.set(-0.4 + i * 0.4, 2.2, 0.18);
		g.add(d); dots.push(d);
	}
	const l = new THREE.PointLight(0x6fc8ff, 4, 6);
	l.position.set(0, 2.2, 0.8);
	g.add(l);
	g.userData.dots = dots;
	g.userData.bubble = b;
	return g;
}

export function createBoard() {
	const g = new THREE.Group();
	const stone = toon(0x3a3348, { roughness: 0.8, rim: 0xffcd0f, rimStrength: 0.25 });
	const ped = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.0, 0.9, 2, 0.08), stone);
	ped.position.y = 0.5; ped.castShadow = true; ped.receiveShadow = true;
	g.add(ped);
	const cards = [];
	for (let i = 0; i < 5; i++) {
		const a = -0.6 + i * 0.3;
		const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffcd0f).multiplyScalar(1.3), side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
		card.position.set(Math.sin(a) * 1.0, 1.7 + Math.cos(a * 2) * 0.1, Math.cos(a) * 0.1 - 0.1);
		card.rotation.y = -a * 0.6;
		const st = starMesh(0.9, 0xffffff, 1.2);
		st.position.z = 0.01; st.scale.z = 0.05;
		card.add(st);
		g.add(card); cards.push(card);
	}
	const l = new THREE.PointLight(0xffcd0f, 5, 5);
	l.position.set(0, 2, 0.8);
	g.add(l);
	g.userData.cards = cards;
	return g;
}

export function createWardrobe() {
	const g = new THREE.Group();
	const wood = toon(0x5a3a22, { roughness: 0.7, rim: 0xffb070, rimStrength: 0.3 });
	const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 10), wood);
	pole.position.y = 1.1; pole.castShadow = true;
	g.add(pole);
	const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 16), wood);
	base.position.y = 0.06;
	g.add(base);
	for (let i = 0; i < 4; i++) {
		const a = i / 4 * Math.PI * 2;
		const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), wood);
		hook.position.set(Math.cos(a) * 0.15, 2.0, Math.sin(a) * 0.15);
		hook.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
		g.add(hook);
	}
	const hat = createHat('wizard');
	hat.position.set(0, 2.2, 0);
	hat.scale.setScalar(0.9);
	g.add(hat);
	return g;
}

// Toolbox: Buddy's weapon rack.
export function createToolbox() {
	const g = new THREE.Group();
	const wood = toon(0x3a2a22, { roughness: 0.7, rim: 0xffb070, rimStrength: 0.3 });
	const base = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.5, 0.8, 2, 0.06), wood);
	base.position.y = 0.25; base.castShadow = true;
	const back = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.6, 0.14, 2, 0.04), wood);
	back.position.set(0, 1.25, -0.33); back.castShadow = true;
	g.add(base, back);
	const slots = [];
	for (let i = 0; i < 3; i++) {
		const s = new THREE.Group();
		s.position.set(-0.62 + i * 0.62, 1.25, -0.15);
		g.add(s);
		slots.push(s);
	}
	const l = new THREE.PointLight(0xffd9a8, 2.5, 5, 1.8);
	l.position.set(0, 2.4, 0.8);
	g.add(l);
	g.userData = { slots };
	return g;
}

// README.md lectern: the codex.
export function createLectern() {
	const g = new THREE.Group();
	const stone = toon(0x3a3446, { roughness: 0.7, rim: 0x9fd8ff, rimStrength: 0.35 });
	const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 1.2, 8), stone);
	stem.position.y = 0.6; stem.castShadow = true;
	const top = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.14, 0.85, 2, 0.04), stone);
	top.position.set(0, 1.25, 0); top.rotation.x = 0.35; top.castShadow = true;
	g.add(stem, top);
	const pages = new THREE.Group();
	pages.position.set(0, 1.36, 0.02); pages.rotation.x = 0.35;
	const paperM = new THREE.MeshStandardMaterial({ map: textTexture(['# README', '', '- buddy', '- caret', '- lint'], { w: 256, h: 256, font: 'bold 26px ui-monospace, monospace', color: '#24324a', bg: '#f1ead8', align: 'left' }), roughness: 0.9, emissive: 0x9fd8ff, emissiveIntensity: 0.08 });
	for (const s of [-1, 1]) {
		const page = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.66).rotateX(-Math.PI / 2), paperM);
		page.position.x = 0.27 * s; page.rotation.z = -0.08 * s;
		pages.add(page);
	}
	g.add(pages);
	const glow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fd8ff).multiplyScalar(0.45), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
	glow.position.set(0, 1.5, 0.05);
	glow.scale.set(0.7, 1, 0.55);
	g.add(glow);
	const l = new THREE.PointLight(0x9fd8ff, 2.2, 5, 1.8);
	l.position.set(0, 2.4, 0.6);
	g.add(l);
	g.userData = { pages, glow };
	return g;
}

const termFS = /* glsl */`
	uniform float uTime; varying vec2 vUv;
	float hash(float n) { return fract(sin(n) * 43758.5453); }
	void main() {
		vec2 uv = vUv;
		float rows = 9.0;
		float line = floor((1.0 - uv.y) * rows);
		float ly = fract((1.0 - uv.y) * rows);
		float indent = (line == 0.0 || line == rows - 1.0) ? 0.06 : 0.14;
		float keyLen = 0.2 + hash(line * 3.1) * 0.3;
		float valLen = 0.08 + hash(line * 7.7) * 0.18;
		float bar = smoothstep(0.25, 0.35, ly) * smoothstep(0.75, 0.65, ly);
		float key = step(indent, uv.x) * step(uv.x, indent + keyLen);
		float val = step(indent + keyLen + 0.05, uv.x) * step(uv.x, indent + keyLen + 0.05 + valLen);
		vec3 col = vec3(0.61, 0.86, 1.0) * key + vec3(0.81, 0.57, 0.47) * val;
		if (line == 0.0 || line == rows - 1.0) col = vec3(1.0, 0.85, 0.3) * step(0.06, uv.x) * step(uv.x, 0.1);
		float cur = step(abs(line - floor(mod(uTime * 0.7, rows - 2.0)) - 1.0), 0.1) * step(0.5, fract(uTime * 1.6)) * step(abs(uv.x - (indent + keyLen + valLen + 0.08)), 0.012);
		float frame = 1.0 - smoothstep(0.0, 0.02, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
		vec3 c = col * bar * 1.9 + vec3(0.43, 0.55, 1.0) * (frame * 1.4 + 0.08) + vec3(1.0) * cur * 2.0;
		gl_FragColor = vec4(c, 1.0);
	}`;

// settings.json terminal: ranked permanent upgrades.
export function createConfigTerminal() {
	const g = new THREE.Group();
	const metal = toon(0x2a2e44, { roughness: 0.35, metalness: 0.6, rim: 0x6f8cff, rimStrength: 0.5 });
	const base = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.5, 0.8, 2, 0.08), metal);
	base.position.y = 0.25; base.castShadow = true;
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8), metal);
	neck.position.y = 1.0;
	g.add(base, neck);
	const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: termFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
	const panel = new THREE.Group();
	panel.position.y = 2.1;
	const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.15), mat);
	panel.add(screen);
	const gear = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 8), glowMat(0x9fb4ff, 2));
	gear.position.set(0.82, 0.62, 0.02);
	panel.add(gear);
	g.add(panel);
	const l = new THREE.PointLight(0x6f8cff, 4, 5, 1.8);
	l.position.set(0, 2, 0.6);
	g.add(l);
	g.userData = { panel, mat, gear };
	return g;
}

const portalFS = /* glsl */`
	uniform float uTime; uniform vec3 uColor; uniform float uOpen; varying vec2 vUv;
	void main() {
		vec2 p = vUv - vec2(0.5, 0.45); p.x *= 1.25;
		float r = length(p);
		float a = atan(p.y, p.x);
		float s = sin(a * 3.0 + r * 16.0 - uTime * 3.0) * 0.5 + 0.5;
		float mask = smoothstep(0.52, 0.44, r);
		vec3 c = uColor * (0.25 + s * s * 1.4) + uColor * 1.5 * smoothstep(0.35, 0.0, r) * 0.6;
		gl_FragColor = vec4(c * mask * uOpen, 1.0);
	}`;
const portalVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function portalMaterial(color) {
	return new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpen: { value: 0.15 } }, vertexShader: portalVS, fragmentShader: portalFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

export function createDoor(stoneMat, color) {
	const g = new THREE.Group();
	for (const s of [-1, 1]) {
		const p = new THREE.Mesh(new RoundedBoxGeometry(0.55, 3.4, 0.7, 2, 0.06), stoneMat);
		p.position.set(1.35 * s, 1.7, 0); p.castShadow = true; p.receiveShadow = true;
		g.add(p);
		const cap = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.25, 0.9, 2, 0.05), stoneMat);
		cap.position.set(1.35 * s, 0.12, 0);
		g.add(cap);
	}
	const lintel = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.5, 0.9, 2, 0.08), stoneMat);
	lintel.position.y = 3.55; lintel.castShadow = true;
	g.add(lintel);
	const pm = portalMaterial(color);
	const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), pm);
	portal.position.set(0, 1.65, 0);
	g.add(portal);
	const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glowMat(color, 2));
	gem.position.set(0, 3.55, 0.47);
	g.add(gem);
	g.userData = { portal, pm, gem };
	return g;
}

export function createPillar(stoneMat, h = 4.2) {
	const g = new THREE.Group();
	const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, h, 10), stoneMat);
	shaft.position.y = h / 2; shaft.castShadow = true; shaft.receiveShadow = true;
	g.add(shaft);
	const base = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.35, 1.25, 2, 0.06), stoneMat);
	base.position.y = 0.17; base.castShadow = true; base.receiveShadow = true;
	g.add(base);
	const cap = base.clone(); cap.position.y = h; g.add(cap);
	return g;
}

export function createBrazier(stoneMat, color) {
	const g = new THREE.Group();
	const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.1, 8), stoneMat);
	stem.position.y = 0.55; stem.castShadow = true;
	const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 12), stoneMat);
	bowl.position.y = 1.2; bowl.castShadow = true;
	const coal = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), glowMat(color, 2.5));
	coal.position.y = 1.36;
	const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
	flame.position.y = 1.8;
	g.add(stem, bowl, coal, flame);
	g.userData.flame = flame;
	return g;
}

export function rewardIcon(kind, color) {
	const g = new THREE.Group();
	switch (kind) {
		case 'boon': {
			const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), glowMat(color, 2.2));
			const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
			g.add(orb, shell);
			g.userData.spin = shell;
			break;
		}
		case 'heart': g.add(heartMesh(1.1)); break;
		case 'stars': {
			for (let i = 0; i < 3; i++) {
				const s = starMesh(0.6 + (i === 0 ? 0.3 : 0));
				s.position.set((i - 1) * 0.4, i === 0 ? 0.1 : -0.1, i === 0 ? 0.1 : 0);
				if (i === 1) s.position.x = 0;
				g.add(s);
			}
			g.children[1].position.set(-0.45, -0.15, 0);
			g.children[2].position.set(0.45, -0.15, 0);
			break;
		}
		case 'refactor': {
			const mat = new THREE.MeshBasicMaterial({ map: glyphTexture('{ }', { font: 'bold 80px ui-monospace, monospace' }), transparent: true, color: new THREE.Color(0x7dffb0).multiplyScalar(2.2), depthWrite: false, side: THREE.DoubleSide });
			const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mat);
			const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), glowMat(0x7dffb0, 2.5));
			g.add(p, gem);
			break;
		}
		case 'snack': {
			const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.44, 16), toon(0xf4efe6, { roughness: 0.3 }));
			const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.23, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.2 }));
			coffee.position.y = 0.2;
			const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), toon(0xf4efe6));
			handle.position.set(0.28, 0.02, 0);
			const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0x23a8f2 }));
			logo.position.set(0, 0, 0.235);
			g.add(cup, coffee, handle, logo);
			break;
		}
		case 'rest': {
			const mat = new THREE.MeshBasicMaterial({ map: glyphTexture('Zz', { font: 'bold 80px ui-monospace, monospace' }), transparent: true, color: new THREE.Color(0x9fd8ff).multiplyScalar(2), depthWrite: false, side: THREE.DoubleSide });
			g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mat));
			break;
		}
		case 'boss': {
			const mat = new THREE.MeshBasicMaterial({ map: glyphTexture('☠', { font: 'bold 100px serif' }), transparent: true, color: new THREE.Color(0xff3048).multiplyScalar(2.2), depthWrite: false, side: THREE.DoubleSide });
			g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat));
			break;
		}
		case 'patch': {
			const gear = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.13, 8, 10), new THREE.MeshStandardMaterial({ color: 0xffb000, emissive: 0xff8a00, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.25, flatShading: true }));
			const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10).rotateX(Math.PI / 2), glowMat(0xfff0b0, 2.4));
			const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshBasicMaterial({ map: glyphTexture('PR #', { size: 128, font: 'bold 40px ui-monospace, monospace', glow: 8 }), transparent: true, depthWrite: false, color: new THREE.Color(0xffd27a).multiplyScalar(1.8), side: THREE.DoubleSide }));
			pr.position.y = 0.72;
			g.add(gear, hub, pr);
			g.userData.spin = gear;
			break;
		}
		case 'memory': {
			const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshPhysicalMaterial({ color: 0x6f8cff, emissive: 0x3050ff, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.2, iridescence: 1, flatShading: true }));
			gem.scale.y = 1.35;
			const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glowMat(0xd8e4ff, 2.6));
			g.add(gem, core);
			g.userData.spin = gem;
			break;
		}
		case 'stairs': {
			const mat = new THREE.MeshBasicMaterial({ map: glyphTexture('↓', { font: 'bold 110px ui-monospace, monospace' }), transparent: true, color: new THREE.Color(color).multiplyScalar(2.2), depthWrite: false, side: THREE.DoubleSide });
			g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat));
			break;
		}
	}
	return g;
}

export function sunglassesMesh() {
	const g = new THREE.Group();
	const m = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.1, metalness: 0.6 });
	for (const s of [-1, 1]) {
		const lens = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.15, 0.04, 2, 0.02), m);
		lens.position.set(0.16 * s, 0, 0);
		lens.rotation.y = 0.25 * s;
		g.add(lens);
	}
	const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), m);
	g.add(bridge);
	const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.03), m);
	bar.position.y = 0.06;
	g.add(bar);
	return g;
}

export { RoundedBoxGeometry };
