//----------------------------------------------------------------------------------------------------
// sevens（七並べ）— Pixi(2D 手札 / UI) + Three(3D の場) のマルチプレイ サンプル。
//   server/client 共通の 1 ファイル。Node では xsync.server 分岐だけ、browser では xsync.client 分岐だけが動く。
//
//   ルール: 52 枚を参加者へ配り、手元の 7 は最初から場に置く。手番では場の並びに隣接するカード（同じスートの
//     ±1）を 1 枚出すか、パスする。パスは 3 回まで（4 回目で脱落し、手札は全部場に公開される）。
//     手札を先に無くした順に上がり。残り 1 人になったらラウンド終了。
//
//   モデル（すべて server 権威・xsync で同期）:
//     - Table  : 公開盤面 { phase, turnId, placed[52], lastPlay, ranking }。場の並びは 52 枚ぶんの真偽値で持つ
//                （脱落者の手札を場にぶちまけると並びが不連続になるので、区間ではなくマス単位で持つ）。
//     - Player : 公開プロフィール { clientId, name, joinIndex, mog, handCount, passLeft, rank, out, inRound }。
//     - Hand   : 手札 { ownerId, cards[] }。xsync.visibility の述語で本人にだけ届く（他人の手札はワイヤに載らない）。
//
//   描画（browser 専用ライブラリは window.gfx 経由。index.js が render.js を載せる）:
//     - Three : 四畳半の畳・円形ちゃぶ台・場のマス目・場に出た 52 枚・囲むボクセルキャラ。OffscreenCanvas に描いて…
//     - Pixi  : …その canvas を最背面スプライトに、その上に名札・HUD・自分の手札 UI を重ねる。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';

const W = 960, H = 600;                                     // 描画解像度（Screen のバッファ）
const MIN_PLAYERS = 2, MAX_PLAYERS = 4;
const PASS_LIMIT = 3;                                       // パスできる回数。使い切ったあとのパスで脱落
const SUITS = 4, RANKS = 13;
const DIAMOND = 2;                                          // ♦7 の持ち主から始める
const MOGS = ['zundamon', 'kiritan', 'zunko', 'itako'];
const VRMA = '/assets/walk.vrma';                           // 歩きモーション

// カードは 0..51 の通し番号（suit * 13 + rank）。rank は 0=A .. 6=7 .. 12=K
export const SUIT_MARKS = ['♠', '♥', '♦', '♣'];
export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_COLORS = [0x2b2b33, 0xc0392b, 0xc0392b, 0x2b2b33];   // ♥♦ が赤

export function suitOf(card) { return Math.floor(card / RANKS); }
export function rankOf(card) { return card % RANKS; }
export function cardLabel(card) { return `${SUIT_MARKS[suitOf(card)]}${RANK_LABELS[rankOf(card)]}`; }

//----------------------------------------------------------------------------------------------------
// ルール判定（server が権威。client は同じ関数で「出せるカード」をハイライトするだけ）
//----------------------------------------------------------------------------------------------------

// 場に隣（同じスートの ±1）が出ていれば置ける。7 は開始時に置かれるので、そこから外へ伸びていく
export function playable(placed, card) {
    const suit = suitOf(card), rank = rankOf(card);
    if (placed[card]) {
        return false;
    } else {
        const lower = rank > 0 && placed[suit * RANKS + rank - 1];
        const upper = rank < RANKS - 1 && placed[suit * RANKS + rank + 1];
        return lower || upper;
    }
}

function shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}

//----------------------------------------------------------------------------------------------------
// pixi helpers（ボタン / カードの見た目）
//----------------------------------------------------------------------------------------------------

function makeButton(PIXI, { label, w = 150, h = 34, color = 0x2563eb, fontSize = 15, onTap }) {
    const button = new PIXI.Container();
    button.addChild(new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, 8).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.6 }));
    const text = new PIXI.Text({ text: label, style: { fontFamily: 'sans-serif', fontSize, fontWeight: 'bold', fill: 0xffffff } });
    text.anchor.set(0.5);
    button.addChild(text);
    if (onTap) {
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointertap', onTap);
    }
    return button;
}

