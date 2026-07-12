import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

if (import.meta.env.DEV) {
  void import('./dev/seed');
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
