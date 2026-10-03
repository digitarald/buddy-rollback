import * as THREE from 'three';
import { G } from './state.js';
import { R, setAtmosphere } from './render.js';
import { makeStoneTextures, glyphTexture } from './textures.js';
import { createDoor, createPillar, createBrazier, rewardIcon, RoundedBoxGeometry } from './models.js';
import { rimify } from './materials.js';
import { burst } from './fx.js';
import { floorify, floorUniforms, chunks, sparks, floorRipple } from './juice.js';
import { audio } from './audio.js';
import { rand, pick, clamp } from './util.js';

export const T = 2; // tile size

export const BIOMES = {
	hub: {
		id: 'hub', name: 'The Scratch Buffer', sub: 'Untitled-1 · never saved, so never reverted',
		floor: 0xd8bea6, stone: 0x9a7c80, glyph: 0xffb870, seam: 0xff9a40, bg: 0x140a12, fogDensity: 0.018,
		hemiSky: 0xffd9b0, hemiGround: 0x3a1830, hemiInt: 0.5, sun: 0xffe2c0, sunInt: 1.9, brazier: 0xffa040,
		glyphs: ['~', '*', '♥', '//', 'TODO', '¶'], exposure: 1.1, bloom: 0.6, seamK: 0.12, tint: 0xfff2e6, music: 'hub',
	},
	deprecated: {
		id: 'deprecated', name: 'The Deprecated', sub: 'Where old APIs go to be forgotten',
		floor: 0xb4aad6, stone: 0x7a6e9e, glyph: 0x9b6bff, seam: 0x7a4cff, bg: 0x07050f, fogDensity: 0.022,
		hemiSky: 0x8fa6ff, hemiGround: 0x2a1030, hemiInt: 0.85, sun: 0xcfd6ff, sunInt: 2.0, brazier: 0x8a5cff,
		glyphs: ['{ }', ';', '=>', '//', '&&', '[ ]', '!=', '()'], exposure: 1.05, bloom: 0.6, tint: 0xf4f0ff, music: 'combat',
		enemies: [{ v: 'null', w: 5 }, { v: 'tab', w: 3 }, { v: 'warning', w: 2 }, { v: 'regression', w: 1 }],
	},
	legacy: {
		id: 'legacy', name: 'The Legacy Stack', sub: 'Forty layers of "temporary" fixes',
		floor: 0xd2ae86, stone: 0x8c6c50, glyph: 0xffae42, seam: 0xff8a1f, bg: 0x0e0704, fogDensity: 0.022,
		hemiSky: 0xffcf9a, hemiGround: 0x301408, hemiInt: 0.8, sun: 0xffd7a8, sunInt: 2.0, brazier: 0xff7a1f,
		glyphs: ['GOTO', '0x', '*p', '::', '%', 'NULL', '&', 'TODO'], exposure: 1.05, bloom: 0.62, tint: 0xfff0e0, music: 'combat2',
		enemies: [{ v: 'null', w: 3 }, { v: 'tab', w: 3 }, { v: 'leak', w: 3 }, { v: 'warning', w: 2 }, { v: 'regression', w: 2 }],
	},
	deps: {
		id: 'deps', name: 'node_modules', sub: 'The heaviest object in the universe',
		floor: 0x8a8f78, stone: 0x4a5640, glyph: 0x7dff6a, seam: 0xcb3837, bg: 0x060a05, fogDensity: 0.022,
		hemiSky: 0xd8ffc8, hemiGround: 0x2a0c08, hemiInt: 0.8, sun: 0xf0ffe0, sunInt: 1.85, brazier: 0x7dff6a,
		glyphs: ['^1.2.3', '~0.0.1', '*', 'peer', 'npm i', '@latest', '.lock', 'deps'], exposure: 1.05, bloom: 0.62, tint: 0xf4fff0, music: 'combat5',
		traceK: 0.35,
		enemies: [{ v: 'peer', w: 3 }, { v: 'typosquat', w: 3 }, { v: 'leak', w: 2 }, { v: 'null', w: 2 }, { v: 'regression', w: 1.5 }, { v: 'tab', w: 1.5 }],
	},
	latent: {
		id: 'latent', name: 'The Latent Space', sub: 'Where every answer sounds right',
		floor: 0x6b6f9e, stone: 0x3b3f6a, glyph: 0x58f0ff, seam: 0xff4fd8, bg: 0x05030d, fogDensity: 0.02,
		hemiSky: 0x9fb4ff, hemiGround: 0x2a0838, hemiInt: 0.8, sun: 0xd8e4ff, sunInt: 1.75, brazier: 0xff4fd8,
		glyphs: ['p=.97', '<|end|>', 'tok', 'attn', '∇', '[MASK]', '∑', '0.42'], exposure: 1.08, bloom: 0.72, tint: 0xf4efff, music: 'combat4',
		traceK: 0.55, glassDebris: true,
		enemies: [{ v: 'ghost', w: 4 }, { v: 'modal', w: 2 }, { v: 'tab', w: 2 }, { v: 'null', w: 2 }, { v: 'warning', w: 1 }],
	},
	zero: {
		id: 'zero', name: 'Version Zero', sub: 'Before the first commit',
		floor: 0xe6eaf2, stone: 0xa0a8ba, glyph: 0x9fe8ff, seam: 0x6fd8ff, bg: 0x03050a, fogDensity: 0.024,
		hemiSky: 0xdfe8ff, hemiGround: 0x101828, hemiInt: 0.7, sun: 0xffffff, sunInt: 2.1, brazier: 0xbfefff,
		glyphs: ['0', '1', '∅', '↶', 'v0', 'HEAD~', '#0'], exposure: 1.0, bloom: 0.65, tint: 0xeef6ff, music: 'combat3',
		enemies: [{ v: 'null', w: 3 }, { v: 'tab', w: 3 }, { v: 'leak', w: 2 }, { v: 'warning', w: 2 }, { v: 'regression', w: 2 }],
	},
};

