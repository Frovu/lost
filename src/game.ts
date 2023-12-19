import { create } from 'zustand';
import { useLevelState } from './level';
import { PathCurve, computeCurves, renderCurveGridMask } from './curves';
import { persist } from 'zustand/middleware';
import DstarLite from './algorithm/dstar_lite';

export const algoOptions = ['A*', 'D* lite'] as const;
export const actions = ['draw', 'set goal', 'set pos'] as const;
export const REVERSE_MULTIPLIER = 4;

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
	targetPos: { x: 10, y: 10, rot: 1 },
	algorithm: 'D* lite' as typeof algoOptions[number],
	turningRadius: 1,
	neighborsRadius: 2,
	rotNumber: 8,
	action: null as null | { action: typeof actions[number], stage: number },
	examineMode: false,
	isPlaying: false,
	isPathfinding: false,
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
			findPath(false);
		if (['playerPos', 'targetPos'].includes(k))
			set(st => ({ ...st, results: [] }));
	},
	addResult: (res) => set(st => ({ ...st, isPathfinding: false, results: [...st.results, res] })),
	reset: () => set(st => {
		st.pathfinder?.stop();
		return { ...st, results: [], isPlaying: false, isPathfinding: false }; }),
}), {
	name: 'you lost',
	partialize: ({ playerPos, targetPos, algorithm, turningRadius, rotNumber, robotLength, robotWidth, examineMode , heuristicMulti, costMulti }) =>
		({ playerPos, targetPos, algorithm, turningRadius, rotNumber, robotLength, robotWidth, examineMode, heuristicMulti, costMulti })
}));

export const play = () => useGameState.setState(state => {
	if (state.isPlaying) {
		state.pathfinder?.stop();
		return { ...state, isPlaying: false };
	}
	
	return { ...state, isPlaying: true };
});

export const findPath = (force=true) => useGameState.setState(state => {
	const { addResult, playerPos, targetPos } = state;
	const { grid, size } = useLevelState.getState();
	if (!grid || (state.isPathfinding && !force))
		return state;
	state.pathfinder?.stop();

	const pathfinder = new DstarLite({ state, grid, size, animate: true });
	pathfinder.findPath(playerPos, targetPos)
		.then(res => !res?.aborted && addResult(res));

	return { ...state, playerPos, targetPos, pathfinder, isPathfinding: true };
});

export const closestNode = ({ x: ax, y: ay }: Coords, size: number) => {
	const [x, y] = [ax, ay].map(a => Math.max(0, Math.min(Math.round(a), size - 1)));
	return { x, y };
};

export const distance = (a: Position, b: Position) =>
	Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export const initRandomLevel = async () => {
	const { grid, size } = useLevelState.getState();
	const state = useGameState.getState();
	const { rotNumber } = state;
	if (!grid) return;
	console.time('level init');

	const randomPos = (): Position => {
		const ux = Math.random() * size;
		const uy = Math.random() * size;
		const x = Math.floor(ux);
		const y = Math.floor(uy);
		const rot = Math.floor(Math.random() * rotNumber);
		for (let nx = x - 2; nx < x + 3; ++ nx) {
			for (let ny = y - 2; ny < y + 3; ++ ny) {
				if (nx < 0 || nx >= size || ny < 0 || ny >= size)
					return randomPos();
				if (grid[ny * size + nx] >= 255)
					return randomPos();
			}
		}
		return { x: ux, y: uy, rot };
	};

	for (let i = 0; i < 128; ++i) {
		const start = randomPos();
		const goal = randomPos();
		if (distance(start, goal) < (size - 6) * .8)
			continue;
		i += 16;
		// if (await checkReachable(state, start, goal)) {
		console.timeEnd('level init');
		useGameState.setState(st => ({
			...st, results: [], playerPos: start, targetPos: goal }));
		return findPath();
		// }
	}
	console.log('too much random retries');
	console.timeEnd('level init');
};

export function checkReachable(st: GameState, a: Position, b: Position) {
	const { grid, size } = useLevelState.getState();
	if (!grid) return false;
	const state = { ...st, heuristicMulti: 10 };
	const forw = new DstarLite({ state, grid, size, animate: false, limit: size * 10 });
	const back = new DstarLite({ state, grid, size, animate: false, limit: size * 10 });
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

export function applyMask(pos: Position, curve: PathCurve, mask: ReturnType<typeof renderCurveGridMask>,
	params: PathfinderParams, noWalls=false, reverse=false) {
	const { grid, size, state: { costMulti } } = params;
	let cost = 0;
	for (const { x, y, w } of mask) {
		const c = grid[(y + pos.y) * size + x + pos.x];
		if (!noWalls && (c == null || c >= 255))
			return null;
		cost += (1 + c * costMulti / 256) * w;
	}
	cost *= reverse !== curve.reverse ? REVERSE_MULTIPLIER : 1;
	return { curve, cost };
}

export function neighborsUnaligned(pos: Position, params: PathfinderParams, overrideRadius?: number) { 
	const { state, size } = params;
	const { neighborsRadius, rotNumber } = state;
	const rrr = overrideRadius ?? neighborsRadius;
	const x0 = Math.round(pos.x), y0 = Math.round(pos.y);
	const pos0 = { x: x0, y: y0, rot: pos.rot };
	const neighbors: Required<NodeBase>[] = [];
	for (let x = x0 - rrr; x < x0 + rrr + 1; ++x) {
		for (let y = y0 - rrr; y < y0 + rrr + 1; ++y) {
			if (x === x0 && y === y0)
				continue;
			if (x < 0 || x >= size)
				continue;
			if (y < 0 || y >= size)
				continue;
			for (let rot = 0; rot < rotNumber; ++rot) {
				for (const curve of computeCurves(pos, { x, y, rot }, state)) {
					const res = applyMask(pos0, curve, renderCurveGridMask(curve, state), params);
					if (res)
						neighbors.push({ x, y, rot, ...res });
				}
			}
		}
	}
	return neighbors;
}

export function neighborsFactory(params: PathfinderParams, reverse=false, ignoreWalls=false) {
	const { state, size } = params;
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

	return (pos: Position) => rendered[pos.rot].map(({ curve, mask }) => {
		const tx = curve.target.x + pos.x;
		const ty = curve.target.y + pos.y;
		const trot = curve.target.rot;

		if (tx < 0 || tx >= size)
			return null;
		if (ty < 0 || ty >= size)
			return null;

		const res = applyMask(pos, curve, mask, params, ignoreWalls, reverse);
		return res && { x: tx, y: ty, rot: trot, ...res };
	}).filter((a): a is Position & {
		curve: PathCurve,
		cost: number
	} => a != null);
}