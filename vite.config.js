import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // keep function names in the minified build so on-screen error reports
  // (see reportError in App.jsx) say where things broke
  esbuild: { keepNames: true },
});
