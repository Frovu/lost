import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';
import { useEffect, useMemo, useState } from 'react';
import Astar from './algorithm/astar';
import * as THREE from 'three';
import { NodeBase, computeCost } from './game';

export default function Game() {
	const { size, grid, isGenerating, animate } = useLevelState();
	const [path, setPath] = useState<NodeBase[] | null>(null);

	useEffect(() => {
		if (isGenerating || !grid) return;
		const astar = new Astar({ grid, size, animate });
		setPath(null);
		astar.findPath({ x: 0, y: 0 }, { x: size-1, y: size-1 }).then(setPath);
		return () => astar.stop();
	}, [grid, isGenerating, animate, size]);

	useEffect(() => { if (isGenerating) setPath(null); }, [isGenerating])

	const pathGeom = useMemo(() => {
		return path && new THREE.BufferGeometry()
			.setFromPoints(path.map(({ x, y }) => new THREE.Vector3(x, y, 0)));
	}, [path]);

	let cost = 0;
	for (let i = 0; i < (path?.length ?? 1) - 1; ++i)
		cost += computeCost(path![i], path![i+1]);

	return <>
		{path && <div style={{ position: 'absolute', top: 0, color: 'cyan' }}>cost: {cost.toFixed(1)}</div>}
		<Canvas camera={{ position: [.5, .5, 255] }} flat orthographic onContextMenu={e => e.preventDefault()}>
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
				<lineBasicMaterial color='rgba(0,255,255,125)'/>
			</line>}
		</Canvas>
	</>;
}