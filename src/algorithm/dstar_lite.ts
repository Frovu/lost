import { PriorityQueue } from '@datastructures-js/priority-queue';
import { NodeBase, Pathfinder, PathfinderParams, PathfindingResult, Position, applyMask,
	closestNode, distance, getRadius, neighborsFactory, neighborsUnaligned, posEqual, useGameState } from '../game';
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
	return dist * 1.5 * multi + rotDiff * 4;
}

export default class DstarLite implements Pathfinder {
	params: PathfinderParams;
	graph: Node[][][];
	queue: PriorityQueue<Node>;
	goal: Node;
	start: Position;
	km: number=0;
	stopFlag: boolean=false;
	heuristic: (a: Position, b: Position) => number;
	pred: (p: Position) => Required<NodeBase>[];
	succ: (p: Position) => Required<NodeBase>[];
	allNeighbors: (p: Position) => Required<NodeBase>[];
	 
	constructor(params: PathfinderParams, start: Position, goal: Position) {
		const { size, grid, state: { rotNumber, heuristicMulti } } = params;
		this.params = params;
		this.params.grid = grid.slice();
		this.graph = [...Array(size).keys()]
			.map(y => [...Array(size).keys()]
				.map(x => [...Array(rotNumber).keys()]
					.map(rot => ({ x, y, rot, ...nodeDefaults }))));
		this.heuristic = (a: Position, b: Position) =>
			heuristicFoo(a, b, rotNumber, heuristicMulti);
		this.start = start;
		this.goal = this.closestAligned(goal, start) ?? { x: 0, y: 0, rot: 0 };
		this.goal.rhs = 0;

		this.pred = neighborsFactory(params, true);
		this.succ = neighborsFactory(params, false);
		this.allNeighbors = neighborsFactory(params, true, true);

		const ini = [this.calculateKey(this.goal)];
		this.queue = PriorityQueue.fromArray<Node>(ini, compare);
	}

	calculateKey(a: Node) {
		const k = Math.min(a.g, a.rhs);
		a.k1 = k + this.heuristic(this.start, a) + this.km;
		a.k2 = k;
		return a;
	};

	updateNode(a: Node) {
		a.rhs = Math.min.apply(null, this.succ(a)
			.map(n => n.cost + this.graph[n.y][n.x][n.rot].g));
		this.queue.remove(node => posEqual(a, node));
		if (a.g !== a.rhs)
			this.queue.enqueue(this.calculateKey(a));
	};

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
		const neighbors = neighborsFactory(this.params, false);
		const priority = (p:ReturnType<typeof neighbors>[number]) =>
			this.graph![p.y][p.x][p.rot].g + p.cost;

		const rec = (pos:NodeBase, path:Required<NodeBase>[]):Required<NodeBase>[] => {
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
			if (!isFinite(cur.rhs) || cur === target)
				return path;
			let min = cur as Required<NodeBase>, minR = Infinity;
			for (const p of neighbors(cur)) {
				const node = this.graph![p.y][p.x][p.rot];
				const r = node.g + p.cost;
				if (!min || minR > r) {
					node.curve = p.curve;
					node.cost = p.cost;
					min = node as any;
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
		const { params, goal, graph, queue, pred } = this;
		const { size, limit } = params;

		const start = this.closestAligned(pos, goal);
		let totalVisits = 0;

		const meta = new Uint8ClampedArray(params.size ** 2);

		while (queue.front() && (compare(queue.front(), this.calculateKey(start)) < 0 || start.rhs !== start.g)) {
			const node = queue.pop();
			totalVisits++;
			
			node.visists ++;
			if (node.visists > 3)
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
			this.calculateKey(node);
			if (oldK1 < node.k1 || (oldK1 === node.k1 && oldK2 < node.k2)) {
				queue.enqueue(node);

			} else if (node.g > node.rhs) {
				node.g = node.rhs;
				for (const { x, y, rot } of pred(node))
					this.updateNode(graph[y][x][rot]);

			} else {
				if (node === goal) continue;
				node.g = Infinity;
				for (const { x, y, rot } of pred(node))
					this.updateNode(graph[y][x][rot]);
				this.updateNode(node);
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
					await new Promise(res => setTimeout(res, 10));
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
			success: isFinite(start.rhs),
			aborted: this.stopFlag,
			nodesVisited: totalVisits,
			at: Date.now()
		};
	};

	async updatePath(last: Position, start: Position, newGrid: Uint8ClampedArray) {
		const { params, graph, succ, allNeighbors } = this;
		// const { state, grid, size } = params;
	
		this.start = start;
		// this.km += this.heuristic(last, start) / 4;

		// if (!somethingChanged)
		// 	return null;

		console.log('update path');

		const s = this.graph[start.y][start.x][start.rot];
		s.g = Infinity;
		for (const node of this.queue.toArray())
			this.calculateKey(node);
		for (const { x, y, rot } of allNeighbors(s)) {
			const node = graph[y][x][rot];
			this.updateNode(node);
		}
		this.updateNode(s);

		const res = await this.findPath(start);
		console.log(res)
		console.log(s, succ(s).map(n => this.graph[n.y][n.x][n.rot]).filter(n => isFinite(n.g)))
		console.log(this.renderPath(start, this.goal))
		return res

	};
}