import * as THREE from 'three';

function hash(x, y, s = 0) {
	let h = x * 374761393 + y * 668265263 + s * 982451653;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
	const xi = Math.floor(x), yi = Math.floor(y);
	const xf = x - xi, yf = y - yi;
	const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
	const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) {
	let t = 0, amp = 0.5, f = 1;
	for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i) * amp; f *= 2; amp *= 0.5; }
	return t;
}

// Tileable stone slab: returns { map, normalMap, roughnessMap }
export function makeStoneTextures(size = 256, seed = 1) {
	const h = new Float32Array(size * size);
	const col = new Float32Array(size * size);
	const period = 8;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / size, v = y / size;
			let n = fbm(u * period, v * period, seed, 5);
			const edge = Math.min(u, v, 1 - u, 1 - v);
			const bevel = Math.min(1, edge / 0.045);
			const inset = edge > 0.09 && edge < 0.1 ? 0.7 : 1; // engraved inner border
			let height = (0.55 + n * 0.45) * (0.4 + 0.6 * bevel) * inset;
			col[y * size + x] = (0.58 + n * 0.32) * (0.7 + 0.3 * bevel) * (inset < 1 ? 0.8 : 1);
			h[y * size + x] = height;
		}
	}
	// cracks
	let rs = seed * 9973;
	const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
	for (let c = 0; c < 3; c++) {
		let x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI * 2;
		const steps = 30 + rnd() * 60;
		for (let i = 0; i < steps; i++) {
			a += (rnd() - 0.5) * 0.9;
			x += Math.cos(a) * 1.4; y += Math.sin(a) * 1.4;
			const xi = Math.floor(x), yi = Math.floor(y);
			if (xi < 2 || yi < 2 || xi >= size - 2 || yi >= size - 2) break;
			for (let oy = -1; oy <= 0; oy++) for (let ox = -1; ox <= 0; ox++) {
				const k = (yi + oy) * size + xi + ox;
				h[k] *= 0.8; col[k] *= 0.78;
			}
		}
	}
	const cc = document.createElement('canvas'); cc.width = cc.height = size;
	const nc = document.createElement('canvas'); nc.width = nc.height = size;
	const rc = document.createElement('canvas'); rc.width = rc.height = size;
	const ci = cc.getContext('2d').createImageData(size, size);
	const ni = nc.getContext('2d').createImageData(size, size);
	const ri = rc.getContext('2d').createImageData(size, size);
	const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const k = y * size + x, p = k * 4;
			const c = Math.min(255, col[k] * 255);
			ci.data[p] = c; ci.data[p + 1] = c; ci.data[p + 2] = c; ci.data[p + 3] = 255;
			const dx = (H(x + 1, y) - H(x - 1, y)) * 3.2;
			const dy = (H(x, y + 1) - H(x, y - 1)) * 3.2;
			const nz = 1 / Math.hypot(dx, dy, 1);
			ni.data[p] = (-dx * nz * 0.5 + 0.5) * 255;
			ni.data[p + 1] = (dy * nz * 0.5 + 0.5) * 255;
			ni.data[p + 2] = (nz * 0.5 + 0.5) * 255;
			ni.data[p + 3] = 255;
			const r = 150 + (1 - h[k]) * 105;
			ri.data[p] = r; ri.data[p + 1] = r; ri.data[p + 2] = r; ri.data[p + 3] = 255;
		}
	}
	cc.getContext('2d').putImageData(ci, 0, 0);
	nc.getContext('2d').putImageData(ni, 0, 0);
	rc.getContext('2d').putImageData(ri, 0, 0);
	const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace;
	const normalMap = new THREE.CanvasTexture(nc);
	const roughnessMap = new THREE.CanvasTexture(rc);
	for (const t of [map, normalMap, roughnessMap]) { t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; }
	return { map, normalMap, roughnessMap };
}

const glyphCache = new Map();
export function glyphTexture(text, { size = 128, font = 'bold 64px ui-monospace, Menlo, Consolas, monospace', glow = 16 } = {}) {
	const key = text + size + font;
	if (glyphCache.has(key)) return glyphCache.get(key);
	const c = document.createElement('canvas'); c.width = c.height = size;
	const g = c.getContext('2d');
	g.fillStyle = '#fff';
	g.font = font;
	g.textAlign = 'center'; g.textBaseline = 'middle';
	g.shadowColor = '#fff'; g.shadowBlur = glow;
	g.fillText(text, size / 2, size / 2 + 2);
	g.shadowBlur = 0;
	g.fillText(text, size / 2, size / 2 + 2);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	glyphCache.set(key, t);
	return t;
}

export function textTexture(lines, { w = 512, h = 128, font = 'bold 44px ui-monospace, Menlo, monospace', color = '#fff', bg = null, align = 'center' } = {}) {
	const c = document.createElement('canvas'); c.width = w; c.height = h;
	const g = c.getContext('2d');
	if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
	g.fillStyle = color; g.font = font; g.textAlign = align; g.textBaseline = 'middle';
	const arr = Array.isArray(lines) ? lines : [lines];
	arr.forEach((l, i) => g.fillText(l, align === 'center' ? w / 2 : 16, h / (arr.length + 1) * (i + 1)));
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

export function softDotTexture() {
	const c = document.createElement('canvas'); c.width = c.height = 64;
	const g = c.getContext('2d');
	const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,255,255,1)');
	gr.addColorStop(0.35, 'rgba(255,255,255,0.5)');
	gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
	return new THREE.CanvasTexture(c);
}

