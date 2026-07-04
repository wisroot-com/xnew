import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React + TypeScript(TSX) を Node 側でコンパイルするための Vite 設定。
// @mulsense/xnew は node_modules から解決される（sync-xnew.js が最新 dist を同期する）。
export default defineConfig({
    plugins: [react()],
});
