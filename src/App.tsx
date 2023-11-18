import Game from './Game';
import { LevelControls } from './Level';

function App() {
	return <div className='App'>
		<div style={{ aspectRatio: 1 }}>
			<Game/>
		</div>
		<div>
			<LevelControls/>
		</div>
	</div>;
}

export default App;
