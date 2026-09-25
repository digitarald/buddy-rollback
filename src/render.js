import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { G } from './state.js';
import { damp, rand } from './util.js';

const GradeShader = {
	uniforms: {
		tDiffuse: { value: null },
		uTime: { value: 0 },
		uVignette: { value: 0.9 },
		uAberr: { value: 0.0 },
		uFlash: { value: 0 },
		uFlashColor: { value: new THREE.Color(1, 1, 1) },
		uSat: { value: 1.08 },
		uLow: { value: 0 },
		uRes: { value: new THREE.Vector2(1, 1) },
		uTint: { value: new THREE.Color(1, 1, 1) },
		uDesat: { value: 0 },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
	`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float uTime, uVignette, uAberr, uFlash, uSat, uLow, uDesat;
		uniform vec3 uFlashColor, uTint;
		uniform vec2 uRes;
		varying vec2 vUv;
		float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
		void main() {
			vec2 uv = vUv;
			vec2 c = uv - 0.5;
			float d = length(c * vec2(uRes.x / uRes.y, 1.0)) / 0.9;
			float ab = (0.0018 + uAberr) * d;
			vec3 col;
			col.r = texture2D(tDiffuse, uv - c * ab).r;
			col.g = texture2D(tDiffuse, uv).g;
			col.b = texture2D(tDiffuse, uv + c * ab).b;
			col *= uTint;
			float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
			col = mix(vec3(l), col, uSat * (1.0 - uDesat));
			float vig = smoothstep(1.25, 0.25, d);
			col *= mix(1.0, vig, uVignette);
			float edge = smoothstep(0.35, 1.2, d);
			col = mix(col, col * 0.35 + vec3(0.55, 0.02, 0.05) * edge, uLow * edge);
			float n = hash(uv * uRes + fract(uTime * 13.0) * 100.0);
			col += (n - 0.5) * 0.018;
			col = mix(col, uFlashColor, uFlash);
			gl_FragColor = vec4(col, 1.0);
		}
	`,
};

export const R = {
	renderer: null, scene: null, camera: null, composer: null, bloom: null, grade: null,
	camTarget: new THREE.Vector3(), camPos: new THREE.Vector3(), lookAhead: new THREE.Vector3(),
	trauma: 0, zoom: 1, zoomPunch: 0, flash: 0, aberr: 0,
	baseOffset: new THREE.Vector3(0, 26.5, 18.5),
	sun: null, hemi: null,
	flashLights: [], flashIdx: 0,
	propLights: [],
	raycaster: new THREE.Raycaster(),
	groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
	cinematic: null,
};

export function initRenderer(container) {
	const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	container.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x07050f);
	scene.fog = new THREE.FogExp2(0x07050f, 0.022);

	const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 200);
	camera.position.copy(R.baseOffset);
	camera.lookAt(0, 0, 0);

	// lights
	const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x2a1030, 0.9);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xdfe4ff, 2.2);
	sun.position.set(-10, 26, 12);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	const sc = sun.shadow.camera;
	sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
	sun.shadow.bias = -0.0004;
	sun.shadow.normalBias = 0.03;
	sun.shadow.radius = 4;
	scene.add(sun, sun.target);

	// Fixed pools: changing light counts forces shader recompiles, so lights are reused.
	for (let i = 0; i < 4; i++) {
		const l = new THREE.PointLight(0xffffff, 0, 9, 2);
		l.userData.t = 0;
		scene.add(l);
		R.flashLights.push(l);
	}
	for (let i = 0; i < 6; i++) {
		const l = new THREE.PointLight(0xff9a40, 0, 11, 1.8);
		scene.add(l);
		R.propLights.push(l);
	}

	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize(size);
	const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
	const composer = new EffectComposer(renderer, rt);
	composer.addPass(new RenderPass(scene, camera));
	const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.55, 0.82);
	composer.addPass(bloom);
	const grade = new ShaderPass(GradeShader);
	grade.uniforms.uRes.value.set(size.x, size.y);
	composer.addPass(grade);
	composer.addPass(new OutputPass());

	Object.assign(R, { renderer, scene, camera, composer, bloom, grade, sun, hemi });
	G.scene = scene; G.camera = camera; G.renderer = renderer;

	window.addEventListener('resize', onResize);
	return R;
}

function onResize() {
	const { renderer, camera, composer, grade } = R;
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	composer.setSize(window.innerWidth, window.innerHeight);
	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize(size);
	grade.uniforms.uRes.value.set(size.x, size.y);
}

export function setAtmosphere({ bg, fog, fogDensity = 0.022, hemiSky, hemiGround, hemiInt = 0.9, sunColor, sunInt = 2.2, exposure = 1.05, bloom = 0.55, tint = 0xffffff }) {
	R.scene.background.set(bg);
	R.scene.fog.color.set(fog ?? bg);
	R.scene.fog.density = fogDensity;
	R.hemi.color.set(hemiSky); R.hemi.groundColor.set(hemiGround); R.hemi.intensity = hemiInt;
	R.sun.color.set(sunColor); R.sun.intensity = sunInt;
	R.renderer.toneMappingExposure = exposure;
	R.bloom.strength = bloom;
	R.grade.uniforms.uTint.value.set(tint);
}

