//----------------------------------------------------------------------------------------------------
// sync-xnew — ローカルの @mulsense/xnew ビルドをこのサンプルの node_modules へ同期する。
//
//   このサンプルは @mulsense/xnew を 2 経路で読む:
//     - ブラウザ : importmap → server.js が packages/xnew/dist を配信（常に最新ビルド）
//     - サーバー : file: 依存 → node_modules/@mulsense/xnew/dist（npm install 時のコピー）
//   `npm run build`（パッケージ側）は後者を更新しないため、放置するとサーバーだけ古いビルドを掴み、
//   ブラウザ↔サーバーでプロトコル（クエリキー等）が食い違って同期が壊れる。本スクリプトで dist を
//   コピーして両者を一致させる。prestart / predev で自動実行される。
//----------------------------------------------------------------------------------------------------

import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..', 'dist');                       // packages/xnew/dist
const destPkg = join(here, 'node_modules', '@mulsense', 'xnew');
const dest = join(destPkg, 'dist');

if (!existsSync(src)) {
    console.error(`[sync-xnew] build not found: ${src}\n  → run \`npm run build\` in packages/xnew first.`);
    process.exit(1);
}
if (!existsSync(destPkg)) {
    console.error(`[sync-xnew] ${destPkg} not found\n  → run \`npm install\` in this sample first.`);
    process.exit(1);
}

rmSync(dest, { recursive: true, force: true });   // --delete 相当（消えたファイルを残さない）
cpSync(src, dest, { recursive: true });
console.log('[sync-xnew] synced packages/xnew/dist → node_modules/@mulsense/xnew/dist');
