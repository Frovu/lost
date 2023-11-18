import * as THREE from 'three';

function generateLevel(size: number) {
	const grid = new Uint8Array(size*size);
	return grid.map(_ => Math.random() * 256);
}
export function Level() {
	
	const size = 128;
	const grid = generateLevel(size);

	const data = new Uint8ClampedArray(size * size * 2);
	for (let i = 0; i < grid.length; ++i) {
		const val = (grid[i] === 255 ? 1 : -Math.log10(-grid[i] / 255 / 4 + 1)) * 256;
		data[i * 2] = val * 2;
		data[i * 2 + 1] = val / 3;
	}

	const dataTexture = new THREE.DataTexture(data, size, size, THREE.RGFormat);
	dataTexture.colorSpace = THREE.NoColorSpace;
	dataTexture.flipY = true;
	dataTexture.needsUpdate = true;
  
	return <>
		<mesh scale={32}>
			<planeGeometry args={[16, 16]}/>
			<meshBasicMaterial map={dataTexture} transparent/>
		</mesh>
	</>;
}