import { xnew, xsync } from '@mulsense/xnew';
import { ChatView } from './chat.js';

//----------------------------------------------------------------------------------------------------
// game — multi-client のゲームロジック（socket.io 前提・無改変で動く）。
//   ネットワークは xsync（emitToServer/emitToClients/on/state）だけに依存。transport は起動側が
//   xsync.boot({ io, client, room }, ...) で生成する socket.io の socket。1 ブラウザ = 1 client。
//
//   シーンは「サーバーが現在のシーンを synced child として 1 つだけ持ち、差し替える」ことで全員に
//   同期される（phase はルーム全体で共有）。各シーンは自分宛ての '-event' を server で受け、
//   xnew(unit.parent, Next) で次のシーンへ差し替えて自分を finalize する。client は今ある synced
//   child（= 現在のシーン）を描画するだけ。
//
//   - Game   : server/client 共通ルート（Room が boot）。server は最初のシーン Title を生成、
//              client は各シーンの mount 先コンテナを用意するだけ。
//   - Title  : タイトル画面。誰かが「進む」を押すと（'-proceed'）全員 Setup へ進む。
//   - Setup  : 開始前の設定画面。synced state {slots:{p1,p2}} を共有。client が枠を取得/取消
//              （'-claim'/'-release'）、両枠が埋まると「開始」（'-begin'）で全員 World へ。
//   - World  : ゲーム本体。server が slots の 2 人ぶん Player を生成。枠を取った人だけが操作でき、
//              それ以外のクライアントは観戦（盤面を見るだけ）。途中参加（World フェーズで接続）した
//              クライアントには Setup が存在しないので設定画面はスキップされ、自機も持たない＝観戦になる。
//   - Player : synced state {x,y,clientId,slot}。server が移動、client が描画＋（自機なら）入力。
//   - ChatView : 全シーン共通のルームチャット（client 専用・Game の client 直下に常駐・chat.js）。
//              送信は xsync.emitToClients('chat', { text })、受信は unit.on('chat', ({ id, text })=>…)。
//              server 経由でルーム全員（自分含む）へ届くので中継コンポーネントは不要。
//
//   sync イベント: 送信は emitToServer/emitToClients（payload はオブジェクト・syncId 自動付与）、受信は unit.on。
//   emitToServer=必ず server で発火（client→server）、emitToClients=必ず client で発火（server 経由で全 client・自分含む）。
//   プレフィックス '-'=同一コンポーネント(同じ syncId・replica↔server で一致) / '+'・無印=全体。
//   key: xnew(C,{key}) で同一性の目印、xnew.find(C,{key}) で引ける（key はグローバル一意の想定）。
//----------------------------------------------------------------------------------------------------

const FIELD = { w: 224, h: 144 };   // 自機(16px)が 240x160 のペインに収まる移動範囲
const SPEED = 3;
const SLOTS = ['p1', 'p2'];
const slotLabel = (slot) => (slot === 'p1' ? 'プレイヤー1' : 'プレイヤー2');
const clamp = (v, max) => Math.max(0, Math.min(max, v));
// clientId → 表示名。台帳（session.clients の name）に無ければ id 先頭を出す。client 側でのみ使う。
const nameOf = (id) => xsync.session.clients.find((c) => c.id === id)?.name || (id ? id.slice(0, 4) : '');

// ---- Game: server/client 共通ルート。シーンを synced child として 1 つ持つ ----
export function Game(unit) {
    xsync.register({ Title, Setup, World });   // 同期対象（= シーン）の型を宣言

    // server: 最初のシーン Title を生成する（チャット中継は core の emitToClients が担うので不要）。
    xsync.server(() => {
        xnew(Title);
    });

    // client: 左にシーン（synced child）、右にルームチャット（ChatView）を横並びで置く。
    xsync.client(() => {
        const layout = xnew.nest('<div class="flex gap-4 items-start">');
        xnew.nest('<div class="flex flex-col gap-3">');   // シーン（synced child）の mount 先
        xnew(layout, ChatView);   // 全シーン共通のルームチャット（client 専用・chat.js）
    });
}

