import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// kobako の 1フォルダとして置くので、公開URLに依存しない相対パスでビルドする
export default defineConfig({
  base: './',
  plugins: [react()],
});
