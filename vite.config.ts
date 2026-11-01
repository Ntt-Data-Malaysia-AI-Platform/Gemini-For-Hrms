import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app runs on 5173 (this origin must be an SPA redirect URI in the Entra app registration).
// API calls go to the Node server in server/.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