// ---- Title: タイトル画面。'-proceed' で全員 Setup へ ----
function Title(unit) {
    xsync.server(() => {
        // 誰かの '-proceed' で Setup へ差し替える（最初の 1 件で遷移。Title は 1 つなので全員分が届く）。
        unit.on('-proceed', () => { xnew(unit.parent, Setup); unit.finalize(); });
    });

    xsync.client(() => {
        xnew.nest('<div class="flex flex-col items-start gap-3 p-4 border border-gray-300 rounded bg-white">');
        xnew('<h2 class="m-0 text-lg font-bold text-gray-700">', 'マルチプレイ サンプル');
        xnew('<p class="m-0 text-sm text-gray-500">', 'プレイヤー1 / プレイヤー2 を決めてゲームを開始します。');
        const start = xnew('<button class="px-4 py-2 rounded border-0 bg-emerald-500 hover:bg-emerald-600 text-white text-sm cursor-pointer">', '設定画面へ進む');
        start.on('click', () => xsync.emitToServer('-proceed'));   // 全員ぶんの Title が同じ syncId なので server の Title に届く
    });
}

// ---- Setup: 開始前の設定画面。slots を共有し、両枠が埋まったら World へ ----
function Setup(unit) {
    const state = xsync.state({ slots: { p1: null, p2: null } });   // 共有: 枠 → 取得した clientId

    xsync.server(() => {
        const free = (id) => SLOTS.forEach((s) => { if (state.slots[s] === id) { state.slots[s] = null; } });
        // 1 人 1 枠。空き枠の取得時は既存の枠を空けてから割り当てる。
        unit.on('-claim', ({ id, slot }) => {
            if (SLOTS.includes(slot) === false || state.slots[slot]) { return; }
            free(id);
            state.slots[slot] = id;
        });
        unit.on('-release', ({ id }) => free(id));
        unit.on('sync.disconnect', ({ id }) => free(id));   // 退室したら枠を空ける
        // 両枠が埋まっていれば World へ。slots を props で World へ渡す（server 側のみ・client replica は受け取らない）。
        unit.on('-begin', () => {
            if (!state.slots.p1 || !state.slots.p2) { return; }
            xnew(unit.parent, World, { slots: { ...state.slots } });
            unit.finalize();
        });
    });

    xsync.client(() => {
        xnew.nest('<div class="flex flex-col items-start gap-2 p-4 border border-gray-300 rounded bg-white">');
        xnew('<p class="m-0 text-sm text-gray-600">', '担当プレイヤーを選んでください（クリックで取得 / 取り消し）。');

        const myId = xsync.session.myself.id;
        // 枠ボタン: 自分の枠ならクリックで取消、空き枠なら取得。
        const slotBtns = {};
        SLOTS.forEach((slot) => {
            const btn = xnew('<button class="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-sm cursor-pointer">');
            slotBtns[slot] = btn.element;
            btn.on('click', () => {
                if (state.slots[slot] === myId) { xsync.emitToServer('-release'); }
                else if (!state.slots[slot]) { xsync.emitToServer('-claim', { slot }); }
            });
        });

        const begin = xnew('<button class="px-4 py-2 rounded border-0 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm cursor-pointer">', 'ゲーム開始');
        begin.on('click', () => xsync.emitToServer('-begin'));
        const hint = xnew('<p class="m-0 text-xs text-gray-400">', '両方のプレイヤーが決まると開始できます。');

        // 共有 state（slots）をボタン表示へ反映する。
        unit.on('update', () => {
            SLOTS.forEach((slot) => {
                const owner = state.slots[slot];
                const who = owner ? (owner === myId ? 'あなた' : nameOf(owner)) : '空き';
                slotBtns[slot].textContent = `${slotLabel(slot)}: ${who}`;
            });
            begin.element.disabled = !(state.slots.p1 && state.slots.p2);
            hint.element.textContent = `参加者 ${xsync.session.clients.length} 人 / 観戦者は盤面を見るだけです。`;
        });
    });
}