// 手札 1 枚（左上のランク + 中央の大きなスート）。出せないカードは白を落として沈ませる
function makeHandCard(PIXI, { card, w, h, enabled }) {
    const suit = suitOf(card), rank = rankOf(card);
    const sprite = new PIXI.Container();
    sprite.addChild(new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, 8)
        .fill(enabled ? 0xfaf8f2 : 0xb9b5ab)
        .stroke({ width: enabled ? 3 : 2, color: enabled ? 0xfcd34d : 0x475569 }));
    const color = SUIT_COLORS[suit];
    const label = new PIXI.Text({ text: RANK_LABELS[rank], style: { fontFamily: 'sans-serif', fontSize: Math.floor(h * 0.24), fontWeight: 'bold', fill: color } });
    label.position.set(-w / 2 + 6, -h / 2 + 4);
    sprite.addChild(label);
    const mark = new PIXI.Text({ text: SUIT_MARKS[suit], style: { fontFamily: 'sans-serif', fontSize: Math.floor(h * 0.42), fontWeight: 'bold', fill: color } });
    mark.anchor.set(0.5);
    mark.position.set(0, h * 0.12);
    sprite.addChild(mark);
    return sprite;
}

//----------------------------------------------------------------------------------------------------
// Game — server/client 共通ルート（server.js / index.js が boot する）。Table / Player / Hand を持つ。
//----------------------------------------------------------------------------------------------------

