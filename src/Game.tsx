import { Canvas } from '@react-three/fiber';
import { Fragment } from 'react';

const map = [
	[255, 255, 0, 35, 99],
	[255, 0, 0, 35, 200],
	[255, 0, 255, 255, 255],
	[255, 0, 0, 0, 255],
	[255, 255, 0, 255, 255],
];

export default function Game() {
	return <Canvas camera={{
		position: [0, 0, 1],
		near: 0.1,
		zoom: 4,
		far: 10
	}}
	orthographic
	gl={{ antialias: false }}
	onContextMenu={e => e.preventDefault()}>
		<ambientLight intensity={.1}/>
		{map.flatMap((row, j) => row.map((val, i) => <Fragment key={j*5+i}>
			<mesh position={[i-2,-j+2,0]}>
				<boxGeometry args={[1, 1, 0]}/>
				<meshBasicMaterial color={`rgb(${val},${val},${val})`}/>
			</mesh></Fragment>))}
		

	</Canvas>;
}