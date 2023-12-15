import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { GameState, NodeBase, Pathfinder, PathfinderParams, PathfindingResult, Position, neighborsFactory, posEqual, useGameState } from '../game';
import { animatePathfinding } from '../level';

type Node = NodeBase & {
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

function heuristic(pos: Position, target: Position, { rotNumber }: GameState) {
	const dist = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y);
	const rotDiff = Math.abs(target.rot - pos.rot) / rotNumber;
	return dist + rotDiff * 4;
}

export default class Astar implements Pathfinder{
	params: PathfinderParams;
	graph: Node[][][];
	stopFlag: boolean=false;
	 
	constructor(params: PathfinderParams) {
		const { size, state: { rotNumber } } = params;
		this.params = params;
		this.graph = [...Array(size).keys()]
			.map(y => [...Array(size).keys()]
				.map(x => [...Array(rotNumber).keys()]
					.map(rot => ({ x, y, rot, ...nodeDefaults }))));
	}

	stop() { this.stopFlag = true; }

	async findPath(startPos: Position, targetPos: Position): Promise<PathfindingResult> {
		const { graph, params } = this;
		const hMulti = params.state.heuristicMulti;
		const target = graph[targetPos.y][targetPos.x][targetPos.rot];
		const start = graph[startPos.y][startPos.x][targetPos.rot];
		let current = start;
		start.g = 0;
		let totalVisits = 0;

		const neighbors = neighborsFactory(params);

		const queue = MinPriorityQueue.fromArray<Node>([start], node => node.f);
		const meta = new Uint8ClampedArray(params.size ** 2);

		while (queue.front()) {
			current = queue.pop();

			totalVisits++;

			if (current === target || this.stopFlag) {
				animatePathfinding(null);
				return {
					params,
					aborted: this.stopFlag,
					path: buildPath(current),
					nodesVisited: totalVisits,
					timeConsumed: 0,
					at: Date.now()
				};
			}

			if (current.visitCount++ >= 3)
				continue;

			if (params.animate) {
				meta.fill(0);
				for (const { x, y } of queue.toArray())
					meta[y * params.size + x] = 1;
				// meta[current.y * params.size + current.x] = 2;
			}
	
			for (const { x, y, rot, curve, cost } of neighbors(current)) {
				const node = graph[y][x][rot];
				const tentativeG = current.g + cost;
				const alreadyVisited = isFinite(node.g);

				const betterBy = node.g - tentativeG;
				if (betterBy > 1) {
					node.parent = current;
					node.curve = curve;
					node.cost = cost;
					node.g = tentativeG;
					node.f = tentativeG + heuristic(node, target, params.state) * hMulti;

					if (alreadyVisited)
						queue.remove(nd => posEqual(node, nd));

					queue.push(node);
				}

				// meta[node.y * params.size + node.x] = 3;
			}
			if (params.animate && totalVisits % useGameState.getState().animationSpeed === 0) {
				await animatePathfinding(meta.slice());
			}
		}

		return {
			params,
			aborted: this.stopFlag,
			path: buildPath(current),
			nodesVisited: totalVisits,
			timeConsumed: 0,
			at: Date.now()
		};
	};
}