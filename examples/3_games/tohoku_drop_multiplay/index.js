import { xnew, xsync, xbasics } from '@mulsense/xnew';
import { Game } from './game.js';

//----------------------------------------------------------------------------------------------------
// tohoku_drop_multiplay（client エントリ）— ロビー / ルームの配線だけ。
//   ゲームの描画・入力（three/pixi）はすべて game.js の Game に集約。Room は xsync.boot({io,client,room},
//   Game) で Game を boot し、browser 実行なので Game の xsync.client 分岐（three/pixi）だけが動く。matter は
//   読み込まれない。Lobby / Room の配線は network サンプルと同じ（socket は自前で生成 / boot が所有）。
//----------------------------------------------------------------------------------------------------

function App() {
    const statusEl = document.getElementById('status');
    xnew(Lobby, { io: window.io });
    return {
        setStatus(text, ok) { statusEl.textContent = text; statusEl.className = ok ? 'text-green-600' : 'text-red-500'; },
    };
}
xnew(document.getElementById('app'), App);

//----------------------------------------------------------------------------------------------------
// Lobby / Room — ルーム作成・一覧・入室（中身が Game なだけ）
//----------------------------------------------------------------------------------------------------

function Lobby(unit, { io }) {
    const app = xnew.context(App);
    xnew.extend(xbasics.Scene);   // シーン遷移（change）は呼び出し側の責務

    // ロビー接続は room を持たない（query なし → サーバーはロビー接続として扱う）。socket は Lobby が所有する。
    const socket = io({ forceNew: true });
    for (const event of ['connect', 'disconnect', 'statusupdate', 'roomcreated', 'roomrejected']) {
        socket.on(event, xnew.scope((payload) => xnew.emit('-' + event, payload ?? {})));
    }
    unit.on('finalize', () => socket.disconnect());
    const createRoom = (name) => socket.emit('roomcreate', { name });

    let rooms = [];

    xnew.nest('<div class="max-w-md flex flex-col gap-3">');
    xnew('<form class="flex gap-2">', (form) => {
        const nameInput = xnew('<input class="flex-1 px-2.5 py-1.5 rounded border border-gray-300 text-sm" type="text" maxlength="16" placeholder="新しいルーム名">');
        xnew('<button class="px-3 py-1.5 rounded border-0 bg-emerald-500 hover:bg-emerald-600 text-white text-sm cursor-pointer" type="submit">', '作成');
        form.on('submit', ({ event }) => {
            event.preventDefault();
            const name = nameInput.element.value.trim();
            if (!name) { return; }
            createRoom(name);
            nameInput.element.value = '';
        });
    });
    const listEl = xnew('<ul class="flex flex-col gap-2">');
    const hintEl = xnew('<p class="m-0 text-xs text-gray-400">', '同じルームに 2 人入ると対戦開始。別タブ / 別ブラウザでもう 1 人入ってください。');

    let rowsUnit = null;
    function render() {
        rowsUnit?.finalize();
        rowsUnit = xnew(listEl, () => {
            if (rooms.length === 0) {
                xnew('<li class="text-sm text-gray-400 py-2">', 'まだルームがありません。上から作成してください。');
                return;
            }
            for (const room of rooms) {
                xnew('<li class="flex items-center justify-between gap-3 px-3 py-2 bg-white border border-gray-200 rounded">', () => {
                    xnew('<div>', () => {
                        xnew('<span class="font-medium text-gray-700">', room.name);
                        xnew('<span class="text-xs text-gray-400 ml-2">', `(${room.count}人)`);
                    });
                    const enter = xnew('<button class="px-3 py-1 rounded border-0 bg-blue-500 hover:bg-blue-600 text-white text-sm cursor-pointer">', '入室');
                    enter.on('click', () => unit.change(Room, { io: window.io, client: { name: '' }, room: { id: room.id, name: room.name } }));
                });
            }
        });
    }

    unit.on('-connect', () => app.setStatus('ロビー', true));
    unit.on('-disconnect', () => app.setStatus('切断', false));
    unit.on('-statusupdate', ({ rooms: list }) => { rooms = list; render(); });
    unit.on('-roomcreated', ({ room }) => unit.change(Room, { io: window.io, client: { name: '' }, room: { id: room.id, name: room.name } }));
    unit.on('-roomrejected', ({ message }) => { hintEl.element.textContent = message; });

    render();
}

function Room(unit, { io, client, room }) {
    const app = xnew.context(App);

    const back = xnew('<button class="px-3 py-1 mb-2 rounded border-0 bg-gray-500 hover:bg-gray-600 text-white text-sm cursor-pointer">', '← ロビーに戻る');
    back.on('click', () => unit.change(Lobby, { io: window.io }));
    xnew.nest('<div class="relative w-[90vmin] max-w-[800px] aspect-[4/3]">');   // Game（Screen）の mount 先（高さを確定させる）

    xnew.extend(xbasics.Scene);   // シーン遷移（change）は呼び出し側の責務
    xsync.boot({ io, client, room }, Game);   // boot が socket を生成・所有し connect/disconnect/notfound を '-event' へ転送

    unit.on('-connect', ({ id }) => app.setStatus(`ルーム ${room.id}: ${id}`, true));
    unit.on('-disconnect', () => app.setStatus('切断', false));
    unit.on('-notfound', () => unit.change(Lobby, { io: window.io }));
}
