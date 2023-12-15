import { GameState, Position } from './game';
import * as THREE from 'three';

const { PI, floor, ceil, round, min, max } = Math;
const mod2PI = (a: number) => (a + 2 * PI) % (2 * PI);

export type PathNode = Position & { side: 1 | -1 };
export type Arc = Position & { phi: number, side: 1 | -1 };
export type Line = { x1: number, y1: number, x2: number, y2: number };
export type PathCurve = {
	start: Position,
	target: Position,
	reverse: boolean,
	line: Line,
	a0?: Arc,
	a1?: Arc
};

export function computeCurves(start: Position, target: Position, state: GameState): PathCurve[] {
	const { rotNumber, turningRadius: r } = state;
	const result = [];
	for (const reverse of [false, true]) {
		const a = reverse ? target : start;
		const b = reverse ? start : target;
		const dy = (b.y - a.y);
		const dx = (b.x - a.x);
		const x0 = reverse ? -dx : 0;
		const y0 = reverse ? -dy : 0;

		const rot1 = PI * 2 / rotNumber * a.rot;
		const rot2 = PI * 2 / rotNumber * b.rot;

		// check for straight line
		const angle = (Math.atan2(dy, dx) + 2 * PI) % (2 * PI);
		if (Math.abs(rot1 - rot2) + Math.abs(rot1 - angle) < .001) {
			return [{ line: { x1: x0, y1: y0, x2: x0 + dx, y2: y0 + dy }, start, target, reverse }];
		}

		for (const [side1, side2] of [[-1, 1], [1, -1], [1, 1], [-1, -1]] as const) {
			const inner = side1 !== side2;

			const x1 = x0 + Math.cos(rot1 + side1 * PI / 2) * r;
			const y1 = y0 + Math.sin(rot1 + side1 * PI / 2) * r;
			const x2 = x0 + Math.cos(rot2 + side2 * PI / 2) * r + dx;
			const y2 = y0 + Math.sin(rot2 + side2 * PI / 2) * r + dy;

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
				start,
				target,
				reverse,
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
	}
	return result;
}

export function renderCurveGridMask({ line, a0, a1, start, target }: PathCurve, state: GameState) {
	const { turningRadius: r, robotWidth: w, robotLength: l } = state;

	// this whole function is cursed, don't even try to comprehend

	const outerR = Math.sqrt((r + w / 2) ** 2 + (l / 2) ** 2);
	const innerR = r - w / 2;
	const phi = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
	const minx = min(line.x1, line.x2);
	const miny = min(line.y1, line.y2);
	const maxx = max(line.x1, line.x2);
	const maxy = max(line.y1, line.y2);

	let weights = [];
	for (let x = floor(minx) - ceil(w); x < ceil(maxx) + ceil(w); ++x) {
		for (let y = floor(miny) - ceil(w); y < ceil(maxy) + ceil(w); ++y) {
			const dx = x - line.x1, dy = y - line.y1;
			const cellPhi = Math.atan2(dy, dx);
			const cellPhiE = Math.atan2(y - line.y2, x - line.x2);
			const ad = (phi - cellPhi + PI*2 + PI) % (PI*2) - PI;
			const ade = (phi - cellPhiE + PI*2 + PI) % (PI*2) - PI;
			const isleft = ad > 0;
			const tana = phi + (isleft ? 1 : -1) * PI / 2;
			const corner = (floor(tana / PI * 2) * PI / 2) + PI / 4;
			const cx = Math.cos(corner) / Math.SQRT2;
			const cy = Math.sin(corner) / Math.SQRT2;
	
			const cdx = dx + cx, cdy = dy + cy;
			const chyp = Math.sqrt(cdx**2 + cdy**2);
			const hyp = Math.sqrt(dx**2 + dy**2);
			const hypE = Math.sqrt((x - line.x2)**2 + (y - line.y2)**2);
			const cdist = Math.sin(phi - Math.atan2(cdy, cdx)) * chyp;
			const dist = Math.abs(Math.sin(ad) * hyp);
			const odist = (isleft ? cdist: -cdist) - w / 2; 

			if (dist > .7 && odist > 0)
				continue;
			let wgt = Math.min(1, odist < -w ? w : (-odist));
			if (Math.abs(ad) > PI / 2)
				wgt = hyp >= 1 ? 0 : Math.min(1, w, wgt / hyp);
			if (Math.abs(ade) < PI / 2)
				wgt = hypE >= 1 ? 0 : Math.min(1, w, wgt / hypE);
			if (wgt > 0)
				weights.push({ x, y, w: Math.min(1, .1 + wgt) });
		}
	}

	for (const [i, a] of [a0, a1].entries()) {
		if (!a) continue;
		const ap0 = a.phi - a.side * PI/2 % (2*PI);
		const ap1 = a.rot - a.side * PI/2 % (2*PI);
		const ad = (2*PI + (ap1 - ap0) * a.side) % (2*PI);
		const x0 = round(a.x), y0 = round(a.y), rrr = ceil(r) + 1;
		if (ad <= 0) continue;

		for (let x = x0 - rrr; x < x0 + rrr + 1; ++x) {
			for (let y = y0 - rrr; y < y0 + rrr + 1; ++y) {
				const dy = y - a.y, dx = x - a.x;
				const cph = Math.atan2(dy, dx);
				const pd = (2*PI + (cph - ap0) * a.side) % (2*PI);
				const centerRadius = Math.sqrt(dx ** 2 + dy ** 2);
				const inner = centerRadius < r;

				const acorn = (floor(cph / PI * 2) * PI / 2) + PI / 4;
				const cx = dx + Math.cos(acorn) / Math.SQRT2 * (inner ? 1 : -1);
				const cy = dy + Math.sin(acorn) / Math.SQRT2 * (inner ? 1 : -1);
				const cornerRadius = Math.sqrt(cx**2 + cy**2);
			
				if ((pd - ad) * (i > 0 ? 1 : -1) > 0)
					continue;

				if (!inner && cornerRadius > outerR)
					continue;
				if (inner && cornerRadius < innerR)
					continue;

				const dist = inner ? innerR - centerRadius : centerRadius - outerR;
				const wgt = Math.max(.05, Math.min(Math.SQRT2 / 2 - dist, w + .1, 1));
				const found = weights.find(g => g.x === x && g.y === y);
				if (found)
					found.w = (found.w + wgt) / 2;
				else
					weights.push({ x, y, w: wgt });
			}
		}
	}

	const dx = target.x - start.x, dy = target.y - start.y;
	weights = weights.filter(a => a.x !== 0 || a.y !== 0);
	weights = weights.filter(a => a.x !== dx || a.y !== dy);
	weights.push({ x: 0, y: 0, w: Math.min(1, w / 2) });
	weights.push({ x: dx, y: dy, w: Math.min(1, w / 2) });
	return weights;
}

export function drawCurveSegment(p: THREE.Path, { line, a0: arc0, a1: arc1, reverse }: PathCurve, state: GameState) {
	const { turningRadius: r } = state;
	const { x, y } = p.currentPoint;
	if (arc0 && arc1) {
		const a0 = reverse ? arc1 : arc0;
		const a1 = reverse ? arc0 : arc1;
		p.arc(a0.x, a0.y, r,
			a0.rot - a0.side * PI/2,
			a0.phi - a0.side * PI/2, (a0.side < 0) !== reverse);
		p.arc(x + a1.x - p.currentPoint.x, y + a1.y - p.currentPoint.y, r,
			a1.phi - a1.side * PI/2,
			a1.rot - a1.side * PI/2, (a1.side < 0) !== reverse);
	} else {
		p.moveTo(x + line.x1, y + line.y1);
		p.lineTo(x + line.x2, y + line.y2);
	}
}

export function drawCurve(curve: PathCurve, state: GameState) {
	const p = new THREE.Path();
	drawCurveSegment(p, curve, state);
	return new THREE.BufferGeometry().setFromPoints(p.getPoints(32));
}