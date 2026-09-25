import * as THREE from 'three';
import { G } from './state.js';
import { R, setAtmosphere } from './render.js';
import { makeStoneTextures, glyphTexture } from './textures.js';
import { createDoor, createPillar, createBrazier, rewardIcon, RoundedBoxGeometry } from './models.js';
import { rimify } from './materials.js';
import { burst } from './fx.js';
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
		'   .................   ',
		'  ..A.............W..  ',
		'  ...................  ',
		' .....C.........M..... ',
		' ..................... ',
		' ...o.............o... ',
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

	const floorMat = new THREE.MeshStandardMaterial({ color: biome.floor, map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap, roughness: 1, metalness: 0.05, normalScale: new THREE.Vector2(0.8, 0.8) });
	const stoneMat = rimify(new THREE.MeshStandardMaterial({ color: biome.stone, map: tex.map, normalMap: tex.normalMap, roughness: 0.9, metalness: 0.05 }), biome.glyph, 0.18, 3);

	const toWorld = (c, r) => ({ x: (c - (w - 1) / 2) * T, z: (r - (h - 1) / 2) * T });
	const cells = [];
	const colliders = [];
	const doorSlots = [];
	const markers = {};
	let start = { x: 0, z: 0 };
	const braziers = [];
	const pillars = [];

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
			else if ('CLMAWXF'.includes(ch)) markers[ch] = p;
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
	const debris = new THREE.InstancedMesh(debrisGeo, stoneMat, 46);
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

	R.scene.add(group);

	const room = {
		layoutName, biome, grid, w, h, group, cells, colliders, doorSlots, doors: [], markers, start, flames, debris, debrisData, stoneMat, floorMat,
		toWorld,
		walkable(x, z) {
			const c = Math.round(x / T + (w - 1) / 2), r = Math.round(z / T + (h - 1) / 2);
			if (r < 0 || r >= h || c < 0 || c >= w) return false;
			return grid[r][c] !== ' ';
		},
		time: 0,
	};
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
