import { Canvas } from '@react-three/fiber';
import { Level } from './Level';
import { useLevelState } from './level';

export default function Game() {
	const { size } = useLevelState();

	return <Canvas camera={{ position: [.5, .5, 255] }} flat orthographic onContextMenu={e => e.preventDefault()}>
		<Level/>
		<mesh position={[size/2, size/2, 0]}>
			<boxGeometry args={[1, 1]}/>
			<meshBasicMaterial color='magenta'/>
		</mesh>
		<mesh position={[-size/2+1, -size/2+1, 0]}>
			<boxGeometry args={[1, 1]}/>
			<meshBasicMaterial color='cyan'/>
		</mesh>
	</Canvas>;
}