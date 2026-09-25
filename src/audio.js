// Fully synthesized audio: no assets. SFX are tiny procedural patches; music is a step sequencer.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const PROGRESSIONS = {
	minor: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
	dark: [[57, 60, 64], [58, 62, 65], [53, 57, 60], [52, 56, 59]], // Am Bb F E
	hope: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]], // C G Am F
	void: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [50, 53, 57]], // Am Em F Dm
};

const MOODS = {
	none: null,
	title: { bpm: 62, prog: 'minor', pad: 1, bell: 0.35, arp: 0, bass: 0, drums: 0 },
	hub: { bpm: 74, prog: 'hope', pad: 0.8, bell: 0.55, arp: 0, bass: 0.5, drums: 0 },
	explore: { bpm: 96, prog: 'minor', pad: 0.9, bell: 0.25, arp: 0, bass: 0.4, drums: 0 },
	combat: { bpm: 108, prog: 'minor', pad: 0.8, bell: 0, arp: 1, bass: 1, drums: 1 },
	combat2: { bpm: 112, prog: 'dark', pad: 0.8, bell: 0, arp: 1, bass: 1, drums: 1 },
	combat3: { bpm: 100, prog: 'void', pad: 1, bell: 0.2, arp: 1, bass: 1, drums: 1 },
	boss: { bpm: 124, prog: 'dark', pad: 1, bell: 0, arp: 1, bass: 1, drums: 2 },
	calm: { bpm: 68, prog: 'hope', pad: 1, bell: 0.6, arp: 0, bass: 0.3, drums: 0 },
	ending: { bpm: 70, prog: 'hope', pad: 1, bell: 0.7, arp: 0.4, bass: 0.6, drums: 0 },
};

class AudioSys {
	constructor() {
		this.ctx = null;
		this.mood = 'none';
		this.pending = null;
		this.step = 0;
		this.bar = 0;
		this.vol = { music: 0.55, sfx: 0.8 };
		this.lastPlay = {};
	}

	init() {
		if (this.ctx) {
			if (this.ctx.state === 'suspended') this.ctx.resume();
			return;
		}
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		const ctx = this.ctx = new AC();
		this.master = ctx.createGain();
		this.master.gain.value = 0.9;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
		this.master.connect(comp).connect(ctx.destination);
		this.sfx = ctx.createGain();
		this.sfx.connect(this.master);
		this.music = ctx.createGain();
		this.music.connect(this.master);
		this.musicBus = ctx.createGain();
		this.musicBus.connect(this.music);
		// reverb
		this.reverb = ctx.createConvolver();
		this.reverb.buffer = this._impulse(2.6, 2.2);
		this.reverbGain = ctx.createGain();
		this.reverbGain.gain.value = 0.32;
		this.reverb.connect(this.reverbGain).connect(this.master);
		// white noise buffer
		const len = ctx.sampleRate * 2;
		this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = this.noise.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		this.setVolumes(this.vol.music, this.vol.sfx);
		this.nextTime = ctx.currentTime + 0.1;
		this.timer = setInterval(() => this._schedule(), 25);
	}

	_impulse(seconds, decay) {
		const ctx = this.ctx, rate = ctx.sampleRate, len = rate * seconds;
		const buf = ctx.createBuffer(2, len, rate);
		for (let c = 0; c < 2; c++) {
			const d = buf.getChannelData(c);
			for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
		}
		return buf;
	}

