// Keyboard + mouse + gamepad. Exposes per-frame "pressed" edges and held state for abstract actions.
const BINDINGS = {
	up: ['KeyW', 'ArrowUp'],
	down: ['KeyS', 'ArrowDown'],
	left: ['KeyA', 'ArrowLeft'],
	right: ['KeyD', 'ArrowRight'],
	attack: ['KeyJ', 'Mouse0'],
	special: ['KeyK', 'Mouse2'],
	cast: ['KeyQ', 'KeyL'],
	dash: ['Space', 'ShiftLeft', 'ShiftRight'],
	interact: ['KeyE', 'Enter'],
	pause: ['Escape', 'KeyP'],
	confirm: ['Space', 'Enter', 'KeyE', 'Mouse0'],
	one: ['Digit1'], two: ['Digit2'], three: ['Digit3'],
	boons: ['Tab'],
};

const PAD = { attack: 2, special: 3, cast: 1, dash: 0, interact: 0, confirm: 0, pause: 9, boons: 8, dashAlt: 7, castAlt: 5 };

class Input {
	constructor() {
		this.down = new Set();
		this.pressedSet = new Set();
		this.releasedSet = new Set();
		this.mouse = { x: 0, y: 0, nx: 0, ny: 0, moved: 0 };
		this.usingPad = false;
		this.padPrev = [];
		this.padAxes = [0, 0, 0, 0];
		this.rumbleUntil = 0;
		this.rumbleLevel = 0;
	}

	// Dual-motor haptics on supported gamepads; stronger requests interrupt weaker ones.
	rumble(strong, weak = strong, ms = 120) {
		if (!this.usingPad || strong <= 0.01 || !navigator.getGamepads) return;
		const pad = [...navigator.getGamepads()].find(Boolean);
		const act = pad && pad.vibrationActuator;
		if (!act || !act.playEffect) return;
		const now = performance.now();
		if (now < this.rumbleUntil && strong <= this.rumbleLevel) return;
		this.rumbleUntil = now + ms;
		this.rumbleLevel = strong;
		const c = (v) => Math.max(0, Math.min(1, v));
		act.playEffect('dual-rumble', { startDelay: 0, duration: Math.round(ms), strongMagnitude: c(strong), weakMagnitude: c(weak) }).catch(() => {});
	}

	attach(canvas) {
		window.addEventListener('keydown', (e) => {
			if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
			if (e.repeat) return;
			this._press(e.code);
			this.usingPad = false;
		});
		window.addEventListener('keyup', (e) => this._release(e.code));
		window.addEventListener('blur', () => { for (const c of this.down) this.releasedSet.add(c); this.down.clear(); });
		window.addEventListener('mousemove', (e) => {
			this.mouse.x = e.clientX; this.mouse.y = e.clientY;
			this.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
			this.mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
			this.mouse.moved = performance.now();
			this.usingPad = false;
		});
		canvas.addEventListener('mousedown', (e) => { this._press('Mouse' + e.button); });
		window.addEventListener('mouseup', (e) => this._release('Mouse' + e.button));
		canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	_press(code) { if (!this.down.has(code)) { this.down.add(code); this.pressedSet.add(code); } }
	_release(code) { if (this.down.has(code)) { this.down.delete(code); this.releasedSet.add(code); } }

	pollPad() {
		const pads = navigator.getGamepads ? navigator.getGamepads() : [];
		const p = pads && [...pads].find(Boolean);
		if (!p) return;
		const btn = p.buttons.map((b) => b.pressed);
		for (let i = 0; i < btn.length; i++) {
			const code = 'Pad' + i;
			if (btn[i] && !this.padPrev[i]) { this._press(code); this.usingPad = true; }
			if (!btn[i] && this.padPrev[i]) this._release(code);
		}
		this.padPrev = btn;
		const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
		this.padAxes = [dz(p.axes[0] || 0), dz(p.axes[1] || 0), dz(p.axes[2] || 0), dz(p.axes[3] || 0)];
		if (this.padAxes.some((a) => a !== 0)) this.usingPad = true;
	}

	_codes(action) {
		const c = BINDINGS[action] ? [...BINDINGS[action]] : [];
		if (PAD[action] !== undefined) c.push('Pad' + PAD[action]);
		if (action === 'dash') c.push('Pad' + PAD.dashAlt);
		if (action === 'cast') c.push('Pad' + PAD.castAlt);
		return c;
	}

	held(action) { return this._codes(action).some((c) => this.down.has(c)); }
	pressed(action) { return this._codes(action).some((c) => this.pressedSet.has(c)); }
	released(action) { return this._codes(action).some((c) => this.releasedSet.has(c)); }

	move() {
		let x = 0, z = 0;
		if (this.held('left')) x -= 1;
		if (this.held('right')) x += 1;
		if (this.held('up')) z -= 1;
		if (this.held('down')) z += 1;
		if (this.padAxes[0] || this.padAxes[1]) { x = this.padAxes[0]; z = this.padAxes[1]; }
		const l = Math.hypot(x, z);
		if (l > 1) { x /= l; z /= l; }
		return { x, z };
	}

	padAim() {
		const x = this.padAxes[2], z = this.padAxes[3];
		return Math.hypot(x, z) > 0.3 ? { x, z } : null;
	}

	endFrame() { this.pressedSet.clear(); this.releasedSet.clear(); }
	consume(action) { for (const c of this._codes(action)) this.pressedSet.delete(c); }
}

export const input = new Input();
