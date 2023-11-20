import Game, { GameControls } from './Game';
import { LevelControls } from './Level';

function App() {
	return <div className='App'>
		<div style={{ aspectRatio: 1 }}>
			<Game/>
		</div>
		<div style={{ display: 'flex', flexFlow: 'column', gap: 16 }}>
			<LevelControls/>
			<GameControls/>
		</div>
	</div>;
}

export default App;
