import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: https://<user>.github.io/my-app3/
export default defineConfig({
  base: '/my-app3/',
  plugins: [react()],
});
