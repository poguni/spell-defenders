import { useState } from 'react';
import { Stage } from './components/Stage';
import { BattleScreen } from './screens/BattleScreen';
import { StartScreen } from './screens/StartScreen';

type Screen = 'start' | 'battle';

export function App() {
  const [screen, setScreen] = useState<Screen>('start');

  return (
    <Stage>
      {screen === 'start' && <StartScreen onStart={() => setScreen('battle')} />}
      {screen === 'battle' && <BattleScreen />}
    </Stage>
  );
}