// ---------- pixel art ----------
export function pixelSVG(rows, palette, px = 4) {
	const h = rows.length, w = Math.max(...rows.map((r) => r.length));
	let rects = '';
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < rows[y].length; x++) {
			const ch = rows[y][x];
			if (ch === '.' || ch === ' ' || !palette[ch]) continue;
			rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${palette[ch]}"/>`;
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" shape-rendering="crispEdges">${rects}</svg>`;
}

export const BUDDY_PAL = { A: '#0077b8', B: '#004e7c', C: '#23a8f2', D: '#212324', W: '#ffffff', Y: '#ffcd0f', R: '#e8334a', K: '#111' };
export const BUDDY_PAL_INSIDERS = { A: '#1a9c87', B: '#0f6b5c', C: '#24bfa5', D: '#212324', W: '#ffffff', Y: '#ffcd0f', R: '#e8334a', K: '#111' };

// Traced 1:1 (at 4px/cell) from buddy-idle-stable-tracking-96.png in microsoft/vscode, with eyes added.
export const BUDDY_ROWS = [
	'..A.........A...',
	'...A.......A....',
	'....A.....A.....',
	'.....BA..A......',
	'.....BACC.......',
	'....BACCCC......',
	'...BACCCCCC.....',
	'..BACCCCCCCC....',
	'.BAACDCCCDCCC...',
	'BAAACDCCCDCCCC..',
	'BAAACCCCCCCCCC..',
	'BAAACCCCCCCCCC..',
	'.BAAAACCCCCCC...',
];

export const PORTRAITS = {
	buddy: { rows: BUDDY_ROWS, pal: BUDDY_PAL },
	caret: {
		rows: [
			'...WWWWWW...',
			'.....WW.....',
			'.....WW.....',
			'.....WW.....',
			'....YWWY....',
			'.....WW.....',
			'.....WW.....',
			'.....WW.....',
			'.....WW.....',
			'...WWWWWW...',
		], pal: { W: '#f4f1e8', Y: '#ffcd0f' },
	},
	lint: {
		rows: [
			'............',
			'..G.....G...',
			'.G.G...G.G..',
			'G...G.G...G.',
			'.....G......',
			'..KW....KW..',
			'..KK....KK..',
			'............',
			'...RRRRRR...',
		], pal: { G: '#e5c14b', K: '#111', W: '#fff', R: '#d9534f' },
	},
	message: {
		rows: [
			'.WWWWWWWWWW.',
			'WWWWWWWWWWWW',
			'WW.WW.WW.WWW',
			'WWWWWWWWWWWW',
			'.WWWWWWWWWW.',
			'..WW........',
			'.W..........',
		], pal: { W: '#9fd8ff' },
	},
	deprecata: {
		rows: [
			'..Y.Y.Y.Y...',
			'..YYYYYYY...',
			'..RRRRRRR...',
			'..PWPPPWP...',
			'..PPPPPPP...',
			'...PPPPP....',
			'..PPPPPPP...',
			'.PPOPPPOPP..',
			'PPPPPPPPPPP.',
		], pal: { Y: '#ffb347', R: '#ff5e7a', P: '#7a4fd6', W: '#fff2c8', O: '#ff8a3d' },
	},
	collector: {
		rows: [
			'.GGGGGGGGGG.',
			'GGGGGGGGGGGG',
			'GG..RRRR..GG',
			'GG..RRRR..GG',
			'GGGGGGGGGGGG',
			'GYGYGYGYGYGG',
			'GGGGGGGGGGGG',
			'.KK......KK.',
		], pal: { G: '#7b6a4e', R: '#ff3b30', Y: '#ffc53d', K: '#222' },
	},
	revert: {
		rows: [
			'...YYYYYY...',
			'..Y......Y..',
			'.Y..WWWW..Y.',
			'.Y.W....W.Y.',
			'.Y.W.WW.W.Y.',
			'.Y..W..W..Y.',
			'..Y......Y..',
			'...YYYYYY...',
			'....KKKK....',
			'..KKKKKKKK..',
		], pal: { Y: '#e8d6a0', W: '#ffffff', K: '#1a1a22' },
	},
	pyra: { rows: ['....R.....', '...ROR....', '..ROYOR...', '..OYWYO...', '...OYO....', '....O.....'], pal: { R: '#ff4b1f', O: '#ff8a2f', Y: '#ffd166', W: '#fff' } },
	glace: { rows: ['....W.....', '.W..C..W..', '..WCCCW...', 'WCCCWCCCW.', '..WCCCW...', '.W..C..W..', '....W.....'], pal: { W: '#e8fbff', C: '#7fe6ff' } },
	arc: { rows: ['.....YY...', '....YY....', '...YYYYY..', '.....YY...', '....YY....', '...Y......'], pal: { Y: '#ffd23f' } },
	mira: { rows: ['..M....M..', '..M....M..', '...M..M...', '....MM....', '....MM....', '....MM....'], pal: { M: '#ff4fd8' } },
	system: { rows: ['WWWW', 'W..W', 'WWWW'], pal: { W: '#888' } },
};