// '.' floor, ' ' void, 'o' pillar, 'b' brazier, 'D' door slot (top row), 'S' start, hub markers: C L M A W X
export const LAYOUTS = {
	hall: [
		'     ..D...D...D..     ',
		'    ...............    ',
		'   .................   ',
		'  ....o.........o....  ',
		'  ...................  ',
		' ......b.......b...... ',
		' ..................... ',
		' ..................... ',
		'  ...................  ',
		'  ....o.........o....  ',
		'   .................   ',
		'    ......S.......     ',
		'      ..........       ',
	],
	cross: [
		'       .D...D...D.       ',
		'       ...........       ',
		'       ....b.b....       ',
		'  .....................  ',
		' ....o.............o.... ',
		' ....................... ',
		' ....................... ',
		'  .....................  ',
		'       ...........       ',
		'       ....o.o....       ',
		'       .....S.....       ',
		'        .........        ',
	],
	ring: [
		'      ..D...D...D..      ',
		'    .................    ',
		'   ...................   ',
		'  .....b.........b.....  ',
		'  .........o.o.........  ',
		' ........o.....o........ ',
		' ........o.....o........ ',
		'  .........o.o.........  ',
		'  .....................  ',
		'   ...................   ',
		'    ........S........    ',
		'      .............      ',
	],
	split: [
		'    ..D...D...D..    ',
		'   ...............   ',
		'  .....b.....b.....  ',
		' ................... ',
		' ....   .....   .... ',
		' ....   .....   .... ',
		' ....   ..o..   .... ',
		' ................... ',
		' ...o...........o... ',
		'  .................  ',
		'   .......S.......   ',
		'     ...........     ',
	],
	long: [
		'   ..D...D...D..   ',
		'  ...............  ',
		'  ...b.......b...  ',
		'  ...............  ',
		'  ..o.........o..  ',
		'  ...............  ',
		'  ...............  ',
		'  ..o.........o..  ',
		'  ...............  ',
		'  ...b.......b...  ',
		'  ...............  ',
		'  ...............  ',
		'   ......S......   ',
		'    ...........    ',
	],
	rest: [
		'      ..D..      ',
		'    .........    ',
		'   ..b.....b..   ',
		'  .............  ',
		'  .............  ',
		'  ......F......  ',
		'  .............  ',
		'   .....S.....   ',
		'    .........    ',
	],
	boss: [
		'        ....D....        ',
		'     ...............     ',
		'   ...................   ',
		'  ..b...............b..  ',
		'  .....................  ',
		' ....................... ',
		' ....................... ',
		' ....................... ',
		' ....................... ',
		'  .....................  ',
		'  ..o...............o..  ',
		'   ...................   ',
		'     ......S........     ',
		'        .........        ',
	],
	hub: [
		'       ....X....       ',
		'     .............     ',
		'    ...b.......b...    ',
		'   .....T...........   ',
		'  ..A.............W..  ',
		'  ...................  ',
		' .....C.........M..... ',
		' ..................... ',
		' ...o..R.......G..o... ',
		'  .......L...........  ',
		'   ........S........   ',
		'     .............     ',
		'       .........       ',
	],
};

const texCache = {};
function stoneTex() {
	if (!texCache.stone) texCache.stone = makeStoneTextures(256, 7);
	return texCache.stone;
}

const tileGeo = new RoundedBoxGeometry(T - 0.07, 1.2, T - 0.07, 1, 0.07);
tileGeo.userData.shared = true;
const seamGeo = new THREE.PlaneGeometry(T, T).rotateX(-Math.PI / 2);
seamGeo.userData.shared = true;

