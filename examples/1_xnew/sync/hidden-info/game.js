//----------------------------------------------------------------------------------------------------
// hidden-info game — per-client state フィルタ（xsync.visibility）のサンプル。server/client 共通で動く。
//   サーバーは接続クライアントごとに PlayerView を 1 つ持ち、それぞれ秘密の数字を state に載せる。だが
//   PlayerView は xsync.visibility の述語で「その所有者にだけ見える」と宣言してあるので、各クライアント
//   には自分ぶんの PlayerView しか届かない（他人の数字はワイヤに載らない＝ DevTools でも見えない）。
//   「いっせいに公開」を押すと revealed が立ち、visibility の述語が全員 true を返すので全員ぶんが広がる。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';

// ---- Game: server/client 共通ルート。Board（公開）と PlayerView（各自ぶん）を synced child に持つ ----
export function Game(unit) {
    xsync.register({ Board, PlayerView });   // 同期対象の型を宣言

    // server: 公開ボードを 1 つ、接続クライアントごとに PlayerView を 1 つ生成し、退室で撤去する。
    xsync.server(() => {
        xnew(Board);
        unit.on('sync.connect', ({ id }) => xnew(PlayerView, { key: id, ownerId: id }));
        unit.on('sync.disconnect', ({ id }) => xnew.find(PlayerView, { key: id })[0]?.finalize());
    });

    // client: 説明文と、Board / PlayerView（届いたぶんだけ）の mount 先を用意する。
    xsync.client(() => {
        xnew.nest('<div class="flex flex-col gap-4 max-w-lg">');
        xnew('<h1 class="m-0 text-lg font-bold text-gray-700">', '秘密の数字（per-client state フィルタ）');
        xnew('<p class="m-0 text-sm text-gray-500 leading-relaxed">', 'このページを別タブでも開くと、各タブに 1〜100 の秘密の数字が配られます。サーバーは全員ぶんの数字を持っていますが、各クライアントには自分の数字しか届きません（DevTools の通信を見ても他人の数字は載っていません）。');
        xnew.nest('<div class="flex flex-col gap-3">');   // synced child（Board / PlayerView）の mount 先
    });
}

// ---- Board: 公開ノード（visibility を宣言しない＝全員に届く）。参加人数と公開状態を共有する ----
function Board(unit) {
    const state = xsync.state({ players: 0, revealed: false });

    xsync.server(() => {
        unit.on('update', () => { state.players = xsync.session.clients.length; });
        unit.on('reveal', () => { state.revealed = true; });   // どのクライアントの reveal でも公開に切り替える
    });

    xsync.client(() => {
        xnew.nest('<div class="p-3 rounded border border-gray-300 bg-white">');
        const info = xnew('<p class="m-0 text-sm text-gray-600">');
        const reveal = xnew('<button class="mt-2 px-3 py-1.5 rounded border-0 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm cursor-pointer">', 'いっせいに公開');
        reveal.on('click', () => xsync.emitToServer('reveal'));   // server の全 PlayerView / Board へ届く
        unit.on('update', () => {
            info.element.textContent = `参加者 ${state.players} 人 / ${state.revealed ? '公開済み（全員の数字が見えます）' : '各自の数字は本人だけに見えています'}`;
            reveal.element.disabled = state.revealed;
        });
    });
}

// ---- PlayerView: クライアント 1 人ぶん。server が秘密の数字を割り当て、所有者にだけ見えると宣言する ----
export function PlayerView(unit, { ownerId = '' } = {}) {
    const state = xsync.state({ ownerId, secret: 0, revealed: false });

    xsync.server(() => {
        state.secret = 1 + Math.floor(Math.random() * 100);
        // visibility の述語は capture のたびに再評価される。revealed が立つと全員 true になり、公開へ広がる。
        xsync.visibility((clientId) => state.revealed || clientId === state.ownerId);
        unit.on('reveal', () => { state.revealed = true; });
    });

    xsync.client(() => {
        const mine = state.ownerId === xsync.session.myself.id;
        xnew.nest(`<div class="p-3 rounded border ${mine ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}">`);
        const label = xnew('<p class="m-0 text-sm font-medium text-gray-700">');
        unit.on('update', () => {
            const who = mine ? 'あなた' : `プレイヤー ${state.ownerId.slice(0, 4)}`;
            label.element.textContent = `${who} の秘密の数字: ${state.secret}`;
        });
    });
}
