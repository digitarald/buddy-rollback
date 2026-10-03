// The Arsenal: Buddy's weapons, their models, animation, and Patch (weapon modification) definitions.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glowMat, toon } from './materials.js';
import { glyphTexture } from './textures.js';
import { createCaretWeapon } from './models.js';
import { clamp, damp } from './util.js';

const sw = (o) => ({ dir: 1, knock: 4, sfx: 'swing', ...o });

export const WEAPONS = {
	caret: {
		id: 'caret', name: 'Caret Blade', title: 'The Insertion Point', color: 0xbfeaff, css: '#bfeaff',
		desc: 'Balanced sweeping arcs. Hold to spin.',
		omegaName: 'Rare Spin',
		combo: [
			sw({ arc: 2.5, range: 2.35, dmg: 12, dur: 0.23, hitAt: 0.055, lunge: 3.2, dir: 1, style: 'arc' }),
			sw({ arc: 2.5, range: 2.35, dmg: 12, dur: 0.23, hitAt: 0.055, lunge: 3.2, dir: -1, style: 'arc' }),
			sw({ arc: 3.6, range: 2.9, dmg: 24, dur: 0.36, hitAt: 0.1, lunge: 7, dir: 1, knock: 9, big: true, sfx: 'swing3', style: 'arc', finisher: true }),
		],
		dash: sw({ arc: 1.9, range: 2.8, dmg: 20, dur: 0.26, hitAt: 0.05, lunge: 9, knock: 7, big: true, sfx: 'swing3', style: 'arc' }),
		omega: 'spin',
		unlock: () => true,
	},
	lance: {
		id: 'lance', name: 'Cursor Lance', title: 'The Pointer', color: 0x9fe8ff, css: '#9fe8ff',
		desc: 'Long, piercing thrusts. Hold to Skewer through a line of foes.',
		omegaName: 'Skewer',
		combo: [
			sw({ arc: 0.55, range: 4.1, dmg: 14, dur: 0.24, hitAt: 0.07, lunge: 4.5, knock: 3, style: 'thrust', sfx: 'swing' }),
			sw({ arc: 0.55, range: 4.1, dmg: 14, dur: 0.24, hitAt: 0.07, lunge: 4.5, knock: 3, style: 'thrust', sfx: 'swing' }),
			sw({ arc: 0.7, range: 5.0, dmg: 30, dur: 0.38, hitAt: 0.12, lunge: 9, knock: 10, big: true, style: 'thrust', sfx: 'swing3', finisher: true }),
		],
		dash: sw({ arc: 0.6, range: 5.2, dmg: 24, dur: 0.3, hitAt: 0.05, lunge: 13, knock: 8, big: true, style: 'thrust', sfx: 'swing3' }),
		omega: 'skewer',
		unlock: (s) => s.bossKills.deprecata >= 1,
		hint: 'Defeat Deprecata',
	},
	gauntlets: {
		id: 'gauntlets', name: 'Terminal Gauntlets', title: 'The Keystrokes', color: 0x7dffb0, css: '#7dffb0',
		desc: 'Rapid 5-hit combo ending in a shockwave. Hold for a punch flurry.',
		omegaName: 'Keyboard Mash',
		combo: [
			sw({ arc: 1.5, range: 1.95, dmg: 7, dur: 0.14, hitAt: 0.035, lunge: 3.6, dir: 1, knock: 2, style: 'punch', sfx: 'swing' }),
			sw({ arc: 1.5, range: 1.95, dmg: 7, dur: 0.14, hitAt: 0.035, lunge: 3.6, dir: -1, knock: 2, style: 'punch', sfx: 'swing' }),
			sw({ arc: 1.5, range: 1.95, dmg: 8, dur: 0.15, hitAt: 0.035, lunge: 3.6, dir: 1, knock: 2, style: 'punch', sfx: 'swing' }),
			sw({ arc: 1.5, range: 1.95, dmg: 8, dur: 0.15, hitAt: 0.035, lunge: 3.6, dir: -1, knock: 2, style: 'punch', sfx: 'swing' }),
			sw({ arc: 2.2, range: 2.2, dmg: 20, dur: 0.34, hitAt: 0.1, lunge: 6, dir: 1, knock: 11, big: true, style: 'punch', sfx: 'swing3', finisher: true, shock: 2.6 }),
		],
		dash: sw({ arc: 1.6, range: 2.4, dmg: 18, dur: 0.24, hitAt: 0.05, lunge: 11, knock: 8, big: true, style: 'punch', sfx: 'swing3' }),
		omega: 'flurry',
		unlock: (s) => s.bossKills.collector >= 1,
		hint: 'Defeat the Garbage Collector',
	},
};
export const WEAPON_IDS = Object.keys(WEAPONS);

