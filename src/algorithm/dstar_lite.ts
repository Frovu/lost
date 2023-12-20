import { PriorityQueue } from '@datastructures-js/priority-queue';
import { NodeBase, Pathfinder, PathfinderParams, PathfindingResult, Position, applyMask,
	closestNode, distance, neighborsFactory, neighborsUnaligned, posEqual, useGameState } from '../game';
import { animatePathfinding } from '../level';
import { computeCurves, renderCurveGridMask } from '../curves';

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
	const dist = Math.sqrt((target.x - pos.x) ** 2 + (target.y - pos.y) ** 2);
	const rotDiff = Math.abs(target.rot - pos.rot) / rotNumber;
	return dist * 1.5 * multi + rotDiff * 2;
}

export default class DstarLite implements Pathfinder {
	params: PathfinderParams;
	graph: Node[][][];
	queue: PriorityQueue<Node>;
	goal: Node;
	stopFlag: boolean=false;
	calculateKey: (a: Node) => Node;
	heuristic: (a: Position, b: Position) => number;
	neighbors: (p: Position) => Required<NodeBase>[];
	 
	constructor(params: PathfinderParams, start: Position, goal: Position) {
		const { size, state: { rotNumber, heuristicMulti } } = params;
		this.params = params;
		this.graph = [...Array(size).keys()]
			.map(y => [...Array(size).keys()]
				.map(x => [...Array(rotNumber).keys()]
					.map(rot => ({ x, y, rot, ...nodeDefaults }))));
		const h = this.heuristic = (a: Position, b: Position) =>
			heuristicFoo(a, b, rotNumber, heuristicMulti);
		this.goal = this.closestAligned(goal, start);
		this.goal.rhs = 0;

		this.neighbors = neighborsFactory(params, true);
		this.calculateKey = (a: Node) => {
			const k = Math.min(a.g, a.rhs);
			a.k1 = k + h(start, a);
			a.k2 = k;
			return a;
		};

		const ini = [this.calculateKey(this.goal)];
		this.queue = PriorityQueue.fromArray<Node>(ini, compare);
	}

	stop() { this.stopFlag = true; }

	closestAligned(pos: Position, opposite: Position) {
		if (pos.x % 1 === 0 && pos.y % 1 === 0)
			return this.graph[pos.y][pos.x][pos.rot];
		const neighbors = neighborsUnaligned(pos, this.params);
		const guess = neighbors.sort((a, b) => {
			const ra = a.cost + this.heuristic(a, opposite);
			const rb = b.cost + this.heuristic(b, opposite);
			return ra - rb;
		})[0];
		const p = guess ?? closestNode(pos, this.params.size);
		return this.graph[p.y][p.x][p.rot];
	}

	renderPath(start: Position, target: Position) {
		if (!this.graph) return [];
		const { state } = this.params;
		const neighbors = neighborsFactory(this.params, false, true);
		const priority = (p:ReturnType<typeof neighbors>[number]) =>
			this.graph![p.y][p.x][p.rot].g + p.cost;

		const rec = (pos:NodeBase, path:NodeBase[]):NodeBase[] => {
			const cur = this.graph![pos.y][pos.x][pos.rot];
			// try to move to the goal directly
			if (distance(cur, target) < 5) {
				for (const curve of computeCurves(cur, target, state)) {
					const mask = renderCurveGridMask(curve, state);
					const res = applyMask(cur, curve, mask, this.params);
					if (res)
						return [...path, { ...target, ...res }];
				}
			}
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
		if (start.x % 1 !== 0 || start.y % 1 !== 0) {
			const sorted = neighborsUnaligned(start, this.params, 4)
				.filter(a => isFinite(priority(a)))
				.sort((a, b) => priority(a) - priority(b));
			for (const pos of sorted)
				return rec(pos, [pos]);
			console.log('failed to find path start');
			return [];
		}
		return rec(start, []);
	}

	async findPath(pos: Position): Promise<PathfindingResult> {
		const { params, goal, graph, queue, neighbors, calculateKey } = this;
		const { size, limit } = params;

		const start = this.closestAligned(pos, goal);

		const updateNode = (a: Node) => {
			queue.remove(node => posEqual(a, node));
			if (a.g !== a.rhs)
				queue.enqueue(calculateKey(a));
		};

		let totalVisits = 0;

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
					nodesVisited: totalVisits,
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
					if (neighbor !== goal)
						neighbor.rhs = Math.min(neighbor.rhs, node.g + cost);
					updateNode(neighbor);
				}
			} else {
				const gOld = node.g;
				node.g = Infinity;
				for (const { x, y, rot, cost } of [...neighbors(node), node]) {
					const s = graph[y][x][rot];
					if (s.rhs === gOld + (cost ?? 0) && s !== goal)
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
			nodesVisited: totalVisits,
			at: Date.now()
		};
	};
}