//----------------------------------------------------------------------------------------------------
// card game — Pixi(2D カード / UI) + Three(ボクセルキャラ) のマルチプレイ サンプル（ゲーム性は無し）。
//   server/client 共通の 1 ファイル。Node では xsync.server 分岐だけ、browser では xsync.client 分岐だけが動く。
//
//   モデル（すべて server 権威・xsync で同期）:
//     - Table  : 公開状態 { deckCount, turnSeat }。山札の残り枚数と、現在どの席の手番かを全員へ配る。
//     - Player : 席ごとの公開状態 { seat, clientId, name, mog, played, handCount }。出したカード・名前・手札枚数。
//     - Hand   : 手札 { ownerId, cards[] }。xsync.visibleTo(ownerId) で本人にだけ届く（他人の手札はワイヤに載らない）。
//
//   進行: 接続順に席 0..3 を割り当て、各自 3 枚配る。自分の手番になったら手札を 1 枚出して山札から 1 枚引く。
//         出したら次の席へ手番が移り、自分の番まで待つ、の繰り返し。5 人目以降は席が無く観戦になる。
//
//   描画（browser 専用ライブラリは window.gfx 経由。index.js が render.js を載せる）:
//     - Three : テーブルを囲む 4 体のボクセルキャラ（歩きモーション付き）。OffscreenCanvas に描いて…
//     - Pixi  : …その canvas を最背面スプライトに、その上に山札・各自の出したカード・自分の手札 UI を重ねる。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';

const W = 960, H = 600;                                     // 描画解像度（Screen のバッファ）
const SEATS = 4;
const HAND_SIZE = 3;
const MOGS = ['zundamon', 'kiritan', 'zunko', 'itako'];     // 席 → モデル
const LABELS = ['ずんだもん', 'きりたん', 'ずんこ', 'いたこ']; // 席 → 表示名
const VRMA = '/assets/VRMA_01.vrma';                        // 歩きモーション
// 席 → 3D 位置 [x, y, z]（テーブル中央=原点。手前 / 左 / 奥 / 右）
const SEAT_POS = [[0, 0, 2.6], [-3.4, 0, 0.2], [0, 0, -2.6], [3.4, 0, 0.2]];

//----------------------------------------------------------------------------------------------------
// server helpers（deck / 席 / 手番）
//----------------------------------------------------------------------------------------------------

