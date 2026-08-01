//----------------------------------------------------------------------------------------------------
// cat_king game — 「シャーロックホームズと猫王」（正体隠匿 × カード × マップ）のマルチプレイ実装。
//   server/client 共通の 1 ファイル。Node では xsync.server 分岐だけ、browser では xsync.client 分岐だけが動く。
//
//   モデル（すべて server 権威・xsync で同期）:
//     - Table  : 公開盤面 { phase, turnId, catCells[3], detCell, sanmaCell, deckCount, lastPlay, 結果情報 }。
//     - Player : 公開プロフィール { clientId, name, joinIndex, catCoins, detCoins, label, handCount, inRound }。
//     - Secret : 秘密情報 { ownerId, role, cards[] }。xsync.visibility の述語で本人にだけ届く。
//               猫王の色（kingColor）は server のローカル変数に持ち、結果発表まで共有 state に書かない。
//
//   進行: 3〜8 人そろったら誰かが「ラウンド開始」→ 役割と手札 2 枚を配る → 手番に 1 枚出して 1 枚引く。
//         カードは種別と軸（縦=北南 / 横=東西）を指定し、移動先（軸上の隣接マス）は出すときに選ぶ。
//         動かせるトークンがいないカードは捨てるだけで手番が終わる（稀。サーバーが検証する）→
//         猫王がサンマのマスに着けば猫チーム、探偵が猫王のマスに乗れば探偵チームの勝ち（即ラウンド終了）。
//         探偵が猫王でない猫のマスに乗るとその猫を捕獲し、盤から取り除く（そのラウンド中は復帰しない）。
//         勝利チーム全員に 1 コイン、合計 3 コインで優勝（コインの多い側の称号で君臨）。
//
//   描画: Three（畳・ちゃぶ台・盤・トークンの 3D。OffscreenCanvas に描く）+ Pixi（2D の HUD / 手札 UI。
//         three の canvas を最背面スプライトに合成）。カード選択後の対象選択（例: どの猫を動かすか）は
//         3D トークンの上にフロートするピンを立て、その位置をクリックさせる。
//         browser 専用ライブラリは window.gfx 経由。index.js が render.js を載せる。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';

const W = 960, H = 600;                                     // 描画解像度（Screen のバッファ）
const MIN_PLAYERS = 3, MAX_PLAYERS = 8;
const HAND_SIZE = 2;
const GOAL_COINS = 3;

const CAT_COLORS = ['red', 'green', 'blue'];                // 猫トークンの並び順（index が同期 state と対応）
const CAT_LABELS = ['赤', '緑', '青'];
const CAT_FILLS = [0xef4444, 0x22c55e, 0x3b82f6];
const DIR_VECTORS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };   // 北=盤の奥
const DIR_LABELS = { N: '北', S: '南', E: '東', W: '西' };
const AXIS_DIRS = { v: ['N', 'S'], h: ['E', 'W'] };                     // カードの軸 → 選べる方向
const AXIS_ARROWS = { v: '↕', h: '↔' };
const TEAM_LABELS = { cat: '猫', det: '探偵' };
const MOGS = ['zundamon', 'zunko', 'itako', 'metan', 'sora', 'miku', 'teto', 'usagi'];  // assets/*.mog（重複なしで割当）

// 初期配置ルール: 猫は探偵ともサンマとも「同マス・縦横隣接」にならない（1 手で決着・捕獲される配置を避ける）。
// 猫同士の重なりと、探偵とサンマの重なりは許可。

// 手札カードの見た目（種別 → 色とラベル。移動カードの中央には軸の矢印を描く）
const KIND_STYLES = {
    cat: { color: 0xd97706, label: 'ネコ' },
    det: { color: 0x1d4ed8, label: '探偵' },
    sanma: { color: 0x0f766e, label: 'サンマ' },
    label: { color: 0x7c3aed, label: 'ラベル' },
};

//----------------------------------------------------------------------------------------------------
// server helpers（deck / 役割 / 移動）
//----------------------------------------------------------------------------------------------------

function shuffle(cards) {
    const array = [...cards];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// プレイヤーカードの山札。移動カードは 'kind:軸'（軸 v=縦 / h=横。向きは出すときに選ぶ）
function buildDeck() {
    const deck = [];
    for (const axis of ['v', 'h']) {
        for (let k = 0; k < 10; k++) { deck.push(`cat:${axis}`); }      // 猫 縦横 × 10
        for (let k = 0; k < 8; k++) { deck.push(`det:${axis}`); }       // 探偵 縦横 × 8
        for (let k = 0; k < 2; k++) { deck.push(`sanma:${axis}`); }     // サンマ 縦横 × 2
    }
    deck.push('label:cat', 'label:cat', 'label:det', 'label:det');      // ラベル各 2
    return deck;
}

// 同マス or 縦横の隣接（斜めは含まない）
function nearCell(a, b) {
    return Math.abs(a % 3 - b % 3) + Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) <= 1;
}

// 初期配置: 探偵とサンマを置き、猫はどちらにも近接しないマスからランダムに選ぶ（重なり可）
function buildLayout() {
    while (true) {
        const det = Math.floor(Math.random() * 9);
        const sanma = Math.floor(Math.random() * 9);
        const allowed = [];
        for (let cell = 0; cell < 9; cell++) {
            if (!nearCell(cell, det) && !nearCell(cell, sanma)) { allowed.push(cell); }
        }
        if (allowed.length > 0) {
            const pick = () => allowed[Math.floor(Math.random() * allowed.length)];
            return { cats: [pick(), pick(), pick()], det, sanma };
        }
    }
}

// axis のカードでその猫を動かせるか（軸上のどちらかに、盤内かつ探偵のいない移動先がある）
function catMovable(catCell, detCell, axis) {
    return AXIS_DIRS[axis].some((dir) => {
        const next = moveCell(catCell, dir);
        return next != null && next !== detCell;
    });
}

// 役割束: 色付き猫 1 + 探偵 1 + 残り（無色猫 5 + 探偵 5）から人数分
function buildRoles(count) {
    const colored = `cat:${CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)]}`;
    const rest = shuffle(['cat', 'cat', 'cat', 'cat', 'cat', 'det', 'det', 'det', 'det', 'det']).slice(0, count - 2);
    return shuffle([colored, 'det', ...rest]);
}

// dir へ 1 マス。盤外なら null（トークンは動かずカードだけ消費、の判定に使う）
function moveCell(cell, dir) {
    const [dx, dy] = DIR_VECTORS[dir];
    const x = cell % 3 + dx, y = Math.floor(cell / 3) + dy;
    if (x < 0 || x > 2 || y < 0 || y > 2) { return null; }
    return y * 3 + x;
}

