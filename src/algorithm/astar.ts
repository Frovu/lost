import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { Pathfinder, PathfinderParams, PathfindingResult, Position, computeCost, neighbors, useGameState } from '../game';
import { animatePathfinding } from '../level';

type Node = Position & {
	cost: number,
	h: number,
	g: number,
	f: number,
	visitCount: number,
	parent: null | Node
};

const nodeDefaults = {
	h: Infinity,
	f: Infinity,
	g: Infinity,
	visitCount: 0,
	parent: null
};

function buildPath(target: Node): Node[] {
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
	stopFlag: boolean=false;
	 
	constructor(opts: PathfinderParams) {
		const { size, grid } = opts;
		this.opts = opts;
		this.grid = [...Array(size).keys()]
			.map(y => [...Array(size).keys()]
				.map(x => ({ x, y, cost: grid[y * size + x], ...nodeDefaults })));
	}

	stop() { this.stopFlag = true; }

	async findPath(startPos: Position, targetPos: Position): Promise<PathfindingResult> {
		const { grid, opts } = this;
		const hMulti = opts.state.heuristicMulti;
		const target = grid[targetPos.y][targetPos.x];
		const start = grid[startPos.y][startPos.x];
		let current = start;
		start.g = 0;
		let totalVisits = 0;

		const queue = MinPriorityQueue.fromArray<Node>([start], node => node.f);
		const meta = new Uint8ClampedArray(opts.size ** 2);

		while (queue.front()) {
			current = queue.pop();

			totalVisits++;

			if (current === target || this.stopFlag) {
				animatePathfinding(null);
				return {
					opts,
					aborted: this.stopFlag,
					path: buildPath(current),
					nodesVisited: totalVisits,
					timeConsumed: 0,
					at: Date.now()
				};
			}

			if (current.visitCount++ >= 3)
				continue;

			if (opts.animate) {
				meta.fill(0);
				for (const { x, y } of queue.toArray())
					meta[y * opts.size + x] = 1;
				// meta[current.y * opts.size + current.x] = 2;
			}
	
			for (const node of neighbors(grid, current, opts)) {
				const tentativeG = current.g + computeCost(current, node, opts);
				const alreadyVisited = isFinite(node.g);

				const betterBy = node.g - tentativeG;
				if (betterBy > 1) {
					node.parent = current;
					node.g = tentativeG;
					node.f = tentativeG + heuristic(node, target) * hMulti;

					if (alreadyVisited)
						queue.remove(({ x, y }) => node.x === x && node.y === y);

					queue.push(node);
				}

				// meta[node.y * opts.size + node.x] = 3;
			}
			if (opts.animate && totalVisits % useGameState.getState().animationSpeed === 0) {
				await animatePathfinding(meta.slice());
			}
		}

		return {
			opts,
			aborted: this.stopFlag,
			path: buildPath(current),
			nodesVisited: totalVisits,
			timeConsumed: 0,
			at: Date.now()
		};
	};
}