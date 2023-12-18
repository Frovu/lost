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
	limit?: number,
	grid: Uint8ClampedArray,
	size: number,
}

export type PathfindingResult = {
	success?: boolean,
	params: PathfinderParams,
	aborted: boolean,
	path: NodeBase[],
	nodesVisited: number,
	timeConsumed: number,
	at: number,
};

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
	const { addResult, algorithm, playerPos, targetPos } = state;
	if (!grid) return state;
	const pathfinder = algorithm === 'A*'
		? new Astar({ state, grid, size, animate: true })
		: new DstarLite({ state, grid, size, animate: true });
	pathfinder.findPath(playerPos, targetPos)
		.then(res => !res?.aborted && addResult(res));
	return { ...state, playerPos, targetPos, pathfinder, isPlaying: true };
});

export const distance = (a: Position, b: Position) =>
	Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export const initRandomLevel = async () => {
	const { grid, size } = useLevelState.getState();
	const state = useGameState.getState();
	const { rotNumber } = state;
	if (!grid) return;
	console.time('level init');

	const randomPos = (): Position => {
		const x = Math.floor(Math.random() * size);
		const y = Math.floor(Math.random() * size);
		const rot = Math.floor(Math.random() * rotNumber);
		for (let nx = x - 2; nx < x + 3; ++ nx) {
			for (let ny = y - 2; ny < y + 3; ++ ny) {
				if (nx < 0 || nx >= size || ny < 0 || ny >= size)
					return randomPos();
				if (grid[ny * size + nx] >= 255)
					return randomPos();
			}
		}
		return { x, y, rot };
	};

	for (let i = 0; i < 128; ++i) {
		const start = randomPos();
		const goal = randomPos();
		if (distance(start, goal) < size * .8)
			continue;
		i += 16;
		if (await checkReachable(state, start, goal)) {
			console.timeEnd('level init');
			useGameState.setState(st => ({
				...st, results: [], playerPos: start, targetPos: goal }));
			return play();
		}
	}
	console.log('too much random retries');
	console.timeEnd('level init');
};

export function checkReachable(st: GameState, a: Position, b: Position) {
	const { grid, size } = useLevelState.getState();
	if (!grid) return false;
	const state = { ...st, heuristicMulti: 10 };
	const forw = new DstarLite({ state, grid, size, animate: false, limit: 1000 });
	const back = new DstarLite({ state, grid, size, animate: false, limit: 1000 });
	return new Promise<boolean>(resolve => {
		const found = (r: PathfindingResult) => {
			if (!r.aborted && r.success)
				resolve(true);
			else
				resolve(false);
			forw.stop();
			back.stop();
		};
		forw.findPath(a, b).then(found);
		back.findPath(b, a).then(found);
	});

}

export function neighborsFactory(params: PathfinderParams, reverse=false, ignoreWalls=false) {
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
			if (!ignoreWalls && (cost == null || cost >= 255))
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