export function buildRoom(layoutName, biomeId, opts = {}) {
	const biome = BIOMES[biomeId];
	const rows = LAYOUTS[layoutName];
	const h = rows.length, w = Math.max(...rows.map((r) => r.length));
	const grid = rows.map((r) => r.padEnd(w, ' ').split(''));
	const group = new THREE.Group();
	const tex = stoneTex();

	setAtmosphere({ bg: biome.bg, fogDensity: biome.fogDensity, hemiSky: biome.hemiSky, hemiGround: biome.hemiGround, hemiInt: biome.hemiInt, sunColor: biome.sun, sunInt: biome.sunInt, exposure: biome.exposure, bloom: biome.bloom, tint: biome.tint });

	const floorMat = floorify(new THREE.MeshStandardMaterial({ color: biome.floor, map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap, roughness: biome.id === 'latent' ? 0.55 : 1, metalness: biome.id === 'latent' ? 0.35 : 0.05, normalScale: new THREE.Vector2(0.8, 0.8) }));
	floorUniforms.uTrace.value.set(biome.glyph);
	floorUniforms.uTraceK.value = biome.traceK ?? (biome.id === 'hub' ? 0.12 : 0.28);
	floorUniforms.uRipColor.value.set(biome.seam).multiplyScalar(0.8);
	const stoneMat = rimify(new THREE.MeshStandardMaterial({ color: biome.stone, map: tex.map, normalMap: tex.normalMap, roughness: 0.9, metalness: 0.05 }), biome.glyph, 0.18, 3);

	const toWorld = (c, r) => ({ x: (c - (w - 1) / 2) * T, z: (r - (h - 1) / 2) * T });
	const cells = [];
	const colliders = [];
	const doorSlots = [];
	const markers = {};
	let start = { x: 0, z: 0 };
	const braziers = [];
	const pillars = [];
	const crates = [];

	for (let r = 0; r < h; r++) {
		for (let c = 0; c < w; c++) {
			const ch = grid[r][c];
			if (ch === ' ') continue;
			const p = toWorld(c, r);
			cells.push({ c, r, ...p, ch });
			if (ch === 'D') doorSlots.push({ c, r, ...p });
			else if (ch === 'S') start = p;
			else if (ch === 'o') pillars.push(p);
			else if (ch === 'b') braziers.push(p);
			else if ('CLMAWXFRGT'.includes(ch)) markers[ch] = p;
			else if (ch === 'c') crates.push(p);
		}
	}

	// floor tiles
	const inst = new THREE.InstancedMesh(tileGeo, floorMat, cells.length);
	inst.receiveShadow = true;
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
	const col = new THREE.Color();
	cells.forEach((cell, i) => {
		q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(Math.random() * 4) * Math.PI / 2);
		v.set(cell.x, -0.6 - Math.random() * 0.035, cell.z);
		m4.compose(v, q, s);
		inst.setMatrixAt(i, m4);
		const k = 0.85 + Math.random() * 0.25;
		inst.setColorAt(i, col.setScalar(k));
	});
	group.add(inst);

	// glowing seams between tiles
	const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(biome.seam).multiplyScalar(biome.seamK ?? 0.3) });
	const seams = new THREE.InstancedMesh(seamGeo, seamMat, cells.length);
	cells.forEach((cell, i) => { m4.makeTranslation(cell.x, -0.045, cell.z); seams.setMatrixAt(i, m4); });
	group.add(seams);

	group.add(edgeCurtains(grid, w, h, toWorld, biome));
	// code runes etched into some tiles
	const glyphMats = biome.glyphs.map((gtxt) => new THREE.MeshBasicMaterial({ map: glyphTexture(gtxt, { font: `bold ${gtxt.length > 2 ? 40 : 70}px ui-monospace, Menlo, monospace` }), color: new THREE.Color(biome.glyph).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
	const glyphGeo = new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2);
	for (const cell of cells) {
		if (cell.ch !== '.' || Math.random() > 0.09) continue;
		const gm = new THREE.Mesh(glyphGeo, pick(glyphMats));
		gm.position.set(cell.x, 0.012, cell.z);
		gm.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
		gm.renderOrder = 2;
		group.add(gm);
	}

	// north wall
	const wallGeo = new RoundedBoxGeometry(T, 1, 1.4, 2, 0.08);
	const doorCols = new Set(doorSlots.map((d) => d.c));
	for (const cell of cells) {
		let outer = true;
		for (let rr = 0; rr < cell.r; rr++) if (grid[rr][cell.c] !== ' ') { outer = false; break; }
		if (!outer) continue;
		if (doorCols.has(cell.c) && cell.r === 0) continue;
		if (cell.ch === 'X') continue;
		const hgt = 2.4 + Math.random() * 1.6 + (cell.r === 0 ? 1 : 0);
		const wm = new THREE.Mesh(wallGeo, stoneMat);
		wm.scale.y = hgt;
		wm.position.set(cell.x, hgt / 2 - 0.3, cell.z - T / 2 - 0.7);
		wm.castShadow = true; wm.receiveShadow = true;
		group.add(wm);
		if (Math.random() < 0.35) {
			const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), pick(glyphMats));
			plaque.position.set(cell.x, hgt * 0.55, cell.z - T / 2 + 0.01);
			group.add(plaque);
		}
	}

	// pillars and braziers
	for (const p of pillars) {
		const pl = createPillar(stoneMat, 3 + Math.random() * 2.5);
		pl.position.set(p.x, 0, p.z);
		group.add(pl);
		colliders.push({ x: p.x, z: p.z, r: 0.75 });
	}
	R.propLights.forEach((l) => { l.intensity = 0; });
	const flames = [];
	braziers.forEach((p, i) => {
		const b = createBrazier(stoneMat, biome.brazier);
		b.position.set(p.x, 0, p.z);
		group.add(b);
		colliders.push({ x: p.x, z: p.z, r: 0.6 });
		const l = R.propLights[i];
		if (l) {
			l.color.set(biome.brazier);
			l.position.set(p.x, 2.2, p.z);
			l.intensity = 14;
			l.userData.base = 14;
		}
		flames.push({ mesh: b.userData.flame, x: p.x, z: p.z, light: l, seed: Math.random() * 10 });
	});

	// abyss debris for parallax depth
	const debrisGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.08);
	const debrisMat = biome.glassDebris ? new THREE.MeshPhysicalMaterial({ color: 0x2a2460, roughness: 0.1, metalness: 0.4, iridescence: 1, emissive: 0x2a0a50, emissiveIntensity: 0.8, flatShading: true }) : stoneMat;
	const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, 46);
	const debrisData = [];
	const halfW = (w * T) / 2, halfH = (h * T) / 2;
	for (let i = 0; i < 46; i++) {
		let x, z;
		do { x = rand(-halfW - 14, halfW + 14); z = rand(-halfH - 10, halfH + 14); } while (Math.abs(x) < halfW + 1 && Math.abs(z) < halfH + 1);
		const d = { x, y: rand(-16, -2.5), z, sx: rand(0.6, 2.4), sy: rand(0.6, 3.5), sz: rand(0.6, 2.4), rx: rand(0, 6), ry: rand(0, 6), spin: rand(-0.15, 0.15), bob: rand(0, 6) };
		debrisData.push(d);
	}
	group.add(debris);
	// distant columns rising from the abyss
	for (let i = 0; i < 10; i++) {
		const side = i % 2 ? 1 : -1;
		const pl = createPillar(stoneMat, rand(10, 22));
		pl.position.set(side * (halfW + rand(4, 12)), -rand(12, 20), rand(-halfH - 6, halfH));
		group.add(pl);
	}

	const dressing = dressRoom(group, { cells, grid, w, h, biome, layoutName, halfW, halfH, toWorld, doorSlots, colliders });

	R.scene.add(group);

	const room = {
		layoutName, biome, grid, w, h, group, cells, colliders, doorSlots, doors: [], markers, start, flames, debris, debrisData, stoneMat, floorMat, dressing, breakables: [],
		toWorld,
		walkable(x, z) {
			const c = Math.round(x / T + (w - 1) / 2), r = Math.round(z / T + (h - 1) / 2);
			if (r < 0 || r >= h || c < 0 || c >= w) return false;
			return grid[r][c] !== ' ';
		},
		time: 0,
	};
	if (opts.breakables !== false && !['hub', 'rest', 'boss'].includes(layoutName)) placeBreakables(room, crates);
	return room;
}

export function disposeRoom(room) {
	if (!room) return;
	R.scene.remove(room.group);
	room.group.traverse((o) => {
		if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
		if (o.material && !Array.isArray(o.material)) {
			if (!o.material.userData.shared) o.material.dispose();
		}
	});
	R.propLights.forEach((l) => { l.intensity = 0; });
}

export function addDoors(room, rewards) {
	// rewards: array of { kind, color, keeper?, label }
	const slots = room.doorSlots;
	let chosen;
	if (rewards.length === 1) chosen = [slots[Math.floor(slots.length / 2)]];
	else if (rewards.length === 2 && slots.length >= 3) chosen = [slots[0], slots[slots.length - 1]];
	else chosen = slots.slice(0, rewards.length);
	const used = new Set();
	rewards.forEach((rw, i) => {
		const slot = chosen[i];
		used.add(slot);
		const door = createDoor(room.stoneMat, rw.color);
		door.position.set(slot.x, 0, slot.z - T / 2 - 0.35);
		room.group.add(door);
		const icon = rewardIcon(rw.kind, rw.color);
		icon.position.set(slot.x, 4.7, slot.z - T / 2 - 0.1);
		room.group.add(icon);
		room.doors.push({ x: slot.x, z: slot.z - T / 2 - 0.35, reward: rw, mesh: door, icon, open: false, t: Math.random() * 6 });
	});
	// seal unused slots with wall blocks
	const wallGeo = new RoundedBoxGeometry(T, 4, 1.4, 2, 0.08);
	for (const slot of slots) {
		if (used.has(slot)) continue;
		const wm = new THREE.Mesh(wallGeo, room.stoneMat);
		wm.position.set(slot.x, 1.7, slot.z - T / 2 - 0.7);
		wm.castShadow = true;
		room.group.add(wm);
	}
}

