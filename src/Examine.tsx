import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { Level } from './Level';
import { Coords, GameState, Position, neighborsUnaligned, posEqual, useGameState } from './game';
import { useLevelState } from './level';

import * as THREE from 'three';
import { computeCurves, drawCurve, renderCurveGridMask } from './curves';

const { min, max, round, ceil, PI } = Math;

export const arrowShape = (state: GameState) => {
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

function getRotation(x1: number, y1: number, x2: number, y2: number) {
	const { rotNumber } = useGameState.getState();
	const dx = x1 - x2, dy = y1 - y2;
	const rad = Math.atan2(dy, dx);
	return round((rad / PI / 2 + .5) * rotNumber) % rotNumber;
}

export default function Examine() {
	const state = useGameState();
	const { rotNumber, viewRadius } = state;
	const { size, grid } = useLevelState();
	const [target, setTarget] = useState<Position | null>(null);
	const [start, setStart] = useState<Position>({ x: Math.round(size / 2), y: Math.round(size / 2) + .45, rot: 0 });
	start.rot %= state.rotNumber;

	const closestNode = ({ x: ax, y: ay }: Coords) => {
		const [x, y] = [ax, ay].map(a => max(0, min(round(a), size - 1)));
		return { x, y, rot: getRotation(x, y, ax, ay) };
	};

	// const graph = useMemo(() => [...Array(size).keys()]
	// 	.map(y => [...Array(size).keys()]
	// 		.map(x => [...Array(rotNumber).keys()]
	// 			.map(rot => ({ x, y, rot }))))
	// , [size, rotNumber]);

	const visible = useMemo(() => {
		const r = viewRadius;
		const nodes: Coords[] = [{ x: 0, y: 0 }];
		for (let x = 1; x <= r; ++x) {
			nodes.push({ x, y: 0 }, { x: -x, y: 0 }, { y: x, x: 0 }, { y: -x, x: 0 });
			const h = Math.sqrt(r ** 2 - x ** 2);
			for (let y = 1; y <= h; ++y) {
				nodes.push({ x, y }, { x, y: -y }, { x: -x, y }, { x: -x, y: -y });
			}
		}
		return nodes.map(n => ({ x: start.x + n.x, y: start.y + n.y }));
	}, [start, viewRadius]);

	const allPaths = useMemo(() => {
		if (!start || !grid) return null;
		return neighborsUnaligned(start, { state, grid, size, animate: true });
	}, [start, grid, state, size]);

	const allCurves = useMemo(() => allPaths?.map(({ curve }) => drawCurve(curve, state)), [allPaths, state]);

	const thePath = useMemo(() =>
		target && allPaths?.find((res) => posEqual(res, target))
	, [allPaths, target]);

	const visuals = useMemo(() => {
		if (!start || !target || !grid) return null;
		const curve = thePath?.curve ?? computeCurves(start, target, state)[0];
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
			left.moveTo( tanX + line.x1,  tanY + line.y1);
			left.lineTo( tanX + line.x2,  tanY + line.y2);
			right.moveTo(-tanX + line.x1, -tanY + line.y1);
			right.lineTo(-tanX + line.x2, -tanY + line.y2);
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

		const weights = renderCurveGridMask(curve, state);

		let totalCost = 0;
		for (const { x, y, w: wg } of weights) {
			const tx = x + start.x;
			const ty = y + start.y;
			if (tx < 0 || tx >= size) {
				totalCost = 999.9;
				break;
			}
			if (ty < 0 || ty >= size) {
				totalCost = 999.9;
				break;
			}
			const cost = grid[ty * size + tx];
			if (cost >= 255) {
				totalCost = 999.9;
				break;
			}
			totalCost += (1 + cost * state.costMulti / 256) * wg;
		}

		return {
			cost: totalCost,
			weights,
			path: drawCurve(curve, state),
			intercepts: xIntercepts.concat(yIntercepts),
			left: new THREE.BufferGeometry().setFromPoints(left.getPoints(32)),
			right: new THREE.BufferGeometry().setFromPoints(right.getPoints(32)) };
	}, [start, target, grid, thePath?.curve, state, rotNumber, size]);

	const arrow = arrowShape(state);

	return <><div style={{ position: 'absolute', top: 0, left: 8 }}>
		{visuals && ('cost=' + visuals.cost.toFixed(1))}
	</div>
	<Canvas flat orthographic onContextMenu={e => e.preventDefault()}>
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
		{allCurves && allCurves.map(p => <line geometry={p} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='rgb(150,50,50)' opacity={1} transparent/>
		</line>) }
		{/* @ts-ignore */}
		{visuals?.path && <line geometry={visuals.path} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='cyan' opacity={.7} transparent/>
		</line> }
		{/* @ts-ignore */}
		{visuals?.left && <line geometry={visuals.left} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='orange' transparent/>
		</line> }
		{/* @ts-ignore */}
		{visuals?.right && <line geometry={visuals.right} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='orange' transparent/>
		</line> }
		{visuals?.intercepts && visuals.intercepts.map(([x, y]) => <mesh position={[x + start.x, y + start.y, 0]}>
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
		{visuals?.weights && grid && visuals.weights.map(({ x, y, w }) => {
			const tx = x + Math.round(start.x);
			const ty = y + Math.round(start.y);
			const bad = tx < 0 || tx >= size || ty < 0 || ty >= size || grid[ty * size + tx] >= 255;
			return <mesh position={[tx, ty, 0]}>
				<boxGeometry args={[1, 1, 0]}/>
				<meshBasicMaterial color={bad ? 'red' : 'rgb(0,255,0)'} opacity={bad ? .7 : w / 2} transparent/>
			</mesh>;})}
		{visible && visible.map(({ x, y }) => {
			return <mesh position={[x, y, 0]}>
				<boxGeometry args={[1, 1, 0]}/>
				<meshBasicMaterial color='blue' opacity={.15} transparent/>
			</mesh>;})}
	</Canvas></>;
}