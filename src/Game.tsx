import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { play, useGameState } from './game';

export function GameControls() {
	const { isPlaying, costMulti, heuristicMulti, animationSpeed, robotLength, robotWidth,
		rotNumber, examineMode, turningRadius, results, set } = useGameState();

	const resultsWithCost = useMemo(() => results.map(res => {
		const path = res.path;
		let cost = 0;
		for (let i = 0; i < (path?.length ?? 1) - 1; ++i)
			cost += 1 // computeCost(path![i], path![i+1], res.opts);
		return { cost, ...res };
	}), [results]);

	return <><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
		<button style={{ width: 128, color: isPlaying ? 'var(--color-active)' : 'unset' }}
			onClick={() => play()}>PLAY{isPlaying ? 'ING' : ''}</button>
		<label title='animation speed'>speed*=<input style={{ marginLeft: 2, width: 64 }} type='number' min='8' max='256' step='8'
			value={animationSpeed} onChange={e => set('animationSpeed', e.target.valueAsNumber)}/></label>
		<label title='heuristic multiplier'>h*=<input style={{ marginLeft: 2, width: 64 }} type='number' min='1' max='64' step='.1'
			value={heuristicMulti} onChange={e => set('heuristicMulti', e.target.valueAsNumber)}/></label>
		<label title='terrain cost multiplier'>cost*=<input style={{ marginLeft: 2, width: 64 }} type='number' min='1' max='64' step='1'
			value={costMulti} onChange={e => set('costMulti', e.target.valueAsNumber)}/></label>
	</div>
	<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
		<label title='Robot width'>Robot w=
			<input style={{ marginLeft: 2, width: 64 }} type='number' min='.6' max='2' step='.1'
				value={robotWidth} onChange={e => set('robotWidth', e.target.valueAsNumber)}/></label>
		<label title='Robot length'>l=
			<input style={{ marginLeft: 2, width: 64 }} type='number' min='.1' max='2' step='.1'
				value={robotLength} onChange={e => set('robotLength', e.target.valueAsNumber)}/></label>
		<label title='Robot turning radius'>turn r=
			<input style={{ marginLeft: 2, width: 64 }} type='number' min='0' max='4' step='.1'
				value={turningRadius} onChange={e => set('turningRadius', e.target.valueAsNumber)}/></label>
		<label title='Number of possible stationary rotations'>Rot
			<select style={{ marginLeft: 2 }}
				value={rotNumber} onChange={e => set('rotNumber', parseInt(e.target.value))}>
				{[4, 8, 16].map(n => <option key={n} value={n}>{n}</option>)}
			</select></label>
		<label title='Examine available paths and costs'>Examine
			<input type='checkbox' checked={examineMode} onChange={e => set('examineMode', e.target.checked)}/></label>
	</div>
	<div style={{ color: 'var(--color-text-dark)', fontSize: 14 }}>
		{resultsWithCost.map(({ cost, nodesVisited, at, opts }) =>
			<div key={at}>h*={opts.state.heuristicMulti} nodesVisited = {nodesVisited}, cost = {cost.toFixed(1)}</div>)}
	</div></>;
}

export default function Game() {
	const { size, grid, isGenerating } = useLevelState();
	const { pathfinder, results, reset } = useGameState();

	useEffect(() => reset(), [grid, reset]);

	useEffect(() => {
		if (grid && !pathfinder && !isGenerating) play();
	}, [grid, isGenerating, pathfinder]);

	const paths = useMemo(() => results.map(({ path, at }, i) => {
		const primary = i + 1 === results.length;
		const color = primary ? 'cyan' : 'red';
		const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: primary ? 1 : .5 });
		const geom = new THREE.BufferGeometry();
		geom.setFromPoints(path.map(({ x, y }) => new THREE.Vector3(x, y, 0)));
		// @ts-ignore
		return <line key={at} geometry={geom} material={mat}/>;
	}), [results]);

	return <Canvas flat orthographic onContextMenu={e => e.preventDefault()}>
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
	</Canvas>;
}