// Patches: Daedalus-hammer-style modifications found behind gold Patch doors.
export const PATCHES = [
	{ id: 'triple_star', name: 'Triple Star', weapon: null, desc: 'Your <b>Special</b> throws <b>3</b> stars in a fan (each deals 70% damage).' },
	{ id: 'boomerang', name: 'Return Statement', weapon: null, desc: 'Your stars <b>return</b> to you after reaching max range, hitting foes again.' },
	{ id: 'echo_dash', name: 'Echo Dash', weapon: null, desc: 'Your <b>Dash</b> leaves an echo that detonates for <b>22</b> damage after 0.5s.' },
	{ id: 'overclock', name: 'Overclock', weapon: null, desc: 'Your <b>Attack</b> is <b>25%</b> faster.' },
	{ id: 'multi_cursor', name: 'Multi-Cursor', weapon: 'caret', desc: 'Your finisher spawns <b>2</b> extra cursors that slash beside you.' },
	{ id: 'wide_select', name: 'Wide Selection', weapon: 'caret', desc: 'Your <b>Attack</b> has <b>+35%</b> arc and <b>+20%</b> range.' },
	{ id: 'long_line', name: 'Long Line', weapon: 'lance', desc: 'Your thrusts reach <b>+35%</b> further.' },
	{ id: 'fling', name: 'Pointer Fling', weapon: 'lance', desc: 'Your finisher launches a piercing bolt for <b>26</b> damage.' },
	{ id: 'ctrl_combo', name: 'Ctrl+Combo', weapon: 'gauntlets', desc: 'Your finisher shockwave is <b>60%</b> larger and deals <b>+50%</b> damage.' },
	{ id: 'one_two', name: 'One-Two', weapon: 'gauntlets', desc: 'Each punch has a <b>30%</b> chance to strike twice.' },
];
export const PATCH_BY_ID = Object.fromEntries(PATCHES.map((p) => [p.id, p]));

// ---------------- models ----------------
export function createWeaponModel(id) {
	if (id === 'lance') {
		const g = new THREE.Group();
		const mat = glowMat(0x9fe8ff, 2.6);
		const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), mat);
		shaft.position.z = 0.2;
		const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4).rotateX(Math.PI / 2), mat);
		tip.position.z = 1.3;
		tip.rotation.z = Math.PI / 4;
		const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), mat);
		guard.position.z = -0.4;
		const butt = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), mat);
		butt.position.z = -0.7;
		g.add(shaft, tip, guard, butt);
		g.userData.mat = mat;
		g.userData.kind = 'lance';
		return g;
	}
	if (id === 'gauntlets') {
		const g = new THREE.Group();
		const mat = glowMat(0x7dffb0, 2.4);
		const shell = toon(0x1c2430, { roughness: 0.3, metalness: 0.6, rim: 0x7dffb0, rimStrength: 0.9 });
		const fists = [];
		for (const s of [-1, 1]) {
			const f = new THREE.Group();
			const cube = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.3, 0.38, 2, 0.06), shell);
			cube.castShadow = true;
			const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.24), new THREE.MeshBasicMaterial({ map: glyphTexture('>_', { font: 'bold 70px ui-monospace, monospace', glow: 10 }), transparent: true, depthWrite: false, color: new THREE.Color(0x7dffb0).multiplyScalar(2) }));
			keys.position.z = 0.2;
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 20), mat);
			ring.position.z = -0.18;
			f.add(cube, keys, ring);
			f.userData.side = s;
			g.add(f);
			fists.push(f);
		}
		g.userData.mat = mat;
		g.userData.fists = fists;
		g.userData.kind = 'gauntlets';
		return g;
	}
	const c = createCaretWeapon();
	c.userData.kind = 'caret';
	return c;
}

