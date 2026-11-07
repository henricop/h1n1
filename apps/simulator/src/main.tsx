import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { localizeRoot, setDocumentLocale } from './i18n';
import './journey/journey.css';

setDocumentLocale();
function LocalizedApp() {
  useLayoutEffect(() => localizeRoot(document.getElementById('root')!), []);
  return <App />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><LocalizedApp /></StrictMode>);
