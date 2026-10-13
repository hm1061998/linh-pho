import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameView } from './app/GameView';
import './app/app.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <GameView />
  </StrictMode>,
);
