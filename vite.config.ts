import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

function healthEndpointPlugin(): Plugin {
  const sendHealth = (res: {
    setHeader: (name: string, value: string) => void;
    end: (body: string) => void;
  }) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'helix-map-web',
        mode: process.env.NODE_ENV ?? 'development',
        timestamp: new Date().toISOString(),
      }),
    );
  };

  return {
    name: 'helix-map-health-endpoint',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/health') {
          sendHealth(res);
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/health') {
          sendHealth(res);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [healthEndpointPlugin(), react(), tailwindcss(), viteSingleFile()],
  server: {
    port: 3125,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Build as single-file bundle for MCP App
    rollupOptions: {
      input: 'mcp-app.html',
    },
    outDir: 'dist',
  },
});
