import { Canvas } from '@react-three/fiber';
import { Level } from './Level';

export default function Game() {
	return <Canvas camera={{
		position: [0, 0, 1]
	}}
	orthographic
	gl={{ antialias: false }}
	onContextMenu={e => e.preventDefault()}>
		<ambientLight intensity={.1}/>
		<Level/>
	</Canvas>;
}