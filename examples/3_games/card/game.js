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
//   描画（browser 専用ライブラリは window.gfx 経由。index.js が render.js を載せる。3D の見た目は
//   2_addons/three_chabudai を移植）:
//     - Three : 畳の床・円形ちゃぶ台・囲む 4 体のボクセルキャラ・山札(3D)・各自の出したカード(3D)。
//               OffscreenCanvas に描いて…
//     - Pixi  : …その canvas を最背面スプライトに、その上に名札・HUD・自分の手札 UI(2D) を重ねる。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';

const W = 960, H = 600;                                     // 描画解像度（Screen のバッファ）
const SEATS = 4;
const HAND_SIZE = 3;
const MOGS = ['zundamon', 'kiritan', 'zunko', 'itako'];     // 席 → モデル
const LABELS = ['ずんだもん', 'きりたん', 'ずんこ', 'いたこ']; // 席 → 表示名
const VRMA = '/assets/walk.vrma';                           // 歩きモーション
// 席 → テーブル周りの角度（0=手前 / 1=左 / 2=奥 / 3=右）。位置は x=sin(a)*R, z=cos(a)*R で出す。
const SEAT_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const CAM = { r: 3.1, y: 2.8, lookY: 0.15 };               // カメラ: 水平半径 / 高さ / 注視点の高さ

// 指定席の後ろにカメラを回す（その席のキャラが手前に来る）。scene ではなく camera を回すので名札の投影もずれない。
function orientCamera(camera, seat) {
    const a = SEAT_ANGLE[seat];
    camera.position.set(Math.sin(a) * CAM.r, CAM.y, Math.cos(a) * CAM.r);
    camera.lookAt(0, CAM.lookY, 0);
}

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

        // three: OffscreenCanvas に描く。望遠ぎみ（低 FOV + 引き）でちゃぶ台の歪みを抑え、少し上から見下ろす。
        // 初期は手前(seat0)基準。自分の Player が判明したらその席の後ろへ向け直す（下の update ループ）。
        const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
        orientCamera(camera, 0);
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

            // 自分の id に対応するキャラが手前に来るよう、席が判明したらカメラをその席の後ろへ回す
            let camSeat = 0;
            unit.on('update', () => {
                const myPlayer = xnew.find(Player).find((p) => p.clientId === xsync.session.myself.id);
                const seat = myPlayer ? myPlayer.seat : 0;
                if (seat !== camSeat) { camSeat = seat; orientCamera(camera, seat); }
                xthree.renderer.render(xthree.scene, xthree.camera);
                texture.source.update();
                xpixi.renderer.render(xpixi.scene);
            });

            xnew(Scene3D);   // ライト / 畳の床 / ちゃぶ台（three）
            xnew(Board);     // 山札(3D) + 手番表示(HUD)
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Scene3D — ライト・畳の床・円形ちゃぶ台（render.js の共通部品。キャラ / カードは各ノードが nest する）
//----------------------------------------------------------------------------------------------------

function Scene3D(unit) {
    const { Lights, Ground, Chabudai } = window.gfx;
    xnew(Lights);
    xnew(Ground);
    xnew(Chabudai);
}

//----------------------------------------------------------------------------------------------------
// Board — 天面中央の山札(3D) と、手番 / 観戦の HUD 表示（client 専用・Table の共有状態を find で読む）
//----------------------------------------------------------------------------------------------------

function Board(unit) {
    const { xpixi, PIXI, Deck3D } = window.gfx;

    // HUD（2D テキスト）
    const group = xpixi.nest();
    group.zIndex = 50;
    const title = new PIXI.Text({ text: 'カードサンプル', style: { fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x0f172a, width: 4 } } });
    title.position.set(16, 12);
    xpixi.add(title);
    const turnText = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 15, fill: 0xcbd5e1, stroke: { color: 0x0f172a, width: 4 } } });
    turnText.position.set(16, 42);
    xpixi.add(turnText);

    // 山札(3D): 枚数に応じた高さで積む。枚数の段（4 枚ごと）が変わったときだけ作り直す。
    let deckUnit = null;
    let shownLayers = -1;

    unit.on('update', () => {
        const table = xnew.find(Table)[0];
        if (!table) { return; }
        const turnSeat = table.shared.turnSeat;
        const turnName = turnSeat >= 0 ? LABELS[turnSeat] : '—';

        const count = table.shared.deckCount;
        const layers = Math.round(count / 4);
        if (layers !== shownLayers) {
            shownLayers = layers;
            deckUnit?.finalize();
            deckUnit = count > 0 ? xnew(Deck3D, { count }) : null;
        }

        const myself = xsync.session.myself.id;
        const myPlayer = xnew.find(Player).find((p) => p.clientId === myself);
        if (myPlayer) {
            const myTurn = myPlayer.seat === turnSeat;
            turnText.text = myTurn
                ? `あなたの番です！手札をクリックして出す（山札 ${count}）`
                : `${turnName} の番を待っています（山札 ${count}）`;
            turnText.style.fill = myTurn ? 0xfcd34d : 0xcbd5e1;
        } else {
            turnText.text = `観戦中（${turnName} の番・山札 ${count}）`;
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
        const { xpixi, PIXI, Character, Card3D, TABLE, coord3dTo2d } = window.gfx;
        const angle = SEAT_ANGLE[state.seat];
        const R = TABLE.RADIUS + 0.2;                              // キャラはテーブル外周のすぐ外
        const px = Math.sin(angle) * R, pz = Math.cos(angle) * R;

        xnew(Character, { mogPath: `/assets/${state.mog}.mog`, vrmaPath: VRMA, x: px, z: pz });

        const group = xpixi.nest();
        group.zIndex = 20;
        const label = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x0f172a, width: 4 } } });
        label.anchor.set(0.5, 1);
        xpixi.add(label);

        // 出したカードは 3D で天面に置く（席と中央の間）。変化したときだけ作り直す。
        let shownPlayed = undefined;
        let cardUnit = null;

        unit.on('update', () => {
            const head = coord3dTo2d(px, 1.9, pz);                  // 頭上の 2D 位置に名札を置く
            label.position.set(head.x, head.y);

            const table = xnew.find(Table)[0];
            const myTurn = table && table.shared.turnSeat === state.seat;
            label.text = `${state.name}${myTurn ? ' ◀手番' : ''}  手札${state.handCount}`;
            label.style.fill = myTurn ? 0xfcd34d : 0xffffff;

            if (state.played !== shownPlayed) {
                shownPlayed = state.played;
                cardUnit?.finalize();
                cardUnit = null;
                if (shownPlayed != null) {
                    const cr = TABLE.RADIUS * 0.55;                 // 席方向・中央寄りの天面
                    cardUnit = xnew(Card3D, { number: shownPlayed, x: Math.sin(angle) * cr, z: Math.cos(angle) * cr, rot: angle });
                }
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
        const group = xpixi.nest();
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
