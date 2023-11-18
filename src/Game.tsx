import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';

export default function Game() {
	const { size } = useLevelState();

	return <Canvas camera={{ position: [0, 0, 255] }} flat orthographic onContextMenu={e => e.preventDefault()}>
		<Level/>
		<mesh position={[size / 3, size / 3, 0]}>
			<circleGeometry args={[2]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>
		<mesh position={[-size / 3, -size / 3, 0]}>
			<circleGeometry args={[2]}/>
			<meshBasicMaterial color='rgb(0,255,0)'/>
		</mesh>
	</Canvas>;
}