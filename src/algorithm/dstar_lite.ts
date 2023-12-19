import { PriorityQueue } from '@datastructures-js/priority-queue';
import { NodeBase, Pathfinder, PathfinderParams, PathfindingResult, Position, REVERSE_MULTIPLIER, closestNode, neighborsFactory, posEqual, useGameState } from '../game';
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

	renderPath(start: Position, target: Position) {
		if (!this.graph) return [];
		const { size, grid, state } = this.params;
		const { costMulti: multi } = state;
		const neighbors = neighborsFactory(this.params, false, true);
		const priority = (p:ReturnType<typeof neighbors>[number]) =>
			this.graph![p.y][p.x][p.rot].g + p.cost;

		const rec = (pos:NodeBase, path:NodeBase[]):NodeBase[] => {
			const cur = this.graph![pos.y][pos.x][pos.rot];
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
			const closest = { ...closestNode(start, size), rot: start.rot };
			const sorted = neighbors(closest).filter(a => isFinite(priority(a)))
				.sort((a, b) => priority(a) - priority(b));
			console.log(sorted)
			for (const pos of sorted) {
				const curves = computeCurves(start, pos, state);
				console.log(curves)
				const masks = curves.map(c => renderCurveGridMask(c, state));
				console.log(masks)
				const idx = masks.findIndex(msk => msk
					.every(p => grid[start.y + p.y * size + start.x + p.x] < 255));
				console.log(masks[0].map(p => grid[start.y + p.y * size + start.x + p.x]))
				if (idx >= 0) {
					const curve = curves[idx];
					let cost = masks[idx].reduce((a, p) =>
						a + p.w + grid[p.y * size + p.x] * multi * p.w, 0);
					cost *= curve.reverse ? REVERSE_MULTIPLIER : 1;
					return rec(pos, [{ ...pos, curve, cost }]);
				}
			}
			console.log('failed to find path start');
			return [];
		}
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

		const strt = closestNode(startPos, size);
		const targ = closestNode(targetPos, size);
		const target = graph[targ.y][targ.x][targetPos.rot];
		const start  = graph[strt.y][strt.x][startPos.rot];
		
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
			path: this.renderPath(startPos, targetPos),
			nodesVisited: totalVisits,
			timeConsumed: 0,
			at: Date.now()
		};
	};
}