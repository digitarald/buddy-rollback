import { G, writeSave } from './state.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { pixelSVG, PORTRAITS, BUDDY_PAL, BUDDY_PAL_INSIDERS } from './textures.js';
import { SPEAKERS, ACHIEVEMENTS } from './story.js';
import { KEEPERS, BOON_BY_ID, RARITY, SLOT_LABEL, boonPower } from './boons.js';
import { HATS, HEART_ROWS } from './models.js';
import { worldToScreen } from './fx.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const EMOTE_ICONS = {
	love: pixelSVG(HEART_ROWS, { '#': '#e8334a' }, 5),
	worry: pixelSVG(['.##.', '.##.', '.##.', '.##.', '....', '.##.'], { '#': '#ffd23f' }, 5),
	cool: pixelSVG(['###########', '####.#.####', '.###...###.', '..#.....#..'], { '#': '#111', '.': 'transparent' }, 4).replace(/fill="transparent"/g, 'fill="none"'),
};
const EMOTE_LABEL = { love: 'Love', worry: 'Worry', cool: 'Cool' };

function portraitHTML(key, scale = 8) {
	if (!key) return '';
	const p = PORTRAITS[key];
	if (!p) return '';
	const pal = key === 'buddy' && G.save?.settings.variant === 'insiders' ? BUDDY_PAL_INSIDERS : p.pal;
	return pixelSVG(p.rows, pal, scale);
}

// Reveal HTML progressively without breaking tags.
function sliceHTML(html, n) {
	let out = '', count = 0, i = 0;
	while (i < html.length && count < n) {
		const ch = html[i];
		if (ch === '<') { const j = html.indexOf('>', i); out += html.slice(i, j + 1); i = j + 1; continue; }
		if (ch === '&') { const j = html.indexOf(';', i); out += html.slice(i, j + 1); i = j + 1; count++; continue; }
		out += ch; i++; count++;
	}
	// include trailing tags (closers)
	while (i < html.length && html[i] === '<') { const j = html.indexOf('>', i); out += html.slice(i, j + 1); i = j + 1; }
	return out;
}
function visibleLength(html) {
	return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, 'x').length;
}

