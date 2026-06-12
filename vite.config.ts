import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' so the build works when hosted from a sub-path (e.g. GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