export function addTrauma(t) {
	R.trauma = Math.min(1, R.trauma + t * (G.save?.settings.shake ?? 1));
}
export function flashScreen(amount = 0.3, color = 0xffffff) {
	R.flash = Math.max(R.flash, amount);
	R.grade.uniforms.uFlashColor.value.set(color);
}
export function punchZoom(z = 0.05) { R.zoomPunch = Math.max(R.zoomPunch, z); }
export function aberrate(a = 0.01) { R.aberr = Math.max(R.aberr, a); }

export function flashLight(pos, color = 0xffffff, intensity = 30, dur = 0.15, dist = 9) {
	const l = R.flashLights[R.flashIdx++ % R.flashLights.length];
	l.position.set(pos.x, (pos.y ?? 0) + 1.2, pos.z);
	l.color.set(color);
	l.distance = dist;
	l.userData.i = intensity; l.userData.t = dur; l.userData.d = dur;
	l.intensity = intensity;
}

export function aimPoint(nx, ny, out) {
	R.raycaster.setFromCamera({ x: nx, y: ny }, R.camera);
	return R.raycaster.ray.intersectPlane(R.groundPlane, out);
}

export function snapCamera(target) {
	R.camTarget.copy(target);
	R.lookAhead.set(0, 0, 0);
	R.camPos.copy(target).add(R.baseOffset);
}

export function updateCamera(realDt, target, aim) {
	const { camera } = R;
	if (R.cinematic) {
		const c = R.cinematic;
		R.camTarget.x = damp(R.camTarget.x, c.target.x, c.speed ?? 3, realDt);
		R.camTarget.z = damp(R.camTarget.z, c.target.z, c.speed ?? 3, realDt);
		R.zoom = damp(R.zoom, c.zoom ?? 1, 3, realDt);
	} else if (target) {
		if (aim) {
			R.lookAhead.x = damp(R.lookAhead.x, aim.x * 1.6, 3, realDt);
			R.lookAhead.z = damp(R.lookAhead.z, aim.z * 1.2, 3, realDt);
		}
		R.camTarget.x = damp(R.camTarget.x, target.x + R.lookAhead.x, 6, realDt);
		R.camTarget.z = damp(R.camTarget.z, target.z + R.lookAhead.z, 6, realDt);
		R.zoom = damp(R.zoom, 1, 3, realDt);
	}
	R.zoomPunch = damp(R.zoomPunch, 0, 10, realDt);
	const z = R.zoom * (1 - R.zoomPunch);
	camera.position.set(R.camTarget.x + R.baseOffset.x * z, R.baseOffset.y * z, R.camTarget.z + R.baseOffset.z * z);
	const s = R.trauma * R.trauma;
	const t = performance.now() / 1000;
	if (s > 0.0001) {
		camera.position.x += (Math.sin(t * 71) + Math.sin(t * 43.1) * 0.5) * s * 0.55;
		camera.position.y += Math.sin(t * 57.3) * s * 0.3;
		camera.position.z += (Math.cos(t * 63) + Math.sin(t * 37.7) * 0.5) * s * 0.55;
	}
	camera.lookAt(R.camTarget.x, 0, R.camTarget.z - 0.5);
	if (s > 0.0001) camera.rotation.z += Math.sin(t * 29) * s * 0.03;
	R.trauma = Math.max(0, R.trauma - realDt * 1.6);

	// shadow frustum follows the camera target
	R.sun.position.set(R.camTarget.x - 10, 26, R.camTarget.z + 12);
	R.sun.target.position.set(R.camTarget.x, 0, R.camTarget.z);

	for (const l of R.flashLights) {
		if (l.userData.t > 0) {
			l.userData.t -= realDt;
			l.intensity = Math.max(0, l.userData.i * (l.userData.t / l.userData.d));
		} else l.intensity = 0;
	}
}

export function render(realDt) {
	const u = R.grade.uniforms;
	u.uTime.value += realDt;
	R.flash = damp(R.flash, 0, 9, realDt);
	R.aberr = damp(R.aberr, 0, 6, realDt);
	u.uFlash.value = R.flash;
	u.uAberr.value = R.aberr;
	const p = G.player;
	const low = p && G.mode === 'run' && p.hp > 0 ? Math.max(0, 1 - p.hp / (p.maxHp * 0.3)) : 0;
	u.uLow.value = damp(u.uLow.value, low * (0.55 + 0.25 * Math.sin(u.uTime.value * 5)), 4, realDt);
	R.composer.render(realDt);
}

export function randomShakeDir() { return rand(-1, 1); }