export const UI = {
	hudCache: {},
	init() {
		this.el = {
			hud: $('hud'), hpFill: $('hp-fill'), hpGhost: $('hp-ghost'), hpText: $('hp-text'), mpFill: $('mp-fill'), mpText: $('mp-text'),
			dash: $('dash-pips'), cast: $('cast-pip'), stars: $('stars'), boons: $('boon-icons'), loc: $('loc'),
			boss: $('bossbar'), bossName: $('boss-name'), bossTitle: $('boss-title'), bossFill: $('boss-fill'), bossGhost: $('boss-ghost'), bossNote: $('boss-note'),
			banner: $('banner'), toast: $('toast'), barks: $('barks'), prompt: $('prompt'), reticle: $('reticle'),
			dialog: $('dialog'), dPortrait: $('d-portrait'), dName: $('d-name'), dText: $('d-text'), dChoices: $('d-choices'), dNext: $('d-next'),
			fade: $('fade'), letterbox: $('letterbox'), narration: $('narration'), bosscard: $('bosscard'), boonList: $('boon-list'),
		};
		this.hpGhost = 1; this.bossGhostV = 1;
		this.refreshPortrait();
		document.addEventListener('mousemove', (e) => {
			this.el.reticle.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
		});
	},

	// ---------------- HUD ----------------
	refreshPortrait() { $('hud-portrait').innerHTML = portraitHTML('buddy'); },
	showHUD(v) { this.el.hud.classList.toggle('show', v); },

	updateHUD(dt) {
		const P = G.player;
		if (!P) return;
		const c = this.hudCache;
		const hpK = Math.max(0, P.hp / P.maxHp);
		if (c.hp !== P.hp || c.maxHp !== P.maxHp) {
			c.hp = P.hp; c.maxHp = P.maxHp;
			this.el.hpFill.style.transform = `scaleX(${hpK})`;
			this.el.hpText.textContent = `${Math.max(0, Math.ceil(P.hp))} / ${P.maxHp}`;
			this.el.hud.classList.toggle('low', hpK < 0.3);
		}
		this.hpGhost += (hpK - this.hpGhost) * Math.min(1, dt * (this.hpGhost > hpK ? 2.5 : 20));
		this.el.hpGhost.style.transform = `scaleX(${this.hpGhost})`;
		const mp = Math.floor(P.mp);
		if (c.mp !== mp || c.maxMp !== P.maxMp) {
			c.mp = mp; c.maxMp = P.maxMp;
			this.el.mpFill.style.transform = `scaleX(${P.mp / P.maxMp})`;
			this.el.mpText.textContent = `${mp}`;
			this.el.mpFill.classList.toggle('ready', P.mp >= 30);
		}
		const dkey = P.dashCharges + '/' + P.dashMax;
		if (c.dash !== dkey) {
			c.dash = dkey;
			this.el.dash.innerHTML = Array.from({ length: P.dashMax }, (_, i) => `<i class="${i < P.dashCharges ? 'on' : ''}"></i>`).join('');
		}
		const castK = P.castCharges > 0 ? 1 : 1 - Math.max(0, P.castCd) / 6;
		this.el.cast.style.setProperty('--k', castK);
		this.el.cast.classList.toggle('ready', P.castCharges > 0);
		if (c.stars !== G.save.stars) { c.stars = G.save.stars; this.el.stars.textContent = G.save.stars; }
		const bkey = P.boonList().map((b) => b.id + b.rarity + b.level).join(',');
		if (c.boons !== bkey) {
			c.boons = bkey;
			this.el.boons.innerHTML = P.boonList().map((b) => {
				const def = BOON_BY_ID[b.id];
				const k = KEEPERS[def.keeper];
				return `<div class="bicon" style="--c:${k.css};--r:${RARITY[b.rarity].css}" title="${def.name}"><span>${SLOT_LABEL[def.slot][0]}</span>${b.level > 1 ? `<em>${b.level}</em>` : ''}</div>`;
			}).join('');
			this.renderBoonList();
		}
		// boss bar
		const B = G.boss;
		if (B && B.state === 'fight' && (B.alive || B.deathT < 1.5)) {
			this.el.boss.classList.add('show');
			if (c.bossName !== B.name) { c.bossName = B.name; this.el.bossName.textContent = B.name; this.el.bossTitle.textContent = B.title; }
			const k = Math.max(0, B.hp / B.maxHp);
			this.el.bossFill.style.transform = `scaleX(${k})`;
			this.bossGhostV += (k - this.bossGhostV) * Math.min(1, dt * (this.bossGhostV > k ? 2 : 20));
			this.el.bossGhost.style.transform = `scaleX(${this.bossGhostV})`;
			this.el.boss.classList.toggle('invuln', !!B.invuln);
			this.el.bossNote.textContent = B.rewindTimer > 0 ? `REWIND IN ${B.rewindTimer.toFixed(1)}s — BREAK THE COMMITS` : B.vulnerable ? 'EXPOSED' : '';
		} else this.el.boss.classList.remove('show');
		// boon list overlay
		this.el.boonList.classList.toggle('show', input.held('boons') && G.mode !== 'title');
		this.el.reticle.classList.toggle('show', G.mode === 'run' && !G.modal && !input.usingPad);
	},

	renderBoonList() {
		const P = G.player;
		const list = P.boonList();
		this.el.boonList.innerHTML = '<h3>Boons <small>(hold Tab)</small></h3>' + (list.length ? list.map((b) => {
			const def = BOON_BY_ID[b.id];
			const k = KEEPERS[def.keeper];
			return `<div class="bl-row" style="--c:${k.css};--r:${RARITY[b.rarity].css}"><div class="bl-name">${def.name} <span class="lvl">${b.level > 1 ? 'Lv.' + b.level : ''}</span><span class="tag">${SLOT_LABEL[def.slot]} · ${RARITY[b.rarity].name}</span></div><div class="bl-desc">${def.desc(boonPower(b))}</div></div>`;
		}).join('') : '<p class="empty">No boons yet. Find the Keepers below.</p>');
	},

	setLocation(text) { this.el.loc.textContent = text; },

	banner(title, sub, color = '#fff') {
		const b = this.el.banner;
		b.innerHTML = `<div class="b-title" style="color:${color}">${title}</div><div class="b-sub">${sub || ''}</div>`;
		b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
		clearTimeout(this._bannerT);
		this._bannerT = setTimeout(() => b.classList.remove('show'), 3200);
	},

	toast(text, color = '#fff') {
		const t = this.el.toast;
		t.innerHTML = text; t.style.color = color;
		t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
		clearTimeout(this._toastT);
		this._toastT = setTimeout(() => t.classList.remove('show'), 2800);
	},

	bark(text, name, color) {
		const d = document.createElement('div');
		d.className = 'bark';
		d.innerHTML = `<b style="color:${color}">${name}</b> ${text}`;
		this.el.barks.appendChild(d);
		while (this.el.barks.children.length > 2) this.el.barks.firstChild.remove();
		setTimeout(() => d.classList.add('out'), 3200);
		setTimeout(() => d.remove(), 3800);
	},

	prompt(text, pos) {
		const p = this.el.prompt;
		if (!text) { p.classList.remove('show'); return; }
		const s = worldToScreen(pos.x, pos.y ?? 2.6, pos.z);
		p.innerHTML = text;
		p.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
		p.classList.add('show');
	},

	async fadeOut(ms = 400, color = '#000') {
		this.el.fade.style.background = color;
		this.el.fade.style.transitionDuration = ms + 'ms';
		this.el.fade.classList.add('show');
		await wait(ms);
	},
	async fadeIn(ms = 500) {
		this.el.fade.style.transitionDuration = ms + 'ms';
		this.el.fade.classList.remove('show');
		await wait(ms);
	},

	letterbox(v) { this.el.letterbox.classList.toggle('show', v); },

	async bossCard(name, title, color) {
		const c = this.el.bosscard;
		c.innerHTML = `<div class="bc-name" style="color:${color}">${name}</div><div class="bc-title">${title}</div>`;
		c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
		await wait(2400);
		c.classList.remove('show');
	},

	// ---------------- dialogue ----------------
	dialog(lines) {
		return new Promise((resolve) => {
			const prevModal = G.modal;
			G.modal = 'dialog';
			const el = this.el;
			el.dialog.classList.add('show');
			const queue = [...lines];
			let typing = null;

			const finish = () => {
				el.dialog.classList.remove('show');
				G.modal = prevModal === 'dialog' ? null : prevModal;
				cleanup();
				writeSave();
				input.endFrame();
				resolve();
			};

			const showLine = () => {
				el.dChoices.innerHTML = '';
				el.dChoices.classList.remove('show');
				if (!queue.length) return finish();
				const line = queue.shift();
				if (line.choice) {
					if (!line.choice.length) return showLine();
					showChoice(line);
					return;
				}
				const sp = SPEAKERS[line.s] || SPEAKERS.narrator;
				el.dialog.dataset.speaker = line.s;
				el.dPortrait.innerHTML = portraitHTML(sp.portrait);
				el.dPortrait.style.display = sp.portrait ? '' : 'none';
				el.dName.textContent = sp.name;
				el.dName.style.color = sp.color;
				el.dName.style.display = sp.name ? '' : 'none';
				el.dialog.style.setProperty('--accent', sp.color);
				if (line.emote) {
					el.dText.innerHTML = `<div class="emote-line">${EMOTE_ICONS[line.emote] || ''}</div>`;
					G.player?.emote(line.emote === 'dots' ? 'dots' : line.emote);
					el.dNext.classList.add('show');
					typing = null;
					return;
				}
				const html = line.t;
				if (line.instant) {
					el.dText.innerHTML = html;
					typing = null;
					el.dNext.classList.add('show');
					return;
				}
				const total = visibleLength(html);
				let shown = 0;
				el.dNext.classList.remove('show');
				typing = { html, total, done: false };
				const speed = 55; // chars / sec
				let last = performance.now();
				let acc = 0;
				const step = (now) => {
					if (!typing || typing.html !== html) return;
					acc += (now - last) / 1000 * speed;
					last = now;
					const n = Math.floor(acc);
					if (n > shown) {
						shown = Math.min(total, n);
						el.dText.innerHTML = sliceHTML(html, shown);
						if (shown % 2 === 0) audio.play('blip', { freq: sp.blip || 500, pitch: 0.9 + Math.random() * 0.2 });
					}
					if (shown >= total) { typing.done = true; el.dNext.classList.add('show'); return; }
					requestAnimationFrame(step);
				};
				el.dText.innerHTML = '';
				requestAnimationFrame(step);
			};

			const showChoice = (line) => {
				el.dNext.classList.remove('show');
				el.dChoices.innerHTML = '<div class="c-hint">Buddy responds…</div>' + line.choice.map((c, i) => `<button class="emote-btn" data-i="${i}">${EMOTE_ICONS[c.e]}<span>${i + 1}. ${EMOTE_LABEL[c.e]}</span></button>`).join('');
				el.dChoices.classList.add('show');
				this._choice = (i) => {
					const c = line.choice[i];
					if (!c) return;
					this._choice = null;
					audio.play('select');
					G.player?.emote(c.e);
					queue.unshift(...c.then);
					el.dPortrait.innerHTML = portraitHTML('buddy');
					el.dName.textContent = 'Buddy'; el.dName.style.color = '#4cc3ff';
					el.dText.innerHTML = `<div class="emote-line">${EMOTE_ICONS[c.e]}</div>`;
					el.dChoices.classList.remove('show');
					setTimeout(showLine, 650);
				};
				el.dChoices.querySelectorAll('button').forEach((b) => {
					b.onclick = (ev) => { ev.stopPropagation(); this._choice && this._choice(+b.dataset.i); };
					b.onmouseenter = () => audio.play('hover');
				});
			};

			const advance = () => {
				if (this._choice) return;
				if (typing && !typing.done) {
					typing.done = true;
					el.dText.innerHTML = typing.html;
					el.dNext.classList.add('show');
					typing = null;
					return;
				}
				audio.play('ui', { vol: 0.5 });
				showLine();
			};

			const onKey = (e) => {
				if (this._choice) {
					if (e.code === 'Digit1') this._choice(0);
					if (e.code === 'Digit2') this._choice(1);
					if (e.code === 'Digit3') this._choice(2);
					return;
				}
				if (['Space', 'Enter', 'KeyE', 'KeyJ'].includes(e.code)) { e.preventDefault(); advance(); }
			};
			const onClick = (e) => { if (e.target.closest('.emote-btn')) return; advance(); };
			const onPad = setInterval(() => {
				if (input.pressed('confirm') && input.usingPad) advance();
			}, 50);
			window.addEventListener('keydown', onKey);
			el.dialog.addEventListener('click', onClick);
			const cleanup = () => { window.removeEventListener('keydown', onKey); el.dialog.removeEventListener('click', onClick); clearInterval(onPad); this._choice = null; };
			showLine();
		});
	},

	// ---------------- narration ----------------
	narrate(lines, { hold = false } = {}) {
		return new Promise((resolve) => {
			const n = this.el.narration;
			n.classList.add('show');
			n.innerHTML = '<div class="n-line"></div><div class="n-hint">click or press Space</div>';
			const lineEl = n.querySelector('.n-line');
			let i = 0;
			let ready = false;
			const show = async () => {
				if (i >= lines.length) {
					cleanup();
					input.endFrame();
					if (!hold) n.classList.remove('show');
					setTimeout(resolve, hold ? 0 : 600);
					return;
				}
				ready = false;
				lineEl.classList.remove('in');
				await wait(350);
				lineEl.innerHTML = lines[i].replace(/\n/g, '<br>');
				void lineEl.offsetWidth;
				lineEl.classList.add('in');
				audio.play('blip', { freq: 700, vol: 1.5 });
				i++;
				await wait(500);
				ready = true;
			};
			const next = () => { if (ready) show(); };
			const onKey = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); next(); } };
			n.addEventListener('click', next);
			window.addEventListener('keydown', onKey);
			const cleanup = () => { n.removeEventListener('click', next); window.removeEventListener('keydown', onKey); };
			show();
		});
	},
	hideNarration() { this.el.narration.classList.remove('show'); },

	// ---------------- boon choice ----------------
	chooseBoon(keeperId, offers, quote) {
		return new Promise((resolve) => {
			G.modal = 'boon';
			const k = KEEPERS[keeperId];
			const scr = $('boon-screen');
			scr.style.setProperty('--c', k.css);
			scr.innerHTML = `
				<div class="bs-head">
					<div class="bs-portrait">${portraitHTML(keeperId, 10)}</div>
					<div><div class="bs-name" style="color:${k.css}">${k.name}</div><div class="bs-title">${k.title}</div><div class="bs-quote">“${quote.replace(/\n/g, '<br>')}”</div></div>
				</div>
				<div class="bs-cards">${offers.map((o, i) => {
					const def = BOON_BY_ID[o.id];
					const r = RARITY[o.rarity];
					return `<button class="card" data-i="${i}" style="--r:${r.css};--d:${i * 90}ms">
						<div class="card-top"><span class="slot">${SLOT_LABEL[def.slot]}</span><span class="rarity">${r.name}</span></div>
						<div class="card-name">${def.name}</div>
						<div class="card-desc">${def.desc(r.mul)}</div>
						${o.replaces ? `<div class="card-rep">Replaces <b>${o.replaces.name}</b></div>` : ''}
						<div class="card-key">${i + 1}</div>
					</button>`;
				}).join('')}</div>`;
			scr.classList.add('show');
			audio.play('boon');
			let done = false;
			const pickI = (i) => {
				if (done || !offers[i]) return;
				done = true;
				audio.play('select');
				const card = scr.querySelectorAll('.card')[i];
				card.classList.add('picked');
				setTimeout(() => {
					scr.classList.remove('show');
					G.modal = null;
					cleanup();
					input.endFrame();
					resolve(offers[i]);
				}, 450);
			};
			scr.querySelectorAll('.card').forEach((c) => {
				c.onclick = () => pickI(+c.dataset.i);
				c.onmouseenter = () => audio.play('hover');
			});
			let sel = 0;
			const onKey = (e) => {
				if (e.code === 'Digit1') pickI(0);
				if (e.code === 'Digit2') pickI(1);
				if (e.code === 'Digit3') pickI(2);
			};
			const padT = setInterval(() => {
				if (!input.usingPad) return;
				const mv = input.move();
				const cards = scr.querySelectorAll('.card');
				if (Math.abs(mv.x) > 0.6 && !this._padLock) { sel = (sel + (mv.x > 0 ? 1 : -1) + cards.length) % cards.length; this._padLock = true; audio.play('hover'); }
				if (Math.abs(mv.x) < 0.3) this._padLock = false;
				cards.forEach((c, i) => c.classList.toggle('focus', i === sel));
				if (input.pressed('confirm')) pickI(sel);
			}, 50);
			window.addEventListener('keydown', onKey);
			const cleanup = () => { window.removeEventListener('keydown', onKey); clearInterval(padT); };
		});
	},

	// ---------------- achievements board ----------------
	openBoard(onBuy) {
		return new Promise((resolve) => {
			G.modal = 'board';
			const scr = $('board-screen');
			const render = () => {
				const s = G.save;
				scr.innerHTML = `
					<div class="panel">
						<div class="panel-head"><h2>Achievement Board</h2><div class="stars-pill">${s.stars}</div></div>
						<p class="panel-sub">Trade Stars for Achievements the Maintainer never unlocked. Each grants a permanent boon — and a hat.</p>
						<div class="ach-grid">${ACHIEVEMENTS.map((a) => {
							const owned = s.unlocks.includes(a.id);
							const afford = s.stars >= a.cost;
							return `<div class="ach ${owned ? 'owned' : afford ? 'afford' : 'locked'}">
								<div class="ach-title">${a.title}</div>
								<div class="ach-desc">${a.desc}</div>
								<div class="ach-hat">🎩 ${HATS[a.hat].name}</div>
								<button data-id="${a.id}" ${owned || !afford ? 'disabled' : ''}>${owned ? 'Unlocked ✓' : `★ ${a.cost}`}</button>
							</div>`;
						}).join('')}</div>
						<button class="close">Close (Esc)</button>
					</div>`;
				scr.querySelectorAll('.ach button').forEach((b) => {
					b.onclick = () => {
						const a = ACHIEVEMENTS.find((x) => x.id === b.dataset.id);
						if (!a || s.stars < a.cost || s.unlocks.includes(a.id)) return;
						s.stars -= a.cost;
						s.unlocks.push(a.id);
						s.hat = a.hat;
						writeSave();
						audio.play('unlock');
						onBuy?.(a);
						render();
					};
					b.onmouseenter = () => audio.play('hover');
				});
				scr.querySelector('.close').onclick = close;
			};
			const close = () => { scr.classList.remove('show'); G.modal = null; window.removeEventListener('keydown', onKey); input.endFrame(); resolve(); };
			const onKey = (e) => { if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); close(); } };
			window.addEventListener('keydown', onKey);
			render();
			scr.classList.add('show');
		});
	},

	openWardrobe(onPick) {
		return new Promise((resolve) => {
			G.modal = 'wardrobe';
			const scr = $('wardrobe-screen');
			const render = () => {
				const s = G.save;
				const owned = ACHIEVEMENTS.filter((a) => s.unlocks.includes(a.id)).map((a) => a.hat);
				if (s.wins > 0) owned.push('party');
				scr.innerHTML = `
					<div class="panel small">
						<div class="panel-head"><h2>Wardrobe</h2></div>
						<p class="panel-sub">Hats from the VS Code pet's achievement collection.</p>
						<div class="hat-list">
							<button data-h="" class="${!s.hat ? 'on' : ''}">No hat</button>
							${Object.keys(HATS).map((h) => `<button data-h="${h}" class="${s.hat === h ? 'on' : ''}" ${owned.includes(h) ? '' : 'disabled'}>${owned.includes(h) ? HATS[h].name : '??? (locked)'}</button>`).join('')}
						</div>
						<div class="panel-head"><h3>Colors</h3></div>
						<div class="hat-list">
							<button data-v="stable" class="${s.settings.variant === 'stable' ? 'on' : ''}">Stable Blue</button>
							<button data-v="insiders" class="${s.settings.variant === 'insiders' ? 'on' : ''}">Insiders Teal</button>
						</div>
						<button class="close">Close (Esc)</button>
					</div>`;
				scr.querySelectorAll('[data-h]').forEach((b) => {
					b.onclick = () => { s.hat = b.dataset.h || null; writeSave(); audio.play('select'); onPick?.({ hat: s.hat }); render(); };
					b.onmouseenter = () => audio.play('hover');
				});
				scr.querySelectorAll('[data-v]').forEach((b) => {
					b.onclick = () => { s.settings.variant = b.dataset.v; writeSave(); audio.play('select'); onPick?.({ variant: b.dataset.v }); render(); };
				});
				scr.querySelector('.close').onclick = close;
			};
			const close = () => { scr.classList.remove('show'); G.modal = null; window.removeEventListener('keydown', onKey); input.endFrame(); resolve(); };
			const onKey = (e) => { if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); close(); } };
			window.addEventListener('keydown', onKey);
			render();
			scr.classList.add('show');
		});
	},

	// ---------------- pause ----------------
	openPause({ onResume, onAbandon, onWipe }) {
		G.modal = 'pause';
		const scr = $('pause-screen');
		const s = G.save.settings;
		scr.innerHTML = `
			<div class="panel small">
				<div class="panel-head"><h2>Paused</h2></div>
				<div class="controls">
					<div><kbd>WASD</kbd> Move</div><div><kbd>LMB</kbd>/<kbd>J</kbd> Attack · hold for <b>Rare Spin</b></div>
					<div><kbd>RMB</kbd>/<kbd>K</kbd> Throw Star · hold for <b>Starfall</b></div><div><kbd>Q</kbd>/<kbd>L</kbd> Cast Breakpoint</div>
					<div><kbd>Space</kbd>/<kbd>Shift</kbd> Dash · hold to Sprint</div><div><kbd>E</kbd> Interact · <kbd>Tab</kbd> Boons</div>
					<div class="dim">Gamepad supported</div>
				</div>
				<label>Music <input type="range" id="vol-music" min="0" max="1" step="0.05" value="${s.music}"></label>
				<label>Sound <input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
				<label>Screen shake <input type="range" id="vol-shake" min="0" max="1.5" step="0.1" value="${s.shake}"></label>
				<div class="row">
					<button id="p-resume">Resume</button>
					${onAbandon ? '<button id="p-abandon" class="warn">Abandon run</button>' : ''}
				</div>
				<button id="p-wipe" class="tiny">Reset save data</button>
			</div>`;
		scr.classList.add('show');
		const upd = () => {
			s.music = +$('vol-music').value; s.sfx = +$('vol-sfx').value; s.shake = +$('vol-shake').value;
			audio.setVolumes(s.music, s.sfx);
			writeSave();
		};
		['vol-music', 'vol-sfx', 'vol-shake'].forEach((id) => { $(id).oninput = upd; });
		const close = () => { scr.classList.remove('show'); G.modal = null; input.endFrame(); };
		$('p-resume').onclick = () => { close(); onResume?.(); };
		if (onAbandon) $('p-abandon').onclick = () => { close(); onAbandon(); };
		$('p-wipe').onclick = () => { if (confirm('Erase all progress?')) { onWipe?.(); } };
		this.closePause = close;
	},

	// ---------------- death ----------------
	deathScreen(stats) {
		return new Promise((resolve) => {
			const scr = $('death-screen');
			scr.innerHTML = `
				<div class="death-inner">
					<div class="d-title">BUDDY FELL OFF</div>
					<div class="d-sub">The Scratch Buffer catches you.</div>
					<div class="d-stats">
						<div><span>Deepest</span><b>${stats.where}</b></div>
						<div><span>Foes defeated</span><b>${stats.kills}</b></div>
						<div><span>Stars kept</span><b>★ ${stats.stars}</b></div>
						<div><span>Boons</span><b>${stats.boons}</b></div>
					</div>
					<div class="n-hint">click or press Space</div>
				</div>`;
			scr.classList.add('show');
			G.modal = 'dead';
			let ready = false;
			setTimeout(() => { ready = true; }, 900);
			const go = () => {
				if (!ready) return;
				scr.classList.remove('show');
				window.removeEventListener('keydown', onKey);
				scr.removeEventListener('click', go);
				G.modal = null;
				input.endFrame();
				resolve();
			};
			const onKey = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) go(); };
			window.addEventListener('keydown', onKey);
			scr.addEventListener('click', go);
		});
	},
};
