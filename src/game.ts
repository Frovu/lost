import { create } from 'zustand';
import Astar from './algorithm/astar';
import { useLevelState } from './level';
import { PathCurve, computeCurves } from './curves';
import { persist } from 'zustand/middleware';

const SQRT_2 = Math.sqrt(2);

export type Coords = { x: number, y: number };
export type Position = { x: number, y: number, rot: number };

export const posEqual = (a: Position, b: Position) => a.x === b.x && a.y === b.y && a.rot === b.rot;

export type NodeBase = Position & { cost: number };

export type PathfindingResult = {
	opts: PathfinderParams,
	aborted: boolean,
	path: NodeBase[],
	nodesVisited: number,
	timeConsumed: number,
	at: number,
};

const defaultState = {
	robotLength: 1.2,
	robotWidth: .8,
	turningRadius: 1,
	neighborsRadius: 2,
	rotNumber: 16,
	examineMode: true,
	isPlaying: false,
	animationSpeed: 4,
	heuristicMulti: 1,
	costMulti: 4,
	pathfinder: null as null | Pathfinder,
	results: [] as PathfindingResult[]
};

export type GameState = typeof defaultState & {
	set: <T extends keyof typeof defaultState>(k: T, val: typeof defaultState[T]) => void,
	addResult: (r: PathfindingResult) => void,
	reset: () => void,
};

export interface PathfinderParams {
	state: GameState,
	animate: boolean,
	grid: Uint8ClampedArray,
	size: number,
}

export interface Pathfinder {
	stop: () => void,
	findPath: (position: Position, target: Position) => Promise<PathfindingResult>,
};

export const useGameState = create<GameState>()(persist((set) => ({
	...defaultState,
	set: (k, val) => {
		set(st => ({ ...st, [k]: val }));
		if (['heuristicMulti', 'costMulti'].includes(k))
			play(false);
	},
	addResult: (res) => set(st => ({ ...st, isPlaying: false, results: [...st.results, res] })),
	reset: () => set(st => ({ ...st, results: [] })),
}), {
	name: 'you lost',
	partialize: ({ turningRadius, rotNumber }) => ({ turningRadius, rotNumber })
}));

export const play = (force=true) => useGameState.setState(state => {
	if (state.isPlaying && !force)
		return state;
	state.pathfinder?.stop();
	const { grid, size } = useLevelState.getState();
	const { addResult } = state;
	if (!grid) return state;
	const pathfinder = new Astar({ state, grid, size, animate: true });
	pathfinder.findPath({ x: 0, y: 0, rot: 0 }, { x: size-1, y: size-1, rot: 0 })
		.then(res => !res?.aborted && addResult(res));
	return { ...state, pathfinder, isPlaying: true };
});

export const distance = (a: Position, b: Position) =>
	Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export function neighborsFactory(state: GameState) {
	const { neighborsRadius, rotNumber } = state;
	const masks: PathCurve[][] = Array(rotNumber).fill(null).map(() => []);
	const rot180 = (r: number) => (r + rotNumber / 2) % rotNumber;

	for (let rot0 = 0; rot0 < rotNumber; ++rot0) {
		const pos0 = { x: 0, y: 0, rot: rot0 };
		for (let x = -neighborsRadius; x < neighborsRadius + 1; ++x) {
			for (let y = -neighborsRadius; y < neighborsRadius + 1; ++y) {
				if (x === 0 && y === 0)
					continue;
				for (let rot = 0; rot < rotNumber; ++rot) {
					const forward = computeCurves(pos0, { x, y, rot }, state);
					const pos180 = { ...pos0, rot: rot180(rot0) };
					const backward = computeCurves(pos180, { x, y, rot: rot180(rot) }, state);
					masks[rot0].push(...forward);
					masks[rot0].push(...backward);
				}
			}
		}
	}
	return (rot: number) => masks[rot];
}

export function* neighbors<T extends NodeBase>(grid: T[][], node: T, opts: PathfinderParams) {
	const r = 1;
	const { size } = opts;
	const { x, y } = node;
	for (let i = Math.max(0, y - r); i < Math.min(size, y + r + 1); ++i) {
		for (let j = Math.max(0, x - r); j < Math.min(size, x + r + 1); ++j) {
			if (j === x && i === y)
				continue;
			const cur = grid[i][j];
			if (cur.cost >= 255)
				continue;
			yield cur;
		}
	}
};

export function computeCost(a: NodeBase, b: NodeBase, opts: PathfinderParams) {
	const dist = (a.x === b.x || a.y === b.y) ? 1 : SQRT_2;
	return dist + b.cost / 256 * opts.state.costMulti;
}