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
		<a style={{ position: 'absolute', bottom: 8, right: 8 }} rel='noreferrer' target='_blank'
			href='https://github.com/frovu/lost'>source code</a>
	</div>;
}

export default App;
