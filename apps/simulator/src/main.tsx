import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initAnalytics } from './analytics';
import { App } from './App';
import { localizeRoot, setDocumentLocale } from './i18n';
import './journey/journey.css';

setDocumentLocale();
initAnalytics();
function LocalizedApp() {
  useLayoutEffect(() => localizeRoot(document.getElementById('root')!), []);
  return <App />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><LocalizedApp /></StrictMode>);