// 1..13 を 4 枚ずつ、計 52 枚をシャッフルした山札
function buildDeck() {
    const deck = [];
    for (let n = 1; n <= 13; n++) { for (let k = 0; k < 4; k++) { deck.push(n); } }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// fromSeat の次に埋まっている席（1 周して自分に戻る＝実質そのまま）
function nextSeat(fromSeat, occupied) {
    for (let k = 1; k <= SEATS; k++) {
        const seat = (fromSeat + k) % SEATS;
        if (occupied.has(seat)) { return seat; }
    }
    return fromSeat;
}

//----------------------------------------------------------------------------------------------------
// pixi helper（カード 1 枚の見た目）
//----------------------------------------------------------------------------------------------------

function makeCard(PIXI, { number, w, h, faceUp = true, highlight = false }) {
    const card = new PIXI.Container();
    const g = new PIXI.Graphics()
        .roundRect(-w / 2, -h / 2, w, h, 8)
        .fill(faceUp ? 0xffffff : 0x2563eb)
        .stroke({ width: highlight ? 4 : 2, color: highlight ? 0xfcd34d : 0x334155 });
    card.addChild(g);
    if (faceUp) {
        const text = new PIXI.Text({ text: String(number), style: { fontFamily: 'sans-serif', fontSize: Math.floor(h * 0.42), fontWeight: 'bold', fill: 0x1e293b } });
        text.anchor.set(0.5);
        card.addChild(text);
    }
    return card;
}

//----------------------------------------------------------------------------------------------------
// Game — server/client 共通ルート（Room が boot する）。Table / Player / Hand を synced child に持つ。
//----------------------------------------------------------------------------------------------------

export function Game(unit) {
    xsync.register({ Table, Player, Hand });

    // ---- server: 山札・席・手番を管理し、接続ごとに Player + Hand を生成、play で手札を回す ----
    xsync.server(() => {
        const table = xnew(Table);
        const deck = buildDeck();
        const seatOf = new Map();                                   // clientId → seat
        const occupied = () => new Set(seatOf.values());
        const freeSeat = () => { for (let s = 0; s < SEATS; s++) { if (![...seatOf.values()].includes(s)) { return s; } } return -1; };

        table.shared.deckCount = deck.length;

        // 入室: 空き席を割り当て、Player と（本人だけに見える）Hand を作って 3 枚配る。最初の 1 人で手番開始。
        unit.on('sync.connect', ({ id }) => {
            const seat = freeSeat();
            if (seat < 0) { return; }                               // 5 人目以降は観戦（席なし）
            seatOf.set(id, seat);
            const player = xnew(Player, { key: id, seat, clientId: id, name: LABELS[seat], mog: MOGS[seat] });
            const hand = xnew(Hand, { key: id, ownerId: id });
            hand.deal(deck.splice(0, HAND_SIZE));
            player.setHandCount(hand.count);
            table.shared.deckCount = deck.length;
            if (table.shared.turnSeat < 0) { table.shared.turnSeat = seat; }
        });

        // 退室: 席を空け、Player / Hand を撤去。手番だった席なら次へ回す。
        unit.on('sync.disconnect', ({ id }) => {
            const seat = seatOf.get(id);
            seatOf.delete(id);
            xnew.find(Player, { key: id })[0]?.finalize();
            xnew.find(Hand, { key: id })[0]?.finalize();
            if (table.shared.turnSeat === seat) {
                const occ = occupied();
                table.shared.turnSeat = occ.size ? nextSeat(seat, occ) : -1;
            }
        });

        // play: 自分の手番のときだけ、手札の cardIndex を場に出して山札から 1 枚引き、手番を次へ回す。
        unit.on('play', ({ id, cardIndex }) => {
            const player = xnew.find(Player, { key: id })[0];
            const hand = xnew.find(Hand, { key: id })[0];
            if (!player || !hand) { return; }
            if (player.seat !== table.shared.turnSeat) { return; }  // 手番でなければ無視
            const card = hand.play(cardIndex);
            if (card == null) { return; }
            player.setPlayed(card);
            const drawn = deck.pop();
            if (drawn != null) { hand.add(drawn); }
            player.setHandCount(hand.count);
            table.shared.deckCount = deck.length;
            table.shared.turnSeat = nextSeat(player.seat, occupied());
        });
    });

    // ---- client: Screen(canvas) を用意し、Pixi/Three を初期化して合成ループを回す。盤面(Board)を描く ----
    //   synced child（Player / Hand）は各自の client 分岐で shared scene に nest する。
    xsync.client(() => {
        const { Screen, xpixi, xthree, PIXI, THREE } = window.gfx;
        xnew.extend(Screen, { width: W, height: H });

        // three: OffscreenCanvas にキャラを描く（テーブルを見下ろすカメラ）
        const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
        camera.position.set(0, 5.6, 7.2);
        camera.lookAt(0, 0.7, 0);
        xthree.initialize({ canvas: new OffscreenCanvas(W, H), camera });

        // pixi: 画面 canvas（背景は透過）。この上にカードと UI を重ねる
        xpixi.initialize({ canvas: unit.canvas });

        xnew.promise(unit).then(() => {
            xthree.renderer.shadowMap.enabled = true;
            xpixi.scene.sortableChildren = true;                    // zIndex で重なり順を制御

            // three の描画結果を最背面スプライトとして pixi へ持ち込む
            const texture = PIXI.Texture.from(xthree.canvas);
            const background = xpixi.add(new PIXI.Sprite(texture));
            background.width = W; background.height = H; background.zIndex = 0;

            unit.on('update', () => {
                xthree.renderer.render(xthree.scene, xthree.camera);
                texture.source.update();
                xpixi.renderer.render(xpixi.scene);
            });

            xnew(Scene3D);   // ライト / 地面 / テーブル（three）
            xnew(Board);     // 山札 / 手番表示（pixi）
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Scene3D — three のライト・地面・丸テーブル（キャラは各 Player が nest する）
//----------------------------------------------------------------------------------------------------

function Scene3D(unit) {
    const { xthree, THREE } = window.gfx;

    const dir = xthree.add(new THREE.DirectionalLight(0xffffff, 2.0));
    dir.position.set(4, 8, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    Object.assign(dir.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    dir.shadow.camera.updateProjectionMatrix();

    xthree.add(new THREE.AmbientLight(0xffffff, 1.2));

    const ground = xthree.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.25 })));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    const table = xthree.add(new THREE.Mesh(new THREE.CircleGeometry(3.0, 48), new THREE.MeshStandardMaterial({ color: 0x15803d })));
    table.rotation.x = -Math.PI / 2;
    table.position.y = 0.01;
    table.receiveShadow = true;
}

//----------------------------------------------------------------------------------------------------
// Board — 山札の山と、手番 / 観戦の表示（client 専用・Table の共有状態を find で読む）
//----------------------------------------------------------------------------------------------------

function Board(unit) {
    const { xpixi, PIXI } = window.gfx;
    const group = xpixi.nest(new PIXI.Container());
    group.zIndex = 50;

    const pile = makeCard(PIXI, { number: 0, w: 70, h: 98, faceUp: false });
    pile.position.set(W / 2, H / 2);
    group.addChild(pile);

    const deckText = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: 0xffffff } });
    deckText.anchor.set(0.5);
    deckText.position.set(W / 2, H / 2 + 66);
    group.addChild(deckText);

    const title = new PIXI.Text({ text: 'カードサンプル', style: { fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: 0xffffff } });
    title.position.set(16, 12);
    group.addChild(title);

    const turnText = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 15, fill: 0xcbd5e1 } });
    turnText.position.set(16, 42);
    group.addChild(turnText);

    unit.on('update', () => {
        const table = xnew.find(Table)[0];
        if (!table) { return; }
        const turnSeat = table.shared.turnSeat;
        const turnName = turnSeat >= 0 ? LABELS[turnSeat] : '—';
        deckText.text = `山札 ${table.shared.deckCount}`;

        const myself = xsync.session.myself.id;
        const myPlayer = xnew.find(Player).find((p) => p.clientId === myself);
        if (myPlayer) {
            const myTurn = myPlayer.seat === turnSeat;
            turnText.text = myTurn ? 'あなたの番です！手札をクリックして出してください' : `${turnName} の番を待っています`;
            turnText.style.fill = myTurn ? 0xfcd34d : 0xcbd5e1;
        } else {
            turnText.text = `観戦中（${turnName} の番）`;
            turnText.style.fill = 0xcbd5e1;
        }
    });
}

