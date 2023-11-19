import { useEffect } from 'react';

import { useFrame } from '@react-three/fiber';
import { useLevelState, generateLevel, typeOptions } from './level';

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
		<label>Size:<input style={{ marginLeft: 4, width: 64 }} type='number' min='16' max='512' step='16'
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

export function Level() {
	const { texture, size, type, pow, multi, resolution, useVignette, set } = useLevelState();

	useEffect(() => {
		const { isGenerating } = useLevelState.getState();
		if (!isGenerating) {
			generateLevel();
		} else {
			set('isGenerating', false);
			const timeout = setTimeout(generateLevel, 100);
			return () => clearTimeout(timeout);
		}
	}, [size, type, pow, multi, resolution, useVignette, set]);

	const translate = size / 2 - .5;
	useFrame(({ camera, size: canSize }) => {
		const zoom = (canSize.width - 16) / size;
		camera.zoom = zoom;
		camera.lookAt(translate, translate, 0);
		camera.updateProjectionMatrix();
	});
	
	return <>
		<mesh position={[translate, translate, -1]}>
			<planeGeometry args={[size, size]}/>
			<meshBasicMaterial map={texture} transparent/>
		</mesh>
	</>;
}