	setVolumes(music, sfx) {
		this.vol.music = music; this.vol.sfx = sfx;
		if (!this.ctx) return;
		this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1);
		this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
	}

	// ---------- primitives ----------
	tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, attack = 0.005, when = 0, dest = null, detune = 0, send = 0, curve = 'exp', filter = null }) {
		const ctx = this.ctx; if (!ctx) return;
		const t = ctx.currentTime + when;
		const o = ctx.createOscillator();
		o.type = type;
		o.detune.value = detune;
		o.frequency.setValueAtTime(f0, t);
		if (f1 !== null) {
			if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
			else o.frequency.linearRampToValueAtTime(f1, t + dur);
		}
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		let node = o;
		if (filter) {
			const f = ctx.createBiquadFilter();
			f.type = filter.type || 'lowpass';
			f.frequency.value = filter.f || 2000;
			f.Q.value = filter.q || 0.7;
			o.connect(f); node = f;
		}
		node.connect(g);
		g.connect(dest || this.sfx);
		if (send) {
			const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.reverb);
		}
		o.start(t); o.stop(t + dur + 0.05);
	}

	noiseBurst({ dur = 0.2, vol = 0.3, f0 = 1000, f1 = null, q = 1, type = 'bandpass', when = 0, attack = 0.004, dest = null, send = 0 }) {
		const ctx = this.ctx; if (!ctx) return;
		const t = ctx.currentTime + when;
		const s = ctx.createBufferSource();
		s.buffer = this.noise;
		s.playbackRate.value = 0.8 + Math.random() * 0.4;
		const f = ctx.createBiquadFilter();
		f.type = type; f.Q.value = q;
		f.frequency.setValueAtTime(f0, t);
		if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		s.connect(f).connect(g).connect(dest || this.sfx);
		if (send) {
			const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(this.reverb);
		}
		s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
	}

	// ---------- sfx ----------
	play(name, opts = {}) {
		if (!this.ctx) return;
		const p = opts.pitch ?? (0.94 + Math.random() * 0.12);
		const v = opts.vol ?? 1;
		// rate-limit identical sounds so crowds don't clip
		const now = this.ctx.currentTime;
		if (this.lastPlay[name] && now - this.lastPlay[name] < 0.025) return;
		this.lastPlay[name] = now;
		switch (name) {
			case 'swing':
				this.noiseBurst({ dur: 0.16, vol: 0.22 * v, f0: 900 * p, f1: 3200 * p, q: 1.4, attack: 0.02 });
				break;
			case 'swing3':
				this.noiseBurst({ dur: 0.24, vol: 0.3 * v, f0: 600 * p, f1: 4200 * p, q: 1.2, attack: 0.03 });
				this.tone({ type: 'triangle', f0: 300 * p, f1: 900 * p, dur: 0.18, vol: 0.06 * v });
				break;
			case 'hit':
				this.tone({ type: 'sine', f0: 190 * p, f1: 60, dur: 0.14, vol: 0.45 * v });
				this.noiseBurst({ dur: 0.06, vol: 0.25 * v, f0: 2500 * p, q: 0.8, type: 'highpass' });
				break;
			case 'crit':
				this.tone({ type: 'square', f0: 880 * p, f1: 1760 * p, dur: 0.12, vol: 0.08 * v, filter: { f: 3000 } });
				this.tone({ type: 'sine', f0: 140 * p, f1: 40, dur: 0.22, vol: 0.5 * v });
				break;
			case 'kill':
				this.tone({ type: 'square', f0: 520 * p, f1: 90, dur: 0.22, vol: 0.09 * v, filter: { f: 1800 } });
				this.noiseBurst({ dur: 0.25, vol: 0.22 * v, f0: 1400, f1: 200, q: 0.9, send: 0.2 });
				break;
			case 'dash':
				this.noiseBurst({ dur: 0.2, vol: 0.2 * v, f0: 3000 * p, f1: 600, q: 0.6, attack: 0.01 });
				this.tone({ type: 'sine', f0: 700 * p, f1: 1200 * p, dur: 0.1, vol: 0.05 * v });
				break;
			case 'star':
				this.tone({ type: 'triangle', f0: 1300 * p, f1: 2400 * p, dur: 0.12, vol: 0.12 * v, send: 0.2 });
				this.tone({ type: 'sine', f0: 1950 * p, dur: 0.2, vol: 0.06 * v, when: 0.03, send: 0.3 });
				break;
			case 'cast':
				this.tone({ type: 'sawtooth', f0: 220 * p, f1: 110 * p, dur: 0.5, vol: 0.08 * v, filter: { f: 1200, q: 4 }, send: 0.4 });
				this.tone({ type: 'sine', f0: 660 * p, f1: 880 * p, dur: 0.4, vol: 0.1 * v, send: 0.5 });
				break;
			case 'spin':
				this.noiseBurst({ dur: 0.45, vol: 0.3 * v, f0: 400, f1: 3000, q: 2, attack: 0.05 });
				this.tone({ type: 'triangle', f0: 200 * p, f1: 800 * p, dur: 0.4, vol: 0.1 * v, send: 0.3 });
				break;
			case 'hurt':
				this.tone({ type: 'sawtooth', f0: 240, f1: 70, dur: 0.3, vol: 0.18 * v, filter: { f: 900 } });
				this.noiseBurst({ dur: 0.15, vol: 0.3 * v, f0: 500, q: 0.7, type: 'lowpass' });
				break;
			case 'pickup':
				[0, 4, 7, 12].forEach((s, i) => this.tone({ type: 'triangle', f0: midi(76 + s), dur: 0.25, vol: 0.09 * v, when: i * 0.055, send: 0.3 }));
				break;
			case 'boon':
				[57, 64, 69, 72, 76].forEach((n, i) => {
					this.tone({ type: 'sawtooth', f0: midi(n), dur: 1.6, vol: 0.035 * v, attack: 0.2, when: i * 0.04, filter: { f: 1800 }, send: 0.6, detune: -8 });
					this.tone({ type: 'sawtooth', f0: midi(n), dur: 1.6, vol: 0.035 * v, attack: 0.2, when: i * 0.04, filter: { f: 1800 }, send: 0.6, detune: 8 });
				});
				this.tone({ type: 'sine', f0: midi(88), dur: 1.2, vol: 0.05 * v, when: 0.25, send: 0.8 });
				break;
			case 'select':
				[0, 7, 12, 16].forEach((s, i) => this.tone({ type: 'triangle', f0: midi(69 + s), dur: 0.5, vol: 0.1 * v, when: i * 0.06, send: 0.5 }));
				break;
			case 'door':
				this.tone({ type: 'sine', f0: 90, f1: 45, dur: 0.8, vol: 0.3 * v, send: 0.4 });
				this.noiseBurst({ dur: 0.8, vol: 0.12 * v, f0: 300, f1: 80, q: 1, type: 'lowpass', send: 0.4 });
				break;
			case 'unlock':
				[64, 67, 71, 76].forEach((n, i) => this.tone({ type: 'sine', f0: midi(n), dur: 0.9, vol: 0.09 * v, when: i * 0.09, send: 0.6 }));
				break;
			case 'clear':
				[69, 73, 76, 81].forEach((n, i) => this.tone({ type: 'triangle', f0: midi(n), dur: 1.2, vol: 0.08 * v, when: i * 0.08, send: 0.7 }));
				break;
			case 'explode':
				this.tone({ type: 'sine', f0: 120, f1: 30, dur: 0.6, vol: 0.6 * v });
				this.noiseBurst({ dur: 0.7, vol: 0.4 * v, f0: 2000, f1: 100, q: 0.5, type: 'lowpass', send: 0.3 });
				break;
			case 'zap':
				this.tone({ type: 'sawtooth', f0: 1800 * p, f1: 300, dur: 0.12, vol: 0.07 * v, filter: { f: 5000 } });
				this.noiseBurst({ dur: 0.1, vol: 0.14 * v, f0: 5000, q: 0.5, type: 'highpass' });
				break;
			case 'burn':
				this.noiseBurst({ dur: 0.35, vol: 0.16 * v, f0: 700, f1: 2400, q: 0.6, attack: 0.03 });
				break;
			case 'freeze':
				this.tone({ type: 'sine', f0: 2600 * p, f1: 1800 * p, dur: 0.3, vol: 0.06 * v, send: 0.5 });
				this.noiseBurst({ dur: 0.2, vol: 0.12 * v, f0: 6000, q: 2, type: 'bandpass' });
				break;
			case 'conflict':
				this.tone({ type: 'square', f0: 330 * p, dur: 0.14, vol: 0.06 * v, filter: { f: 2000 } });
				this.tone({ type: 'square', f0: 349 * p, dur: 0.14, vol: 0.06 * v, filter: { f: 2000 } });
				this.tone({ type: 'sine', f0: 160, f1: 50, dur: 0.3, vol: 0.4 * v });
				break;
			case 'ui':
				this.tone({ type: 'triangle', f0: 880 * p, dur: 0.07, vol: 0.07 * v });
				break;
			case 'hover':
				this.tone({ type: 'sine', f0: 1320 * p, dur: 0.04, vol: 0.03 * v });
				break;
			case 'blip':
				this.tone({ type: 'square', f0: (opts.freq || 520) * p, dur: 0.035, vol: 0.025 * v, filter: { f: 2200 } });
				break;
			case 'heal':
				[72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'sine', f0: midi(n), dur: 0.6, vol: 0.08 * v, when: i * 0.07, send: 0.5 }));
				break;
			case 'shoot':
				this.tone({ type: 'sine', f0: 600 * p, f1: 220 * p, dur: 0.15, vol: 0.1 * v });
				break;
			case 'telegraph':
				this.tone({ type: 'sawtooth', f0: 180 * p, f1: 360 * p, dur: 0.35, vol: 0.05 * v, filter: { f: 1400 } });
				break;
			case 'spawn':
				this.tone({ type: 'sine', f0: 200 * p, f1: 800 * p, dur: 0.4, vol: 0.06 * v, send: 0.4 });
				break;
			case 'land':
				this.tone({ type: 'sine', f0: 110 * p, f1: 50, dur: 0.12, vol: 0.2 * v });
				break;
			case 'roar':
				this.tone({ type: 'sawtooth', f0: 90, f1: 55, dur: 1.4, vol: 0.2 * v, filter: { f: 600, q: 3 }, send: 0.5 });
				this.tone({ type: 'sawtooth', f0: 92, f1: 54, dur: 1.4, vol: 0.2 * v, filter: { f: 600, q: 3 }, send: 0.5 });
				this.noiseBurst({ dur: 1.4, vol: 0.2 * v, f0: 300, f1: 900, q: 1, send: 0.4 });
				break;
			case 'rewind':
				this.tone({ type: 'sawtooth', f0: 1200, f1: 120, dur: 1.2, vol: 0.08 * v, filter: { f: 2500, q: 6 }, send: 0.6, curve: 'lin' });
				this.tone({ type: 'sine', f0: 60, f1: 40, dur: 1.2, vol: 0.3 * v });
				break;
			case 'respawn':
				[60, 64, 67, 72, 76, 79].forEach((n, i) => this.tone({ type: 'triangle', f0: midi(n), dur: 0.6, vol: 0.08 * v, when: i * 0.05, send: 0.5 }));
				break;
			case 'death':
				[64, 60, 57, 52].forEach((n, i) => this.tone({ type: 'triangle', f0: midi(n), dur: 0.6, vol: 0.1 * v, when: i * 0.14, send: 0.6 }));
				break;
			case 'heartbeat':
				this.tone({ type: 'sine', f0: 70, f1: 40, dur: 0.15, vol: 0.25 * v });
				this.tone({ type: 'sine', f0: 70, f1: 40, dur: 0.15, vol: 0.18 * v, when: 0.18 });
				break;
		}
	}

	// ---------- music ----------
	setMood(name) {
		if (!MOODS[name] && name !== 'none') return;
		if (name === this.mood && !this.pending) return;
		this.pending = name;
		if (!this.ctx) { this.mood = name; this.pending = null; return; }
		const t = this.ctx.currentTime;
		this.musicBus.gain.cancelScheduledValues(t);
		this.musicBus.gain.setTargetAtTime(0.0001, t, 0.25);
		clearTimeout(this._swap);
		this._swap = setTimeout(() => {
			this.mood = this.pending; this.pending = null;
			this.step = 0; this.bar = 0;
			this.nextTime = this.ctx.currentTime + 0.05;
			this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
			this.musicBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.6);
		}, 700);
	}

	_schedule() {
		const ctx = this.ctx;
		if (!ctx) return;
		const m = MOODS[this.mood];
		if (!m) { this.nextTime = ctx.currentTime + 0.05; return; }
		const stepDur = 60 / m.bpm / 4;
		while (this.nextTime < ctx.currentTime + 0.15) {
			this._playStep(m, this.step, this.nextTime - ctx.currentTime, stepDur);
			this.nextTime += stepDur;
			this.step++;
			if (this.step >= 16) { this.step = 0; this.bar++; }
		}
	}

	_playStep(m, step, when, stepDur) {
		const prog = PROGRESSIONS[m.prog];
		const chord = prog[this.bar % prog.length];
		const bus = this.musicBus;
		const barDur = stepDur * 16;
		if (step === 0 && m.pad) {
			for (const n of chord) {
				for (const det of [-7, 7]) {
					this.tone({ type: 'sawtooth', f0: midi(n), dur: barDur * 1.15, vol: 0.022 * m.pad, attack: barDur * 0.3, when, dest: bus, detune: det, filter: { f: 700 + 300 * Math.sin(this.bar), q: 0.8 }, send: 0.35 });
				}
			}
			this.tone({ type: 'sine', f0: midi(chord[0] - 12), dur: barDur, vol: 0.05 * m.pad, attack: barDur * 0.25, when, dest: bus });
		}
		if (m.bass && (step === 0 || step === 6 || step === 8 || (m.drums && step === 14))) {
			this.tone({ type: 'triangle', f0: midi(chord[0] - 24), dur: stepDur * 3, vol: 0.16 * m.bass, when, dest: bus, filter: { f: 500 } });
		}
		if (m.arp) {
			const seq = [0, 1, 2, 1, 0, 2, 1, 2];
			const n = chord[seq[step % 8]] + (step >= 8 ? 12 : 0);
			this.tone({ type: 'triangle', f0: midi(n), dur: stepDur * 1.6, vol: 0.045 * m.arp, when, dest: bus, filter: { f: 2400 }, send: 0.15 });
		}
		if (m.bell && [0, 3, 6, 10, 12, 14].includes(step) && Math.random() < m.bell) {
			const n = chord[Math.floor(Math.random() * 3)] + 12 + (Math.random() < 0.3 ? 12 : 0);
			this.tone({ type: 'sine', f0: midi(n), dur: 1.4, vol: 0.05, when, dest: bus, send: 0.6 });
			this.tone({ type: 'sine', f0: midi(n) * 3, dur: 0.4, vol: 0.008, when, dest: bus, send: 0.6 });
		}
		if (m.drums) {
			if (step % 8 === 0 || (m.drums > 1 && step === 10)) {
				this.tone({ type: 'sine', f0: 130, f1: 42, dur: 0.28, vol: 0.4, when, dest: bus });
			}
			if (step === 4 || step === 12) {
				this.noiseBurst({ dur: 0.16, vol: 0.12, f0: 1800, q: 0.8, when, dest: bus, send: 0.2 });
				this.tone({ type: 'triangle', f0: 190, f1: 120, dur: 0.1, vol: 0.08, when, dest: bus });
			}
			if (step % 2 === 1 || m.drums > 1) {
				this.noiseBurst({ dur: 0.035, vol: step % 4 === 2 ? 0.05 : 0.03, f0: 8000, q: 0.5, type: 'highpass', when, dest: bus });
			}
		}
	}
}

export const audio = new AudioSys();
