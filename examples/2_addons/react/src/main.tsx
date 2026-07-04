import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// React がページ全体を管理する。StrictMode は開発時に effect を二重実行するので、
// useXnew のマウント/finalize が正しく対になっていること（破棄漏れがないこと）の確認にもなる。
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
