import { PriorityQueue } from '@datastructures-js/priority-queue';
import { NodeBase, Pathfinder, PathfinderParams, PathfindingResult, Position, neighborsFactory, posEqual, useGameState } from '../game';
import { animatePathfinding } from '../level';

type Node = NodeBase & {
	rhs: number,
	g: number,
	k1: number,
	k2: number,
	visists: number,
};

const nodeDefaults = {
	rhs: Infinity,
	g: Infinity,
	k1: 0,
	k2: 0,
	visists: 0,
};

function compare(a: Node, b: Node) {
	if (a.k1 === b.k1 && a.k2 === b.k2)
		return 0;
	if (a.k1 < b.k1 || (a.k1 === b.k1 && a.k2 < b.k2))
		return -1;
	return 1;
}

function heuristicFoo(pos: Position, target: Position, rotNumber: number, multi: number) {
	const dist = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y);
	const rotDiff = Math.abs(target.rot - pos.rot) / rotNumber;
	return dist * 1.5 * multi + rotDiff * 2;
}

export default class DstarLite implements Pathfinder {
	params: PathfinderParams;
	graph: Node[][][] | undefined;
	stopFlag: boolean=false;
	heuristic: (a: Position, b: Position) => number;
	 
	constructor(params: PathfinderParams) {
		const rn = params.state.rotNumber;
		const multi = params.state.heuristicMulti;
		this.params = params;
		this.heuristic = (a: Position, b: Position) => heuristicFoo(a, b, rn, multi);
	}

	stop() { this.stopFlag = true; }

	renderPath(start: Node, target: Node) {
		if (!this.graph) return [];
		const neighbors = neighborsFactory(this.params, false, true);
		const rec = (cur: Node, path: Node[]): Node[] => {
			if (!isFinite(cur.g) || cur === target)
				return path;
			let min = cur, minR = Infinity;
			for (const p of neighbors(cur)) {
				const node = this.graph![p.y][p.x][p.rot];
				const r = node.g + p.cost;
				if (!min || minR > r) {
					node.curve = p.curve;
					node.cost = p.cost;
					min = node;
					minR = r;
				}
			}
			const found = path.find(n => posEqual(n, min));
			if (found)
				return path;
			return rec(min, path.concat({ ...min }));
		};
		return rec(start, []);
	}

	async findPath(startPos: Position, targetPos: Position): Promise<PathfindingResult> {
		const { params, heuristic } = this;
		const { size, state, limit } = params;
		const { rotNumber } = state;

		const calculateKey = (a: Node) => {
			const k = Math.min(a.g, a.rhs);
			a.k1 = k + heuristic(start, a);
			a.k2 = k;
			return a;
		};

		const updateNode = (a: Node) => {
			queue.remove(node => posEqual(a, node));
			if (a.g !== a.rhs)
				queue.enqueue(calculateKey(a));
		};

		const graph = this.graph = [...Array(size).keys()]
			.map(y => [...Array(size).keys()]
				.map(x => [...Array(rotNumber).keys()]
					.map(rot => ({ x, y, rot, ...nodeDefaults }))));

		const target = graph[targetPos.y][targetPos.x][targetPos.rot];
		const start  = graph[startPos.y][startPos.x][startPos.rot];
		
		target.rhs = 0;
		let totalVisits = 0;

		const neighbors = neighborsFactory(params, true);

		const ini = [calculateKey(target)];
		const queue = PriorityQueue.fromArray<Node>(ini, compare);
		const meta = new Uint8ClampedArray(params.size ** 2);

		while (queue.front() && (compare(queue.front(), calculateKey(start)) <= 0 || start.rhs > start.g)) {
			const node = queue.pop();
			totalVisits++;
			
			node.visists ++;
			if (node.visists > 2)
				continue;

			if (this.stopFlag || totalVisits > (limit ?? 99999)) {
				if (params.animate)
					animatePathfinding(null);
				return {
					params,
					aborted: true,
					path: [],
					nodesVisited: totalVisits,
					timeConsumed: 0,
					at: Date.now()
				};
			}

			const oldK1 = node.k1;
			const oldK2 = node.k2;
			calculateKey(node);
			if (oldK1 < node.k1 || (oldK1 === node.k1 && oldK2 < node.k2)) {
				queue.enqueue(node);

			} else if (node.g > node.rhs) {
				node.g = node.rhs;
				for (const { x, y, rot, cost } of neighbors(node)) {
					const neighbor = graph[y][x][rot];
					if (neighbor !== target)
						neighbor.rhs = Math.min(neighbor.rhs, node.g + cost);
					updateNode(neighbor);
				}
			} else {
				const gOld = node.g;
				node.g = Infinity;
				for (const { x, y, rot, cost } of [...neighbors(node), node]) {
					const s = graph[y][x][rot];
					if (s.rhs === gOld + (cost ?? 0) && s !== target)
						s.rhs = Math.min.apply(null, neighbors(s)
							.map(n => n.cost + graph[n.y][n.x][n.rot].g));
					
					updateNode(s);
				}
			}

			if (params.animate) {
				if (totalVisits % useGameState.getState().animationSpeed === 0) {
					meta.fill(0);
					for (const { x, y } of queue.toArray()) {
						const found = graph[y][x].find(n => isFinite(n.g) && n.g === n.rhs);
						meta[y * size + x] = found ? 2 : 1;
	
					}
					meta[node.y * size + node.x] = 3;
					await animatePathfinding(meta.slice());
				}
			} else {
				if (totalVisits % 500 === 0)
					await new Promise(res => setTimeout(res, 0));
			}
		}

		if (params.animate)
			animatePathfinding(null);
		return {
			params,
			success: isFinite(start.g),
			aborted: this.stopFlag,
			path: this.renderPath(start, target),
			nodesVisited: totalVisits,
			timeConsumed: 0,
			at: Date.now()
		};
	};
}