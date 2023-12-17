import { create } from 'zustand';
import Astar from './algorithm/astar';
import { useLevelState } from './level';
import { PathCurve, computeCurves, renderCurveGridMask } from './curves';
import { persist } from 'zustand/middleware';
import DstarLite from './algorithm/dstar_lite';

export const algoOptions = ['A*', 'D* lite'] as const;

export type Coords = { x: number, y: number };
export type Position = { x: number, y: number, rot: number };

export const posEqual = (a: Position, b: Position) => a.x === b.x && a.y === b.y && a.rot === b.rot;

export type NodeBase = Position & {
	curve?: PathCurve,
	cost?: number
};

export type PathfindingResult = {
	params: PathfinderParams,
	aborted: boolean,
	path: NodeBase[],
	nodesVisited: number,
	timeConsumed: number,
	at: number,
};

const defaultState = {
	robotLength: 1.2,
	robotWidth: .8,
	playerPos: { x: 1, y: 1, rot: 1 },
	targetPos: { x: 2, y: 2, rot: 1 },
	algorithm: 'D* lite' as typeof algoOptions[number],
	turningRadius: 1,
	neighborsRadius: 2,
	rotNumber: 8,
	examineMode: false,
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
	partialize: ({ algorithm, turningRadius, rotNumber, robotLength, robotWidth, examineMode , heuristicMulti, costMulti }) =>
		({ algorithm, turningRadius, rotNumber, robotLength, robotWidth, examineMode, heuristicMulti, costMulti })
}));

export const play = (force=true) => useGameState.setState(state => {
	if (state.isPlaying && !force)
		return state;
	state.pathfinder?.stop();
	const { grid, size } = useLevelState.getState();
	const { addResult, algorithm } = state;
	if (!grid) return state;
	const pathfinder = algorithm === 'A*'
		? new Astar({ state, grid, size, animate: true })
		: new DstarLite({ state, grid, size, animate: true });
	const rot = Math.ceil(state.rotNumber / 4);
	const playerPos = { x: 0, y: 0, rot };
	const targetPos = { x: size-1, y: size-1, rot };
	pathfinder.findPath(playerPos, targetPos)
		.then(res => !res?.aborted && addResult(res));
	return { ...state, playerPos, targetPos, pathfinder, isPlaying: true };
});

export const distance = (a: Position, b: Position) =>
	Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export function neighborsFactory(params: PathfinderParams, reverse=false) {
	const state = params.state;
	const { neighborsRadius, rotNumber } = state;
	const curves: PathCurve[][] = Array(rotNumber).fill(null).map(() => []);

	for (let rot0 = 0; rot0 < rotNumber; ++rot0) {
		const pos0 = { x: 0, y: 0, rot: rot0 };
		for (let x = -neighborsRadius; x < neighborsRadius + 1; ++x) {
			for (let y = -neighborsRadius; y < neighborsRadius + 1; ++y) {
				if (x === 0 && y === 0)
					continue;
				for (let rot = 0; rot < rotNumber; ++rot) {
					const bunch = computeCurves(pos0, { x, y, rot }, state);
					curves[rot0].push(...bunch);
				}
			}
		}
	}
	const rendered = curves.map(forRot => forRot.map(c => 
		({ curve: c, mask: renderCurveGridMask(c, state) })));

	const { grid, size } = params;

	return (pos: Position) => rendered[pos.rot].map(({ curve, mask }) => {
		const tx = curve.target.x + pos.x;
		const ty = curve.target.y + pos.y;
		const trot = curve.target.rot;

		if (tx < 0 || tx >= size)
			return null;
		if (ty < 0 || ty >= size)
			return null;

		const multi = state.costMulti / 256;
		let totalCost = 0;

		for (const { x, y, w } of mask) {
			const ax = x + pos.x, ay = y + pos.y;
			const cost = grid[ay * size + ax];
			if (cost == null || cost >= 255)
				return null;
			totalCost += (1 + cost * multi) * w;
		}
		totalCost *= reverse !== curve.reverse ? 4 : 1;

		return { x: tx, y: ty, rot: trot, curve, cost: totalCost };
	}).filter((a): a is Position & {
		curve: PathCurve,
		cost: number
	} => a != null);
}