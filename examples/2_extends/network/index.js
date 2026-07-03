import { xnew, xsync, xbasics } from '@mulsense/xnew';
import { Game } from './game.js';

//----------------------------------------------------------------------------------------------------
// multi-client（client 側）— ロビーでルームを作成 / 入室してプレイする。
//   呼び出し側は io（socket.io factory）を渡し、socket の生成は basics 側に委ねる（どちらも forceNew で
//   独立。サーバーは query.roomId の有無で lobby/game を判別）:
//     - Lobby : io を渡す → basics.Lobby が io({ forceNew }) を生成（room 無し）→ ロビー（一覧 / 作成）
//     - Room  : io と client（{name}）/ room を渡す → basics.Room → sync.boot が
//               io({ query:{ roomId, clientName }, forceNew }) を生成 → そのルームに参加
//   どちらも受信イベントを unit.on('-event') へ転送し finalize で切断する。
//   ゲーム本体 game.js は Game が Title→Setup→World のシーン遷移を同期で処理する。
//----------------------------------------------------------------------------------------------------

// App — #app を要素に持つコンテナ。ステータス表示(setStatus)を公開し、最初のシーンを mount する。
//   各シーン（Lobby/Game）はこの App の子として相互にスワップする（Scene.change が unit.parent の下へ
//   次シーンを mount → finalize するため、共通の親が要る。シーンを直接 #app に張ると親が engineRoot に
//   なり #app の外へ出てしまう）。シーンからは xnew.context(App).setStatus(...) で表示を更新する。
function App() {
    const statusEl = document.getElementById('status');
    let playerName = '';   // プレイヤー名。Lobby の入力欄から更新され、シーンをまたいで保持される。
    xnew(Lobby, { io: window.io });
    return {
        setStatus(text, ok) { statusEl.textContent = text; statusEl.className = ok ? 'text-green-600' : 'text-red-500'; },
        get playerName() { return playerName; },
        setPlayerName(name) { playerName = name; },
    };
}
xnew(document.getElementById('app'), App);

//----------------------------------------------------------------------------------------------------
// Lobby — ルーム作成 / 一覧 / 入室
//   ルームは動的。誰かが作成すると '-statusupdate' で全員へ一覧が届く。作成すると '-roomcreated' で自分の
//   入るべき roomId が返るので、そのまま Room へ遷移する。
//----------------------------------------------------------------------------------------------------

