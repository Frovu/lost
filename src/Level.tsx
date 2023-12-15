import { useEffect, useMemo } from 'react';

import { MeshProps, useFrame } from '@react-three/fiber';
import { useLevelState, generateLevel, typeOptions } from './level';

import * as THREE from 'three';

export function Level(callbacks: Partial<MeshProps>) {
	const { grid, overlayGrid, size } = useLevelState();

	const textureData = useMemo(() => new Uint8ClampedArray(size * size * 4), [size]);
	const overlayTextureData = useMemo(() => new Uint8ClampedArray(size * size * 4), [size]);

	const texture = useMemo(() => new THREE.DataTexture(textureData, size, size, THREE.RGBAFormat), [textureData, size]);
	const overlayTexture = useMemo(() => new THREE.DataTexture(overlayTextureData, size, size, THREE.RGBAFormat), [overlayTextureData, size]);

	useEffect(() => {
		if (!grid) return;
		for (let i = 0; i < size * size; ++i) {
			const val = (grid[i] === 255 ? 2 : -Math.log10(-grid[i] / 255 + 1)) * 255;
			textureData[i * 4] = 200;
			textureData[i * 4 + 1] = 200;
			textureData[i * 4 + 2] = 200;
			textureData[i * 4 + 3] = val;
		}
		texture.needsUpdate = true; 
	}, [grid, size, texture, textureData]);

	useEffect(() => {
		for (let i = 0; i < size * size; ++i) {
			const v = overlayGrid?.[i] ?? 0;
			overlayTextureData[i * 4] = v === 1 ? 255 : 0;
			overlayTextureData[i * 4 + 1] = v === 3 ? 255 : 0;
			overlayTextureData[i * 4 + 2] = v === 2 ? 255 : 0;
			overlayTextureData[i * 4 + 3] = v === 0 ? 0 : 128;
		}
		overlayTexture.needsUpdate = true; 
	}, [overlayGrid, size, overlayTexture, overlayTextureData]);

	useEffect(() => {
		if (!grid) generateLevel();
	}, [grid]);

	const translate = size / 2 - .5;
	useFrame(({ camera, size: canSize }) => {
		const zoom = (canSize.width - 16) / size;
		camera.zoom = zoom;
		camera.position.set(translate, translate, 256);
		camera.lookAt(translate, translate, 0);
		camera.updateProjectionMatrix();
	});
	
	return <>
		<mesh position={[translate, translate, -2]}>
			<planeGeometry args={[size, size]}/>
			<meshBasicMaterial map={texture} transparent/>
		</mesh>
		<mesh position={[translate, translate, -1]} {...callbacks}>
			<planeGeometry args={[size, size]}/>
			<meshBasicMaterial map={overlayTexture} transparent/>
		</mesh>
	</>;
}

export function LevelControls () {
	const { size, pow, multi, type, animate, isGenerating, resolution, useVignette, set } = useLevelState();

	return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
		<button style={{ width: 128, color: isGenerating ? 'var(--color-active)' : 'unset' }}
			onClick={() => isGenerating ? set('isGenerating', false) : generateLevel()}>
				GENERAT{isGenerating ? 'ING' : 'E'}</button>
		<label title='Animate map generation'>Anim
			<input type='checkbox' checked={animate} onChange={e => set('animate', e.target.checked)}/></label>
		<label title='Apply map vignette'>Vign
			<input type='checkbox' checked={useVignette} onChange={e => set('useVignette', e.target.checked)}/></label>
		<label>Size:<input style={{ marginLeft: 4, width: 64 }} type='number' min='8' max='128' step='16'
			value={size} onChange={e => set('size', e.target.valueAsNumber)}/></label>
		<label>Type:<select style={{ marginLeft: 4, width: 144 }}
			value={type} onChange={e => set('type', e.target.value as any)}>
			{typeOptions.map(o => <option key={o} value={o}>{o}</option>)}	
		</select></label>
		{type === 'perlin noise' && <>
			<div style={{ flexBasis: '100%' }}></div>
			<label>power=<input style={{ marginLeft: 2, width: 64 }} type='number' min='1' max='64' step='1'
				value={pow} onChange={e => set('pow', e.target.valueAsNumber)}/></label>
			<label>multi=<input style={{ marginLeft: 2, width: 64 }} type='number' min='4' max='512' step='4'
				value={multi} onChange={e => set('multi', e.target.valueAsNumber)}/></label>
			<label>resolution=<input style={{ marginLeft: 2, width: 64 }} type='number' min='1' max='64' step='1'
				value={resolution} onChange={e => set('resolution', e.target.valueAsNumber)}/></label>
		</>}
	</div>;
}