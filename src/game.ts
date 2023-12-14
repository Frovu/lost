import { create } from 'zustand';
import Astar from './algorithm/astar';
import { useLevelState } from './level';
import { PathCurve, computeCurves, renderCurveGridMask } from './curves';
import { persist } from 'zustand/middleware';

export type Coords = { x: number, y: number };
export type Position = { x: number, y: number, rot: number };

export const posEqual = (a: Position, b: Position) => a.x === b.x && a.y === b.y && a.rot === b.rot;

export type NodeBase = Position & { cost?: number };

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
	partialize: ({ turningRadius, rotNumber, robotLength, robotWidth }) =>
		({ turningRadius, rotNumber, robotLength, robotWidth })
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

export function neighborsFactory(params: PathfinderParams) {
	const state = params.state;
	const { neighborsRadius, rotNumber } = state;
	const curves: PathCurve[][] = Array(rotNumber).fill(null).map(() => []);
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
					curves[rot0].push(...forward);
					curves[rot0].push(...backward);
				}
			}
		}
	}
	const rendered = curves.map(forRot => forRot.map(c => 
		({ curve: c, mask: renderCurveGridMask(c, state) })));

	const { grid, size } = params;

	return <T extends NodeBase>(pos: Position, graph: T[][][]) => rendered[pos.rot].map(({ curve, mask }) => {
		const tx = curve.target.x + pos.x;
		const ty = curve.target.y + pos.y;

		if (tx < 0 || tx >= size)
			return null;
		if (ty < 0 || ty >= size)
			return null;

		const target = graph[ty][tx][curve.target.rot];
		const multi = state.costMulti / 256;
		let totalCost = 0;

		for (const { x, y, w } of mask) {
			const cost = grid[y * size + x];
			if (cost >= 255)
				return null;
			totalCost += (1 + cost * multi) * w;
		}

		return { node: target, curve, cost: totalCost };
	}).filter((a): a is {
		node: T,
		curve: PathCurve,
		cost: number
	} => a != null);
}