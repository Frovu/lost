import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { perlin } from './perlin';
import { Coords, initRandomLevel, useGameState } from './game';

export const typeOptions = ['gradient', 'white noise', 'perlin noise'] as const;

const defaultState = {
	type: 'perlin noise' as typeof typeOptions[number],
	isGenerating: false,
	isDrawing: false,
	useVignette: true,
	animate: true,
	resolution: 20,
	pow: 16,
	multi: 64,
	size: 64,
	overlayGrid: null as null | Uint8ClampedArray,
	originalGrid: null as null | Uint8ClampedArray,
	grid: null as null | Uint8ClampedArray,
	obstacles: [] as { x: number, y: number }[][]
};

export type LevelState = typeof defaultState & {
	set: <T extends keyof typeof defaultState>(k: T, val: typeof defaultState[T]) => void,
	drawObstacle: (pos: Coords) => void,
	startDrawing: () => void,
	finishDrawing: () => void,
	undoObstacle: () => void,
};

export const animatePathfinding = (grid: Uint8ClampedArray | null) => {
	useLevelState.setState(st => ({ ...st, overlayGrid: grid }));
	return new Promise(res => setTimeout(res, 0));
};

export const useLevelState = create<LevelState>()(persist((set) => ({
	...defaultState,
	set: (k, val) => {
		set(st => ({ ...st, [k]: val }));
		if (['size', 'pow', 'multi', 'resolution'].includes(k))
			generateLevel(false);
		else if (['type'].includes(k))
			generateLevel(true);
	},
	drawObstacle: (pos) => set(st => {
		if (!st.isDrawing) return st;
		const obstacles = st.obstacles.slice();
		const last = obstacles.at(-1);
		if (!last) return st;
		if (!last.find(p => p.x === pos.x && p.y === pos.y))
			last.push({ x: pos.x, y: pos.y });
		const grid = st.grid?.slice() ?? null;
		if (grid)
			grid[pos.y * st.size + pos.x] = 255;
		return { ...st, isDrawing: true, obstacles, grid };
	}),
	undoObstacle: () => set(st => {
		const obstacle = st.obstacles.at(-1);
		if (!obstacle || !st.grid) return st;
		const grid = st.grid.slice();
		for (const { x, y } of obstacle) {
			const c = y * st.size + x;
			grid[c] = st.originalGrid![c];
		}
		return { ...st, grid, obstacles: st.obstacles.slice(0, -1) };
	}),
	startDrawing: () => set(st => {
		return { ...st, isDrawing: true, obstacles: st.obstacles.concat([[]]) };
	}),
	finishDrawing: () => set(st => {
		return { ...st, isDrawing: false };
	})
}), {
	name: 'and I become lost',
	partialize: ({ type, size, animate, pow, multi, resolution, grid, originalGrid, useVignette }) =>
		({ type, size, animate, pow, multi, resolution, useVignette,
			grid: grid && Array.from(grid), originalGrid: originalGrid && Array.from(originalGrid) })
}));

export async function generateLevel(animated=true) {
	const { size, type, pow, multi, resolution, useVignette, animate: animateEn } = useLevelState.getState();
	useGameState.getState().pathfinder?.stop();
	useLevelState.setState(st => ({ ...st, isGenerating: true }));
	const delay = 1000 / size - 4;
	const animateEnabled = animated && animateEn;

	const grid = new Uint8ClampedArray(size * size);
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
	for (let i = 0; i < size ** 2; ++i) {
		grid[i] = grid[i] > 200 ? 255 : grid[i];
	}
	await animate();
	useLevelState.setState(st => ({ ...st, originalGrid: grid.slice(), grid, isGenerating: false }));
	if (!useGameState.getState().examineMode)
		initRandomLevel();
}