// Per-weapon idle/attack poses. `P` is the Player; `w` the weapon group parented to Buddy's root.
export function animateWeapon(P, w, dt) {
	const kind = w.userData.kind;
	const st = P.state;
	const t = performance.now() / 1000;
	if (kind === 'lance') {
		w.rotation.order = 'YXZ';
		if (st === 'attack') {
			const sw = P.swing;
			const k = clamp(P.swingT / sw.dur, 0, 1);
			const ext = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
			w.position.set(0.25 * (sw.dir || 1), 0.62, 0.3 + ext * sw.range * 0.55);
			w.rotation.set(0, 0, 0);
		} else if (st === 'skewer') {
			w.position.set(0, 0.6, 1.4);
			w.rotation.set(0, 0, P.stateT * 30);
		} else if (st === 'charge') {
			w.position.x = damp(w.position.x, 0.2, 10, dt);
			w.position.y = damp(w.position.y, 0.7, 10, dt);
			w.position.z = damp(w.position.z, -0.4, 10, dt);
			w.rotation.set(0, 0, w.rotation.z + dt * 18);
		} else {
			w.position.x = damp(w.position.x, 0.75, 12, dt);
			w.position.y = damp(w.position.y, 0.9 + Math.sin(t * 2.2) * 0.08, 12, dt);
			w.position.z = damp(w.position.z, -0.1, 12, dt);
			w.rotation.set(damp(w.rotation.x, -0.9, 10, dt), 0, 0);
		}
		return;
	}
	if (kind === 'gauntlets') {
		const [L, Rr] = w.userData.fists;
		w.position.set(0, 0, 0);
		w.rotation.set(0, 0, 0);
		const rest = (f, s) => {
			f.position.x = damp(f.position.x, 0.62 * s, 14, dt);
			f.position.y = damp(f.position.y, 0.5 + Math.sin(t * 3 + s) * 0.05, 14, dt);
			f.position.z = damp(f.position.z, 0.35, 14, dt);
			f.rotation.set(0, 0, 0);
		};
		if (st === 'attack') {
			const sw = P.swing;
			const k = clamp(P.swingT / sw.dur, 0, 1);
			const ext = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
			const lead = sw.finisher ? null : sw.dir > 0 ? Rr : L;
			for (const f of [L, Rr]) {
				if (sw.finisher) {
					f.position.set(0.32 * f.userData.side, 0.55 + ext * 0.2, 0.4 + ext * 1.4);
					f.rotation.x = -ext * 0.4;
				} else if (f === lead) {
					f.position.set(0.25 * f.userData.side, 0.55, 0.4 + ext * 1.35);
				} else rest(f, f.userData.side);
			}
		} else if (st === 'flurry') {
			for (const f of [L, Rr]) {
				const ph = Math.sin(P.stateT * 40 + (f.userData.side > 0 ? 0 : Math.PI));
				f.position.set(0.3 * f.userData.side + Math.sin(P.stateT * 23 + f.userData.side) * 0.2, 0.55 + Math.cos(P.stateT * 31) * 0.15, 0.6 + Math.max(0, ph) * 1.2);
			}
		} else if (st === 'charge') {
			for (const f of [L, Rr]) { f.position.x = damp(f.position.x, 0.2 * f.userData.side, 12, dt); f.position.y = damp(f.position.y, 0.9, 12, dt); f.position.z = damp(f.position.z, 0.1, 12, dt); f.rotation.z += dt * 12 * f.userData.side; }
		} else { rest(L, -1); rest(Rr, 1); }
		return;
	}
	// caret (original behaviour)
	w.rotation.order = 'YXZ';
	if (st === 'attack') {
		const k = clamp(P.swingT / (P.swing.dur * 0.55), 0, 1);
		const e = 1 - Math.pow(1 - k, 3);
		const th = P.swing.dir * (P.swing.arc / 2 - P.swing.arc * e);
		const r = P.swing.range * 0.62;
		w.position.set(Math.sin(th) * r, 0.6, Math.cos(th) * r);
		w.rotation.set(Math.PI / 2, th, 0);
	} else if (st === 'spin') {
		const th = -P.stateT * Math.PI * 2 * 3.6;
		w.position.set(Math.sin(th) * 1.9, 0.6, Math.cos(th) * 1.9);
		w.rotation.set(Math.PI / 2, th, 0);
	} else if (st === 'charge') {
		w.position.x = damp(w.position.x, 0, 10, dt);
		w.position.y = damp(w.position.y, 2.0, 10, dt);
		w.position.z = damp(w.position.z, 0, 10, dt);
		w.rotation.set(0, w.rotation.y + dt * 20, 0);
	} else {
		w.position.x = damp(w.position.x, 0.9, 12, dt);
		w.position.y = damp(w.position.y, 0.95 + Math.sin(t * 2.2) * 0.1, 12, dt);
		w.position.z = damp(w.position.z, -0.2, 12, dt);
		w.rotation.set(damp(w.rotation.x, 0.15, 10, dt), w.rotation.y + dt * 1.2, 0);
	}
}
