import { GameState, Position } from './game';
import * as THREE from 'three';

const { PI } = Math;
const mod2PI = (a: number) => (a + 2 * PI) % (2 * PI);

export type PathNode = Position & { side: 1 | -1 };
export type Arc = Position & { phi: number, side: 1 | -1 };
export type Line = { x1: number, y1: number, x2: number, y2: number };
export type PathCurve = {
	line: Line,
	a0?: Arc,
	a1?: Arc
};

export function computeCurves(a: Position, b: Position, state: GameState): PathCurve[] {
	const { rotNumber, turningRadius: r } = state;
	const dy = b.y - a.y, dx = b.x - a.x;

	const rot1 = PI * 2 / rotNumber * a.rot;
	const rot2 = PI * 2 / rotNumber * b.rot;

	// check for straight line
	const angle = (Math.atan2(dy, dx) + 2 * PI) % (2 * PI);
	if (Math.abs(rot1 - rot2) + Math.abs(rot1 - angle) < .001) {
		return [{ line: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } }];
	}

	const result = [];

	for (const [side1, side2] of [[-1, 1], [1, -1], [1, 1], [-1, -1]] as const) {
		const inner = side1 !== side2;

		const x1 = Math.cos(rot1 + side1 * PI / 2) * r;
		const y1 = Math.sin(rot1 + side1 * PI / 2) * r;
		const x2 = Math.cos(rot2 + side2 * PI / 2) * r + dx;
		const y2 = Math.sin(rot2 + side2 * PI / 2) * r + dy;

		const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
		if (inner && dist < 2 * r)
			continue;

		const phi0 = Math.atan2(y2 - y1, x2 - x1);
		const phi = mod2PI(phi0 + side1 * (inner ? Math.asin(2 * r / dist) : 0));

		// forbid sharp turns
		if (mod2PI((phi - rot1) * side1) > PI / 2)
			continue;
		if (mod2PI((rot2 - phi) * side2) > PI / 2)
			continue;

		result.push({
			line: {
				x1: x1 + r * Math.cos(phi - side1 * PI / 2),
				y1: y1 + r * Math.sin(phi - side1 * PI / 2),
				x2: x2 + r * Math.cos(phi - side2 * PI / 2),
				y2: y2 + r * Math.sin(phi - side2 * PI / 2),
			},
			a0: {
				x: x1, y: y1,
				rot: rot1, phi,
				side: side1,
			},
			a1: {
				x: x2, y: y2,
				rot: rot2, phi,
				side: side2,
			},
		});
	}
	return result;
}

export function drawCurve({ line, a0, a1 }: PathCurve, state: GameState) {
	const { turningRadius: r } = state;
	const p = new THREE.Path();

	if (a0 && a1) {
		p.arc(a0.x, a0.y, r,
			a0.rot - a0.side * PI/2,
			a0.phi - a0.side * PI/2, a0.side < 0);
		p.arc(a1.x - line.x1, a1.y - line.y1, r,
			a1.phi - a1.side * PI/2,
			a1.rot - a1.side * PI/2, a1.side < 0);
	} else {
		p.lineTo(line.x2 - line.x1, line.y2 - line.y1);
	}

	return new THREE.BufferGeometry().setFromPoints(p.getPoints(32));
}