//----------------------------------------------------------------------------------------------------
// pixi helpers（ボタン / 手札カードの見た目）
//----------------------------------------------------------------------------------------------------

function makeButton(PIXI, { label, w = 120, h = 32, color = 0x2563eb, fontSize = 14, onTap }) {
    const button = new PIXI.Container();
    button.addChild(new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, 8).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.6 }));
    const text = new PIXI.Text({ text: label, style: { fontFamily: 'sans-serif', fontSize, fontWeight: 'bold', fill: 0xffffff } });
    text.anchor.set(0.5);
    button.addChild(text);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointertap', onTap);
    return button;
}

// カード面は assets/ の生成イラスト。テクスチャが未ロードの間だけ従来の無地デザインで代替する。
function makeHandCard(PIXI, { card, w, h, highlight = false }) {
    const [kind, arg] = card.split(':');
    const style = KIND_STYLES[kind];
    const sprite = new PIXI.Container();
    const texture = window.gfx.cardTextures[card];
    if (texture) {
        const image = new PIXI.Sprite(texture);
        image.anchor.set(0.5);
        const scale = Math.max(w / texture.width, h / texture.height);     // cover でカード枠を満たす
        image.scale.set(scale);
        const mask = new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, 10).fill(0xffffff);
        image.mask = mask;
        sprite.addChild(mask);
        sprite.addChild(image);
    } else {
        sprite.addChild(new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, 10).fill(style.color));
        const title = new PIXI.Text({ text: style.label, style: { fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: 0xffffff } });
        title.anchor.set(0.5);
        title.position.set(0, -h / 2 + 20);
        sprite.addChild(title);
        const glyph = kind === 'label' ? TEAM_LABELS[arg] : AXIS_ARROWS[arg];
        const body = new PIXI.Text({ text: glyph, style: { fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold', fill: 0xffffff } });
        body.anchor.set(0.5);
        body.position.set(0, 10);
        sprite.addChild(body);
    }
    sprite.addChild(new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, 10)
        .stroke({ width: highlight ? 4 : 2, color: highlight ? 0xfcd34d : 0x0f172a }));
    return sprite;
}

// 得点コイン（猫サイド勝利=猫耳の金貨 / 探偵サイド勝利=帽子の銀貨）を g に描く
function drawCoin(g, team, x, y) {
    if (team === 'cat') {
        g.poly([x - 9, y - 2, x - 7, y - 12, x - 2, y - 6]).fill(0xfbbf24);
        g.poly([x + 9, y - 2, x + 7, y - 12, x + 2, y - 6]).fill(0xfbbf24);
        g.circle(x, y, 9).fill(0xfbbf24).stroke({ width: 2, color: 0x92400e });
        g.circle(x - 3, y - 1, 1.4).fill(0x92400e);
        g.circle(x + 3, y - 1, 1.4).fill(0x92400e);
    } else {
        g.circle(x, y, 9).fill(0xbfdbfe).stroke({ width: 2, color: 0x1e3a8a });
        g.circle(x, y - 3, 4.5).fill(0x1e3a8a);
        g.ellipse(x, y - 1, 7, 2.2).fill(0x1e3a8a);
    }
}

//----------------------------------------------------------------------------------------------------
// Game — server/client 共通ルート（Room が boot する）。Table / Player / Secret を synced child に持つ。
//----------------------------------------------------------------------------------------------------

