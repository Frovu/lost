import { useMemo, useState } from 'react';
import { Level } from './Level';
import { Coords, Position, neighborsFactory, posEqual, useGameState } from './game';
import { useLevelState } from './level';

import * as THREE from 'three';
import { computeCurves, drawCurve } from './curves';

const { min, max, round, PI } = Math;

const arrowShape = new THREE.Shape();
arrowShape.moveTo(-.4, -.05);
arrowShape.lineTo(-.4, .05);
arrowShape.lineTo(-.4, .05);
arrowShape.lineTo(.1, .05);
arrowShape.lineTo(.1, .2);
arrowShape.lineTo(.5, 0);
arrowShape.lineTo(.1, -.2);
arrowShape.lineTo(.1, -.05);
arrowShape.lineTo(-.4, -.05);

function getrot1tion(x1: number, y1: number, x2: number, y2: number) {
	const { rotNumber } = useGameState.getState();
	const dx = x1 - x2, dy = y1 - y2;
	const rad = Math.atan2(dy, dx);
	return round((rad / PI / 2 + .5) * rotNumber) % rotNumber;
}

export default function Examine() {
	const state = useGameState();
	const { rotNumber, turningRadius: r } = state;
	const { size } = useLevelState();
	const [target, setTarget] = useState<Position | null>(null);
	const [start, setStart] = useState<Position>({ x: size / 2, y: size / 2, rot: 0 });

	const closestNode = ({ x: ax, y: ay }: Coords) => {
		const [x, y] = [ax, ay].map(a => max(0, min(round(a), size - 1)));
		return { x, y, rot: getrot1tion(x, y, ax, ay) };
	};

	const paths = useMemo(() => {
		if (!start || !target) return null;
		const a = start, b = target;
		const fact = neighborsFactory(state);
		console.log(fact(b.rot % state.rotNumber))
		return fact(b.rot % state.rotNumber).map(c => drawCurve(c, state));
		// return computeCurves(a, b, state).map(c => drawCurve(c, state));
	}, [start, target, state]);

	return <>
		<Level {...{
			onClick: e => setStart(closestNode(e.point)),
			onPointerMove: e => setTarget(closestNode(e.point))
		}}/>
		{/* <mesh position={[start.x, start.y, 0]}
			rotation={new THREE.Euler(0, 0, start.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrowShape]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh> */}
		{target && !posEqual(target, start) && <mesh position={[target.x, target.y, 0]}
			rotation={new THREE.Euler(0, 0, target.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrowShape]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>}
		{/* @ts-ignore */}
		{paths && paths.map( p => <line geometry={p} position={[target.x, target.y, 0]}>
			<lineBasicMaterial color='cyan'/>
		</line>) }
	</>;
}