//----------------------------------------------------------------------------------------------------
// Table — 公開状態（山札枚数 / 手番の席）。client は Board / Player / Hand が find で読む。
//----------------------------------------------------------------------------------------------------

function Table(unit) {
    const state = xsync.state({ deckCount: 0, turnSeat: -1 });
    return {
        get shared() { return state; },
    };
}

//----------------------------------------------------------------------------------------------------
// Player — 席ごとの公開状態。server が played / handCount を更新、client がキャラ + 名札 + 出したカードを描く。
//----------------------------------------------------------------------------------------------------

export function Player(unit, { seat = 0, clientId = '', name = '', mog = '' } = {}) {
    const state = xsync.state({ seat, clientId, name, mog, played: null, handCount: 0 });

    xsync.server(() => ({
        setPlayed(card) { state.played = card; },
        setHandCount(count) { state.handCount = count; },
    }));

    xsync.client(() => {
        const { xpixi, xthree, PIXI, Character } = window.gfx;
        const [px, , pz] = SEAT_POS[state.seat];

        xnew(Character, { mogPath: `/assets/${state.mog}.mog`, vrmaPath: VRMA, x: px, z: pz });

        const group = xpixi.nest(new PIXI.Container());
        group.zIndex = 20;
        const label = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x0f172a, width: 4 } } });
        label.anchor.set(0.5, 1);
        group.addChild(label);

        let shownPlayed = undefined;   // 出したカードの表示（変化したときだけ作り直す）
        let playedCard = null;

        unit.on('update', () => {
            const head = xthree.coord3dTo2d(px, 1.9, pz);           // 頭上の 2D 位置に名札を置く
            label.position.set(head.x, head.y);

            const table = xnew.find(Table)[0];
            const myTurn = table && table.shared.turnSeat === state.seat;
            label.text = `${state.name}${myTurn ? ' ◀手番' : ''}  手札${state.handCount}`;
            label.style.fill = myTurn ? 0xfcd34d : 0xffffff;

            if (state.played !== shownPlayed) {
                shownPlayed = state.played;
                playedCard?.destroy();
                playedCard = null;
                if (shownPlayed != null) {
                    playedCard = makeCard(PIXI, { number: shownPlayed, w: 52, h: 72, faceUp: true });
                    group.addChild(playedCard);
                }
            }
            if (playedCard) {
                const spot = xthree.coord3dTo2d(px * 0.4, 0.05, pz * 0.4);   // 席と中央の間に出したカードを置く
                playedCard.position.set(spot.x, spot.y);
            }
        });
    });

    return {
        get seat() { return state.seat; },
        get clientId() { return state.clientId; },
    };
}

