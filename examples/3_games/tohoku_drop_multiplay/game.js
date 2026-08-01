import { xnew, xsync, xbasics } from '@mulsense/xnew';

//----------------------------------------------------------------------------------------------------
// game — とーほくドロップ 2人対戦のゲームロジック（server / client を 1 ファイルに集約）。
//   server / client の分岐は xsync.server / xsync.client で行い、環境依存ライブラリは「環境判定つきの
//   動的 import」で読み分ける（matter は browser の importmap に無く、three/pixi は Node で動かないため）。
//   sync は「レジストリ名」で同期するので、同じ Status / Ball を両環境で登録し、各 unit の中で
//   server=物理(matter) / client=描画(three・pixi) を担当する。boot と Lobby/Room の配線は server.js /
//   index.js が担う（このファイルは描画も物理もここに閉じる）。
//
//   ルール: 共有の皿に 2 人が交互ドロップ。同種が接触すると合体（id+1）。スコアは「落とした玉」「合体で
//   生まれた玉」を現在の手番へ加点し、「あふれて落ちた玉」を現在の手番から減点。ドロップ後に皿が静まったら
//   手番交代し、先に WIN_SCORE（200）へ到達した方が勝ち。
//
//   - Game        : booted ルート。server=物理エンジン+皿+Status を用意 / client=描画パイプライン+盤面UI。
//   - Status      : 共有状態（フェーズ/プレイヤー/ターン/スコア/カーソル/キュー）。server=入力・判定、client='+status' 配信。
//   - Ball        : 玉 1 個。server=matter ボディ+合体/あふれ判定 / client=3D モデル描画。
//   - Cursor/QueuePreview/HUD/Model/… : client 専用の見た目（Game の client 分岐から生成）。
//----------------------------------------------------------------------------------------------------

// ----- 実行環境ごとに必要なライブラリだけ読み込む（top-level await + 環境判定つき動的 import） -----
const isServer = typeof window === 'undefined';

const Matter = isServer ? (await import('matter-js')).default : null;
const xmatter = isServer ? (await import('@mulsense/xnew/addons/xmatter')).xmatter : null;

const PIXI = isServer ? null : await import('pixi.js');
const THREE = isServer ? null : await import('three');
const { GLTFLoader } = isServer ? {} : await import('three/addons/loaders/GLTFLoader.js');
const { VRMLoaderPlugin } = isServer ? {} : await import('@pixiv/three-vrm');
const voxelkit = isServer ? null : (await import('voxelkit')).default;
const xpixi = isServer ? null : (await import('@mulsense/xnew/addons/xpixi')).xpixi;
const xthree = isServer ? null : (await import('@mulsense/xnew/addons/xthree')).xthree;

// ----- 定数・ルール（server / client 共通） -----
const WIDTH = 800;
const HEIGHT = 600;
const DROP_Y = 60;
const WIN_SCORE = 200;        // 先取で勝利
const KINDS = 7;              // id 0..6 が合体対象（合体結果は最大 id 7）
const DROP_KINDS = 3;         // 落とせるのは id 0,1,2
const SCALES = [0.7, 1.0, 1.3, 1.4, 1.6, 1.8, 1.9, 1.9, 1.9];
const BOWL = { cx: 400, cy: 360, rx: 240, ry: 200, wall: 12 };
const ballRadius = (id) => 35 + Math.pow(3.0, SCALES[id] * 2.0);
const points = (id) => Math.pow(2, id);   // id 0,1,2,…,7 → 1,2,4,…,128
const clampX = (x) => Math.max(BOWL.cx - 190, Math.min(BOWL.cx + 190, x));

//----------------------------------------------------------------------------------------------------
// Game — booted ルート（Lobby/Room が boot）。server=物理基盤、client=描画基盤を用意する
//----------------------------------------------------------------------------------------------------