export function openDoors(room) {
	for (const d of room.doors) {
		d.open = true;
		d.openT = 0;
		burst({ x: d.x, z: d.z + 0.3, y: 1.6, count: 30, color: d.reward.color, speed: 3, up: 2, size: 0.25, life: 0.9, gravity: -1 });
	}
}

export function updateRoom(room, dt) {
	if (!room) return;
	room.time += dt;
	const t = room.time;
	// debris drift
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
	room.debrisData.forEach((d, i) => {
		e.set(d.rx + t * d.spin, d.ry + t * d.spin * 0.7, 0);
		q.setFromEuler(e);
		v.set(d.x, d.y + Math.sin(t * 0.4 + d.bob) * 0.4, d.z);
		s.set(d.sx, d.sy, d.sz);
		m4.compose(v, q, s);
		room.debris.setMatrixAt(i, m4);
	});
	room.debris.instanceMatrix.needsUpdate = true;
	// braziers
	for (const f of room.flames) {
		const fl = Math.sin(t * 13 + f.seed) * 0.5 + Math.sin(t * 7.3 + f.seed * 2) * 0.5;
		f.mesh.scale.set(1 + fl * 0.08, 1 + fl * 0.18, 1 + fl * 0.08);
		if (f.light) f.light.intensity = f.light.userData.base * (0.85 + fl * 0.15);
		if (Math.random() < dt * 14) burst({ x: f.x + rand(-0.2, 0.2), z: f.z + rand(-0.2, 0.2), y: 1.7, count: 1, color: room.biome.brazier, speed: 0.3, up: 2.2, upVar: 0.6, size: 0.18, life: 0.8, gravity: 0.5, drag: 1 });
	}
	// doors
	for (const d of room.doors) {
		d.t += dt;
		d.icon.position.y = 4.7 + Math.sin(d.t * 2) * 0.12;
		d.icon.rotation.y = Math.sin(d.t * 0.9) * 0.5;
		if (d.icon.userData.spin) d.icon.userData.spin.rotation.y += dt;
		const pm = d.mesh.userData.pm;
		pm.uniforms.uTime.value = d.t;
		const target = d.open ? 1 : 0.12;
		pm.uniforms.uOpen.value += (target - pm.uniforms.uOpen.value) * Math.min(1, dt * 3);
		if (d.open && Math.random() < dt * 10) burst({ x: d.x + rand(-1, 1), z: d.z + 0.2, y: rand(0.3, 3), count: 1, color: d.reward.color, speed: 0.4, up: 0.6, size: 0.14, life: 1, gravity: 0.3, drag: 1 });
	}
	for (const u of room.dressing.uniforms) u.uTime.value = t;
	room.dressing.update?.(dt, t, room);
	for (const b of room.breakables) if (b.alive) b.mesh.userData.glow.material.uniforms.uTime.value = t + b.seed;
	// ambient motes
	if (Math.random() < dt * 18) {
		const cell = pick(room.cells);
		burst({ x: cell.x + rand(-1, 1), z: cell.z + rand(-1, 1), y: 0.1, count: 1, color: room.biome.glyph, speed: 0.2, up: 0.7, upVar: 0.3, size: 0.09, life: 3.5, lifeVar: 0.4, gravity: 0.05, drag: 0.4 });
	}
}

// Axis-separated circle movement with sliding, against the tile grid and circular colliders.
export function moveCircle(room, pos, dx, dz, r) {
	if (!room) { pos.x += dx; pos.z += dz; return; }
	const ok = (x, z) => room.walkable(x - r, z - r) && room.walkable(x + r, z - r) && room.walkable(x - r, z + r) && room.walkable(x + r, z + r) && room.walkable(x, z - r) && room.walkable(x, z + r) && room.walkable(x - r, z) && room.walkable(x + r, z);
	const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.35));
	const sx = dx / steps, sz = dz / steps;
	let hit = false;
	for (let i = 0; i < steps; i++) {
		if (ok(pos.x + sx, pos.z)) pos.x += sx; else hit = true;
		if (ok(pos.x, pos.z + sz)) pos.z += sz; else hit = true;
	}
	for (const c of room.colliders) {
		const ddx = pos.x - c.x, ddz = pos.z - c.z;
		const d = Math.hypot(ddx, ddz), min = c.r + r;
		if (d < min && d > 0.0001) {
			const nx = pos.x + ddx / d * (min - d), nz = pos.z + ddz / d * (min - d);
			if (ok(nx, nz)) { pos.x = nx; pos.z = nz; }
			hit = true;
		}
	}
	return hit;
}

export function randomSpawnPoint(room, avoid, minDist = 6) {
	for (let tries = 0; tries < 60; tries++) {
		const cell = pick(room.cells);
		if (cell.ch !== '.') continue;
		if (!room.walkable(cell.x - 1.2, cell.z) || !room.walkable(cell.x + 1.2, cell.z) || !room.walkable(cell.x, cell.z - 1.2) || !room.walkable(cell.x, cell.z + 1.2)) continue;
		if (avoid && Math.hypot(cell.x - avoid.x, cell.z - avoid.z) < minDist) continue;
		if (cell.r === 0) continue;
		return { x: cell.x + rand(-0.4, 0.4), z: cell.z + rand(-0.4, 0.4) };
	}
	const cell = pick(room.cells.filter((c) => c.ch === '.'));
	return { x: cell.x, z: cell.z };
}

export function clampToRoom(room, pos) {
	if (!room.walkable(pos.x, pos.z)) {
		// nudge toward start
		pos.x = clamp(pos.x, room.start.x - 30, room.start.x + 30);
	}
}


