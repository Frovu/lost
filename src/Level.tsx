import * as THREE from 'three';
import { useEffect } from 'react';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const typeOptions = ['gradient', 'white noise', 'perlin noise'] as const;

const defaultState = {
	type: 'white noise' as typeof typeOptions[number],
	isGenerating: false,
	size: 128,
	texture: null as null | THREE.DataTexture,
	textureData: null as null | Uint8ClampedArray,
	grid: null as null | Uint8Array
};
type LevelState = typeof defaultState & {
	initTexture: () => void,
	render: () => void,
	set: <T extends keyof typeof defaultState>(k: T, val: typeof defaultState[T]) => void
};

const useLevelState = create<LevelState>()(persist((set, get) => ({
	...defaultState,
	set: (k, val) => set(st => ({ ...st, [k]: val })),
	render: () => {
		const { grid, size, texture, textureData } = get();
		if (!grid || !textureData) return;
		for (let i = 0; i < size * size; ++i) {
			const val = (grid[i] === 255 ? 255 : -Math.log10(-grid[i] / 255 + 1)) * 256;
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
	partialize: ({ type, size }) => ({ type, size })
}));

async function generateLevel() {
	const { size, type, render, initTexture } = useLevelState.getState();
	useLevelState.setState(st => ({ ...st, isGenerating: true }));
	initTexture();
	const delay = 1000 / size;

	const grid = new Uint8Array(size * size).fill(16);
	const animate = () => {
		useLevelState.setState(st => ({ ...st, grid }));
		render(); return new Promise(res => setTimeout(res, delay)); };
	await animate();

	const gen: (x: number, y: number) => void = type === 'gradient'
		? (x, y) => { grid[y * size + x] = y / (size - 1) * x / (size - 1) * 254; }
		: (x, y) => { grid[y * size + x] = Math.min(255, Math.random() * 256 + 8); };
	// const gen = (x: number, y: number) => { grid[y * size + x] = Math.random() * 500; };
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
			const state = useLevelState.getState();
			if (!state.isGenerating)
				return;
		}
	}
	for (let i = 0; i < size; ++i) {
		gen(i, 0);
		gen(i, size - 1);
	}
	await animate();
	useLevelState.setState(st => ({ ...st, isGenerating: false }));
}

export function LevelControls () {
	const { size, type, set, isGenerating } = useLevelState();

	return <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
		<button style={{ width: 128, color: isGenerating ? 'var(--color-active)' : 'unset' }}
			onClick={() => isGenerating ? set('isGenerating', false) : generateLevel()}>
				GENERAT{isGenerating ? 'ING' : 'E'}</button>
		<label>Size:<input style={{ marginLeft: 4, width: 72 }} type='number' min='16' max='1024' step='16'
			value={size} onChange={e => set('size', e.target.valueAsNumber)}/></label>
		<label>Type:<select style={{ marginLeft: 4, width: 144 }}
			value={type} onChange={e => set('type', e.target.value as any)}>
			{typeOptions.map(o => <option key={o} value={o}>{o}</option>)}	
		</select></label>
		
	</div>;
}

export function Level() {
	const { texture, size, type, set } = useLevelState();

	useEffect(() => {
		const { isGenerating } = useLevelState.getState();
		if (!isGenerating) {
			generateLevel();
		} else {
			set('isGenerating', false);
			const timeout = setTimeout(generateLevel, 100);
			return () => clearTimeout(timeout);
		}
	}, [size, type, set]);
	
	return <>
		<mesh scale={8}>
			<planeGeometry args={[64, 64]}/>
			<meshBasicMaterial map={texture} transparent/>
		</mesh>
	</>;
}