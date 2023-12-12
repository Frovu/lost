import { useMemo, useState } from 'react';
import { Level } from './Level';
import { Coords, GameState, Position, neighborsFactory, posEqual, useGameState } from './game';
import { useLevelState } from './level';

import * as THREE from 'three';
import { PathCurve, computeCurves, drawCurve } from './curves';

const { min, max, round, PI } = Math;

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
	const { rotNumber } = state;
	const { size } = useLevelState();
	const [target, setTarget] = useState<Position | null>(null);
	const [start, setStart] = useState<Position>({ x: size / 2, y: size / 2, rot: 0 });

	const closestNode = ({ x: ax, y: ay }: Coords) => {
		const [x, y] = [ax, ay].map(a => max(0, min(round(a), size - 1)));
		return { x, y, rot: getrot1tion(x, y, ax, ay) };
	};

	const allPaths = useMemo(() => {
		if (!start) return null;
		const fact = neighborsFactory(state);
		return fact(start.rot % state.rotNumber).map(c => drawCurve(c, state));
	}, [start, state]);

	const thePath = useMemo(() => {
		if (!start || !target) return null;
		const curve = computeCurves(start, target, state)[0];
		if (!curve) return null;
		const { a0, a1, line } = curve;
		const { turningRadius: r, robotWidth: w, robotLength: l } = state;

		const left = new THREE.Path();
		const right = new THREE.Path();
		if (a0 && a1) {
			const outerR = Math.sqrt((r + w / 2) ** 2 + (l / 2) ** 2);
			const innerR = r - w / 2;

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
			const rot = PI * 2 / rotNumber * start.rot;
			const x = Math.cos(rot + PI / 2) * w / 2;
			const y = Math.sin(rot + PI / 2) * w / 2;
			console.log(x, y, line)
			left.moveTo(x, y);
			left.lineTo(x + line.x2 - line.x1, y + line.y2 - line.y1);
			right.moveTo(-x, -y);
			right.lineTo(-x + line.x2 - line.x1, -y + line.y2 - line.y1);
		}

		return { path: drawCurve(curve, state),
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
		{allPaths && allPaths.map( p => <line geometry={p} position={[start.x, start.y, 0]}>
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
	</>;
}