// ---- World: ゲーム本体。server が slots の 2 人ぶん Player を生成。観戦者は盤面を見るだけ ----
export function World(unit, { slots } = {}) {
    xsync.register({ Player });

    xsync.server(() => {
        SLOTS.forEach((slot) => {
            const clientId = slots?.[slot];
            if (clientId) { xnew(Player, { key: clientId, clientId, slot }); }
        });
        unit.on('sync.disconnect', ({ id }) => xnew.find(Player, { key: id })[0]?.finalize());   // 退室した自機を撤去
    });

    xsync.client(() => {
        xnew.nest('<div class="flex flex-col gap-1">');   // World のラッパ（ラベル + 盤面）
        const status = xnew('<p class="m-0 text-xs text-gray-500">');   // 操作中 / 観戦中 の表示
        const roster = xnew('<p class="m-0 text-xs text-gray-400">');   // 各枠の担当者名
        xnew.nest('<div class="relative w-60 h-40 overflow-hidden border border-gray-300 bg-gray-50">');   // 全員共通の盤面（以降 Player はここへ）

        // 自分の id に一致する Player があれば操作者、無ければ観戦者（途中参加もここに含まれる）。
        const myId = xsync.session.myself.id;
        unit.on('update', () => {
            const players = xnew.find(Player);
            const mine = players.find((player) => player.clientId === myId);
            status.element.textContent = mine ? `操作中: ${slotLabel(mine.slot)}（WASD / 矢印で移動）` : '観戦中（操作はできません）';
            // 各枠を slot 順に並べ、担当者名を出す（自分は「あなた」）。
            roster.element.textContent = SLOTS
                .map((slot) => {
                    const p = players.find((player) => player.slot === slot);
                    const who = p ? (p.clientId === myId ? 'あなた' : nameOf(p.clientId)) : '空き';
                    return `${slotLabel(slot)}: ${who}`;
                })
                .join(' / ');
        });
    });
}

// ---- Player: 位置を synced state で持ち、server が移動、client が描画 ----
export function Player(unit, { clientId = '', slot = '' } = {}) {
    const state = xsync.state({ x: 0, y: 0, clientId, slot });

    xsync.server(() => {
        state.x = state.slot === 'p2' ? FIELD.w : 0;   // 初期位置（p1 左 / p2 右）。重ならないよう離す
        state.y = FIELD.h / 2;
        const vel = { x: 0, y: 0 };   // 受けた方向(速度)。update で積分し、押しっぱなしで動き続ける
        // '-move' = 同一コンポーネント宛て。自機(同じ syncId の client replica)からの move だけが届く。
        unit.on('-move', ({ vector }) => {
            vel.x = Math.sign(vector?.x || 0);
            vel.y = Math.sign(vector?.y || 0);
        });
        unit.on('update', () => {
            state.x = clamp(state.x + vel.x * SPEED, FIELD.w);
            state.y = clamp(state.y + vel.y * SPEED, FIELD.h);
        });
    });

    xsync.client(() => {
        const color = state.slot === 'p1' ? 'bg-blue-500' : 'bg-red-500';   // p1=青 / p2=赤
        const el = xnew.nest(`<div class="absolute w-4 h-4 rounded ${color}">`);
        unit.on('update', () => { el.style.left = `${state.x}px`; el.style.top = `${state.y}px`; });

        // 入力 → 移動は自機（このクライアント自身の Player）だけが受ける。観戦者は描画のみ。
        if (state.clientId === xsync.session.myself.id) {
            const stop = () => xsync.emitToServer('-move', { vector: { x: 0, y: 0 } });
            // チャット等の入力欄にフォーカスがある間はゲーム入力にしない（文字入力を優先）
            const typing = (target) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
            unit.on('window.keydown.wasd window.keyup.wasd window.keydown.arrow window.keyup.arrow', ({ event, vector }) => {
                if (typing(event.target) === false) {
                    event.preventDefault();
                    xsync.emitToServer('-move', { vector });
                }
            });
            unit.on('window.focusin', ({ event }) => { if (typing(event.target)) { stop(); } });   // キー押下中に入力欄へ移っても停止
            unit.on('window.blur', stop);   // フォーカス喪失で停止
        }
    });

    // World が「誰がどの枠か」を引くための公開 API（操作中 / 観戦中の判定に使う）。
    return {
        get clientId() { return state.clientId; },
        get slot() { return state.slot; },
    };
}
