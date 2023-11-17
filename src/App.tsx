import { useState } from 'react';
import Game from './Game';

function App() {

	return <div className='App'>
		<div style={{ aspectRatio: 1 }}>
			<Game/>
		</div>
		<div>
			<button>Press me</button>
		</div>
	</div>;
}

export default App;