export function Game(unit) {
    xsync.register({ Status, Ball });   // 同期対象（server/client 共通の名前で登録）

    // server: matter エンジンと皿、共有状態 Status を用意する（描画はしない）。
    xsync.server(() => {
        xmatter.initialize();   // この unit 配下に matter Root（以降の子は context で engine/world を引ける）
        unit.on('update', () => Matter.Engine.update(xmatter.engine));

        // 皿（受け）の静的ボディ。見た目は client が同じジオメトリで描く。
        for (let a = 10; a <= 170; a++) {
            const x = BOWL.cx + Math.cos((a * Math.PI) / 180) * BOWL.rx;
            const y = BOWL.cy + Math.sin((a * Math.PI) / 180) * BOWL.ry;
            Matter.Composite.add(xmatter.world, Matter.Bodies.circle(x, y, BOWL.wall, { isStatic: true }));
        }

        xnew(Status);   // 共有状態 + 入力処理（Status は 1 つ）
    });

    // client: 描画パイプライン（three→pixi）と盤面・カーソル・予告・HUD を組み立てる。
    xsync.client(() => {
        xnew.extend(xbasics.Screen, { width: WIDTH, height: HEIGHT });

        xthree.initialize({ canvas: new OffscreenCanvas(WIDTH, HEIGHT) });
        xthree.renderer.shadowMap.enabled = true;
        xthree.camera.position.set(0, 0, 10);

        xpixi.initialize({ canvas: unit.canvas });

        xnew.promise(unit).then(() => {
            unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));

            const threeTexture = PIXI.Texture.from(xthree.canvas);
            unit.on('update', () => { threeTexture.source.update(); xpixi.renderer.render(xpixi.scene); });

            // pixi の描画順 = 重なり順。Status / Ball の replica は sync が同じ Game の下へ生成する。
            xnew(Background);
            xnew(ShadowPlane);
            xnew(DirectionalLight, { x: 2, y: 5, z: 10 });
            xnew(AmbientLight);
            xnew(BowlVisual);
            xnew(Cursor, { player: 1, color: 0xE84A57 });   // P1 = 赤
            xnew(Cursor, { player: 2, color: 0x3B82F6 });   // P2 = 青
            xnew(QueuePreview, { player: 1 });
            xnew(QueuePreview, { player: 2 });
            xnew(ThreeTexture);   // three の描画（玉/カーソル/予告のモデル）を最前面に合成
            xnew(HUD);
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Status — 共有状態。server=入力/ターン/スコア/収束判定、client=変更時（sync.update）に '+status' を盤面へ配る
//----------------------------------------------------------------------------------------------------

function Status(unit) {
    // phase: waiting（2 人待ち）→ playing → over。dropping=ドロップ後に皿が静まるのを待つ間。
    // queue1/queue2 は各プレイヤーが次に落とすキャラ列（先頭が次の 1 体）。cursor1X/2X は各自のカーソル位置。
    const state = xsync.state({
        phase: 'waiting', p1: null, p2: null,
        turn: 1, cursor1X: WIDTH / 2, cursor2X: WIDTH / 2, queue1: [], queue2: [], dropping: false,
        score1: 0, score2: 0, winner: 0,
    });

    // server: 権威ロジック。Ball が合体/あふれの加減点に使えるよう addScore を公開する。
    xsync.server(() => {
        const QUEUE_LEN = 3;
        const idOfTurn = () => (state.turn === 1 ? state.p1 : state.p2);
        const randDrop = () => Math.floor(Math.random() * DROP_KINDS);
        const newQueue = () => Array.from({ length: QUEUE_LEN }, randDrop);

        // 収束判定: 速度がしきい値未満の状態が連続したら静止とみなして交代する。
        const SETTLE_SPEED = 0.4;
        const SETTLE_HOLD = 24;     // 連続静止フレーム数（約 0.4s）で収束
        const SETTLE_MAX = 360;     // 念のための上限（約 6s）で強制交代
        let settleTicks = 0;
        let dropTicks = 0;

        const startTurn = (turn) => { state.turn = turn; state.dropping = false; settleTicks = 0; dropTicks = 0; };

        // 現在の手番へ加減点（落とす / 合体 = 加点、あふれ = 減点）。先取で勝敗確定。
        const addScore = (delta) => {
            if (state.phase !== 'playing') { return; }
            if (state.turn === 1) { state.score1 = Math.max(0, state.score1 + delta); }
            else { state.score2 = Math.max(0, state.score2 + delta); }
            if (state.score1 >= WIN_SCORE) { state.phase = 'over'; state.winner = 1; }
            else if (state.score2 >= WIN_SCORE) { state.phase = 'over'; state.winner = 2; }
        };

        // 接続: 空いている枠へ割り当て、2 人そろったら対戦開始。3 人目以降は観戦。
        unit.on('sync.connect', ({ id }) => {
            if (!state.p1) { state.p1 = id; }
            else if (!state.p2) { state.p2 = id; }
            if (state.p1 && state.p2 && state.phase === 'waiting') {
                state.queue1 = newQueue();
                state.queue2 = newQueue();
                state.phase = 'playing';
                startTurn(1);
            }
        });

        // 切断: 対戦中にプレイヤーが抜けたら相手の勝ち。枠は空ける。
        unit.on('sync.disconnect', ({ id }) => {
            if (state.phase === 'playing' && (id === state.p1 || id === state.p2)) {
                state.phase = 'over';
                state.winner = id === state.p1 ? 2 : 1;
            }
            if (id === state.p1) { state.p1 = null; }
            if (id === state.p2) { state.p2 = null; }
        });

        // カーソル移動: 各プレイヤーが自分のカーソル（P1=cursor1X / P2=cursor2X）を動かす（手番に依らない）。
        unit.on('move', ({ id, x }) => {
            if (state.phase !== 'playing') { return; }
            if (id === state.p1) { state.cursor1X = clampX(x); }
            else if (id === state.p2) { state.cursor2X = clampX(x); }
        });

        // ドロップ: 手番のプレイヤーが収束待ちでないときのみ。手番側カーソル位置に玉を生成し、キューを進める。
        unit.on('drop', ({ id }) => {
            if (state.phase !== 'playing' || state.dropping || id !== idOfTurn()) { return; }
            const queue = state.turn === 1 ? state.queue1 : state.queue2;
            const dropId = queue[0];
            const cursorX = state.turn === 1 ? state.cursor1X : state.cursor2X;
            xnew(unit.parent, Ball, { x: cursorX, y: DROP_Y, id: dropId });
            addScore(points(dropId));   // 落としたキャラのポイントを現手番へ加点
            const advanced = queue.slice(1);
            advanced.push(randDrop());
            if (state.turn === 1) { state.queue1 = advanced; } else { state.queue2 = advanced; }
            state.dropping = true;      // 以降は収束まで入力を止める
            settleTicks = 0;
            dropTicks = 0;
        });

        // 収束判定: ドロップ後、皿が静まったら（または上限に達したら）手番を交代する。
        unit.on('update', () => {
            if (state.phase !== 'playing' || !state.dropping) { return; }
            dropTicks++;
            const balls = xnew.find(Ball);
            const maxSpeed = balls.reduce((m, b) => Math.max(m, b.speed), 0);
            if (balls.length === 0 || maxSpeed < SETTLE_SPEED) { settleTicks++; } else { settleTicks = 0; }
            if (settleTicks >= SETTLE_HOLD || dropTicks >= SETTLE_MAX) { startTurn(state.turn === 1 ? 2 : 1); }
        });

        return { addScore };
    });

    // client: 同期 state が変わったとき（sync.update）だけ '+status' として盤面（Cursor / QueuePreview / HUD）へ配る。
    xsync.client(() => {
        const myId = xsync.session.myself.id;
        unit.on('sync.update', () => {
            const myNo = myId === state.p1 ? 1 : myId === state.p2 ? 2 : 0;
            xnew.emit('+status', {
                phase: state.phase, myNo, turn: state.turn, dropping: state.dropping,
                cursor1X: state.cursor1X, cursor2X: state.cursor2X,
                queue1: state.queue1, queue2: state.queue2,
                score1: state.score1, score2: state.score2, winner: state.winner,
            });
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Ball — 玉 1 個。server=matter ボディ（位置/角度を state に書き、合体・あふれ判定）/ client=3D モデル描画
//----------------------------------------------------------------------------------------------------

function Ball(unit, { x = 0, y = 0, id = 0 } = {}) {
    const state = xsync.state({ x, y, angle: 0, id });   // server が書き、client が描画に使う

    // server: matter ボディを持ち、毎フレーム位置を state へ反映。あふれ=減点撤去 / 同種接触=合体。
    xsync.server(() => {
        const radius = ballRadius(state.id);
        const body = Matter.Bodies.circle(state.x, state.y, radius, { restitution: 0.1, friction: 0.5 });
        Matter.Composite.add(xmatter.world, body);
        unit.on('finalize', () => Matter.Composite.remove(xmatter.world, body));

        unit.on('update', () => {
            state.x = body.position.x;
            state.y = body.position.y;
            state.angle = body.angle;

            // あふれ: 画面下へ抜けたら現在手番から減点して撤去。
            if (body.position.y > HEIGHT + radius) {
                xnew.context(Status)?.addScore(-points(state.id));
                unit.finalize();
                return;
            }

            // 合体: 同 id が接触したら両者を撤去し id+1 を中点に生成。生まれた玉のポイントを現在手番へ加点。
            if (state.id < KINDS) {
                for (const other of xnew.find(Ball)) {
                    if (other === unit || other.id !== state.id) { continue; }
                    const dist = Math.hypot(state.x - other.x, state.y - other.y);
                    if (dist < radius + ballRadius(other.id)) {
                        xnew(unit.parent, Ball, { x: (state.x + other.x) / 2, y: (state.y + other.y) / 2, id: state.id + 1 });
                        xnew.context(Status)?.addScore(points(state.id + 1));
                        other.finalize();
                        unit.finalize();
                        return;
                    }
                }
            }
        });

        return {
            get id() { return state.id; },
            get x() { return state.x; },
            get y() { return state.y; },
            get speed() { return body.speed; },
        };
    });

    // client: 3D モデルを synced 位置/角度へ追従させる。
    xsync.client(() => {
        const model = xnew(Model, { id: state.id, scale: SCALES[state.id] });
        unit.on('update', () => {
            const p = convert3d(state.x, state.y);
            model.threeObject?.position.set(p.x, p.y, p.z);
            if (model.threeObject) { model.threeObject.rotation.z = -state.angle; }
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Cursor — プレイヤーごとの十字カーソル（P1=赤 / P2=青）。常時表示で、自分のカーソルだけ操作できる。
//          構え玉プレビューは「現在の手番プレイヤーのカーソル」に収束後だけ出す。位置は server 権威。
//----------------------------------------------------------------------------------------------------

function Cursor(unit, { player, color }) {
    const object = xpixi.nest({ position: { x: WIDTH / 2, y: DROP_Y } });
    const graphics = new PIXI.Graphics();
    graphics.moveTo(-24, 0).lineTo(24, 0).stroke({ color, width: 12 });
    graphics.moveTo(0, -24).lineTo(0, 24).stroke({ color, width: 12 });
    xpixi.add(graphics);

    let iControl = false;   // 自分がこの player か（= このカーソルを動かせる）
    let canDrop = false;    // 自分の手番＆収束後のみドロップ
    let model = null;
    let currentId = -1;

    unit.on('+status', ({ phase, myNo, turn, cursor1X, cursor2X, queue1, queue2, dropping }) => {
        const playing = phase === 'playing';
        object.x = player === 1 ? cursor1X : cursor2X;   // 自分のカーソル位置（server 権威）
        iControl = playing && myNo === player;
        const isTurn = turn === player;
        canDrop = iControl && isTurn && !dropping;
        // 構え玉は手番側カーソルに、収束後だけ出す。
        const aiming = playing && isTurn && !dropping;
        const dropId = (player === 1 ? queue1 : queue2)?.[0];
        if (aiming && dropId !== undefined) {
            if (currentId !== dropId) {   // 構え玉が変わったら作り直す
                currentId = dropId;
                model?.finalize();
                model = xnew(Model, { id: dropId, scale: 0.5 });
            }
        } else if (model !== null) {
            model.finalize();
            model = null;
            currentId = -1;
        }
    });

    // 自分のカーソルだけ動かせる（手番でなくても自分のぶんは動かせる。ドロップは手番＆収束後のみ）。
    unit.on('pointermove pointerdown', ({ position }) => {
        if (!iControl) { return; }
        xsync.emitToServer('move', { x: position.x * xpixi.canvas.width / xpixi.canvas.clientWidth });
    });
    unit.on('pointerdown', () => { if (canDrop) { xsync.emitToServer('drop'); } });

    unit.on('update', () => {
        object.rotation += 0.02;
        if (model !== null) {
            const p = convert3d(object.x, DROP_Y + 50);
            model.threeObject?.position.set(p.x, p.y, p.z);
        }
    });
}

//----------------------------------------------------------------------------------------------------
// HUD — 左上に P1・右上に P2 のスコアを表示し、手番のプレイヤーを強調（pointer は透過）
//----------------------------------------------------------------------------------------------------

function HUD(unit) {
    xnew.nest('<div class="absolute inset-0 pointer-events-none">');
    const boxClass = 'absolute top-[2cqw] px-[1.6cqw] py-[0.8cqw] rounded-[1cqw] font-bold text-[3.2cqw] leading-tight';
    const p1box = xnew(`<div class="${boxClass} left-[2cqw] text-left">`);
    const p2box = xnew(`<div class="${boxClass} right-[2cqw] text-right">`);
    const center = xnew('<div class="absolute inset-0 flex items-center justify-center font-bold text-[6cqw] text-red-500" style="text-shadow:0 0 0.6cqw #fff;">');

    // 手番のプレイヤーは緑背景＋枠で強調、そうでない方は淡色にする。
    const paint = (box, label, score, active, mine) => {
        box.element.innerHTML = `${label}${mine ? '<span class="text-[2cqw]">（あなた）</span>' : ''}<br>${score} <span class="text-[2cqw]">/ ${WIN_SCORE}</span>`;
        box.element.style.background = active ? '#16a34a' : 'rgba(255,255,255,0.75)';
        box.element.style.color = active ? '#ffffff' : '#15803d';
        box.element.style.boxShadow = active ? '0 0 0 0.5cqw #bbf7d0' : 'none';
        box.element.style.opacity = active ? '1' : '0.8';
    };

    unit.on('+status', ({ phase, myNo, turn, score1, score2, winner }) => {
        const playing = phase === 'playing';
        paint(p1box, 'P1', score1, playing && turn === 1, myNo === 1);
        paint(p2box, 'P2', score2, playing && turn === 2, myNo === 2);
        if (phase === 'waiting') {
            center.element.textContent = '相手の参加を待っています…';
        } else if (phase === 'over') {
            const youWin = myNo !== 0 && myNo === winner;
            center.element.textContent = myNo === 0 ? `Player ${winner} の勝ち！` : (youWin ? 'あなたの勝ち！' : 'あなたの負け…');
        } else {
            center.element.textContent = '';
        }
    });
}

//----------------------------------------------------------------------------------------------------
// QueuePreview — プレイヤーごとの「次に落とすキャラ」1 体を 3D モデルで予告（tohoku_drop の Queue 相当）
//   P1 は左、P2 は右の上隅。キューが進む（= そのプレイヤーがドロップした）たびに、画面外から定位置へ
//   スライドインさせる。
//----------------------------------------------------------------------------------------------------

function QueuePreview(unit, { player }) {
    const targetX = player === 1 ? 58 : 742;            // 画面内の定位置
    const offX = player === 1 ? -140 : WIDTH + 140;     // スライド開始（画面外）
    const y = 175;
    const rotation = { x: (18 / 180) * Math.PI, y: ((player === 1 ? 40 : -40) / 180) * Math.PI, z: 0 };
    let key = '';
    let model = null;
    let anim = null;

    unit.on('+status', ({ phase, queue1, queue2 }) => {
        const queue = (player === 1 ? queue1 : queue2) || [];
        const playing = phase === 'playing' && queue.length > 0;
        const nextKey = playing ? JSON.stringify(queue) : '';   // キューが進んだときだけ作り直す
        if (nextKey === key) { return; }
        key = nextKey;
        anim?.clear();
        anim = null;
        model?.finalize();
        model = null;
        if (!playing) { return; }

        model = xnew(Model, { id: queue[0], position: convert3d(offX, y), rotation, scale: 0.5 });
        const target = model;
        anim = xnew.transition(({ value }) => {
            const p = convert3d(offX + (targetX - offX) * value, y);
            target.threeObject?.position.set(p.x, p.y, p.z);
        }, 400, 'ease-out');
    });
}

//----------------------------------------------------------------------------------------------------
// 見た目の部品（three / pixi）— tohoku_drop と同じ作り
//----------------------------------------------------------------------------------------------------

function Background(unit) {
    xpixi.nest();
    xnew.promise(PIXI.Assets.load('./background.jpg')).then((texture) => {
        const sprite = new PIXI.Sprite(texture);
        sprite.scale.set(xpixi.canvas.width / texture.frame.width, xpixi.canvas.height / texture.frame.height);
        xpixi.add(sprite);
    });
}

function ThreeTexture(unit) {
    xpixi.add(new PIXI.Sprite(PIXI.Texture.from(xthree.canvas)));
}

function BowlVisual(unit) {
    xpixi.nest();
    const graphics = new PIXI.Graphics();
    for (let a = 10; a <= 170; a++) {
        const x = BOWL.cx + Math.cos((a * Math.PI) / 180) * BOWL.rx;
        const y = BOWL.cy + Math.sin((a * Math.PI) / 180) * BOWL.ry;
        graphics.circle(x, y, BOWL.wall).fill(0x99AAAA);
    }
    xpixi.add(graphics);
}

function DirectionalLight(unit, { x, y, z }) {
    const object = xthree.add(new THREE.DirectionalLight(0xFFFFFF, 1.7));
    object.position.set(x, y, z);
    object.castShadow = true;
}

function AmbientLight(unit) {
    xthree.add(new THREE.AmbientLight(0xFFFFFF, 1.2));
}

function ShadowPlane(unit) {
    const geometry = new THREE.PlaneGeometry(16, 14);
    const material = new THREE.ShadowMaterial({ opacity: 0.25 });
    const plane = xthree.add(new THREE.Mesh(geometry, material));
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0.0, -2.9, -2.0);
}

function Model(unit, { id = 0, position = null, rotation = null, scale }) {
    const object = xthree.nest();
    if (position) { object.position.set(position.x, position.y, position.z); }
    if (rotation) { object.rotation.set(rotation.x, rotation.y, rotation.z); }

    const list = ['zundamon.mog', 'usagi.mog', 'kiritan.mog', 'metan.mog', 'zunko.mog', 'sora.mog', 'itako.mog'];
    const path = '/assets/' + (id < 7 ? list[id] : list[0]);

    xnew.promise(voxelkit.load(path, { scale: 100 }))
        .then((composits) => voxelkit.convertVRM(composits[0]))
        .then((arrayBuffer) => new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));
            loader.parse(arrayBuffer.buffer, '', (gltf) => resolve(gltf));
        }))
        .then((gltf) => {
            const vrm = gltf.userData.vrm;
            vrm.scene.traverse((object) => {
                if (object.isMesh) { object.castShadow = object.receiveShadow = true; }
            });
            vrm.scene.position.y = -scale;
            vrm.scene.scale.set(scale, scale, scale);
            object.add(vrm.scene);

            const random = Math.random() * 10;
            let count = 0;
            unit.on('update', () => {
                const t = (count + random) * 0.03;
                const g = (name) => vrm.humanoid.getNormalizedBoneNode(name);
                g('neck').rotation.x = Math.sin(t * 6) * +0.1;
                g('chest').rotation.x = Math.sin(t * 12) * +0.1;
                g('hips').position.z = Math.sin(t * 12) * 0.1;
                g('leftUpperArm').rotation.z = Math.sin(t * 12 + random) * +0.7;
                g('leftUpperArm').rotation.x = Math.sin(t * 6 + random) * +0.8;
                g('rightUpperArm').rotation.z = Math.sin(t * 12) * -0.7;
                g('rightUpperArm').rotation.x = Math.sin(t * 6) * +0.8;
                g('leftUpperLeg').rotation.z = Math.sin(t * 8) * +0.2;
                g('leftUpperLeg').rotation.x = Math.sin(t * 12) * +0.7;
                g('rightUpperLeg').rotation.z = Math.sin(t * 8) * -0.2;
                g('rightUpperLeg').rotation.x = Math.sin(t * 12) * -0.7;
                vrm.update(t);
                count++;
            });
        });

    return { get id() { return id; } };
}

// 2D 盤面座標(0..WIDTH, 0..HEIGHT) → three のワールド座標へ変換
function convert3d(x, y, z = 0) {
    return { x: (x - WIDTH / 2) / 70, y: -(y - HEIGHT / 2) / 70, z };
}
