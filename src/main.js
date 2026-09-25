import { G, loadSave, writeSave, wipeSave } from './state.js';
import { initRenderer, updateCamera, render, R } from './render.js';
import { initFX, updateFX } from './fx.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { Player } from './player.js';
import { updateEnemies } from './enemies.js';
import { updateCombat } from './combat.js';
import { updateRoom } from './world.js';
import { UI } from './ui.js';
import { Flow } from './flow.js';

function init() {
	G.save = loadSave();
	initRenderer(document.getElementById('app'));
	initFX();
	input.attach(R.renderer.domElement);
	UI.init();
	audio.setVolumes(G.save.settings.music, G.save.settings.sfx);
	G.player = new Player();
	window.__G = G; // handy for debugging in the console
	window.__Flow = Flow;
	document.getElementById('loading').remove();
	let last = performance.now();
	const frame = (now) => {
		const realDt = Math.min(0.05, (now - last) / 1000);
		last = now;
		requestAnimationFrame(frame);
		try { tick(realDt); } catch (err) { console.error(err); input.endFrame(); }
	};
	requestAnimationFrame(frame);
	Flow.boot();
}

function togglePause() {
	if (G.modal === 'pause') { UI.closePause(); return; }
	if (G.modal) return;
	UI.openPause({
		onAbandon: G.mode === 'run' ? () => { G.player.hp = 0; G.player.iframes = 0; G.player.die(); } : null,
		onWipe: () => { wipeSave(); location.reload(); },
	});
}

function tick(realDt) {
	input.pollPad();
	if (input.pressed('pause') && (G.mode === 'run' || G.mode === 'hub')) togglePause();

	const paused = G.modal === 'pause';
	const blocking = !!G.modal;
	let dt = blocking ? 0 : realDt;
	if (G.hitstop > 0) { G.hitstop -= realDt; dt = 0; }
	if (G.slowmoT > 0 && !blocking) { G.slowmoT -= realDt; dt *= 0.28; }
	const ambient = paused ? 0 : realDt;
	G.dt = dt;
	G.time += dt;

	const P = G.player;
	const controls = (G.mode === 'run' || G.mode === 'hub') && !blocking && !Flow.busy;
	if (G.mode !== 'title') P.update(dt, controls);
	updateEnemies(dt);
	updateCombat(dt);
	Flow.update(dt, ambient);
	const animDt = G.hitstop > 0 ? 0 : blocking ? ambient : dt;
	P.updateAnim(animDt, realDt);
	updateRoom(G.room, ambient);
	updateFX(blocking ? ambient : dt, realDt);
	updateCamera(realDt, P.pos, G.mode === 'run' ? P.aim : null);
	UI.updateHUD(realDt);
	render(realDt);
	input.endFrame();
}

window.addEventListener('beforeunload', () => writeSave());
init();
