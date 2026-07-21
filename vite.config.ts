import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sert l'app depuis https://<user>.github.io/planning-gare/ (site de projet GitHub Pages).
  base: '/planning-gare/',
});
