import { Canvas, useThree } from '@react-three/fiber';
import { Level } from './Level';

function Camera() {
	const state = useThree();
	const zoom = state.size.width / 640 + .1;
	state.camera.zoom = zoom;
	return null;
}

export default function Game() {
	return <Canvas camera={{ position: [0, 0, 1] }} orthographic onContextMenu={e => e.preventDefault()}>
		<Camera/>
		<ambientLight intensity={.1}/>
		<Level/>
	</Canvas>;
}