//----------------------------------------------------------------------------------------------------
// Hand — 手札。xsync.visibleTo(ownerId) で本人にだけ届く。client は下部に手札 UI を描き、手番なら出せる。
//----------------------------------------------------------------------------------------------------

export function Hand(unit, { ownerId = '' } = {}) {
    const state = xsync.state({ ownerId, cards: [] });

    xsync.server(() => {
        xsync.visibleTo(ownerId);                                   // このノードと配下は owner にだけ届く
        return {
            deal(cards) { state.cards = cards; },
            play(index) { if (index < 0 || index >= state.cards.length) { return null; } const [card] = state.cards.splice(index, 1); return card; },
            add(card) { state.cards.push(card); },
            get count() { return state.cards.length; },
        };
    });

    // Hand が届くのは本人だけなので、client 分岐は常に「自分の手札」を描く。
    xsync.client(() => {
        const { xpixi, PIXI } = window.gfx;
        const group = xpixi.nest(new PIXI.Container());
        group.zIndex = 40;

        let shown = null;   // 手札 or 手番が変わったときだけ作り直す
        unit.on('update', () => {
            const table = xnew.find(Table)[0];
            const myPlayer = xnew.find(Player).find((p) => p.clientId === state.ownerId);
            const myTurn = table && myPlayer && myPlayer.seat === table.shared.turnSeat;
            const key = `${state.cards.join(',')}|${myTurn}`;
            if (key === shown) { return; }
            shown = key;

            for (const child of group.removeChildren()) { child.destroy(); }
            const n = state.cards.length;
            const w = 72, h = 100, gap = 14;
            const total = n * w + (n - 1) * gap;
            const x0 = W / 2 - total / 2 + w / 2;
            const y = H - h / 2 - 18;
            state.cards.forEach((number, index) => {
                const card = makeCard(PIXI, { number, w, h, faceUp: true, highlight: myTurn });
                card.position.set(x0 + index * (w + gap), y);
                if (myTurn) {
                    card.eventMode = 'static';
                    card.cursor = 'pointer';
                    // pixi のイベントは tick/scope の外で発火するので xnew.scope で unit の scope に戻す（§7）
                    card.on('pointertap', xnew.scope(() => xsync.emitToServer('play', { cardIndex: index })));
                }
                group.addChild(card);
            });
        });
    });
}
