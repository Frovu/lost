import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Coords, Position, actions, algoOptions, initRandomLevel, play, useGameState } from './game';
import { drawCurveSegment } from './curves';

export function GameControls() {
	const { isPlaying, costMulti, heuristicMulti, animationSpeed, robotLength, robotWidth, action,
		algorithm, rotNumber, examineMode, turningRadius, results, set } = useGameState();

	const resultsWithCost = useMemo(() => results.map(res => {
		const path = res.path;
		let cost = 0;
		for (let i = 0; i < (path?.length ?? 1) - 1; ++i)
			cost += path[i]?.cost ?? 0;
		return { cost, ...res };
	}), [results]);

	const setAction = (act: typeof actions[number]) => () =>
		set('action', action?.action === act ? null : { action: act, stage: 0 });

	return <div style={{ display: 'flex', gap: 8, flexFlow: 'column' }}>
		<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
			<button style={{ width: 128, color: action?.action === 'draw' ? 'var(--color-active)' : 'unset' }}
				onClick={setAction('draw')}><u>D</u>RAW</button>
			<button style={{ width: 110, color: action?.action === 'set goal' ? 'var(--color-active)' : 'unset' }}
				disabled={isPlaying} onClick={setAction('set goal')}>SET <u>G</u>OAL</button>
			<button style={{ width: 110, color: action?.action === 'set pos' ? 'var(--color-active)' : 'unset' }}
				disabled={isPlaying} onClick={setAction('set pos')}>SET <u>P</u>OS</button>
			<button style={{ width: 110 }}
				disabled={isPlaying} onClick={() => initRandomLevel()}>RAND POS</button>
			<label title='Examine available paths and costs'>Examine
				<input type='checkbox' checked={examineMode} onChange={e => set('examineMode', e.target.checked)}/></label>
		</div>
		<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
			<button style={{ width: 128, color: isPlaying ? 'var(--color-active)' : 'unset' }}
				onClick={() => play()}>PLAY{isPlaying ? 'ING' : ''}</button>
			<label title='Pathfinding algorithm'>
				<select style={{ marginLeft: 2, width: 48 }}
					value={algorithm} onChange={e => set('algorithm', e.target.value as any)}>
					{algoOptions.map(n => <option key={n} value={n}>{n}</option>)}
				</select></label>
			<label title='animation speed'>spd*=<input style={{ marginLeft: 2, width: 64 }} type='number' min='8' max='256' step='8'
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
		</div>
		<div style={{ color: 'var(--color-text-dark)', fontSize: 14 }}>
			{resultsWithCost.map(({ cost, nodesVisited, at, params }) =>
				<div key={at}>{params.state.algorithm.split(' ')[0]} h*={params.state.heuristicMulti} visits = {nodesVisited}, cost = {cost.toFixed(1)}</div>)}
		</div>
	</div>;
}

export function Player({ pos, shadow }: { pos: Position, shadow?: boolean }) {
	const { robotLength: l, robotWidth: w, rotNumber } = useGameState();
	const geom = useMemo(() => { 
		const a = new THREE.Shape();
		a.moveTo(- l / 2, - w / 8);
		a.lineTo(- l / 2,   w / 8);
		a.lineTo(- l / 2,   w / 8);
		a.lineTo(0,  w / 8);
		a.lineTo(0, w / 2);
		a.lineTo(l / 2, 0);
		a.lineTo(0, - w / 2);
		a.lineTo(0, - w / 8);
		a.lineTo(- l / 2, - w / 8);
		return new THREE.ShapeGeometry(a);
	}, [l, w]);

	return <>
		<mesh position={[pos.x, pos.y, 0]} geometry={geom}
			rotation={new THREE.Euler(0, 0, pos.rot / rotNumber * Math.PI * 2 )}>
			<meshBasicMaterial color={shadow ? 'magenta' : 'cyan'} transparent/>
		</mesh>
	</>;
}

export default function Game() {
	const { grid, size, isGenerating, drawObstacle, finishDrawing } = useLevelState();
	const state = useGameState();
	const { pathfinder, results, playerPos, targetPos, rotNumber, action: act, set, reset } = state;
	const action = act?.action, stage = act?.stage;
	const [isDrawing, setDrawing] = useState(false);

	const closestNode = ({ x: ax, y: ay }: Coords) => {
		const [x, y] = [ax, ay].map(a => Math.max(0, Math.min(Math.round(a), size - 1)));
		return { x, y };
	};

	const getRotation = (a: Coords, b: Coords) => {
		const dx = b.x - a.x, dy = b.y - a.y;
		const rad = Math.atan2(dy, dx);
		return Math.round((rad / Math.PI / 2 + .5) * rotNumber) % rotNumber;
	};

	useEffect(() => reset(), [grid, reset]);

	useEffect(() => {
		if (grid && !pathfinder && !isGenerating)
			initRandomLevel();
	}, [grid, isGenerating, pathfinder]);

	const paths = useMemo(() => results.map(({ path, at, params }, i) => {
		const p = new THREE.Path();
		for (const { curve } of path) {
			if (curve)
				drawCurveSegment(p, curve, params.state);
		}

		const primary = i + 1 === results.length;
		const color = primary ? 'cyan' : 'red';
		const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: primary ? 1 : .5 });
		const geom = new THREE.BufferGeometry().setFromPoints(p.getPoints(32));
		const start = playerPos; // FIXME
		// @ts-ignore
		return <line key={at} position={[start?.x, start?.y, 0]} geometry={geom} material={mat}/>;
	}), [results, playerPos]);

	return <Canvas flat orthographic onContextMenu={e => e.preventDefault()}>
		<Level {...{
			onClick: e => {
				if (action?.startsWith('set')) {
					const which = action === 'set goal' ? 'targetPos' : 'playerPos';
					if (stage === 0) {
						set(which, { ...state[which], ...closestNode(e.point) });
						set('action', { action, stage: 1 });
					} else {
						set('action', null);
					}
				}
			},
			onPointerMove: e => {
				if (action?.startsWith('set')) {
					const which = action === 'set goal' ? 'targetPos' : 'playerPos';
					if (stage === 0) {
						set(which, { ...state[which], ...closestNode(e.point) });
					} else {
						set(which, { ...state[which], rot: getRotation(e.point, state[which]) });
					}
				} else if (action === 'draw') {
					if (isDrawing)
						drawObstacle(closestNode(e.point));
				}
			},
			onPointerDown: e => {
				if (action === 'draw') {
					setDrawing(true);
					drawObstacle(closestNode(e.point));
				}

			},
			onPointerUp: () => {
				setDrawing(false);
				finishDrawing();
			}
		}}/>
		<Player pos={playerPos}/>
		<Player pos={targetPos} shadow={true}/>
		{paths}
	</Canvas>;
}