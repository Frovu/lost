import { Canvas } from '@react-three/fiber';
import { Level } from './Level';

const map = [
	[255, 255, 0, 35, 99],
	[255, 0, 0, 35, 200],
	[255, 0, 255, 255, 255],
	[255, 0, 0, 0, 255],
	[255, 255, 0, 255, 255],
];

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