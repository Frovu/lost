import { useMemo, useState } from 'react';
import { Level } from './Level';
import { Coords, GameState, Position, neighborsFactory, posEqual, useGameState } from './game';
import { useLevelState } from './level';

import * as THREE from 'three';
import { computeCurves, drawCurve } from './curves';

const { min, max, round, ceil, floor, PI } = Math;

const arrowShape = (state: GameState) => {
	const a = new THREE.Shape();
	const { robotLength: l, robotWidth: w } = state;
	a.moveTo(- l / 2, - w / 8);
	a.lineTo(- l / 2,   w / 8);
	a.lineTo(- l / 2,   w / 8);
	a.lineTo(0,  w / 8);
	a.lineTo(0, w / 2);
	a.lineTo(l / 2, 0);
	a.lineTo(0, - w / 2);
	a.lineTo(0, - w / 8);
	a.lineTo(- l / 2, - w / 8);
	return a;
};

function getrot1tion(x1: number, y1: number, x2: number, y2: number) {
	const { rotNumber } = useGameState.getState();
	const dx = x1 - x2, dy = y1 - y2;
	const rad = Math.atan2(dy, dx);
	return round((rad / PI / 2 + .5) * rotNumber) % rotNumber;
}

export default function Examine() {
	const state = useGameState();
	const { rotNumber,  } = state;
	const { size, grid } = useLevelState();
	const [target, setTarget] = useState<Position | null>(null);
	const [start, setStart] = useState<Position>({ x: Math.round(size / 2), y: Math.round(size / 2), rot: 0 });
	start.rot %= state.rotNumber;

	const closestNode = ({ x: ax, y: ay }: Coords) => {
		const [x, y] = [ax, ay].map(a => max(0, min(round(a), size - 1)));
		return { x, y, rot: getrot1tion(x, y, ax, ay) };
	};

	const graph = useMemo(() => [...Array(size).keys()]
		.map(y => [...Array(size).keys()]
			.map(x => [...Array(rotNumber).keys()]
				.map(rot => ({ x, y, rot }))))
	, [size, rotNumber]);

	const allPaths = useMemo(() => {
		if (!start || !grid) return null;
		const fact = neighborsFactory({ state, grid, size, animate: true });
		return fact(start, graph).map(a => drawCurve(a.curve, state));
	}, [start, grid, state, size, graph]);

	const thePath = useMemo(() => {
		if (!start || !target) return null;
		const curve = computeCurves(start, target, state)[0];
		if (!curve) return null;
		const { a0, a1, line } = curve;
		const { turningRadius: r, robotWidth: w, robotLength: l } = state;

		const rot = PI * 2 / rotNumber * start.rot;
		const tanX = Math.cos(rot + PI / 2) * w / 2;
		const tanY = Math.sin(rot + PI / 2) * w / 2;

		const left = new THREE.Path();
		const right = new THREE.Path();
		const outerR = Math.sqrt((r + w / 2) ** 2 + (l / 2) ** 2);
		const innerR = r - w / 2;
		if (a0 && a1) {
			left.arc(a0.x, a0.y,
				a0.side > 0 ? innerR : outerR,
				a0.rot - a0.side * PI/2,
				a0.phi - a0.side * PI/2, a0.side < 0);
			left.arc(a1.x - left.currentPoint.x, a1.y - left.currentPoint.y, 
				a1.side > 0 ? innerR : outerR,
				a1.phi - a1.side * PI/2,
				a1.rot - a1.side * PI/2, a1.side < 0);
			right.arc(a0.x, a0.y,
				a0.side < 0 ? innerR : outerR,
				a0.rot - a0.side * PI/2,
				a0.phi - a0.side * PI/2, a0.side < 0);
			right.arc(a1.x - right.currentPoint.x, a1.y - right.currentPoint.y, 
				a1.side < 0 ? innerR : outerR,
				a1.phi - a1.side * PI/2,
				a1.rot - a1.side * PI/2, a1.side < 0);
		} else {
			left.moveTo(tanX, tanY);
			left.lineTo(tanX + line.x2 - line.x1, tanY + line.y2 - line.y1);
			right.moveTo(-tanX, -tanY);
			right.lineTo(-tanX + line.x2 - line.x1, -tanY + line.y2 - line.y1);
		}

		const yIntercepts = [], xIntercepts = [];
		let [minx, miny, maxx, maxy] = [0, 0, 0, 0];

		const phi = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);

		minx = min(line.x1, line.x2);
		miny = min(line.y1, line.y2);
		maxx = max(line.x1, line.x2);
		maxy = max(line.y1, line.y2);
		const lTanX = Math.cos(phi + PI / 2) * w / 2;
		const lTanY = Math.sin(phi + PI / 2) * w / 2;

		for (let x = ceil(minx); x < ceil(maxx) + 1; ++x) {
			const ly = line.y1 + lTanY + Math.tan(phi) * (x - .5 - lTanX - line.x1);
			const ry = line.y1 - lTanY + Math.tan(phi) * (x - .5 + lTanX - line.x1);
			yIntercepts.push([x - .5, ly, 1]);
			yIntercepts.push([x - .5, ry, -1]);
		}

		for (let y = ceil(miny); y < ceil(maxy) + 1; ++y) {
			const lx = line.x1 + lTanX + (y - .5 - line.y1 - lTanY) / Math.tan(phi);
			const rx = line.x1 - lTanX + (y - .5 - line.y1 + lTanY) / Math.tan(phi);
			xIntercepts.push([lx, y - .5, 1]);
			xIntercepts.push([rx, y - .5, -1]);
		}

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

		return { path: drawCurve(curve, state),
			curve, weights,
			intercepts: xIntercepts.concat(yIntercepts),
			left: new THREE.BufferGeometry().setFromPoints(left.getPoints(32)),
			right: new THREE.BufferGeometry().setFromPoints(right.getPoints(32)) };
	}, [start, target, state, rotNumber]);

	const arrow = arrowShape(state);

	return <>
		<Level {...{
			onClick: e => setStart(closestNode(e.point)),
			onPointerMove: e => setTarget(closestNode(e.point))
		}}/>
		<mesh position={[start.x, start.y, 0]}
			rotation={new THREE.Euler(0, 0, start.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrow]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh>
		{target && !posEqual(target, start) && <mesh position={[target.x, target.y, 0]}
			rotation={new THREE.Euler(0, 0, target.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrow]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>}
		{/* @ts-ignore */}
		{allPaths && allPaths.map(p => <line geometry={p} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='rgb(100,50,50)' opacity={.5} transparent/>
		</line>) }
		{/* @ts-ignore */}
		{thePath && <line geometry={thePath.path} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='cyan' opacity={.7} transparent/>
		</line> }
		{/* @ts-ignore */}
		{thePath?.left && <line geometry={thePath.left} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='orange' transparent/>
		</line> }
		{/* @ts-ignore */}
		{thePath?.right && <line geometry={thePath.right} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='orange' transparent/>
		</line> }
		{thePath?.intercepts && thePath.intercepts.map(([x, y]) => <mesh position={[x + start.x, y + start.y, 0]}>
			<circleGeometry args={[.05]}/>
			<meshBasicMaterial color='rgb(0,255,0)'/>
		</mesh>)}
		{thePath?.curve && <><mesh position={[start.x + thePath.curve.line.x1, start.y + thePath.curve.line.y1, 0]}>
			<circleGeometry args={[.05]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh></>}
		{thePath?.curve && <><mesh position={[start.x + thePath.curve.line.x2, start.y + thePath.curve.line.y2, 0]}>
			<circleGeometry args={[.05]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh></>}
		{thePath?.weights && thePath.weights.map(({ x, y, w }) =>
			<mesh position={[start.x + x, start.y + y, 0]}>
				<boxGeometry args={[1, 1, 0]}/>
				<meshBasicMaterial color='red' opacity={w} transparent/>
			</mesh>)}
	</>;
}