import { useState } from 'react';
import { Level } from './Level';
import { Position, useGameState } from './game';
import { useLevelState } from './level';

import * as THREE from 'three';

const { min, max, round } = Math;

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
	const g = useGameState();
	const { grid, size } = useLevelState();
	const [userPos, setUserPos] = useState<Position>();
	const pos: Position = userPos ?? { x: size / 2, y: size / 2, rot: 0 };

	const closestNode = ({ x, y }: Position) => ({
		x: max(0, min(round(x), size - 1)),
		y: max(0, min(round(y), size - 1)),
	});

	return <>
		<Level {...{ onClick: e => console.log(e.point.x, e.point.y, e) }}/>
		<mesh position={[pos.x, pos.y, 0]}>
			<shapeGeometry args={[arrowShape]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>
	</>;
}