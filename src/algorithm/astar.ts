import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { Pathfinder, PathfinderParams, Position, computeCost, neighbors } from '../game';

type Node = Position & {
	cost: number,
	h: number,
	g: number,
	f: number,
	parent: null | Node
};

const nodeDefaults = {
	h: Infinity,
	f: Infinity,
	g: Infinity,
	parent: null
};

function buildPath(target: Node, path: Node[]=[]): Node[] {
	if (!target.parent)
		return [target];
	return buildPath(target.parent).concat(target);
}

function heuristic(pos: Position, target: Position) {
	return Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y);
}

export default class Astar implements Pathfinder{
	opts: PathfinderParams;
	grid: Node[][];
	 
	constructor(opts: PathfinderParams) {
		const { size, grid } = opts;
		this.opts = opts;
		this.grid = [...Array(size).keys()]
			.map(y => [...Array(size).keys()]
				.map(x => ({ x, y, cost: grid[y * size + x], ...nodeDefaults })));
	}

	findPath(startPos: Position, targetPos: Position): Position[] {
		const { grid, opts } = this;
		const target = grid[targetPos.x][targetPos.y];
		const start = grid[startPos.x][startPos.y];
		start.g = 0;

		const queue = MinPriorityQueue.fromArray<Node>([start], node => node.f);

		while (queue.front()) {
			const current = queue.pop();

			if (current === target)
				return buildPath(current);

			for (const node of neighbors(grid, current, opts)) {
				
				const tentativeG = current.g + computeCost(current, node);
				const alreadyVisited = isFinite(node.g);

				if (tentativeG < node.g) {
					node.parent = current;
					node.g = tentativeG;
					node.f = tentativeG + heuristic(node, target);

					if (alreadyVisited)
						queue.remove(({ x, y }) => node.x === x && node.y === y);

					queue.push(node);
				}
			}
		}
		return [];
	};
}