// ---------------- environment dressing ----------------
const curtainVS = /* glsl */`varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const curtainFS = /* glsl */`
	uniform vec3 uColor; uniform float uTime; varying vec2 vUv; varying vec3 vW;
	void main() {
		float fall = pow(clamp(vUv.y, 0.0, 1.0), 3.5);
		float streak = 0.7 + 0.3 * sin(vW.x * 1.3 + vW.z * 1.1 + uTime * 0.5);
		float drip = pow(fract(vUv.y * 2.0 + uTime * 0.25 + sin(vW.x * 4.0 + vW.z * 3.0) * 0.5), 24.0) * 0.5;
		gl_FragColor = vec4(uColor * (fall * streak + drip * fall) * 0.5, 1.0);
	}`;

// Light curtains hanging off every exposed floor edge make the arena read as a floating island.
function edgeCurtains(grid, w, h, toWorld, biome) {
	const solid = (c, r) => r >= 0 && r < h && c >= 0 && c < w && grid[r][c] !== ' ';
	const edges = [];
	for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
		if (!solid(c, r)) continue;
		const p = toWorld(c, r);
		if (!solid(c, r + 1)) edges.push({ x: p.x, z: p.z + T / 2, ry: 0 });
		if (!solid(c - 1, r)) edges.push({ x: p.x - T / 2, z: p.z, ry: -Math.PI / 2 });
		if (!solid(c + 1, r)) edges.push({ x: p.x + T / 2, z: p.z, ry: Math.PI / 2 });
	}
	const geo = new THREE.PlaneGeometry(T, 7).translate(0, -3.5 - 0.6, 0);
	const mat = new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color(biome.seam).multiplyScalar(biome.id === 'hub' ? 0.25 : 0.42) }, uTime: { value: 0 } },
		vertexShader: curtainVS, fragmentShader: curtainFS,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, edges.length));
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
	edges.forEach((e, i) => { q.setFromAxisAngle(up, e.ry); v.set(e.x, 0, e.z); m4.compose(v, q, one); inst.setMatrixAt(i, m4); });
	inst.count = edges.length;
	inst.userData.uniforms = mat.uniforms;
	inst.renderOrder = 1;
	return inst;
}

const holoFS = /* glsl */`
	uniform vec3 uColor; uniform float uTime; uniform float uSeed; varying vec2 vUv;
	float hash(float n) { return fract(sin(n) * 43758.5453); }
	void main() {
		vec2 uv = vUv;
		float frame = smoothstep(0.0, 0.02, uv.x) * smoothstep(1.0, 0.98, uv.x) * smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);
		float border = 1.0 - smoothstep(0.0, 0.025, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
		float rows = 15.0;
		float scroll = uv.y + uTime * 0.045;
		float line = floor(scroll * rows);
		float ly = fract(scroll * rows);
		float indent = floor(hash(line + uSeed) * 4.0) * 0.07;
		float len = 0.18 + hash(line * 1.7 + uSeed) * 0.62;
		float on = step(indent + 0.06, uv.x) * step(uv.x, indent + 0.06 + len) * smoothstep(0.18, 0.28, ly) * smoothstep(0.72, 0.62, ly);
		float token = step(0.5, fract(uv.x * 18.0 + hash(line) * 9.0));
		vec3 col = mix(uColor, vec3(1.0, 0.35, 0.85), step(0.82, hash(line * 3.1 + uSeed)) * token);
		float caret = step(0.94, ly + 0.0) * 0.0 + step(abs(uv.x - (indent + 0.08 + len)), 0.008) * step(0.5, fract(uTime * 1.2)) * step(abs(line - floor((0.35 + uTime * 0.045) * rows)), 0.5);
		float scan = 0.82 + 0.18 * sin(uv.y * 340.0 + uTime * 8.0);
		float flicker = 0.88 + 0.12 * step(0.96, hash(floor(uTime * 12.0) + uSeed));
		float a = (on * 0.95 + caret * 2.0 + border * 0.8 + 0.06 * frame) * scan * flicker;
		gl_FragColor = vec4(col * a, 1.0);
	}`;

const shaftFS = /* glsl */`
	uniform vec3 uColor; uniform float uTime; uniform float uSeed; varying vec2 vUv;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(12.7, 311.7))) * 43758.5453); }
	void main() {
		float edge = max(0.0, sin(vUv.x * 3.14159));
		float dustY = vUv.y + uTime * 0.04;
		vec2 g = vec2(floor(vUv.x * 22.0), floor(dustY * 60.0));
		float mote = step(0.985, hash(g + uSeed)) * 0.9;
		float body = pow(edge, 3.0) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
		float breathe = 0.75 + 0.25 * sin(uTime * 0.6 + uSeed);
		gl_FragColor = vec4(uColor * (body * 0.12 * breathe + mote * body * 0.7), 1.0);
	}`;

function dressRoom(group, { cells, grid, w, h, toWorld, biome, layoutName, halfW, halfH, doorSlots, colliders }) {
	const uniforms = [];
	const holoVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
	// holographic code panels hovering behind the back wall
	const n = layoutName === 'hub' ? 2 : 3;
	const backZ = -halfH - 1.2;
	for (let i = 0; i < n; i++) {
		const u = { uColor: { value: new THREE.Color(biome.glyph).multiplyScalar(1.15) }, uTime: { value: 0 }, uSeed: { value: rand(0, 50) } };
		uniforms.push(u);
		const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: holoVS, fragmentShader: holoFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
		const wd = rand(3.2, 5), ht = wd * rand(0.55, 0.75);
		const panel = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), mat);
		const slot = (i + 0.5) / n;
		panel.position.set((slot - 0.5) * halfW * 1.7 + rand(-1, 1), 6.5 + rand(-0.6, 1.2), backZ - rand(0.5, 2.5));
		panel.rotation.y = (0.5 - slot) * 0.35;
		group.add(panel);
	}
	// volumetric light shafts falling into the arena
	if (layoutName !== 'hub') {
		const free = cells.filter((c) => c.ch === '.' && c.r > 1);
		const k = layoutName === 'boss' ? 4 : 3;
		for (let i = 0; i < k && free.length; i++) {
			const c = free.splice(Math.floor(Math.random() * free.length), 1)[0];
			const u = { uColor: { value: new THREE.Color(biome.sun).lerp(new THREE.Color(biome.glyph), 0.35) }, uTime: { value: 0 }, uSeed: { value: rand(0, 50) } };
			uniforms.push(u);
			const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: holoVS, fragmentShader: shaftFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
			const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.8, 14, 20, 1, true).translate(0, 7, 0), mat);
			shaft.position.set(c.x + 1.5, 0, c.z - 1.2);
			shaft.rotation.set(0.12, 0, -0.22);
			shaft.renderOrder = 6;
			group.add(shaft);
		}
	}
	let update = null, impulse = null;
	if (biome.id === 'deprecated') ({ update, impulse } = dressDeprecated(group, { cells, grid, w, h, toWorld, halfW, halfH, layoutName, uniforms }));
	if (biome.id === 'deps') update = dressDeps(group, { halfW, halfH, uniforms, cells });
	// biome-specific silhouette pieces drifting in the abyss
	if (biome.id === 'latent') {
		const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(biome.glyph).multiplyScalar(1.8) });
		const nodeGeo = new THREE.SphereGeometry(0.22, 10, 8);
		const pts = [];
		for (let i = 0; i < 26; i++) {
			const side = i % 2 ? 1 : -1;
			const p = new THREE.Vector3(side * (halfW + rand(3, 11)), rand(-9, 3), rand(-halfH - 4, halfH + 2));
			pts.push(p);
			const node = new THREE.Mesh(nodeGeo, nodeMat);
			node.position.copy(p);
			group.add(node);
		}
		const lineGeo = new THREE.BufferGeometry();
		const lp = [];
		for (let i = 0; i < pts.length; i++) for (let j = i + 2; j < pts.length; j += 2) if (pts[i].distanceTo(pts[j]) < 7.5) lp.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
		lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
		group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(biome.seam).multiplyScalar(1.1), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
	}
	return { uniforms, update, impulse };
}

// ---------------- breakable files ----------------
const crateGlowFS = /* glsl */`
	uniform vec3 uColor; uniform float uTime; uniform float uHit; varying vec2 vUv;
	void main() {
		vec2 e = min(vUv, 1.0 - vUv);
		float edge = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y));
		float band = pow(fract(vUv.y * 2.0 - uTime * 0.6), 10.0) * 0.6;
		gl_FragColor = vec4(uColor * (edge * (0.6 + band) + uHit * 1.5), 1.0);
	}`;
const LABELS = { deprecated: ['v1 API', '.bak', '@since 1'], legacy: ['.cpp', '.h', 'tmp'], deps: ['lodash', 'request', 'colors', 'express'], latent: ['.ckpt', '.json', 'eval'], zero: ['.v0', 'init', '.0'] };

function placeBreakables(room, explicit) {
	const free = room.cells.filter((c) => c.ch === '.' && c.r > 1 && c.r < room.h - 2 && Math.hypot(c.x - room.start.x, c.z - room.start.z) > 5);
	const spots = explicit.length ? explicit : [];
	const want = 3 + Math.floor(Math.random() * 3);
	for (let i = 0; spots.length < want && free.length && i < 50; i++) {
		const c = free.splice(Math.floor(Math.random() * free.length), 1)[0];
		if (!room.walkable(c.x - 1.2, c.z) || !room.walkable(c.x + 1.2, c.z) || !room.walkable(c.x, c.z + 1.2) || !room.walkable(c.x, c.z - 1.2)) continue;
		if (room.colliders.some((k) => Math.hypot(k.x - c.x, k.z - c.z) < 2.2) || spots.some((sp) => Math.hypot(sp.x - c.x, sp.z - c.z) < 3)) continue;
		spots.push(c);
	}
	const biome = room.biome;
	const labels = LABELS[biome.id] || ['.txt'];
	for (const sp of spots) {
		const g = new THREE.Group();
		const s = rand(0.85, 1.1);
		const box = new THREE.Mesh(new RoundedBoxGeometry(1.0 * s, 1.15 * s, 1.0 * s, 2, 0.08), room.stoneMat);
		box.position.y = 0.58 * s; box.castShadow = true; box.receiveShadow = true;
		g.add(box);
		const u = { uColor: { value: new THREE.Color(biome.glyph).multiplyScalar(1.4) }, uTime: { value: 0 }, uHit: { value: 0 } };
		const glow = new THREE.Mesh(new THREE.BoxGeometry(1.04 * s, 1.19 * s, 1.04 * s), new THREE.ShaderMaterial({ uniforms: u, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: crateGlowFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		glow.position.y = box.position.y;
		g.add(glow);
		const label = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * s, 0.4 * s), new THREE.MeshBasicMaterial({ map: glyphTexture(pick(labels), { size: 128, font: 'bold 34px ui-monospace, monospace', glow: 8 }), transparent: true, depthWrite: false, color: new THREE.Color(biome.glyph).multiplyScalar(1.6) }));
		label.position.set(0, 0.62 * s, 0.53 * s);
		g.add(label);
		g.position.set(sp.x + rand(-0.3, 0.3), 0, sp.z + rand(-0.3, 0.3));
		g.rotation.y = rand(-0.4, 0.4);
		g.userData.glow = glow;
		room.group.add(g);
		const col = { x: g.position.x, z: g.position.z, r: 0.65 };
		room.colliders.push(col);
		room.breakables.push({ mesh: g, x: g.position.x, z: g.position.z, r: 0.75, hp: 2, alive: true, col, seed: rand(0, 10), shake: 0 });
	}
}

// Damages breakables within a circle (or an arc when `angle` and `arc` are provided).
export function smashBreakables(x, z, r, { angle = null, arc = Math.PI * 2, dmg = 1 } = {}) {
	const room = G.room;
	if (!room || !room.breakables) return 0;
	let n = 0;
	for (const b of room.breakables) {
		if (!b.alive) continue;
		const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
		if (d > r + b.r) continue;
		if (angle !== null && arc < Math.PI * 2 && d > b.r + 0.4) {
			let diff = Math.atan2(dz, dx) - angle;
			diff = Math.atan2(Math.sin(diff), Math.cos(diff));
			if (Math.abs(diff) > arc / 2 + 0.3) continue;
		}
		n++;
		b.hp -= dmg;
		b.mesh.userData.glow.material.uniforms.uHit.value = 1;
		const c = room.biome.glyph;
		sparks({ x: b.x, y: 0.7, z: b.z, count: 8, speed: 10, dir: Math.atan2(dz, dx), spread: 1.8, color: c, color2: 0xffffff, life: 0.22 });
		if (b.hp > 0) {
			b.mesh.scale.set(1.12, 0.86, 1.12);
			setTimeout(() => { if (b.alive) { b.mesh.scale.set(1, 1, 1); b.mesh.userData.glow.material.uniforms.uHit.value = 0; } }, 80);
			audio.play('land', { pitch: 1.5, vol: 1.2 });
			continue;
		}
		b.alive = false;
		room.group.remove(b.mesh);
		const i = room.colliders.indexOf(b.col);
		if (i >= 0) room.colliders.splice(i, 1);
		chunks({ x: b.x, y: 0.6, z: b.z, count: 14, color: room.biome.stone, color2: c, speed: 6, size: 0.2, up: 7 });
		sparks({ x: b.x, y: 0.7, z: b.z, count: 18, speed: 14, color: c, color2: 0xffffff, life: 0.32 });
		burst({ x: b.x, z: b.z, y: 0.7, count: 22, color: c, color2: 0xffffff, speed: 5, up: 3, size: 0.22, life: 0.5 });
		floorRipple(b.x, b.z, 0.55);
		audio.play('kill', { pitch: 0.7 });
		G.hitstop = Math.max(G.hitstop, 0.03);
		b.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== room.stoneMat) o.material.dispose(); });
		room.onBreak?.(b);
	}
	return n;
}


// ---------------- Stage 1: The Deprecated ----------------
const sunsetFS = /* glsl */`
	uniform float uTime; varying vec2 vUv;
	void main() {
		vec2 p = vUv - vec2(0.5, 0.42);
		vec3 top = vec3(0.05, 0.02, 0.12), mid = vec3(0.55, 0.12, 0.42), low = vec3(1.0, 0.5, 0.18);
		float y = vUv.y;
		vec3 sky = mix(low, mid, smoothstep(0.25, 0.5, y));
		sky = mix(sky, top, smoothstep(0.5, 0.95, y));
		float r = length(p * vec2(1.0, 1.15));
		float sun = smoothstep(0.17, 0.165, r);
		float bands = step(0.5, fract((vUv.y - uTime * 0.01) * 26.0 + (0.42 - vUv.y) * 8.0));
		float cut = mix(1.0, bands, smoothstep(0.42, 0.28, vUv.y));
		vec3 sunCol = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.3, 0.45), smoothstep(0.55, 0.28, vUv.y));
		float halo = exp(-r * 7.0) * 0.8;
		vec3 col = sky * 0.55 + sunCol * sun * cut * 1.5 + vec3(1.0, 0.45, 0.3) * halo;
		float strike = smoothstep(0.006, 0.0, abs(vUv.y - 0.43 - (vUv.x - 0.5) * 0.06)) * step(abs(vUv.x - 0.5), 0.24);
		col += vec3(1.0, 0.25, 0.3) * strike * 1.6;
		float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
		gl_FragColor = vec4(col * edge * 0.75, 1.0);
	}`;

const fogFS = /* glsl */`
	uniform float uTime; uniform vec3 uColor; uniform vec3 uPlayer; varying vec2 vUv; varying vec3 vW;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
	void main() {
		vec2 q = vW.xz * 0.12;
		float n = noise(q + vec2(uTime * 0.05, uTime * 0.02)) * 0.6 + noise(q * 2.3 - vec2(uTime * 0.07, 0.0)) * 0.4;
		float d = distance(vW.xz, uPlayer.xz);
		float clear = smoothstep(1.2, 3.2, d);
		float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
		float a = smoothstep(0.45, 0.9, n) * clear * edge;
		gl_FragColor = vec4(uColor * a * 0.13, 1.0);
	}`;

function paperTexture() {
	const c = document.createElement('canvas'); c.width = 64; c.height = 80;
	const g = c.getContext('2d');
	g.fillStyle = '#efe6d0'; g.fillRect(0, 0, 64, 80);
	g.fillStyle = '#3a2f4a';
	for (let i = 0; i < 9; i++) {
		const w = 18 + Math.random() * 34;
		g.fillRect(6, 8 + i * 7.5, w, 2);
		if (Math.random() < 0.45) { g.fillStyle = '#d6304a'; g.fillRect(4, 8.6 + i * 7.5, w + 4, 1); g.fillStyle = '#3a2f4a'; }
	}
	g.fillStyle = '#d6304a'; g.font = 'bold 9px monospace'; g.fillText('@deprecated', 4, 76);
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

function dressDeprecated(group, { cells, grid, w, h, toWorld, halfW, halfH, layoutName, uniforms }) {
	// Sunset sky: Deprecata keeps it from ever finishing.
	const su = { uTime: { value: 0 } };
	uniforms.push(su);
	// A vertical horizon panel far beyond the back wall: visible past the far edge, never through floor gaps.
	const sky = new THREE.Mesh(new THREE.PlaneGeometry(170, 56), new THREE.ShaderMaterial({ uniforms: su, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: sunsetFS, depthWrite: false, fog: false }));
	sky.position.set(0, -20, -halfH - 26);
	sky.renderOrder = -10;
	group.add(sky);

	// Low fog that parts around Buddy.
	const fu = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xb48cff) }, uPlayer: floorUniforms.uPlayer };
	uniforms.push(fu);
	const fogMat = new THREE.ShaderMaterial({ uniforms: fu, vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: fogFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
	for (const y of [0.35]) {
		const fog = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 + 26, halfH * 2 + 22).rotateX(-Math.PI / 2), fogMat);
		fog.position.y = y;
		fog.renderOrder = 5;
		group.add(fog);
	}

	// @deprecated signposts and strikethrough banners on the back wall.
	const wood = new THREE.MeshStandardMaterial({ color: 0x4a3540, roughness: 0.85 });
	const signMat = new THREE.MeshBasicMaterial({ map: glyphTexture('@deprecated', { size: 256, font: 'bold 38px ui-monospace, monospace', glow: 8 }), transparent: true, depthWrite: false, color: new THREE.Color(0xff8a3d).multiplyScalar(1.5) });
	const edgeCells = cells.filter((c) => c.ch === '.' && c.r > 1 && (grid[c.r][c.c - 1] === ' ' || grid[c.r][c.c + 1] === ' ' || c.c === 0 || c.c === w - 1));
	for (let i = 0; i < 3 && edgeCells.length; i++) {
		const c = edgeCells.splice(Math.floor(Math.random() * edgeCells.length), 1)[0];
		const left = c.c === 0 || grid[c.r][c.c - 1] === ' ';
		const post = new THREE.Group();
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6), wood);
		pole.position.y = 1.1; pole.castShadow = true;
		const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.06), wood);
		board.position.set(0, 1.9, 0); board.rotation.z = rand(-0.18, 0.18); board.castShadow = true;
		const label = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), signMat);
		label.position.set(0, 1.9, 0.04); label.rotation.z = board.rotation.z;
		post.add(pole, board, label);
		post.position.set(c.x + (left ? -0.7 : 0.7), 0, c.z);
		post.rotation.y = rand(-0.3, 0.3);
		group.add(post);
	}
	const bu = { uTime: { value: 0 } };
	uniforms.push(bu);
	const bannerMat = new THREE.ShaderMaterial({
		uniforms: { ...bu, map: { value: glyphTexture('v1  ̶A̶P̶I̶', { size: 256, font: 'bold 60px serif', glow: 6 }) } },
		vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(uv.y * 5.0 + uTime * 2.2 + position.x) * 0.12 * (1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
		fragmentShader: `uniform sampler2D map; varying vec2 vUv; void main(){ vec3 cloth = mix(vec3(0.22,0.08,0.28), vec3(0.42,0.14,0.36), vUv.y); float fray = step(0.08, vUv.y) + step(0.5, fract(vUv.x * 9.0)) ; if (fray < 0.5) discard; vec4 t = texture2D(map, vec2(vUv.x, vUv.y * 1.6 - 0.3)); vec3 col = cloth + vec3(1.0, 0.55, 0.25) * t.a * 0.9; float strike = smoothstep(0.02, 0.0, abs(vUv.y - 0.55)) * 0.9; col += vec3(1.0,0.2,0.3) * strike; gl_FragColor = vec4(col, 1.0); }`,
		side: THREE.DoubleSide,
	});
	for (const sx of [-1, 1]) {
		const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2, 8, 12), bannerMat);
		banner.position.set(sx * halfW * 0.45, 3.6, -halfH + 0.2);
		group.add(banner);
	}

	// Drifting documentation pages that scatter from impacts.
	const N = layoutName === 'boss' ? 26 : 18;
	const pageGeo = new THREE.PlaneGeometry(0.42, 0.54);
	const pageMat = new THREE.MeshStandardMaterial({ map: paperTexture(), side: THREE.DoubleSide, roughness: 0.9, emissive: 0x2a1830, emissiveIntensity: 0.4 });
	const pages = new THREE.InstancedMesh(pageGeo, pageMat, N);
	pages.castShadow = true;
	const P = [];
	for (let i = 0; i < N; i++) P.push({ x: rand(-halfW, halfW), y: rand(0.4, 4), z: rand(-halfH, halfH), vx: rand(-0.2, 0.2), vy: 0, vz: rand(-0.1, 0.2), rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), sp: rand(0.6, 1.6), seed: rand(0, 10) });
	group.add(pages);
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
	let crumbleT = rand(1, 3);
	const edges = [];
	for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
		if (grid[r][c] === ' ') continue;
		if (r + 1 >= h || grid[r + 1][c] === ' ') { const p = toWorld(c, r); edges.push({ x: p.x, z: p.z + 1.05 }); }
	}
	const impulse = (x, z, k) => {
		for (const p of P) {
			const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
			if (d > 4.5 || d < 0.01) continue;
			const f = (1 - d / 4.5) * k;
			p.vx += dx / d * f * 7; p.vz += dz / d * f * 7; p.vy += f * 5;
			p.sp += f * 3;
		}
	};
	const update = (dt, t, room) => {
		for (let i = 0; i < N; i++) {
			const p = P[i];
			p.vx += (Math.sin(t * 0.3 + p.seed) * 0.25 + 0.12 - p.vx) * dt * 0.6;
			p.vz += (Math.cos(t * 0.25 + p.seed) * 0.2 + 0.08 - p.vz) * dt * 0.6;
			p.vy += (Math.sin(t * p.sp + p.seed) * 0.35 - p.vy) * dt * 1.2;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			if (p.y < 0.25) { p.y = 0.25; p.vy = Math.abs(p.vy) * 0.3; }
			if (p.y > 6) p.vy -= dt * 2;
			if (p.x > halfW + 3) p.x = -halfW - 3; if (p.x < -halfW - 3) p.x = halfW + 3;
			if (p.z > halfH + 3) p.z = -halfH - 3; if (p.z < -halfH - 3) p.z = halfH + 3;
			p.rx += dt * p.sp * (0.6 + Math.hypot(p.vx, p.vz)); p.rz += dt * p.sp * 0.4;
			p.sp += (1 - p.sp) * dt * 0.5;
			const drag = Math.exp(-1.2 * dt);
			if (Math.hypot(p.vx, p.vz) > 0.5) { p.vx *= drag; p.vz *= drag; }
			e.set(p.rx, p.ry, p.rz); q.setFromEuler(e); v.set(p.x, p.y, p.z);
			m4.compose(v, q, one);
			pages.setMatrixAt(i, m4);
		}
		pages.instanceMatrix.needsUpdate = true;
		crumbleT -= dt;
		if (crumbleT <= 0 && edges.length) {
			crumbleT = rand(1.5, 4);
			const ed = pick(edges);
			chunks({ x: ed.x + rand(-0.8, 0.8), y: -0.2, z: ed.z, count: 4, color: room.biome.stone, color2: 0x2a1a30, speed: 0.6, size: 0.3, up: 0.5, life: 2.4 });
			burst({ x: ed.x, z: ed.z, y: -0.3, count: 6, color: 0xb48cff, speed: 0.4, up: -0.5, size: 0.3, life: 1.2, gravity: -2 });
		}
	};
	return { update, impulse };
}

// ---------------- Stage 3: node_modules ----------------
function crateTexture(text) {
	const c = document.createElement('canvas'); c.width = 128; c.height = 128;
	const g = c.getContext('2d');
	g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 128, 128);
	g.fillStyle = '#6f5334'; for (let i = 0; i < 128; i += 16) g.fillRect(0, i, 128, 2);
	g.fillStyle = '#cb3837'; g.fillRect(0, 54, 128, 20);
	g.fillStyle = '#efe6cf'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText(text, 64, 70);
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

function dressDeps(group, { halfW, halfH, uniforms }) {
	// Towers of packages stacked into the abyss, joined by dependency cables.
	const names = ['react', 'lodash', 'left-pad', 'chalk', 'debug', 'ms', 'semver', 'tslib', 'qs', 'uuid'];
	const mats = names.map((n) => new THREE.MeshStandardMaterial({ map: crateTexture(n), roughness: 0.85 }));
	const geo = new RoundedBoxGeometry(1.6, 1.6, 1.6, 1, 0.08);
	const tops = [];
	for (let i = 0; i < 12; i++) {
		const side = i % 2 ? 1 : -1;
		const x = side * (halfW + rand(3, 12)), z = rand(-halfH - 6, halfH + 2);
		const n = 3 + Math.floor(rand(0, 6));
		let y = -rand(6, 14);
		for (let k = 0; k < n; k++) {
			const b = new THREE.Mesh(geo, pick(mats));
			const s = rand(0.7, 1.3);
			b.scale.setScalar(s);
			b.position.set(x + rand(-0.3, 0.3), y + 0.8 * s, z + rand(-0.3, 0.3));
			b.rotation.y = rand(-0.5, 0.5);
			b.castShadow = false;
			group.add(b);
			y += 1.6 * s;
		}
		tops.push(new THREE.Vector3(x, y, z));
	}
	const pts = [];
	for (let i = 0; i < tops.length; i++) {
		const a = tops[i], b = tops[(i + 2) % tops.length];
		const mid = a.clone().lerp(b, 0.5); mid.y -= 3;
		const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
		const cp = curve.getPoints(16);
		for (let k = 0; k < cp.length - 1; k++) pts.push(cp[k].x, cp[k].y, cp[k].z, cp[k + 1].x, cp[k + 1].y, cp[k + 1].z);
	}
	const lg = new THREE.BufferGeometry();
	lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0x7dff6a).multiplyScalar(0.9), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
	return (dt, t) => {
		if (Math.random() < dt * 3) {
			const a = pick(tops);
			burst({ x: a.x, z: a.z, y: a.y, count: 1, color: 0x7dff6a, speed: 0.2, up: 1.2, size: 0.3, life: 1.6, gravity: 0 });
		}
	};
}
