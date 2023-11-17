import { useMemo } from 'react';
import * as THREE from 'three';

function generateLevel(size: number) {
	const grid = new Uint8Array(size*size);
	return grid.map(_ => Math.random() * 255);
}
export function Level() {
	
	const size = 256;
	const grid = generateLevel(size);
	const data = new Uint8Array(size * size * 4);
	for (let i=0; i < grid.length * 4; i += 4) {
		data[i] = data[i+1] = data[i+2] = grid[i/4];
		data[i+3] = 255;
	}

	const dataTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	dataTexture.needsUpdate = true;
  
	return <>
		<mesh scale={32}>
			<planeGeometry args={[16, 16]}/>
			<meshBasicMaterial map={dataTexture} transparent/>
		</mesh>
	</>;
}