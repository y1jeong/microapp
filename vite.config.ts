import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works when hosted from a sub-path (e.g. GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react()],
});