export function Game(unit) {
    xsync.register({ Table, Player, Secret });

    // ---- server: 接続ごとに Player + Secret を生成し、'start' でラウンド開始、'play' で 1 手を処理する ----
    xsync.server(() => {
        const table = xnew(Table);
        let joinCounter = 0;
        let roundIds = [];                                  // ラウンド参加者の clientId（手番順）
        let deck = [], discardPile = [];                    // discardPile: play 引数の discard と混同しないこと
        let kingColor = '', kingHolder = '';                // 猫王の色と色付き猫カードの持ち主（結果発表まで server 内のみ）

        // 勝利チーム全員に 1 コイン。ラベルが貼られていればそのチームとして受け取る（ドキュメント準拠）。
        // 結果表示（kingHolder / champions）は退室後もぶら下がらないよう、id ではなく確定時の名前で共有する。
        function finishRound(team) {
            const champions = [];
            for (const cid of roundIds) {
                const player = xnew.find(Player, { key: cid })[0];
                const secret = xnew.find(Secret, { key: cid })[0];
                if (!player || !secret) { continue; }
                const memberTeam = player.shared.label || (secret.role.startsWith('cat') ? 'cat' : 'det');
                if (memberTeam === team) { player.addCoin(team); }
                if (player.shared.catCoins + player.shared.detCoins >= GOAL_COINS) {
                    champions.push({ name: player.shared.name, title: player.shared.catCoins > player.shared.detCoins ? '猫王' : 'シャーロックホームズ' });
                }
            }
            const holder = xnew.find(Player, { key: kingHolder })[0];
            Object.assign(table.shared, { phase: 'result', turnId: '', winnerTeam: team, kingColor, kingHolder: holder ? holder.shared.name : '—', champions });
        }

        // ラウンドを中断して待機に戻す（参加者の切断時）
        function abortRound(reason) {
            roundIds = [];
            for (const player of xnew.find(Player)) { player.setInRound(false); player.setLabel(''); player.setHandCount(0); }
            for (const secret of xnew.find(Secret)) { secret.clear(); }
            Object.assign(table.shared, { phase: 'waiting', message: reason, turnId: '', lastPlay: '', winnerTeam: '', kingColor: '', kingHolder: '' });
        }

        unit.on('sync.connect', ({ id }) => {
            joinCounter++;
            // キャラモデルは未使用の mog からランダムに割当（全クライアントで同じ見た目になるよう server が決める）
            const used = new Set(xnew.find(Player).map((p) => p.shared.mog));
            const available = MOGS.filter((mog) => used.has(mog) === false);
            const mog = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : MOGS[joinCounter % MOGS.length];
            xnew(Player, { key: id, clientId: id, name: `プレイヤー${joinCounter}`, joinIndex: joinCounter, mog });
            xnew(Secret, { key: id, ownerId: id });         // ラウンド中の途中参加は role='' のまま観戦
        });

        // 待機画面の名前入力。未入力（空文字）は Player 側でデフォルト名に戻る
        unit.on('rename', ({ id, name }) => {
            xnew.find(Player, { key: id })[0]?.setName(name);
        });

        unit.on('sync.disconnect', ({ id }) => {
            const wasInRound = roundIds.includes(id);
            xnew.find(Player, { key: id })[0]?.finalize();
            xnew.find(Secret, { key: id })[0]?.finalize();
            if (table.shared.phase === 'playing' && wasInRound) { abortRound('参加者が切断したためラウンドを中断しました'); }
        });

        // ラウンド開始: マップカードを引き、役割と手札 3 枚を配り、ランダムな席から時計回り（参加順）で手番開始
        unit.on('start', () => {
            if (table.shared.phase === 'playing') { return; }
            const players = xnew.find(Player).sort((a, b) => a.shared.joinIndex - b.shared.joinIndex);
            if (players.length < MIN_PLAYERS) { return; }
            const members = players.slice(0, MAX_PLAYERS);

            // 優勝者が出た後の開始は新しい勝負としてコインをリセット
            if (table.shared.champions.length > 0) { for (const player of players) { player.resetCoins(); } }

            const layout = buildLayout();
            const roles = buildRoles(members.length);
            deck = shuffle(buildDeck());
            discardPile = [];
            kingColor = '';
            kingHolder = '';
            for (const player of players) { player.setInRound(false); player.setLabel(''); player.setHandCount(0); }
            for (const secret of xnew.find(Secret)) { secret.clear(); }
            members.forEach((player, i) => {
                const cid = player.shared.clientId;
                const secret = xnew.find(Secret, { key: cid })[0];
                secret.setRole(roles[i]);
                if (roles[i].startsWith('cat:')) { kingColor = roles[i].split(':')[1]; kingHolder = cid; }
                secret.deal(deck.splice(0, HAND_SIZE));
                player.setHandCount(HAND_SIZE);
                player.setInRound(true);
            });
            roundIds = members.map((player) => player.shared.clientId);
            const start = Math.floor(Math.random() * roundIds.length);
            roundIds = [...roundIds.slice(start), ...roundIds.slice(0, start)];
            Object.assign(table.shared, {
                phase: 'playing', message: '', turnId: roundIds[0], deckCount: deck.length, lastPlay: '',
                catCells: [...layout.cats], detCell: layout.det, sanmaCell: layout.sanma,
                winnerTeam: '', kingColor: '', kingHolder: '', champions: [],
            });
        });

        // play: 自分の手番のときだけ、手札の cardIndex を出して効果を適用し、1 枚引いて手番を次へ回す。
        //   dir はカードの軸から選んだ方向。target は猫カードなら猫 index(0..2)、ラベルカードなら相手の
        //   clientId。discard は「動かせる猫がいない」ときの捨て札宣言（本当に動かせないかは検証する）。
        //   不正な指定（軸外の方向・盤外・探偵マスへの猫移動など）はカードを消費せず無視。
        unit.on('play', ({ id, cardIndex, target, dir, discard }) => {
            const s = table.shared;
            if (s.phase !== 'playing' || s.turnId !== id) { return; }
            const player = xnew.find(Player, { key: id })[0];
            const secret = xnew.find(Secret, { key: id })[0];
            if (!player || !secret) { return; }
            const card = secret.card(cardIndex);
            if (card == null) { return; }
            const [kind, arg] = card.split(':');                        // arg = 軸(v/h) or ラベルのチーム
            const isDiscard = kind === 'cat' && discard === true;       // 捨て札はネコカードのみ
            if (kind !== 'label' && !isDiscard && !AXIS_DIRS[arg].includes(dir)) { return; }

            let detail = '';
            if (isDiscard) {
                // どの猫も軸方向に動かせないときだけ、カードを捨てるだけで手番を終えられる
                if (s.catCells.some((cell) => cell >= 0 && catMovable(cell, s.detCell, arg))) { return; }
                detail = 'ネコカードを捨てた（動かせる猫がいない）';
            } else if (kind === 'cat') {
                const catIndex = Number(target);
                if (!(catIndex >= 0 && catIndex < 3)) { return; }
                if (s.catCells[catIndex] < 0) { return; }               // 捕獲済みの猫は選べない
                const next = moveCell(s.catCells[catIndex], dir);
                if (next == null || next === s.detCell) { return; }     // 盤外 or 探偵のいるマスへは進めない
                s.catCells[catIndex] = next;
                detail = `${CAT_LABELS[catIndex]}猫を${DIR_LABELS[dir]}へ`;
            } else if (kind === 'det') {
                const next = moveCell(s.detCell, dir);
                if (next == null) { return; }
                s.detCell = next;
                // 到達マスの猫を捕獲して盤から取り除く（猫王だけは捕獲でなく下の勝利判定でラウンド終了）
                const capturedLabels = [];
                s.catCells.forEach((cell, catIndex) => {
                    if (cell === next && CAT_COLORS[catIndex] !== kingColor) {
                        s.catCells[catIndex] = -1;
                        capturedLabels.push(`${CAT_LABELS[catIndex]}猫`);
                    }
                });
                detail = `探偵を${DIR_LABELS[dir]}へ${capturedLabels.length > 0 ? `（${capturedLabels.join('・')}を捕獲！）` : ''}`;
            } else if (kind === 'sanma') {
                const next = moveCell(s.sanmaCell, dir);
                if (next == null) { return; }
                s.sanmaCell = next;
                detail = `サンマを${DIR_LABELS[dir]}へ`;
            } else if (kind === 'label') {
                const targetPlayer = xnew.find(Player, { key: String(target) })[0];
                if (!targetPlayer || targetPlayer.shared.clientId === id || !targetPlayer.shared.inRound) { return; }
                targetPlayer.setLabel(arg);                              // 最新のラベルだけが有効（上書き）
                detail = `${targetPlayer.shared.name} に${TEAM_LABELS[arg]}ラベル`;
            }

            secret.play(cardIndex);
            discardPile.push(card);
            if (deck.length === 0) { deck = shuffle(discardPile); discardPile = []; }   // 山札が尽きたら捨て札を新山札に
            const drawn = deck.pop();
            if (drawn != null) { secret.add(drawn); }
            player.setHandCount(secret.count);
            s.deckCount = deck.length;
            s.lastPlay = `${player.shared.name}：${detail}`;

            // 勝利判定: どちらのトークンが動いた結果かは問わず、同マスになった瞬間に成立
            const kingCell = s.catCells[CAT_COLORS.indexOf(kingColor)];
            if (kingCell === s.sanmaCell) {
                finishRound('cat');
            } else if (s.detCell === kingCell) {
                finishRound('det');
            } else {
                s.turnId = roundIds[(roundIds.indexOf(id) + 1) % roundIds.length];
            }
        });
    });

    // ---- client: Screen(canvas) を用意し、Three(3D 卓上) と Pixi(2D UI) を初期化して合成ループを回す ----
    //   自分の手札 UI は Secret（本人にだけ届く）の client 分岐が描く。
    xsync.client(() => {
        const { Screen, xpixi, xthree, PIXI, THREE } = window.gfx;
        xnew.extend(Screen, { width: W, height: H });

        // three: OffscreenCanvas に描く。盤が読める程度に見下ろしつつ、テーブルを囲むキャラも映る角度（奥=北）
        const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
        camera.position.set(0, 2.9, 3.2);
        camera.lookAt(0, 0.45, 0);
        xthree.initialize({ canvas: new OffscreenCanvas(W, H), camera });

        // pixi: 画面 canvas（背景は透過）。この上に HUD と手札 UI を重ねる
        xpixi.initialize({ canvas: unit.canvas });

        xnew.promise(unit).then(() => {
            xthree.renderer.shadowMap.enabled = true;
            xpixi.scene.sortableChildren = true;                    // zIndex で重なり順を制御

            // three の描画結果を最背面スプライトとして pixi へ持ち込む
            const texture = PIXI.Texture.from(xthree.canvas);
            const background = xpixi.add(new PIXI.Sprite(texture));
            background.width = W;
            background.height = H;
            background.zIndex = 0;

            unit.on('update', () => {
                xthree.renderer.render(xthree.scene, xthree.camera);
                texture.source.update();
                xpixi.renderer.render(xpixi.scene);
            });

            xnew(Scene3D);   // ライト / 畳の床 / ちゃぶ台 / 盤の板（three）
            xnew(Board);     // 3D トークン + HUD / オーバーレイ
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Scene3D — ライト・畳の床・円形ちゃぶ台・盤の板（render.js の共通部品。トークンは Board が nest する）
//----------------------------------------------------------------------------------------------------

function Scene3D(unit) {
    const { Lights, Ground, Chabudai, BoardPlate } = window.gfx;
    xnew(Lights);
    xnew(Ground);
    xnew(Chabudai);
    xnew(BoardPlate);
}

//----------------------------------------------------------------------------------------------------
// Tokens3D — 盤上の駒一式（猫 3・探偵・サンマ）。常駐し、apply で目標位置へなめらかに移動する。
//   捕獲済みの猫は盤の右横に横倒し（スロットは自分より前の捕獲猫の数で決める）。
//----------------------------------------------------------------------------------------------------

function Tokens3D(unit, { catCells, detCell, sanmaCell }) {
    const { CatToken, DetectiveToken, SanmaToken, cellToWorld, TABLE } = window.gfx;

    function catPlacement(cells, catIndex) {
        if (cells[catIndex] >= 0) {
            return { ...cellToWorld(cells[catIndex], (catIndex - 1) * 0.12, -0.1), lying: false };      // マス上段に色順で並べる
        }
        const slot = cells.slice(0, catIndex).filter((cell) => cell < 0).length;
        return { x: TABLE.RADIUS * 0.68, z: -0.18 + slot * 0.22, lying: true };
    }

    const cats = catCells.map((cell, catIndex) => xnew(CatToken, { color: CAT_FILLS[catIndex], ...catPlacement(catCells, catIndex) }));
    const det = xnew(DetectiveToken, cellToWorld(detCell, -0.11, 0.12));
    const sanma = xnew(SanmaToken, cellToWorld(sanmaCell, 0.11, 0.12));

    return {
        apply({ catCells, detCell, sanmaCell }) {
            cats.forEach((cat, catIndex) => cat.place(catPlacement(catCells, catIndex)));
            det.place(cellToWorld(detCell, -0.11, 0.12));
            sanma.place(cellToWorld(sanmaCell, 0.11, 0.12));
        },
    };
}

//----------------------------------------------------------------------------------------------------
// Characters3D — プレイヤーのキャラモデル一式（.mog + 歩きモーション）。席替えやモデル変更時に作り直す。
//----------------------------------------------------------------------------------------------------

function Characters3D(unit, { seats }) {
    const { Character } = window.gfx;
    let selfChar = null, selfSeat = null;
    seats.forEach((seat) => {
        const character = xnew(Character, { mogPath: `/assets/${seat.mog}.mog`, vrmaPath: '/assets/walk.vrma', x: seat.x, z: seat.z, rotX: seat.rotX ?? 0, rotY: seat.rotY, scale: seat.scale });
        if (seat.self) { selfChar = character; selfSeat = seat; }
    });
    return {
        // 自キャラの向き: 盤上の対象選択中はマップ（テーブル中央）へ、終わったら定位置の向きへ戻す
        faceMap(towardMap) {
            selfChar?.look(towardMap ? { rotX: 0, rotY: null } : { rotX: selfSeat.rotX, rotY: selfSeat.rotY });
        },
    };
}

// 座席: ちゃぶ台をプレイヤー数で等分割し、自分の席（手前）を基準に参加順で埋める（4 人なら他は右・奥・左）。
// 自分のモデルはテーブルの席とは独立に、左下へ正面やや右向きで置く（手前の席は空けたまま）。
function seatPositions(players, myselfId) {
    const seats = {};
    const myIndex = players.findIndex((p) => p.clientId === myselfId);
    players.forEach((p, i) => {
        if (p.clientId === myselfId) {
            seats[p.clientId] = { x: -0.8, z: 1.28, rotX: -0.5, rotY: 0.45, scale: 1.2, self: true };   // 手札のすぐ左・ちゃぶ台より手前
        } else {
            const slot = (i - myIndex + players.length) % players.length;
            const a = -slot * (Math.PI * 2 / players.length);           // 0=手前（自分の席）から手番順に時計回り（次の手番は左隣）
            seats[p.clientId] = { x: Math.sin(a) * 1.35, z: Math.cos(a) * 1.32, rotY: null, scale: 1.3 };
        }
    });
    return seats;
}

//----------------------------------------------------------------------------------------------------
// Board — 3D トークン / キャラ / 名札 / 待機・結果オーバーレイ（client 専用。Table / Player を find で読む）
//----------------------------------------------------------------------------------------------------

function Board(unit) {
    const { xpixi, PIXI, coord3dTo2d } = window.gfx;
    const group = xpixi.nest();
    group.zIndex = 10;

    // 名前入力（待機画面のみ表示）。IME 入力が必要なので HTML input を Screen のアスペクトボックスへ重ねる
    const nameInput = xnew({
        tag: 'input', type: 'text', maxLength: 12, placeholder: 'プレイヤー名（未入力なら自動）',
        style: 'position: absolute; left: 50%; top: 53%; transform: translate(-50%, -50%); width: 250px; max-width: 44%;'
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

    let tokensUnit = null;   // 3D の駒一式（常駐。配置が変わったら apply でなめらかに移動）
    let shown3d = null;
    let charactersUnit = null;   // プレイヤーのキャラ一式（顔ぶれが変わったときだけ作り直す）
    let shownChars = null;
    let cursor = null;       // 手番カーソル { text, y }（毎 tick 上下に揺らして注目させる）
    let coinSpins = [];      // 名札のコイン（画面の縦方向を軸に回転して見えるよう横スケールを振動させる）
    const COIN_SCALE = 1.4;
    let animT = 0;

    // 再構築は同期 state が実際に変わったとき（sync.update）だけ予約し、次の tick で描く
    let dirty = true;
    unit.on('sync.update', () => { dirty = true; });
    unit.on('update', ({ delta }) => {
        animT += delta / 1000;
        if (cursor) { cursor.text.position.y = cursor.y + Math.sin(animT * 6) * 5; }
        coinSpins.forEach((coin, i) => { coin.scale.x = COIN_SCALE * Math.cos(animT * 4 + i * 0.6); });
        if (dirty) { dirty = false; redraw(); }
    });

    function redraw() {
        const table = xnew.find(Table)[0];
        if (!table) { return; }
        const s = table.shared;
        const players = xnew.find(Player).map((p) => p.shared).sort((a, b) => a.joinIndex - b.joinIndex);
        const myself = xsync.session.myself.id;
        const seatMap = seatPositions(players, myself);

        const key3d = [s.catCells, s.detCell, s.sanmaCell].join();   // 配置が同じなら glide を触らない（進行中の移動を守る）
        if (key3d !== shown3d) {
            shown3d = key3d;
            if (tokensUnit == null) {
                tokensUnit = xnew(Tokens3D, { catCells: [...s.catCells], detCell: s.detCell, sanmaCell: s.sanmaCell });
            } else {
                tokensUnit.apply({ catCells: [...s.catCells], detCell: s.detCell, sanmaCell: s.sanmaCell });
            }
        }

        const keyChars = players.map((p) => p.clientId + p.mog).join();
        if (keyChars !== shownChars) {
            shownChars = keyChars;
            charactersUnit?.finalize();
            charactersUnit = xnew(Characters3D, { seats: players.map((p) => ({ mog: p.mog, ...seatMap[p.clientId] })) });
        }

        cursor = null;
        coinSpins = [];
        for (const child of group.removeChildren()) { child.destroy({ children: true }); }
        nameInput.element.style.display = s.phase === 'waiting' ? '' : 'none';

        // ---- プレイヤーの名札（キャラの頭上に投影。名前・コイン・ラベル・手番カーソル） ----
        players.forEach((p) => {
            const seat = seatMap[p.clientId];
            const isTurn = s.phase === 'playing' && s.turnId === p.clientId;
            const spectating = s.phase === 'playing' && !p.inRound;
            // mog はチビキャラ（頭上すれすれに置く）。カメラに近い自キャラは高さ分の投影が横へ流れるので、
            // 足元の投影位置から画面上へ固定オフセットして頭の真上に出す。
            let head;
            if (p.clientId === myself) {
                const base = coord3dTo2d(seat.x, 0, seat.z);
                head = { x: base.x, y: base.y - 150 };
            } else {
                head = coord3dTo2d(seat.x, seat.scale * 0.63, seat.z);
            }
            addText(p.name, head.x, head.y, { size: 16, bold: true, center: true, color: isTurn ? 0xfcd34d : (spectating ? 0x94a3b8 : 0xffffff) });
            const coinCount = p.catCoins + p.detCoins;
            if (coinCount > 0) {
                let cx = head.x - coinCount * 16 + 16;
                for (let k = 0; k < coinCount; k++) {
                    const coin = new PIXI.Graphics();
                    drawCoin(coin, k < p.catCoins ? 'cat' : 'det', 0, 0);
                    coin.position.set(cx, head.y + 28);
                    coin.scale.set(COIN_SCALE);
                    group.addChild(coin);
                    coinSpins.push(coin);
                    cx += 32;
                }
            }
            if (p.label) {                                              // ラベル状態は紫のバッジで明示する
                const badgeText = new PIXI.Text({ text: `${TEAM_LABELS[p.label]}ラベル`, style: { fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold', fill: 0xffffff } });
                const badgeW = badgeText.width + 14;
                const badgeY = head.y + (coinCount > 0 ? 48 : 18);
                group.addChild(new PIXI.Graphics().roundRect(head.x - badgeW / 2, badgeY, badgeW, 21, 7).fill(0x7c3aed).stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 }));
                badgeText.position.set(head.x - badgeW / 2 + 7, badgeY + 3);
                group.addChild(badgeText);
            }
            if (spectating) { addText('（観戦）', head.x, head.y + 26, { size: 13, color: 0x94a3b8, center: true }); }
            if (isTurn) {
                const mark = addText('▼', head.x, head.y - 30, { size: 22, bold: true, color: 0xfcd34d, center: true });
                cursor = { text: mark, y: head.y - 30 };
            }
        });

        // ---- 待機オーバーレイ（ルール要約と開始ボタン） ----
        if (s.phase === 'waiting') {
            const panel = new PIXI.Graphics().roundRect(W / 2 - 310, 145, 620, 300, 16).fill(0x0f172a).stroke({ width: 2, color: 0x475569 });
            group.addChild(panel);
            addText('🐟 シャーロックホームズと猫王', W / 2, 175, { size: 20, bold: true, center: true });
            const rules = [
                '・各ラウンドで勝利条件を満たすとコインゲット！（３コインで優勝）',
                '・猫チームはサンマの入手、探偵チームは猫王の捕獲が勝利条件',
                '・どのコマが猫王か？誰がどのチームか？　正体隠匿の推理ゲーム！',
            ];
            rules.forEach((line, i) => { addText(line, W / 2 - 280, 215 + i * 30, { size: 15, color: 0xcbd5e1 }); });
            if (s.message) { addText(s.message, W / 2, 296, { size: 14, color: 0xf87171, center: true }); }
            addText(`参加者 ${players.length} 人（${MIN_PLAYERS}〜${MAX_PLAYERS} 人で開始できます）`, W / 2, 358, { size: 14, center: true });
            if (players.length >= MIN_PLAYERS) {
                group.addChild(Object.assign(makeButton(PIXI, {
                    label: 'ラウンド開始', w: 180, h: 40, fontSize: 16,
                    onTap: xnew.scope(() => xsync.emitToServer('start', {})),
                }), { position: { x: W / 2, y: 404 } }));
            } else {
                addText(`あと ${MIN_PLAYERS - players.length} 人参加すると開始できます`, W / 2, 404, { size: 14, color: 0x94a3b8, center: true });
            }
        }

        // ---- 結果オーバーレイ（猫王の正体公開・コイン・優勝） ----
        if (s.phase === 'result') {
            const panel = new PIXI.Graphics().roundRect(W / 2 - 310, 106, 620, 334, 16).fill(0x0f172a).stroke({ width: 2, color: 0xfcd34d });
            group.addChild(panel);
            addText(`${s.winnerTeam === 'cat' ? '🐈' : '🕵️'} ${TEAM_LABELS[s.winnerTeam]}チームの勝利！`, W / 2, 145, { size: 22, bold: true, color: 0xfcd34d, center: true });
            addText(`猫王は【${CAT_LABELS[CAT_COLORS.indexOf(s.kingColor)]}】でした（${s.kingHolder} が知っていた）`, W / 2, 190, { size: 16, center: true });
            addText(`${TEAM_LABELS[s.winnerTeam]}チーム全員が${TEAM_LABELS[s.winnerTeam]}コインを 1 枚獲得`, W / 2, 222, { size: 14, color: 0xcbd5e1, center: true });
            s.champions.forEach((champion, i) => {
                addText(`👑 ${champion.name} が優勝！（${champion.title}として君臨）`, W / 2, 262 + i * 26, { size: 16, bold: true, color: 0xfcd34d, center: true });
            });
            if (players.length >= MIN_PLAYERS) {
                group.addChild(Object.assign(makeButton(PIXI, {
                    label: s.champions.length > 0 ? '新しい勝負を開始' : '次のラウンドへ', w: 200, h: 40, fontSize: 16,
                    onTap: xnew.scope(() => xsync.emitToServer('start', {})),
                }), { position: { x: W / 2, y: 396 } }));
            }
        }
    }
}

//----------------------------------------------------------------------------------------------------
// Table — 公開盤面。kingColor / kingHolder は結果発表のときだけ書き込まれる（プレイ中は空文字）。
//----------------------------------------------------------------------------------------------------

function Table(unit) {
    const state = xsync.state({
        phase: 'waiting', message: '', turnId: '', deckCount: 0, lastPlay: '',
        catCells: [0, 2, 6], detCell: 4, sanmaCell: 8,
        winnerTeam: '', kingColor: '', kingHolder: '', champions: [],
    });
    return {
        get shared() { return state; },
    };
}

//----------------------------------------------------------------------------------------------------
// Player — 公開プロフィール（コインは猫 / 探偵の 2 種別。優勝時の称号は多い方で決まる）
//----------------------------------------------------------------------------------------------------

export function Player(unit, { clientId = '', name = '', joinIndex = 0, mog = '' } = {}) {
    const state = xsync.state({ clientId, name, joinIndex, mog, catCoins: 0, detCoins: 0, label: '', handCount: 0, inRound: false });

    xsync.server(() => ({
        // 空や空白だけの名前は生成時のデフォルト名（プレイヤーN）に戻す
        setName(next) { state.name = (typeof next === 'string' && next.trim() !== '') ? next.trim().slice(0, 12) : name; },
        setLabel(label) { state.label = label; },
        setHandCount(count) { state.handCount = count; },
        setInRound(inRound) { state.inRound = inRound; },
        addCoin(team) { if (team === 'cat') { state.catCoins++; } else { state.detCoins++; } },
        resetCoins() { state.catCoins = 0; state.detCoins = 0; },
    }));

    return {
        get shared() { return state; },
    };
}

//----------------------------------------------------------------------------------------------------
// Secret — 役割と手札。xsync.visibility の述語で本人にだけ届く（他人の役割・手札はワイヤに載らない）。
//   client 分岐は自分の正体パネルと手札 UI（猫方向 → 猫選択、ラベル → 相手選択の 2 段操作）を描く。
//----------------------------------------------------------------------------------------------------

export function Secret(unit, { ownerId = '' } = {}) {
    const state = xsync.state({ ownerId, role: '', cards: [] });

    xsync.server(() => {
        xsync.visibility((clientId) => clientId === ownerId);           // このノードと配下は owner にだけ届く
        return {
            setRole(role) { state.role = role; },
            deal(cards) { state.cards = cards; },
            card(index) { return state.cards[index]; },
            play(index) { if (index < 0 || index >= state.cards.length) { return null; } const [card] = state.cards.splice(index, 1); return card; },
            add(card) { state.cards.push(card); },
            clear() { state.role = ''; state.cards = []; },
            get role() { return state.role; },
            get count() { return state.cards.length; },
        };
    });

    // Secret が届くのは本人だけなので、client 分岐は常に「自分の情報」を描く。
    xsync.client(() => {
        const { xpixi, PIXI } = window.gfx;
        const group = xpixi.nest();
        group.zIndex = 40;

        function addText(text, x, y, { size = 14, color = 0xffffff, bold = false, center = false, wrap = 0 } = {}) {
            const style = { fontFamily: 'sans-serif', fontSize: size, fontWeight: bold ? 'bold' : 'normal', fill: color };
            if (wrap > 0) { Object.assign(style, { wordWrap: true, wordWrapWidth: wrap, breakWords: true }); }
            const label = new PIXI.Text({ text, style });
            if (center) { label.anchor.set(0.5); }
            label.position.set(x, y);
            group.addChild(label);
            return label;
        }

        // カード選択後の対象選択。cat（どの猫か）→ cat-dir（どのマスへ）、dir（探偵/サンマをどのマスへ）、label（誰に貼るか）
        let mode = null;     // { kind: 'cat'|'cat-dir'|'dir'|'label', cardIndex, catIndex?, token? }
        let pinUnits = [];   // 対象選択中に 3D トークン / 移動先マスの上へ立てるピン
        let lastPhase = '';
        let roleNotice = false;  // ラウンド開始時の陣営ポップアップ（OK で閉じる）

        // 再構築は sync.update とローカル UI 操作（mode / roleNotice の変更）が予約し、次の tick で描く
        let dirty = true;
        unit.on('sync.update', () => { dirty = true; });
        unit.on('update', () => { if (dirty) { dirty = false; redraw(); } });

        function redraw() {
            const table = xnew.find(Table)[0];
            if (!table) { return; }
            const s = table.shared;
            const myTurn = s.phase === 'playing' && s.turnId === state.ownerId;
            if (!myTurn) { mode = null; }
            const others = xnew.find(Player).map((p) => p.shared)
                .filter((p) => p.inRound && p.clientId !== state.ownerId)
                .sort((a, b) => a.joinIndex - b.joinIndex);
            const myLabel = xnew.find(Player).map((p) => p.shared).find((p) => p.clientId === state.ownerId)?.label ?? '';

            // ラウンド開始（→ playing 遷移）で陣営ポップアップを開く。観戦（role 空）には出さない
            if (s.phase === 'playing' && lastPhase !== 'playing' && state.role) { roleNotice = true; }
            if (s.phase !== 'playing') { roleNotice = false; }
            lastPhase = s.phase;

            for (const child of group.removeChildren()) { child.destroy({ children: true }); }
            pinUnits.forEach((pin) => pin.finalize());
            pinUnits = [];

            // 盤上のピンを選ぶ段階（猫・移動先の選択）では、自キャラをマップの方へ向ける
            xnew.find(Characters3D)[0]?.faceMap(mode != null && mode.kind !== 'label');

            // ---- 正体パネル（左上・本人にだけ見える）: チーム名 +（猫王の色は知っている人だけ） ----
            //   ラベルで変更された場合は、元のチーム名に訂正線を引き、横にラベルのチーム名を出す。
            //   左下は自分のキャラモデルの表示エリアなので、ここは左上に置く。
            const role = state.role;
            const TEAM_COLORS = { cat: 0xd97706, det: 0x60a5fa };
            group.addChild(new PIXI.Graphics().roundRect(14, 26, 220, 100, 12).fill({ color: 0x1e293b, alpha: 0.95 }).stroke({ width: 2, color: 0x475569 }));
            addText('あなたの正体', 30, 38, { size: 12, color: 0x94a3b8 });
            if (role) {
                const baseTeam = role.startsWith('cat') ? 'cat' : 'det';
                if (myLabel && myLabel !== baseTeam) {
                    const original = addText(`${TEAM_LABELS[baseTeam]}チーム`, 30, 62, { size: 16, bold: true, color: 0x94a3b8 });
                    group.addChild(new PIXI.Graphics().rect(28, 62 + original.height / 2 - 1, original.width + 4, 2.5).fill(0xef4444));
                    addText(`→ ${TEAM_LABELS[myLabel]}チーム`, 30 + original.width + 8, 62, { size: 16, bold: true, color: TEAM_COLORS[myLabel] });
                } else {
                    addText(`${TEAM_LABELS[baseTeam]}チーム`, 30, 58, { size: 20, bold: true, color: TEAM_COLORS[baseTeam] });
                }
                if (role.startsWith('cat:')) {
                    const catIndex = CAT_COLORS.indexOf(role.split(':')[1]);
                    addText(`（猫王は【${CAT_LABELS[catIndex]}】）`, 30, 92, { size: 14, bold: true, color: CAT_FILLS[catIndex] });
                }
            } else if (s.phase === 'playing') {
                addText('観戦中', 30, 58, { size: 18, bold: true, color: 0x94a3b8 });
            } else {
                addText('配役待ち…', 30, 58, { size: 18, bold: true, color: 0x94a3b8 });
            }

            // ---- 手札（中央下・2 枚から 1 枚選んで出す。手札らしくやや扇状に並べる） ----
            if (s.phase === 'playing' && state.cards.length > 0) {
                const cardW = 88, cardH = 124, gap = 10;    // 5:7（生成イラストと同じ比率）
                const total = state.cards.length * cardW + (state.cards.length - 1) * gap;
                state.cards.forEach((card, index) => {
                    const selected = mode != null && mode.cardIndex === index;
                    const sprite = makeHandCard(PIXI, { card, w: cardW, h: cardH, highlight: (myTurn && mode == null) || selected });
                    const lean = index - (state.cards.length - 1) / 2;      // 扇の傾き（中央 0・外側ほど倒す）
                    sprite.position.set(W / 2 - total / 2 + cardW / 2 + index * (cardW + gap), H - cardH / 2 - 6 + Math.abs(lean) * 8);
                    sprite.rotation = lean * 0.18;
                    if (myTurn && mode == null) {
                        sprite.eventMode = 'static';
                        sprite.cursor = 'pointer';
                        // pixi のイベントは tick/scope の外で発火するので xnew.scope で unit の scope に戻す（§7）
                        sprite.on('pointertap', xnew.scope(() => {
                            const [kind, axis] = card.split(':');
                            if (kind === 'label') {
                                mode = { kind, cardIndex: index };                              // 相手選択へ
                            } else if (kind === 'cat') {
                                if (s.catCells.some((cell) => cell >= 0 && catMovable(cell, s.detCell, axis))) {
                                    mode = { kind, cardIndex: index, axis };                    // 猫選択へ
                                } else {
                                    xsync.emitToServer('play', { cardIndex: index, discard: true });    // 動かせる猫がいない → 捨て札
                                }
                            } else {
                                mode = { kind: 'dir', cardIndex: index, token: kind, axis };    // 移動先選択へ
                            }
                            dirty = true;
                        }));
                    }
                    group.addChild(sprite);
                });
            }

            // ---- 対象選択（どの猫か → どのマスへ / 探偵・サンマをどのマスへ / 誰にラベルを貼るか） ----
            if (mode != null) {
                const { Pin3D, cellToWorld, coord3dTo2d, BOARD_TOP } = window.gfx;
                const candidates = [];   // { pin, proj, onPick } — カーソル最寄りの候補を 1 つ選ぶ

                function addCandidate(cell, dx, dz, onPick) {
                    const p = cellToWorld(cell, dx, dz);
                    const pin = xnew(Pin3D, { x: p.x, z: p.z });
                    pinUnits.push(pin);
                    candidates.push({ pin, proj: coord3dTo2d(p.x, BOARD_TOP + 0.1, p.z), onPick });
                }

                // fromCell からカードの軸方向の隣接マス（盤外と excludeCell を除く）を移動先候補にする
                function addDestinationCandidates(fromCell, excludeCell, targetProps) {
                    for (const dir of AXIS_DIRS[mode.axis]) {
                        const next = moveCell(fromCell, dir);
                        if (next != null && next !== excludeCell) {
                            addCandidate(next, 0, 0, () => { const cardIndex = mode.cardIndex; mode = null; dirty = true; xsync.emitToServer('play', { cardIndex, ...targetProps, dir }); });
                        }
                    }
                }

                const card = state.cards[mode.cardIndex];
                const [, cardArg] = card.split(':');                    // 移動カードは軸、ラベルは対象チーム
                let title = '', desc = '';
                const choices = [];                                     // ラベルカードの相手選択肢（右下パネルに並べる）
                if (mode.kind === 'cat') {
                    title = `ネコ移動カード ${AXIS_ARROWS[mode.axis]}`;
                    desc = '猫を 1 匹選んで、カードの軸方向へ 1 マス動かす。盤上のピンが立った猫をクリック。';
                    for (let catIndex = 0; catIndex < 3; catIndex++) {
                        if (s.catCells[catIndex] >= 0 && catMovable(s.catCells[catIndex], s.detCell, mode.axis)) {   // 軸方向に動けない猫は出さない
                            const cat = catIndex;                       // Tokens3D と同じ配置にピンを立てる
                            addCandidate(s.catCells[cat], (cat - 1) * 0.12, -0.1, () => { mode = { kind: 'cat-dir', cardIndex: mode.cardIndex, catIndex: cat, axis: mode.axis }; dirty = true; });
                        }
                    }
                } else if (mode.kind === 'cat-dir') {
                    title = `ネコ移動カード ${AXIS_ARROWS[mode.axis]}`;
                    desc = `${CAT_LABELS[mode.catIndex]}猫の移動先を選ぶ。ピンの立ったマスをクリック。`;
                    addDestinationCandidates(s.catCells[mode.catIndex], s.detCell, { target: mode.catIndex });
                } else if (mode.kind === 'dir') {
                    title = `${KIND_STYLES[mode.token].label}移動カード ${AXIS_ARROWS[mode.axis]}`;
                    desc = mode.token === 'det'
                        ? '探偵を軸方向へ 1 マス動かす。ピンの立ったマスをクリック。猫のいるマスに乗るとその猫を捕獲する（猫王なら勝利）。'
                        : 'サンマを軸方向へ 1 マス動かす。ピンの立ったマスをクリック。';
                    addDestinationCandidates(mode.token === 'det' ? s.detCell : s.sanmaCell, null, {});
                } else {
                    title = `ラベルカード（${TEAM_LABELS[cardArg]}）`;
                    desc = `選んだ相手のチームを「${TEAM_LABELS[cardArg]}」に変える。相手を選んでください。`;
                    others.forEach((p) => {
                        choices.push({ label: p.name, onTap: xnew.scope(() => { const cardIndex = mode.cardIndex; mode = null; dirty = true; xsync.emitToServer('play', { cardIndex, target: p.clientId }); }) });
                    });
                }
                // ---- 最寄りピッキング: カーソルに最も近い候補を強調表示し、クリックでそれを選ぶ ----
                //   同一マスに猫が重なっていてもピンごとの当たり判定に頼らず、距離計算で 1 匹に決まる。
                if (candidates.length > 0) {
                    const ring = new PIXI.Graphics().circle(0, 0, 30).fill({ color: 0xfcd34d, alpha: 0.15 }).stroke({ width: 3, color: 0xfcd34d, alpha: 0.9 });
                    ring.visible = false;
                    group.addChild(ring);
                    const overlay = new PIXI.Container();               // 全面で pointer を受け、最寄り候補に振り分ける
                    overlay.eventMode = 'static';
                    overlay.hitArea = new PIXI.Rectangle(0, 0, W, H);
                    group.addChild(overlay);

                    function nearest(p) {
                        let best = -1, bestDistance = 60;               // 60px より遠い位置は候補なし
                        candidates.forEach((c, i) => {
                            const d = Math.hypot(p.x - c.proj.x, p.y - c.proj.y);
                            if (d < bestDistance) { bestDistance = d; best = i; }
                        });
                        return best;
                    }
                    let hovered = -1;
                    overlay.on('pointermove', (e) => {
                        const index = nearest(e.global);
                        if (index !== hovered) {
                            hovered = index;
                            candidates.forEach((c, i) => c.pin.setActive(i === index));
                            ring.visible = index >= 0;
                            overlay.cursor = index >= 0 ? 'pointer' : 'default';
                            if (index >= 0) { ring.position.set(candidates[index].proj.x, candidates[index].proj.y); }
                        }
                    });
                    overlay.on('pointertap', xnew.scope((e) => {
                        const index = nearest(e.global);
                        if (index >= 0) { candidates[index].onPick(); }
                    }));
                }

                // ---- 右下の説明パネル（カードの説明・選択肢・大きめのキャンセル） ----
                const rows = Math.ceil(choices.length / 2);
                const panelW = 296, panelH = 150 + rows * 36;
                const panelX = W - panelW - 14, panelY = H - 8 - panelH;
                group.addChild(new PIXI.Graphics().roundRect(panelX, panelY, panelW, panelH, 12).fill({ color: 0x0f172a, alpha: 0.94 }).stroke({ width: 2, color: 0xfcd34d }));
                addText(title, panelX + 16, panelY + 12, { size: 16, bold: true, color: 0xfcd34d });
                addText(desc, panelX + 16, panelY + 38, { size: 13, color: 0xcbd5e1, wrap: panelW - 32 });
                choices.forEach((choice, i) => {
                    const button = makeButton(PIXI, { label: choice.label, w: 132, h: 30, color: 0x7c3aed, onTap: choice.onTap });
                    button.position.set(panelX + 16 + (i % 2) * 140 + 66, panelY + 96 + Math.floor(i / 2) * 36 + 15);
                    group.addChild(button);
                });
                const cancel = makeButton(PIXI, { label: 'キャンセル', w: 220, h: 42, color: 0x475569, fontSize: 16, onTap: xnew.scope(() => { mode = null; dirty = true; }) });
                cancel.position.set(panelX + panelW / 2, panelY + panelH - 30);
                group.addChild(cancel);
            }

            // ---- ラウンド開始ポップアップ（陣営・猫王の色・勝利条件。OK で閉じる） ----
            if (roleNotice) {
                const backdrop = new PIXI.Container();              // 背面のクリックを吸って誤操作を防ぐ
                backdrop.eventMode = 'static';
                backdrop.hitArea = new PIXI.Rectangle(0, 0, W, H);
                backdrop.addChild(new PIXI.Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.45 }));
                group.addChild(backdrop);
                group.addChild(new PIXI.Graphics().roundRect(W / 2 - 300, 170, 600, 250, 16).fill(0x0f172a).stroke({ width: 2, color: 0xfcd34d }));
                const baseTeam = state.role.startsWith('cat') ? 'cat' : 'det';
                addText(`あなたは ${TEAM_LABELS[baseTeam]}チーム です。`, W / 2, 212, { size: 20, bold: true, color: TEAM_COLORS[baseTeam], center: true });
                if (state.role.startsWith('cat:')) {
                    const catIndex = CAT_COLORS.indexOf(state.role.split(':')[1]);
                    addText(`猫王は【${CAT_LABELS[catIndex]}】です（知り得るのはあなただけ）`, W / 2, 256, { size: 16, bold: true, color: CAT_FILLS[catIndex], center: true });
                } else {
                    addText('猫王の色はあなたには非公開です（知り得るのは１名のみ）', W / 2, 256, { size: 16, color: 0xcbd5e1, center: true });
                }
                addText(`勝利条件は、${baseTeam === 'cat' ? 'サンマのあるマスに猫王の到達' : '猫王のあるマスに探偵の到達'}`, W / 2, 296, { size: 16, color: 0xcbd5e1, center: true });
                const ok = makeButton(PIXI, { label: 'OK', w: 160, h: 44, fontSize: 16, onTap: xnew.scope(() => { roleNotice = false; dirty = true; }) });
                ok.position.set(W / 2, 376);
                group.addChild(ok);
            }
        }
    });
}
