import { useState } from 'react';
import { Level } from './Level';
import { Coords, Position, useGameState } from './game';
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

export default function Examine() {
	const { rotNumber } = useGameState();
	const { grid, size } = useLevelState();
	const [hovering, setHovering] = useState(false);
	const [userPos, setUserPos] = useState<Position>();
	const pos: Position = userPos ?? { x: size / 2, y: size / 2, rot: 0 };

	const closestNode = ({ x, y }: Coords) => ({
		x: max(0, min(round(x), size - 1)),
		y: max(0, min(round(y), size - 1)),
		rot: 0
	});

	return <>
		<Level {...{
			onClick: e => {
				if (hovering)
					return setHovering(false);
				setHovering(true);
				setUserPos(closestNode(e.point)); },
			onPointerMove: e => {
				if (!hovering) return;
				const dx = pos.x - e.point.x, dy = pos.y - e.point.y;
				const rad = Math.atan2(dy, dx);
				console.log()
				const rot = Math.round((rad / PI / 2 + .5) * rotNumber)
				setUserPos({ ...pos, rot });
			}
		}}/>
		<mesh position={[pos.x, pos.y, 0]} rotation={new THREE.Euler(0, 0, pos.rot / rotNumber * PI * 2 )}>
			<shapeGeometry args={[arrowShape]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>
	</>;
}