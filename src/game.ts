import { create } from 'zustand';
import Astar from './algorithm/astar';
import { useLevelState } from './level';

const SQRT_2 = Math.sqrt(2);

export type Position = { x: number, y: number };

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
	isPlaying: false,
	heuristicMulti: 1,
	costMulti: 4,
	pathfinder: null as null | Pathfinder,
	results: [] as PathfindingResult[]
};

type GameState = typeof defaultState & {
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

export const useGameState = create<GameState>()((set) => ({
	...defaultState,
	set: (k, val) => {
		set(st => ({ ...st, [k]: val }));
		if (['heuristicMulti', 'costMulti'].includes(k))
			play(false);
	},
	addResult: (res) => set(st => ({ ...st, isPlaying: false, results: [...st.results, res] })),
	reset: () => set(st => ({ ...st, results: [] })),
}));

export const play = (force=true) => useGameState.setState(state => {
	if (state.isPlaying && !force)
		return state;
	state.pathfinder?.stop();
	const { grid, size } = useLevelState.getState();
	const { addResult } = state;
	if (!grid) return state;
	const pathfinder = new Astar({ state, grid, size, animate: true });
	pathfinder.findPath({ x: 0, y: 0 }, { x: size-1, y: size-1 })
		.then(res => !res?.aborted && addResult(res));
	return { ...state, pathfinder, isPlaying: true };
});

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