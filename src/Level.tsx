import * as THREE from 'three';
import { useEffect } from 'react';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const typeOptions = ['white noise', 'perlin noise'] as const;

const defaultState = {
	type: 'white noise' as typeof typeOptions[number],
	size: 256,
	texture: null as null | THREE.DataTexture,
	textureData: null as null | Uint8ClampedArray,
	grid: null as null | Uint8Array
};
type LevelState = typeof defaultState & {
	initTexture: () => void,
	render: () => void,
};

const useLevelState = create<LevelState>()(persist((set, get) => ({
	...defaultState,
	render: () => {
		const { grid, size, texture, textureData } = get();
		if (!grid || !textureData) return;
		for (let i = 0; i < size * size; ++i) {
			const val = (grid[i] === 255 ? 255 : -Math.log10(-grid[i] / 255 + 1)) * 32;
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
}), {
	name: 'and I become lost',
	partialize: ({ type }) => ({ type })
}));

async function generateLevel() {
	const { size, render } = useLevelState.getState();
	const delay = 1000 / size;

	const grid = new Uint8Array(size * size).fill(16);
	const animate = () => {
		useLevelState.setState(st => ({ ...st, grid }));
		render(); return new Promise(res => setTimeout(res, delay)); };
	await animate();

	const gen = (x: number, y: number) => { grid[y * size + x] = y / (size - 1) * x / (size - 1) * 254; };
	const half = size / 2;
	const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]];
	for (let r = 1; r < half; ++r) {
		for (const [dx, dy] of sides) {
			const hor = (dx !== 0 ? 1 : 0);
			const ver = (dy !== 0 ? 1 : 0);
			const x = half + r * dx - (dx === 1 ? 1 : 0);
			const y = half + r * dy - (dy === 1 ? 1 : 0);
			for (let i = -r; i < r; ++i) {
				const ax = x + i * ver + dx;
				const ay = y + i * hor;
				gen(ax, ay);
			}
			await animate();
		}
	}
	for (let i = 0; i < size; ++i) {
		gen(i, 0);
		gen(i, size - 1);
	}
	await animate();
}

export function LevelControls () {

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