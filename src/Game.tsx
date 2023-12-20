import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Coords, Position, actions, closestNode, findPath, initRandomLevel, playRound, posEqual, useGameState } from './game';
import { drawCurveSegment } from './curves';
import DstarLite from './algorithm/dstar_lite';

const ANIM_STEPS = 24;

export function GameControls() {
	const { isPlaying, isPathfinding, costMulti, viewRadius, heuristicMulti, animationSpeed, robotLength, robotWidth, action,
		rotNumber, examineMode, turningRadius, results, set } = useGameState();

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
			<button style={{ width: 110, color: action?.action === 'draw' ? 'var(--color-active)' : 'unset' }}
				onClick={setAction('draw')}><u>D</u>RAW</button>
			<button style={{ width: 128, ...(action?.action === 'set goal' && { color: 'var(--color-active)' }) }}
				disabled={isPlaying} onClick={setAction('set goal')}>SET <u>G</u>OAL</button>
			<button style={{ width: 110, ...(action?.action === 'set pos' && { color: 'var(--color-active)' }) }}
				disabled={isPlaying} onClick={setAction('set pos')}>SET <u>P</u>OS</button>
			<button style={{ width: 110 }}
				disabled={isPlaying} onClick={() => initRandomLevel()}>RAND POS</button>
			<label title='Examine available paths and costs'>Examine
				<input type='checkbox' checked={examineMode} onChange={e => set('examineMode', e.target.checked)}/></label>
		</div>
		<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
			<button style={{ width: 110, color: isPlaying ? 'var(--color-active)' : 'unset' }}
				onClick={() => set('isPlaying', !isPlaying)}>PLAY{isPlaying ? 'ING' : ''}</button>
			<button style={{ width: 128, color: isPathfinding ? 'var(--color-active)' : 'unset' }}
				onClick={() => findPath()}>PATHFIND{isPathfinding ? 'ING' : ''}</button>
			{/* <label title='Pathfinding algorithm'>
				<select style={{ marginLeft: 2, width: 48 }}
					value={algorithm} onChange={e => set('algorithm', e.target.value as any)}>
					{algoOptions.map(n => <option key={n} value={n}>{n}</option>)}
				</select></label> */}
			<label title='heuristic multiplier'>h*=<input style={{ marginLeft: 2, width: 64 }} type='number' min='1' max='64' step='.1'
				value={heuristicMulti} onChange={e => set('heuristicMulti', e.target.valueAsNumber)}/></label>
			<label title='terrain cost multiplier'>c*=<input style={{ marginLeft: 2, width: 56 }} type='number' min='1' max='64' step='1'
				value={costMulti} onChange={e => set('costMulti', e.target.valueAsNumber)}/></label>
			<label title='animation speed'>spd*=<input style={{ marginLeft: 2, width: 56 }} type='number' min='8' max='256' step='8'
				value={animationSpeed} onChange={e => set('animationSpeed', e.target.valueAsNumber)}/></label>
		</div>
		<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
			<label title='Robot width'>w=
				<input style={{ marginLeft: 2, width: 60 }} type='number' min='.6' max='2' step='.1'
					value={robotWidth} onChange={e => set('robotWidth', e.target.valueAsNumber)}/></label>
			<label title='Robot length'>l=
				<input style={{ marginLeft: 2, width: 60 }} type='number' min='.1' max='2' step='.1'
					value={robotLength} onChange={e => set('robotLength', e.target.valueAsNumber)}/></label>
			<label title='Robot turning radius'>turn=
				<input style={{ marginLeft: 2, width: 60 }} type='number' min='0' max='4' step='.1'
					value={turningRadius} onChange={e => set('turningRadius', e.target.valueAsNumber)}/></label>
			<label title='Robot view radius'>view=
				<input style={{ marginLeft: 2, width: 60 }} type='number' min='3' max='32' step='.5'
					value={viewRadius} onChange={e => set('viewRadius', e.target.valueAsNumber)}/></label>
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

const getRotation = (a: Coords, b: Coords) => {
	const { rotNumber } = useGameState.getState();
	const dx = b.x - a.x, dy = b.y - a.y;
	const rad = Math.atan2(dy, dx);
	return Math.round((rad / Math.PI / 2 + .5) * rotNumber) % rotNumber;
};

export default function Game() {
	const { grid, size, isGenerating, originalGrid, drawObstacle, startDrawing, finishDrawing, undoObstacle } = useLevelState();
	const state = useGameState();
	const { pathfinder, path: curPath, isPlaying, isPathfinding, rotNumber, animationSpeed,
		results, playerPos, targetPos, action: act, set, reset } = state;
	const action = act?.action, stage = act?.stage;
	const [animationStep, setAnimationStep] = useState(0);

	useEffect(() => {
		const listener = (e: KeyboardEvent) => {
			if (e.code === 'KeyZ') {
				undoObstacle();
			} else if (e.code === 'KeyD') {
				set('action', { action: 'draw', stage: 0 });
			} else if (e.code === 'KeyP' && !isPlaying) {
				set('action', { action: 'set pos', stage: 0 });
			} else if (e.code === 'KeyG' && !isPlaying) {
				set('action', { action: 'set goal', stage: 0 });
			} else if (e.code === 'Escape') {
				set('action', null);
			} else if (e.code === 'Space') {
				set('isPlaying', !isPlaying);
			}
		};
		document.body.addEventListener('keydown', listener);
		return () => document.body.removeEventListener('keydown', listener);
	}, [isPlaying, set, undoObstacle]);

	useEffect(() => { if (!isPlaying) setAnimationStep(0); }, [isPlaying]);

	useEffect(() => reset(), [originalGrid, reset]);

	useEffect(() => {
		if (grid && !pathfinder && !isGenerating && !isPlaying)
			findPath(false);
	}, [grid, isGenerating, isPlaying, pathfinder]);

	const [animDist, animPos, pathGeom] = useMemo(() => {
		const curve = curPath?.[0]?.curve;
		if (!curPath || !curve || !isPlaying || posEqual(playerPos, targetPos) || animationStep >= ANIM_STEPS) 
			return [null, null, null];
		const first = new THREE.Path();
		drawCurveSegment(first, curve, state);
		const points = first.getSpacedPoints(ANIM_STEPS);
		const sliced = points.slice(animationStep);
		const dx = sliced[1].x - sliced[0].x;
		const dy = sliced[1].y - sliced[0].y;
		const dist = Math.sqrt(dx**2 + dy**2);
		const rot = (Math.atan2(dy, dx) + (curve.reverse ? Math.PI : 0))
			/ Math.PI / 2 * rotNumber;
		const pos = {
			x: sliced[0].x + playerPos.x,
			y: sliced[0].y + playerPos.y,
			rot };
		const p = new THREE.Path().setFromPoints(sliced.slice(1));
		for (const { curve: c } of curPath.slice(1))
			c && drawCurveSegment(p, c, state);
		const geom = new THREE.BufferGeometry().setFromPoints(p.getPoints(8));
		return [dist, pos, geom];
	}, [curPath, isPlaying, playerPos, targetPos, animationStep, state, rotNumber]);

	useEffect(() => {
		if (!isPlaying || isPathfinding)
			return;
		if (action && action !== 'draw')
			set('action', null);
		if (animationStep >= ANIM_STEPS) {
			setAnimationStep(0);
			playRound();
		} else {
			const interv = setTimeout(() => {
				setAnimationStep(s => s + 1);
			}, Math.max(10, (animDist ?? 1) * 1000 / animationSpeed));
			return () => clearTimeout(interv);
		}
	}, [action, animationStep, isPathfinding, isPlaying, animDist, set, animationSpeed]);

	const paths = useMemo(() => results.map(({ path, at, params }, i) => {
		const p = new THREE.Path();
		for (const { curve } of path)
			if (curve)
				drawCurveSegment(p, curve, params.state);
		const primary = i + 1 === results.length;
		const color = primary ? 'cyan' : 'red';
		const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: primary ? 1 : .5 });
		const geom = new THREE.BufferGeometry().setFromPoints(p.getPoints(8));
		const start = playerPos; // FIXME
		// @ts-ignore
		return <line key={at} position={[start?.x, start?.y, 0]} geometry={geom} material={mat}/>;
	}), [results, playerPos]);

	const level = useMemo(() => <Level {...{
		onClick: e => {
			if (action?.startsWith('set')) {
				const which = action === 'set goal' ? 'targetPos' : 'playerPos';
				if (stage === 0) {
					set(which, { ...state[which], x: e.point.x, y: e.point.y });
					set('action', { action, stage: 1 });
				} else {
					set('action', null);
					findPath(false);
				}
			}
		},
		onPointerMove: e => {
			const graph = (pathfinder as DstarLite).graph;
			const nodes = graph[Math.round(e.point.y)]?.[Math.round(e.point.x)]?.filter(n => isFinite(n.g));
			console.log(nodes?.map(n => [n.x, n.y, n.g.toFixed(2), n.rhs.toFixed(2)].join(', ')))
			if (action?.startsWith('set')) {
				const which = action === 'set goal' ? 'targetPos' : 'playerPos';
				if (stage === 0) {
					set(which, { ...state[which], x: e.point.x, y: e.point.y });
				} else {
					set(which, { ...state[which], rot: getRotation(e.point, state[which]) });
				}
			} else if (action === 'draw') {
				drawObstacle(closestNode(e.point, size));
			}
		},
		onPointerDown: e => {
			if (action === 'draw') {
				startDrawing();
				drawObstacle(closestNode(e.point, size));
			}
		},
		onPointerUp: () => {
			finishDrawing();
		},
		onPointerLeave: () => {
			finishDrawing();
		},
	}}/>, [action, drawObstacle, finishDrawing, pathfinder, set, size, stage, startDrawing, state]);

	return <Canvas flat orthographic onContextMenu={e => e.preventDefault()}>
		{level}
		<Player pos={targetPos} shadow={true}/>
		<Player pos={((isPlaying && !isPathfinding) && animPos) || playerPos}/>
		{!isPlaying && paths}
		{/* @ts-ignore */}
		{pathGeom && <line position={[playerPos.x, playerPos.y, 0]} geometry={pathGeom}>
			<lineBasicMaterial color='cyan' transparent/>
		</line> }
	</Canvas>;
}