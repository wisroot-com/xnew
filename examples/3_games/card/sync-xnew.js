//----------------------------------------------------------------------------------------------------
// sync-xnew — トラッキング済みの examples/dist をこのサンプルの node_modules へ同期する。
//
//   このサンプルは @mulsense/xnew を 2 経路で読む:
//     - ブラウザ : importmap → server.js が examples/dist を配信
//     - サーバー : file: 依存 → node_modules/@mulsense/xnew/dist（file: 依存の実体は packages/xnew で、
//                  その package.json exports は ./dist を指すが packages/xnew/dist はビルド時のみ生成される
//                  gitignore 対象。examples/dist はコミット済みで常に存在するため、そこからコピーして
//                  サーバー import を解決する）。
//   examples/dist はビルド（npm run build）が更新するので、src/ を変更したときはビルド後に再実行すれば
//   最新が反映される。ビルド未実行でもコミット済みの examples/dist で動く。prestart / predev で自動実行。
//----------------------------------------------------------------------------------------------------

import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'dist');                                  // examples/dist（コミット済み）
const destPkg = join(here, 'node_modules', '@mulsense', 'xnew');
const dest = join(destPkg, 'dist');

if (!existsSync(src)) {
    console.error(`[sync-xnew] examples/dist not found: ${src}\n  → run \`npm run build\` in packages/xnew first.`);
    process.exit(1);
}
if (!existsSync(destPkg)) {
    console.error(`[sync-xnew] ${destPkg} not found\n  → run \`npm install\` in this sample first.`);
    process.exit(1);
}

rmSync(dest, { recursive: true, force: true });   // --delete 相当（消えたファイルを残さない）
cpSync(src, dest, { recursive: true });
console.log('[sync-xnew] synced examples/dist → node_modules/@mulsense/xnew/dist');
