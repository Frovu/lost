import { useState } from 'react';

function App() {
	const [count, setCount] = useState(0);

	return (
		<>
			Hello, World!
			<div onClick={() => setCount(c => c + 1)}>count: {count}</div>
		</>
	);
}

export default App;
