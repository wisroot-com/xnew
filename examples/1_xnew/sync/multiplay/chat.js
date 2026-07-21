import { xnew, xsync } from '@mulsense/xnew';

//----------------------------------------------------------------------------------------------------
// ChatView — 全シーン共通のルームチャット（client 専用・Game の client 直下に常駐）。
//   emitToClients は server 専用なので、送信は emitToServer で server に投げ、Game の server ブロックが
//   emitToClients で全 client へ中継する（client→client は送れない）:
//     - 送信: xsync.emitToServer('chat', { text })  → server が受けてルーム全員（自分含む）へ中継
//     - 受信: unit.on('chat', ({ id, text }) => …)  → root 内の全 client が受け取る（id = 送信者）
//   名前は client 側で nameOf(id) に解決する（表示は例側の責務）。
//----------------------------------------------------------------------------------------------------

// clientId → 表示名。台帳（session.clients の name）に無ければ id 先頭を出す。client 側でのみ使う。
const nameOf = (id) => xsync.session.clients.find((c) => c.id === id)?.name || (id ? id.slice(0, 4) : '');

export function ChatView(unit) {
    xnew.nest('<div class="w-56 h-80 flex flex-col border border-gray-300 rounded bg-white">');
    xnew('<div class="px-3 py-2 border-b border-gray-200 text-sm font-bold text-gray-700">', 'チャット');
    const log = xnew('<div class="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">');

    xnew('<form class="flex gap-1 p-2 border-t border-gray-200">', (form) => {
        const input = xnew('<input class="flex-1 min-w-0 px-2 py-1 rounded border border-gray-300 text-sm" type="text" maxlength="200" placeholder="メッセージ">');
        xnew('<button type="submit" class="px-2 py-1 rounded border-0 bg-emerald-500 hover:bg-emerald-600 text-white text-sm cursor-pointer">', '送信');
        form.on('submit', ({ event }) => {
            event.preventDefault();
            const text = input.element.value.trim();

            if (!text) {
                return;
            }

            xsync.emitToServer('chat', { text });   // server が受けて emitToClients でルーム全員（自分含む）へ中継
            input.element.value = '';
        });
    });

    const myId = xsync.session.myself.id;
    // server 経由で届いた 'chat'（{ id, text }）を 1 行追加する。名前は client 側で nameOf に解決。
    unit.on('chat', ({ id, text }) => {
        const mine = id === myId;
        xnew(log, '<div class="text-sm leading-snug break-words">', () => {
            xnew(`<span class="font-bold ${mine ? 'text-emerald-600' : 'text-gray-700'}">`, nameOf(id));
            xnew('<span class="ml-1 text-gray-600">', text);
        });
        log.element.scrollTop = log.element.scrollHeight;
    });
}
