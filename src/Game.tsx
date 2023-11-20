import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';
import { useEffect, useMemo, useState } from 'react';
import Astar from './algorithm/astar';
import * as THREE from 'three';
import { NodeBase, computeCost, play, useGameState } from './game';

export function GameControls() {
	const { isPlaying, costMulti, heuristicMulti, set } = useGameState();

	return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
		<button style={{ width: 128, color: isPlaying ? 'var(--color-active)' : 'unset' }}
			onClick={() => play()}>PLAY{isPlaying ? 'ING' : ''}</button>
	</div>;
}

export default function Game() {
	const { size, grid } = useLevelState();
	const { results, reset } = useGameState();

	useEffect(() => reset(), [grid, reset]);

	const paths = useMemo(() => results.map(({ path, at }, i) => {
		const color = i + 1 === results.length ? 'cyan' : 'grey';
		const mat = new THREE.LineBasicMaterial({ color });
		const geom = new THREE.BufferGeometry();
		geom.setFromPoints(path.map(({ x, y }) => new THREE.Vector3(x, y, 0)));
		// @ts-ignore
		return <line key={at} geometry={geom} material={mat}/>;
	}), [results]);

	// let cost = 0;
	// for (let i = 0; i < (path?.length ?? 1) - 1; ++i)
	// 	cost += computeCost(path![i], path![i+1]);

	return <>
		{/* {path && <div style={{ position: 'absolute', top: 0, color: 'cyan' }}>cost: {cost.toFixed(1)}</div>} */}
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
			{paths}
		</Canvas>
	</>;
}