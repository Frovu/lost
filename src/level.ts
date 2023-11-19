import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { perlin } from './perlin';

export const typeOptions = ['gradient', 'white noise', 'perlin noise'] as const;

const defaultState = {
	type: 'perlin noise' as typeof typeOptions[number],
	isGenerating: false,
	useVignette: true,
	animate: true,
	resolution: 8,
	pow: 8,
	multi: 32,
	size: 128,
	overlayGrid: null as null | Uint8ClampedArray,
	grid: null as null | Uint8ClampedArray
};

export type LevelState = typeof defaultState & {
	set: <T extends keyof typeof defaultState>(k: T, val: typeof defaultState[T]) => void
};

export const animatePathfinding = () => {

	return new Promise(res => setTimeout(res, 50));
};

export const useLevelState = create<LevelState>()(persist((set) => ({
	...defaultState,
	set: (k, val) => set(st => ({ ...st, [k]: val }))
}), {
	name: 'and I become lost',
	partialize: ({ type, size, animate, pow, multi, resolution }) => ({ type, size, animate, pow, multi, resolution })
}));

export async function generateLevel() {
	const { size, type, pow, multi, resolution, useVignette, animate: animateEnabled } = useLevelState.getState();
	useLevelState.setState(st => ({ ...st, isGenerating: true }));
	const delay = 1000 / size;

	const grid = new Uint8ClampedArray(size * size).fill(0);
	const animate = () => {
		useLevelState.setState(st => ({ ...st, grid: grid.slice() }));
		return new Promise(res => setTimeout(res, delay)); };
	if (animateEnabled)
		await animate();
	
	if (type === 'perlin noise')
		perlin.seed();
	const res = Math.max(2, (size-1) / resolution); 
	const vignette = useVignette ? (r: number) => 1 - Math.pow(r / size, 3) * 8 : () => 1;
	const gen = ((): ((x: number, y: number, r: number) => void) => {
		switch (type) {
			case 'gradient':
				return (x, y) => {
					grid[y * size + x] = y / (size - 1) * x / (size - 1) * 255; };
			case 'white noise':
				return (x, y, r) => {
					grid[y * size + x] = Math.min(255, Math.random() * 256 + 8) * vignette(r); };
			case 'perlin noise':
				return (x, y, r) => {
					const val = perlin.get(x / res, y / res);
					grid[y * size + x] = (Math.pow(val + 1, pow)) * multi * vignette(r); };
		}
	})();
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
				gen(ax, ay, r);
			}
			if (animateEnabled)
				await animate();
			const state = useLevelState.getState();
			if (!state.isGenerating)
				return;
		}
	}
	for (let i = 0; i < size; ++i) {
		gen(i, 0, half - 1);
		gen(i, size - 1, half - 1);
	}
	await animate();
	useLevelState.setState(st => ({ ...st, isGenerating: false }));
}