function Lobby(unit, { io }) {
    const app = xnew.context(App);   // ステータス表示はコンテナ App が持つ

    // io（socket.io factory）を渡すと basics.Lobby が socket を生成・所有する（room 無し = サーバーはロビー接続として扱う）。
    // basics.Lobby が受信イベントを unit.on('-event') へ転送し、finalize で socket を切断する。
    // シーン遷移（change/add）は呼び出し側の責務なので Scene をここで extend する。
    xnew.extend(xbasics.Scene);
    xnew.extend(xsync.Lobby, { io });

    let rooms = [];

    // 入室時に Room へ渡す client（ClientStatus）。name は空なら 'ゲスト' にフォールバックし、必ず非空にする（socket は boot が作る）。
    const client = () => ({ name: app.playerName.trim() || 'ゲスト' });

    xnew.nest('<div class="max-w-md flex flex-col gap-3">');
    // 名前入力（App に保持。入室時の query.name になり、空ならゲスト名へフォールバック）
    xnew('<label class="flex items-center gap-2 text-sm text-gray-600">', () => {
        xnew('<span>', 'あなたの名前');
        const nameField = xnew('<input class="flex-1 px-2.5 py-1.5 rounded border border-gray-300 text-sm" type="text" maxlength="16" placeholder="ゲスト">');
        nameField.element.value = app.playerName;   // シーン復帰時に既存の名前を復元
        nameField.on('input', ({ value }) => app.setPlayerName(value));
    });
    // 作成フォーム
    xnew('<form class="flex gap-2">', (form) => {
        const nameInput = xnew('<input class="flex-1 px-2.5 py-1.5 rounded border border-gray-300 text-sm" type="text" maxlength="16" placeholder="新しいルーム名">');
        xnew('<button class="px-3 py-1.5 rounded border-0 bg-emerald-500 hover:bg-emerald-600 text-white text-sm cursor-pointer" type="submit">', '作成');
        form.on('submit', ({ event }) => {
            event.preventDefault();
            const name = nameInput.element.value.trim();
            if (!name) { return; }
            unit.createRoom(name);   // Lobby が公開（内部で 'roomcreate' を emit）
            nameInput.element.value = '';
        });
    });
    const listEl = xnew('<ul class="flex flex-col gap-2">');
    const hintEl = xnew('<p class="m-0 text-xs text-gray-400">', 'ルームを作成 / 入室して、別タブでも同じルームに入ると互いの自機が見えます。');

    // 一覧は受信のたびに作り直す（前回ぶんの行 unit を finalize → 再生成。innerHTML クリア不要）。
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
                        xnew('<span class="font-medium text-gray-700">', room.name);   // textContent でユーザー入力名を安全に表示
                        xnew('<span class="text-xs text-gray-400 ml-2">', `(${room.count}人)`);
                    });
                    const enter = xnew('<button class="px-3 py-1 rounded border-0 bg-blue-500 hover:bg-blue-600 text-white text-sm cursor-pointer">', '入室');
                    enter.on('click', () => unit.change(Room, { io: window.io, client: client(), room: { id: room.id, name: room.name, count: room.count } }));
                });
            }
        });
    }

    // 受信イベントは Lobby が '-event' で転送する（finalize の切断も Lobby が担う。一覧は接続時に自動で届く）。
    unit.on('-connect', () => app.setStatus('ロビー', true));
    unit.on('-disconnect', () => app.setStatus('切断', false));
    unit.on('-statusupdate', ({ rooms: list }) => { rooms = list; render(); });
    unit.on('-roomcreated', ({ room }) => unit.change(Room, { io: window.io, client: client(), room: { id: room.id, name: room.name, count: room.count } }));
    unit.on('-roomrejected', ({ message }) => { hintEl.element.textContent = message; });

    render();   // 初期描画（一覧は -statusupdate 受信で更新）
}

//----------------------------------------------------------------------------------------------------
// Room — 渡された io / client / room でそのルームへ接続し、client ツリー(Game) を mount してプレイ
//   呼び出し側が io（socket.io factory）・client（表示名）・room({id,name}）を渡す。HTML（戻るボタン・
//   シーンの mount 先）だけを持ち、room 関連の配線（boot / socket 生成・所有 / 基本イベント connect・
//   disconnect・notfound の '-event' 転送）は xsync.Room → sync.boot に委ねる（mode は client に自動判定）。
//----------------------------------------------------------------------------------------------------

function Room(unit, { io, client, room }) {
    const app = xnew.context(App);   // ステータス表示はコンテナ App が持つ

    const back = xnew('<button class="px-3 py-1 mb-2 rounded border-0 bg-gray-500 hover:bg-gray-600 text-white text-sm cursor-pointer">', '← ロビーに戻る');
    back.on('click', () => unit.change(Lobby, { io: window.io }));
    xnew.nest('<div class="flex gap-4">');   // シーンの mount 先（Game の client が Title/Setup/World を nest する）

    // room 関連の配線は Room が引き受ける（boot(Game)、socket は boot が io から生成・所有し finalize で切断）。
    // io / client / room は boot へ渡され、基本イベントは boot が '-event' でこの Room の unit.on へ転送する。
    // シーン遷移（change）は呼び出し側の責務なので Scene をここで extend する。
    xnew.extend(xbasics.Scene);
    xnew.extend(xsync.Room, { io, client, room, Component: Game });

    unit.on('-connect', ({ id }) => app.setStatus(`ルーム ${room.id}: ${id}`, true));
    unit.on('-disconnect', () => app.setStatus('切断', false));
    unit.on('-notfound', () => unit.change(Lobby, { io: window.io }));   // 消滅ルームへ来たらロビーへ
}
