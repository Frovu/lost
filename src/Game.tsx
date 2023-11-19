import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';
import { useMemo } from 'react';
import Astar from './algorithm/astar';
import * as THREE from 'three';

export default function Game() {
	const { size, grid, isGenerating } = useLevelState();

	const pathGeom = useMemo(() => {
		if (isGenerating || !grid) return;
		const astar = new Astar({ grid, size });
		const path = astar.findPath({ x: 0, y: 0 }, { x: size-1, y: size-1 });
		return new THREE.BufferGeometry()
			.setFromPoints(path.map(({ x, y }) => new THREE.Vector3(x, y, 0)));
	}, [grid, isGenerating]);

	return <Canvas camera={{ position: [.5, .5, 255] }} flat orthographic onContextMenu={e => e.preventDefault()}>
		<Level/>
		<mesh position={[size-1, size-1, 0]}>
			<boxGeometry args={[1, 1]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>
		<mesh position={[0, 0, 0]}>
			<boxGeometry args={[1, 1]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh>
		{/* @ts-ignore */}
		{pathGeom && <line geometry={pathGeom}>
			<lineBasicMaterial color='cyan'/>
		</line>}
	</Canvas>;
}