export function Game(unit) {
    xsync.register({ Table, Player, Hand });

    // ---- server: 接続ごとに Player + Hand を生成し、'start' で配り、'play' / 'pass' で 1 手を処理する ----
    xsync.server(() => {
        const table = xnew(Table);
        let joinCounter = 0;
        let roundIds = [];                                  // ラウンド参加者の clientId（手番順 = 参加順）
        let placed = new Array(SUITS * RANKS).fill(false);  // 場の並び（server 内の作業用。共有はコピーを渡す）
        let finishCount = 0;                                // 上がった人数 = 次の順位

        function sharePlaced() { table.shared.placed = [...placed]; }

        function playerOf(id) { return xnew.find(Player, { key: id })[0]; }
        function handOf(id) { return xnew.find(Hand, { key: id })[0]; }

        // まだ手札を持っていて脱落もしていない参加者（この人数が 1 以下になったらラウンド終了）
        function aliveIds() {
            return roundIds.filter((cid) => {
                const player = playerOf(cid);
                return player && player.shared.inRound && player.shared.rank === 0 && player.shared.out === false;
            });
        }

        // 上がり / 脱落を順位表へ積む（退室後もぶら下がらないよう id ではなく確定時の名前で共有する）
        function record(player, out) {
            table.shared.ranking = [...table.shared.ranking, { name: player.shared.name, rank: player.shared.rank, out }];
        }

        function finish(player) {
            finishCount++;
            player.setRank(finishCount);
            record(player, false);
        }

        function advanceTurn(fromId) {
            const alive = aliveIds();
            if (alive.length <= 1) {
                for (const cid of alive) { finish(playerOf(cid)); }   // 最後の 1 人も順位を確定して終了
                Object.assign(table.shared, { phase: 'result', turnId: '' });
            } else {
                const from = roundIds.indexOf(fromId);
                for (let k = 1; k <= roundIds.length; k++) {
                    const cid = roundIds[(from + k) % roundIds.length];
                    if (alive.includes(cid)) { table.shared.turnId = cid; break; }
                }
            }
        }

        // ラウンドを中断して待機に戻す（参加者の切断時）
        function abortRound(reason) {
            roundIds = [];
            placed = new Array(SUITS * RANKS).fill(false);
            finishCount = 0;
            for (const player of xnew.find(Player)) { player.reset(); }
            for (const hand of xnew.find(Hand)) { hand.clear(); }
            Object.assign(table.shared, { phase: 'waiting', message: reason, turnId: '', lastPlay: '', ranking: [], placed: [...placed] });
        }

        unit.on('sync.connect', ({ id }) => {
            joinCounter++;
            // キャラモデルは未使用の mog から割当（全クライアントで同じ見た目になるよう server が決める）
            const used = new Set(xnew.find(Player).map((p) => p.shared.mog));
            const available = MOGS.filter((mog) => used.has(mog) === false);
            const mog = available.length > 0 ? available[0] : MOGS[joinCounter % MOGS.length];
            xnew(Player, { key: id, clientId: id, name: `プレイヤー${joinCounter}`, joinIndex: joinCounter, mog });
            xnew(Hand, { key: id, ownerId: id });           // ラウンド中の途中参加は手札なしで観戦
        });

        // 待機画面の名前入力。未入力（空文字）は Player 側でデフォルト名に戻る
        unit.on('rename', ({ id, name }) => {
            playerOf(id)?.setName(name);
        });

        unit.on('sync.disconnect', ({ id }) => {
            const wasInRound = roundIds.includes(id);
            playerOf(id)?.finalize();
            handOf(id)?.finalize();
            if (table.shared.phase === 'playing' && wasInRound) { abortRound('参加者が切断したためラウンドを中断しました'); }
        });

        // ラウンド開始: 52 枚を参加順に配り切り、各自の 7 は場へ置く。♦7 を持っていた人から手番開始
        unit.on('start', () => {
            if (table.shared.phase === 'playing') { return; }
            const players = xnew.find(Player).sort((a, b) => a.shared.joinIndex - b.shared.joinIndex);
            if (players.length < MIN_PLAYERS) { return; }
            const members = players.slice(0, MAX_PLAYERS);

            const deck = shuffle([...Array(SUITS * RANKS).keys()]);
            placed = new Array(SUITS * RANKS).fill(false);
            finishCount = 0;
            for (const player of players) { player.reset(); }
            for (const hand of xnew.find(Hand)) { hand.clear(); }

            const piles = members.map(() => []);
            deck.forEach((card, i) => piles[i % members.length].push(card));

            let firstIndex = 0;
            members.forEach((player, i) => {
                const hand = handOf(player.shared.clientId);
                for (const card of piles[i]) {
                    if (rankOf(card) === 6) {
                        placed[card] = true;
                        if (suitOf(card) === DIAMOND) { firstIndex = i; }
                    }
                }
                const rest = piles[i].filter((card) => rankOf(card) !== 6).sort((a, b) => a - b);
                hand.deal(rest);
                player.setHandCount(rest.length);
                player.setInRound(true);
            });

            roundIds = members.map((player) => player.shared.clientId);
            sharePlaced();
            Object.assign(table.shared, {
                phase: 'playing', message: '', turnId: roundIds[firstIndex], ranking: [],
                lastPlay: `${members[firstIndex].shared.name} が ♦7 を持っていたので先手です`,
            });
        });

        // play: 自分の手番のときだけ、場の並びに隣接する 1 枚を出す。手札が尽きたらその場で上がり
        unit.on('play', ({ id, card }) => {
            const s = table.shared;
            if (s.phase !== 'playing' || s.turnId !== id) { return; }
            const player = playerOf(id);
            const hand = handOf(id);
            if (!player || !hand) { return; }
            if (hand.has(card) === false || playable(placed, card) === false) { return; }

            hand.remove(card);
            placed[card] = true;
            sharePlaced();
            player.setHandCount(hand.count);
            s.lastPlay = `${player.shared.name} が ${cardLabel(card)} を出しました`;
            if (hand.count === 0) { finish(player); }
            advanceTurn(id);
        });

        // pass: 残りパス数があれば 1 つ消費。使い切ったあとのパスは脱落（手札を全部場に公開する）
        unit.on('pass', ({ id }) => {
            const s = table.shared;
            if (s.phase !== 'playing' || s.turnId !== id) { return; }
            const player = playerOf(id);
            const hand = handOf(id);
            if (!player || !hand) { return; }

            if (player.shared.passLeft > 0) {
                player.usePass();
                s.lastPlay = `${player.shared.name} がパス（残り ${player.shared.passLeft}）`;
            } else {
                for (const card of hand.cards) { placed[card] = true; }
                hand.clear();
                player.setHandCount(0);
                player.setOut();
                sharePlaced();
                s.lastPlay = `${player.shared.name} はパス切れで脱落。手札を場に出しました`;
                record(player, true);
            }
            advanceTurn(id);
        });
    });

    // ---- client: Screen(canvas) を用意し、Three(3D の場) と Pixi(2D UI) を初期化して合成ループを回す ----
    //   synced child（Player / Hand）は各自の client 分岐で shared scene に nest する。
    xsync.client(() => {
        const { Screen, xpixi, xthree, PIXI, THREE } = window.gfx;
        xnew.extend(Screen, { width: W, height: H });

        // three: OffscreenCanvas に描く。場の格子が読めるよう、カメラは正面固定でやや見下ろす（席では回さない）
        const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
        camera.position.set(0, 3.0, 3.0);
        camera.lookAt(0, 0.52, 0);
        xthree.initialize({ canvas: new OffscreenCanvas(W, H), camera });

        // pixi: 画面 canvas（背景は透過）。この上に UI を重ねる
        xpixi.initialize({ canvas: unit.canvas });

        xnew.promise(unit).then(() => {
            xthree.renderer.shadowMap.enabled = true;
            xthree.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

            xnew(Scene3D);   // ライト / 畳の床 / ちゃぶ台 / 場のマス目（three）
            xnew(Board);     // 場のカード・キャラ・名札・HUD・待機/結果オーバーレイ
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Scene3D — ライト・畳の床・円形ちゃぶ台・場のマス目（render.js の共通部品。カードとキャラは Board が nest する）
//----------------------------------------------------------------------------------------------------

function Scene3D(unit) {
    const { Lights, Floor, Chabudai, BoardGuide3D } = window.gfx;
    xnew(Lights);
    xnew(Floor);
    xnew(Chabudai);
    xnew(BoardGuide3D);
}

//----------------------------------------------------------------------------------------------------
// Cards3D — 場に出たカード。場から取り除かれることは無いので、増えたぶんだけ足していく
//----------------------------------------------------------------------------------------------------

function Cards3D(unit) {
    const { Card3D } = window.gfx;
    const shown = new Set();
    return {
        apply(placed) {
            placed.forEach((on, card) => {
                if (on && shown.has(card) === false) {
                    shown.add(card);
                    xnew(Card3D, { suit: suitOf(card), rank: rankOf(card) });
                }
            });
        },
        get count() { return shown.size; },
    };
}

//----------------------------------------------------------------------------------------------------
// Characters3D — プレイヤーのキャラモデル一式（.mog + 歩きモーション）。顔ぶれが変わったときだけ作り直す
//----------------------------------------------------------------------------------------------------

function Characters3D(unit, { seats }) {
    const { Character } = window.gfx;
    seats.forEach((seat) => {
        xnew(Character, { mogPath: `/assets/${seat.mog}.mog`, vrmaPath: VRMA, x: seat.x, z: seat.z, rotY: seat.rotY, scale: seat.scale });
    });
}

// 座席: ちゃぶ台を人数で等分割し、自分（手前 = カメラの位置）を基準に参加順で埋める。手前の席は
// カメラそのものなので自分のキャラは描かず、seats にも入れない（4 人なら他は左・奥・右）。
function seatPositions(players, myselfId) {
    const seats = {};
    const myIndex = players.findIndex((p) => p.clientId === myselfId);
    players.forEach((p, i) => {
        const slot = (i - myIndex + players.length) % players.length;   // 0=手前（自分）から手番順に時計回り
        if (slot > 0) {
            const a = -slot * (Math.PI * 2 / players.length);
            seats[p.clientId] = { x: Math.sin(a) * 1.42, z: Math.cos(a) * 1.42, scale: 1.2 };
        }
    });
    return seats;
}

//----------------------------------------------------------------------------------------------------
// Board — 場のカード / キャラ / 名札 / HUD / 待機・結果オーバーレイ（client 専用。Table / Player を find で読む）
//----------------------------------------------------------------------------------------------------

function Board(unit) {
    const { xpixi, PIXI, coord3dTo2d } = window.gfx;
    const group = xpixi.nest();
    group.zIndex = 10;

    // 名前入力（待機画面のみ表示）。IME 入力が必要なので HTML input を Screen のアスペクトボックスへ重ねる
    const nameInput = xnew({
        tag: 'input', type: 'text', maxLength: 12, placeholder: 'プレイヤー名（未入力なら自動）',
        style: 'position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); width: 250px; max-width: 44%;'
            + 'padding: 6px 10px; font-size: 14px; text-align: center; border-radius: 8px; border: 1px solid #64748b;'
            + 'background: #0b1220; color: #fff; outline: none; display: none; z-index: 5;',
    });
    nameInput.on('change', ({ value }) => xsync.emitToServer('rename', { name: value }));

    function addText(text, x, y, { size = 14, color = 0xffffff, bold = false, center = false } = {}) {
        const label = new PIXI.Text({ text, style: { fontFamily: 'sans-serif', fontSize: size, fontWeight: bold ? 'bold' : 'normal', fill: color, stroke: { color: 0x0f172a, width: 3 } } });
        if (center) { label.anchor.set(0.5); }
        label.position.set(x, y);
        group.addChild(label);
        return label;
    }

    let cardsUnit = xnew(Cards3D);   // 常駐。場が増えたぶんだけ 3D カードを足す
    let charactersUnit = null;
    let shownChars = null;
    let cursor = null;               // 手番カーソル（毎 tick 上下に揺らして注目させる）
    let animT = 0;

    // 再構築は同期 state が実際に変わったとき（sync.update）だけ予約し、次の tick で描く
    let dirty = true;
    unit.on('sync.update', () => { dirty = true; });
    unit.on('update', ({ delta }) => {
        animT += delta / 1000;
        if (cursor) { cursor.text.position.y = cursor.y + Math.sin(animT * 6) * 5; }
        if (dirty) { dirty = false; redraw(); }
    });

    function redraw() {
        const table = xnew.find(Table)[0];
        if (!table) { return; }
        const s = table.shared;
        const players = xnew.find(Player).map((p) => p.shared).sort((a, b) => a.joinIndex - b.joinIndex);
        const myself = xsync.session.myself.id;
        const seatMap = seatPositions(players, myself);

        // 場のカード: ラウンドをやり直すと枚数が減るので、そのときだけ丸ごと作り直す
        const onBoard = s.placed.filter((on) => on).length;
        if (onBoard < cardsUnit.count) {
            cardsUnit.finalize();
            cardsUnit = xnew(Cards3D);
        }
        cardsUnit.apply(s.placed);

        const keyChars = players.filter((p) => seatMap[p.clientId]).map((p) => p.clientId + p.mog).join();
        if (keyChars !== shownChars) {
            shownChars = keyChars;
            charactersUnit?.finalize();
            charactersUnit = xnew(Characters3D, { seats: players.filter((p) => seatMap[p.clientId]).map((p) => ({ mog: p.mog, ...seatMap[p.clientId] })) });
        }

        cursor = null;
        for (const child of group.removeChildren()) { child.destroy({ children: true }); }
        nameInput.element.style.display = s.phase === 'waiting' ? '' : 'none';

        // ---- HUD ----
        addText('七並べ', 16, 12, { size: 20, bold: true });
        addText(s.lastPlay || s.message || '同じスートの隣（±1）のカードを出していきます', 16, 40, { size: 14, color: 0xcbd5e1 });

        // ---- 他プレイヤーの名札（頭の上へ投影。奥の席は画面上端に寄るのでクランプする） ----
        players.filter((p) => seatMap[p.clientId]).forEach((p) => {
            const seat = seatMap[p.clientId];
            const head = coord3dTo2d(seat.x, 1.15, seat.z);
            const tx = Math.min(W - 70, Math.max(70, head.x));
            const ty = Math.max(66, head.y);
            const isTurn = s.phase === 'playing' && s.turnId === p.clientId;
            const state = p.out ? '脱落' : p.rank > 0 ? `${p.rank}位 上がり` : p.inRound ? `手札${p.handCount} / パス${p.passLeft}` : '観戦';
            const label = addText(`${p.name}\n${state}`, tx, ty, { size: 13, bold: true, center: true, color: isTurn ? 0xfcd34d : 0xffffff });
            label.anchor.set(0.5, 1);
            label.style.align = 'center';
            if (isTurn) {
                const mark = addText('▼', tx, ty - 40, { size: 18, bold: true, center: true, color: 0xfcd34d });
                mark.anchor.set(0.5, 1);
                cursor = { text: mark, y: ty - 40 };
            }
        });

        // ---- 待機 / 結果のオーバーレイ ----
        if (s.phase === 'waiting') { drawWaiting(players); }
        if (s.phase === 'result') { drawResult(s); }
    }

    function drawPanel(x, y, w, h) {
        group.addChild(new PIXI.Graphics().roundRect(x - w / 2, y - h / 2, w, h, 14).fill({ color: 0x0b1220, alpha: 0.92 }).stroke({ width: 2, color: 0x334155 }));
    }

    function drawWaiting(players) {
        drawPanel(W / 2, H / 2, 620, 320);
        addText('七並べ', W / 2, H / 2 - 132, { size: 24, bold: true, center: true });
        addText('・手元の 7 は最初から場に出ています', W / 2 - 270, H / 2 - 92, { size: 14, color: 0xcbd5e1 });
        addText('・自分の番は、場の並びの隣（同じスートの ±1）を 1 枚出すかパス', W / 2 - 270, H / 2 - 68, { size: 14, color: 0xcbd5e1 });
        addText(`・パスは ${PASS_LIMIT} 回まで。使い切ったあとのパスで脱落（手札は場に公開）`, W / 2 - 270, H / 2 - 44, { size: 14, color: 0xcbd5e1 });
        addText(`参加者 ${players.length} 人（${MIN_PLAYERS}〜${MAX_PLAYERS} 人で開始できます）`, W / 2, H / 2 + 62, { size: 14, bold: true, center: true });
        if (players.length >= MIN_PLAYERS) {
            const button = makeButton(PIXI, { label: 'ラウンド開始', onTap: xnew.scope(() => xsync.emitToServer('start', {})) });
            button.position.set(W / 2, H / 2 + 112);
            group.addChild(button);
        } else {
            addText(`あと ${MIN_PLAYERS - players.length} 人参加すると開始できます`, W / 2, H / 2 + 112, { size: 14, color: 0x94a3b8, center: true });
        }
    }

    function drawResult(s) {
        const rows = s.ranking;
        drawPanel(W / 2, H / 2, 460, 150 + rows.length * 28);
        addText('ラウンド終了', W / 2, H / 2 - 55 - rows.length * 14, { size: 24, bold: true, center: true });
        rows.forEach((row, i) => {
            const text = row.out ? `${row.name} — 脱落` : `${row.rank} 位  ${row.name}`;
            addText(text, W / 2, H / 2 - 18 - rows.length * 14 + i * 28, { size: 16, bold: i === 0, center: true, color: i === 0 && !row.out ? 0xfcd34d : 0xffffff });
        });
        const button = makeButton(PIXI, { label: 'もう一度', onTap: xnew.scope(() => xsync.emitToServer('start', {})) });
        button.position.set(W / 2, H / 2 + 45 + rows.length * 14);
        group.addChild(button);
    }
}

//----------------------------------------------------------------------------------------------------
// Table — 公開盤面。placed は 52 マスぶんの真偽値（脱落者の手札公開で並びが飛ぶので区間では持てない）
//----------------------------------------------------------------------------------------------------

function Table(unit) {
    const state = xsync.state({
        phase: 'waiting', message: '', turnId: '', lastPlay: '',
        placed: new Array(SUITS * RANKS).fill(false), ranking: [],
    });
    return {
        get shared() { return state; },
    };
}

//----------------------------------------------------------------------------------------------------
// Player — 公開プロフィール。rank は上がり順（0 = まだ）、out はパス切れ脱落
//----------------------------------------------------------------------------------------------------

export function Player(unit, { clientId = '', name = '', joinIndex = 0, mog = '' } = {}) {
    const state = xsync.state({ clientId, name, joinIndex, mog, handCount: 0, passLeft: PASS_LIMIT, rank: 0, out: false, inRound: false });

    xsync.server(() => ({
        // 空や空白だけの名前は生成時のデフォルト名（プレイヤーN）に戻す
        setName(next) { state.name = (typeof next === 'string' && next.trim() !== '') ? next.trim().slice(0, 12) : name; },
        setHandCount(count) { state.handCount = count; },
        setInRound(inRound) { state.inRound = inRound; },
        setRank(rank) { state.rank = rank; },
        setOut() { state.out = true; },
        usePass() { state.passLeft--; },
        reset() { Object.assign(state, { handCount: 0, passLeft: PASS_LIMIT, rank: 0, out: false, inRound: false }); },
    }));

    return {
        get shared() { return state; },
    };
}

//----------------------------------------------------------------------------------------------------
// Hand — 手札。xsync.visibility の述語で本人にだけ届く。client 分岐は手札 UI とパスボタンを描く
//----------------------------------------------------------------------------------------------------

export function Hand(unit, { ownerId = '' } = {}) {
    const state = xsync.state({ ownerId, cards: [] });

    xsync.server(() => {
        xsync.visibility((clientId) => clientId === ownerId);        // このノードと配下は owner にだけ届く
        return {
            deal(cards) { state.cards = cards; },
            clear() { state.cards = []; },
            has(card) { return state.cards.includes(card); },
            remove(card) { state.cards = state.cards.filter((c) => c !== card); },
            get cards() { return [...state.cards]; },
            get count() { return state.cards.length; },
        };
    });

    // Hand が届くのは本人だけなので、client 分岐は常に「自分の手札」を描く。
    xsync.client(() => {
        const { xpixi, PIXI } = window.gfx;
        const group = xpixi.nest();
        group.zIndex = 40;

        let dirty = true;
        unit.on('sync.update', () => { dirty = true; });
        unit.on('update', () => { if (dirty) { dirty = false; redraw(); } });

        function redraw() {
            for (const child of group.removeChildren()) { child.destroy({ children: true }); }

            const table = xnew.find(Table)[0];
            const me = xnew.find(Player).map((p) => p.shared).find((p) => p.clientId === state.ownerId);
            if (!table || !me || table.shared.phase !== 'playing') { return; }

            const s = table.shared;
            const myTurn = s.turnId === state.ownerId;
            const cards = [...state.cards].sort((a, b) => a - b);

            // 自分の状態（名札の代わり。手札の真上に置く）
            const status = me.out ? 'あなたは脱落しました' : me.rank > 0 ? `あなたは ${me.rank} 位で上がりました` : me.inRound === false ? '観戦中' : myTurn ? 'あなたの番です' : `${nameOf(s.turnId)} の番を待っています`;
            const head = new PIXI.Text({ text: `${status}　パス残り ${me.passLeft}`, style: { fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: myTurn ? 0xfcd34d : 0xe2e8f0, stroke: { color: 0x0f172a, width: 4 } } });
            head.anchor.set(0.5, 1);
            head.position.set(W / 2 - 90, H - 108);
            group.addChild(head);

            // 手札: 出せるカードだけ持ち上げてハイライト。枚数が多いときは重ねて詰める
            const w = 62, h = 88;
            const area = W - 260;                                    // 右側はパスボタンぶん空ける
            const step = cards.length > 1 ? Math.min(w + 8, (area - w) / (cards.length - 1)) : 0;
            const total = w + step * (cards.length - 1);
            const x0 = 30 + (area - total) / 2 + w / 2;
            cards.forEach((card, index) => {
                const enabled = myTurn && playable(s.placed, card);
                const sprite = makeHandCard(PIXI, { card, w, h, enabled });
                sprite.position.set(x0 + index * step, H - 54 - (enabled ? 12 : 0));
                if (enabled) {
                    sprite.eventMode = 'static';
                    sprite.cursor = 'pointer';
                    // pixi のイベントは tick/scope の外で発火するので xnew.scope で unit の scope に戻す
                    sprite.on('pointertap', xnew.scope(() => xsync.emitToServer('play', { card })));
                }
                group.addChild(sprite);
            });

            // パスボタン: 残 0 のパスは脱落なので色と文言を変える
            if (myTurn) {
                const last = me.passLeft === 0;
                const button = makeButton(PIXI, {
                    label: last ? 'パス（脱落する）' : `パス（残り ${me.passLeft}）`,
                    w: 170, h: 40, color: last ? 0xb91c1c : 0x2563eb,
                    onTap: xnew.scope(() => xsync.emitToServer('pass', {})),
                });
                button.position.set(W - 105, H - 54);
                group.addChild(button);
            }
        }

        function nameOf(clientId) {
            const player = xnew.find(Player).map((p) => p.shared).find((p) => p.clientId === clientId);
            return player ? player.name : '—';
        }
    });
}
