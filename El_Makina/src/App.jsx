import React from 'react';
import GameBoard from './components/game/GameBoard';
import './index.css';
function App() {
  return (
    // We render the main GameBoard here. It will take up the whole screen.
    <div className="w-full h-screen bg-black">
      <GameBoard />
    </div>
  );
}

export default App;