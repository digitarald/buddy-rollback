import * as THREE from 'three';

// Patches a standard/physical material with a fresnel rim light and a hit-flash uniform.
export function rimify(mat, rimColor = 0x88ccff, rimStrength = 0.6, rimPower = 2.6) {
	const u = {
		uRimColor: { value: new THREE.Color(rimColor) },
		uRimStrength: { value: rimStrength },
		uRimPower: { value: rimPower },
		uFlash: { value: 0 },
		uFlashColor: { value: new THREE.Color(1, 1, 1) },
	};
	mat.userData.u = u;
	mat.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, u);
		shader.fragmentShader = 'uniform vec3 uRimColor; uniform float uRimStrength; uniform float uRimPower; uniform float uFlash; uniform vec3 uFlashColor;\n' +
			shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), uRimPower);
				totalEmissiveRadiance += uRimColor * rimF * uRimStrength;
			`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
				gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlashColor * 1.6, uFlash);
			`);
	};
	mat.customProgramCacheKey = () => 'rimify';
	return mat;
}

export function toon(color, opts = {}) {
	const m = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.55, metalness: opts.metalness ?? 0.0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1, flatShading: !!opts.flat, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
	return rimify(m, opts.rim ?? 0x6688ff, opts.rimStrength ?? 0.45, opts.rimPower ?? 2.6);
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x05030a, side: THREE.BackSide });
// Inverted hull outline: a slightly inflated back-face copy gives the inked, comic silhouette.
export function addOutline(mesh, thickness = 0.04) {
	const geo = mesh.geometry.clone();
	const pos = geo.attributes.position, nor = geo.attributes.normal;
	if (!nor) geo.computeVertexNormals();
	for (let i = 0; i < pos.count; i++) {
		pos.setXYZ(i, pos.getX(i) + nor.getX(i) * thickness, pos.getY(i) + nor.getY(i) * thickness, pos.getZ(i) + nor.getZ(i) * thickness);
	}
	const o = new THREE.Mesh(geo, outlineMat);
	o.userData.isOutline = true;
	o.raycast = () => {};
	mesh.add(o);
	return o;
}

export function setFlash(obj, v, color) {
	obj.traverse((o) => {
		const m = o.material;
		if (m && m.userData && m.userData.u) {
			m.userData.u.uFlash.value = v;
			if (color !== undefined) m.userData.u.uFlashColor.value.set(color);
		}
	});
}

export function glowMat(color, intensity = 2, opts = {}) {
	return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive, side: opts.side ?? THREE.FrontSide, toneMapped: opts.toneMapped ?? true });
}
