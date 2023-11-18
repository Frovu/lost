import * as THREE from 'three';
import { useEffect } from 'react';

import { create } from 'zustand';

const defaultState = {
	size: 64,
	texture: null as null | THREE.DataTexture,
	textureData: null as null | Uint8ClampedArray,
	grid: null as null | Uint8Array
};
type LevelState = typeof defaultState & {
	initTexture: () => void,
	render: () => void,
};

const useLevelState = create<LevelState>()((set, get) => ({
	...defaultState,
	render: () => {
		const { grid, size, texture, textureData } = get();
		if (!grid || !textureData) return;
		for (let i = 0; i < size * size; ++i) {
			const val = (grid[i] === 255 ? 1 : -Math.log10(-grid[i] / 255 / 4 + 1)) * 256;
			textureData[i * 2] = val * 2;
			textureData[i * 2 + 1] = val / 3;
		}
		texture!.needsUpdate = true; 
	},
	initTexture: () => {
		const { size, texture: oldTexture } = get();
		if (oldTexture)
			oldTexture.dispose();
		const textureData = new Uint8ClampedArray(size * size * 2);
		const texture = new THREE.DataTexture(textureData, size, size, THREE.RGFormat);
		texture.flipY = true;
		set(st => ({ ...st, texture, textureData }));
	}
}));

async function generateLevel() {
	const { size, render } = useLevelState.getState();
	const delay = 1000 / size;

	const grid = new Uint8Array(size * size).fill(0);
	const animate = () => {
		useLevelState.setState(st => ({ ...st, grid }));
		render(); return new Promise(res => setTimeout(res, delay)); };
	
	await animate();

	for (let i = 0; i < size; ++i) {
		for (let j = 0; j < size; ++j) {
			grid[i * size + j] = Math.random() * 256;
		}
		await animate();
	}
}

export function Level() {
	const { texture, initTexture } = useLevelState();

	useEffect(() => {
		if (texture == null) {
			initTexture();
			generateLevel();
		}
	}, [initTexture, texture]);
	
	return <>
		<mesh scale={32}>
			<planeGeometry args={[16, 16]}/>
			<meshBasicMaterial map={texture} transparent/>
		</mesh>
	</>;
}