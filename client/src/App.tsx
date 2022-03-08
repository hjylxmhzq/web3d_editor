import React, { useEffect, useState } from 'react';
import './App.scss';
import Scene from './components/Scene';
import TilesGen from './components/editor';

function App() {

  const [current, setCurrent] = useState('tilegen');
  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      if (e.key === '!') {
        console.log('set current');
        setCurrent(current === 'scene' ? 'tilegen' : 'scene');
      }
    });
  }, []);

  return (
    <div className="App">
      {
        current === 'scene' ?
          <Scene key={current} />
          : <TilesGen key={current} />
      }
    </div>
  );
}

export default App;
