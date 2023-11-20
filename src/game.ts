import { create } from 'zustand';

const SQRT_2 = Math.sqrt(2);

export type Position = { x: number, y: number };

export type NodeBase = Position & { cost: number };

const defaultState = {
	grid: null as null | Uint8ClampedArray,
	size: 16,

};

type GameState = typeof defaultState & {

};

export interface PathfinderParams {
	animate: boolean,
	grid: Uint8ClampedArray,
	size: number,
}

export interface Pathfinder {
	init?: (params: PathfinderParams) => void,
	stop?: () => void,
	findPath?: (position: Position, target: Position) => Promise<NodeBase[]>,
};

export const useGameState = create<GameState>()(set => ({
	...defaultState
}));

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

export function computeCost(a: NodeBase, b: NodeBase) {
	// FIXME: if r != 1
	const dist = (a.x === b.x || a.y === b.y) ? 1 : SQRT_2;
	return dist + dist * b.cost / 64;
}

export const getCost = (p: Position) => {
	const { grid, size } = useGameState.getState();
	return grid![p.y * size + p.x];
};