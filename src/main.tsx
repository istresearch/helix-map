import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { McpAppProvider, detectMcpMode, initMcpApp, initStandaloneApp } from './mcp-app';

async function main() {
  const isMcp = detectMcpMode();
  const context = isMcp ? await initMcpApp() : initStandaloneApp();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <McpAppProvider context={context}>
        <App />
      </McpAppProvider>
    </StrictMode>,
  );
}

main().catch(console.error);
