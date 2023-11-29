import { useMemo, useState } from 'react';
import { Level } from './Level';
import { Coords, Position, posEqual, useGameState } from './game';
import { useLevelState } from './level';

import * as THREE from 'three';

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
	const { rotNumber, turningRadius: r } = useGameState();
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
		const dy = b.y - a.y, dx = b.x - a.x;

		const rot1 = PI * 2 / rotNumber * a.rot;
		const rot2 = PI * 2 / rotNumber * b.rot;

		// check for straight line
		const angle = (Math.atan2(dy, dx) + 2 * PI) % (2 * PI);
		if (rot1 === rot2 && rot1 === angle) {
			const p = new THREE.Path();
			p.lineTo(dx, dy);
			return [new THREE.BufferGeometry().setFromPoints(p.getPoints(32))];
		}

		const result = [];

		for (const [side1, side2] of [[-1, 1], [-1, -1], [1, 1], [1, -1]]) {
			const inner = side1 !== side2;

			const x1 = Math.cos(rot1 + side1 * PI / 2) * r;
			const y1 = Math.sin(rot1 + side1 * PI / 2) * r;
			const x2 = Math.cos(rot2 + side2 * PI / 2) * r + dx;
			const y2 = Math.sin(rot2 + side2 * PI / 2) * r + dy;

			const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
			if (inner && dist < 2 * r)
				continue;

			const phi0 = Math.atan2(y2 - y1, x2 - x1);
			const phi = phi0 + side1 * (inner ? Math.asin(2 * r / dist) : 0);
	
			const rot180 = (inner ? PI : 0);
			// const t1x = a.x + r * Math.cos(phi);
			// const t1y = a.y + r * Math.sin(phi);
			const t2x = x2 + r * Math.cos(phi - side1 * PI / 2 + rot180);
			const t2y = y2 + r * Math.sin(phi - side1 * PI / 2 + rot180);

			const p = new THREE.Path();
			p.arc(x1, y1, r, rot1 - side1 * PI/2, phi - side1 * PI/2, side1 < 0);
			p.lineTo(t2x, t2y);
			p.arc(x2 - t2x, y2 - t2y, r, phi - side1 * PI/2 + rot180, rot2 - side1 * PI/2 + rot180, side2 < 0);

			result.push(new THREE.BufferGeometry().setFromPoints(p.getPoints(32)));
		}
		return result;
	}, [start, target, rotNumber, r]);

	return <>
		<Level {...{
			onClick: e => setStart(closestNode(e.point)),
			onPointerMove: e => setTarget(closestNode(e.point))
		}}/>
		<mesh position={[start.x, start.y, 0]}
			rotation={new THREE.Euler(0, 0, start.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrowShape]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh>
		{target && !posEqual(target, start) && <mesh position={[target.x, target.y, 0]}
			rotation={new THREE.Euler(0, 0, target.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrowShape]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>}
		{/* @ts-ignore */}
		{paths && paths.map( p => <line geometry={p} position={[start.x, start.y, 0]}>
			<lineBasicMaterial color='cyan'/>
		</line>) }
	</>;
}