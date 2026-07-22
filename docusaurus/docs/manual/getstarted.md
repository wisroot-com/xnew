---
sidebar_position: 1
---

# get started

**10分で最初のステップ。**

## xnew とは?

`xnew` はコンポーネント指向プログラミング向けの JavaScript / TypeScript ライブラリです。

xnew の特徴は次のとおりです。

- **コンポーネント指向** — アプリケーションの機能毎に独立して実装できます。各コンポーネントは自動で連動する仕組みになっていて、その関係を意識せずに開発を進められます。
- **ゲーム開発向けアドオン** — PixiJS / Three.js / matter-js / Rapier との連携が可能で、複雑なインタラクティブアプリやゲームも構築できます。

## セットアップ

導入方法は次の 2 通りから選べます。

### CDN
ES モジュール版は import map で読み込みます。
```html
<script type="importmap">
{
  "imports": {
    "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
  }
}
</script>

<script type="module">
import { xnew } from '@mulsense/xnew';

// Your code here
</script>
```

### npm
npm でインストールします。
```bash
npm install @mulsense/xnew@0.9.x
```

JavaScript ファイルからインポートして使用します。
```js
import { xnew } from '@mulsense/xnew';
```

## チュートリアル

### 基本構文
`xnew` の使い方は主に 2 通りです。

#### 1. コンポーネントの生成
```js
const unit = xnew(Component, props);

function Component(unit, props) {
  // Define behavior here
  // props = data passed to the component
}
```

#### 2. HTML 要素の生成
```js
const unit = xnew('<div class="my-class">', 'inner text');
unit.element; // Access the created DOM element
```

### 例 1: 最初のコンポーネント

コンポーネントを２つ生成し、メッセージを表示する簡単なサンプルです。

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
  {
    "imports": {
      "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import { xnew } from '@mulsense/xnew';
    // Create your first component
    xnew(MyFirstComponent);

    function MyFirstComponent(unit) {
      // Create a simple paragraph element
      xnew('<p>', 'Hello, xnew!');
    }
  </script>
</body>
</html>
```

実行結果の HTML は次のようになります。
```html
<body>
  <p>Hello, xnew!</p>
</body>
```

### 例 2: 複数の要素を並べる

`xnew.nest()` はネストの基準を切り替え、これ以降の要素を指定したコンテナの内側に配置します。HTML を直接書き連ねずに、構造化されたレイアウトを組み立てられます。

<iframe style={{width:'100%',height:'120px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/manual/element.html" ></iframe>

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
  {
    "imports": {
      "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import { xnew } from '@mulsense/xnew';
    // Create main component
    xnew(MainComponent);

    function MainComponent(unit) {
      // Create a paragraph element
      xnew('<p>', 'Create new HTML elements.');
    
      // Create a child component
      xnew(ColorBoxes);
    }

    function ColorBoxes(unit) {
      // Create a container and nest child elements inside it
      xnew.nest('<div style="display: flex;">');

      // The following elements will be nested inside the container
      xnew('<div style="width: 160px; height: 36px; background: #d66;">', '1');
      xnew('<div style="width: 160px; height: 36px; background: #6d6;">', '2');
      xnew('<div style="width: 160px; height: 36px; background: #66d;">', '3');
    }
  </script>
</body>
</html>
```

実行結果の HTML は次のようになります。
```html
<body>
  <p>Create new HTML elements.</p>
  <div style="display: flex;">
    <div style="width: 160px; height: 36px; background: #d66;">1</div>
    <div style="width: 160px; height: 36px; background: #6d6;">2</div>
    <div style="width: 160px; height: 36px; background: #66d;">3</div>
  </div>
</body>
```

**ポイント:**
- `xnew.nest()` はコンテナ要素を生成し、後続の要素をその中にネストします
- コンポーネントから別のコンポーネントを呼び出して構造を分割できます
- 各コンポーネントは関数として再利用できます

### 例 3: インタラクションの追加

下のボックスをクリックすると CSS 回転アニメーションが開始・停止します。

<iframe style={{width:'100%',height:'300px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/manual/box.html" ></iframe>

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
  {
    "imports": {
      "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import { xnew } from '@mulsense/xnew';
    xnew(RotatingBox);

    function RotatingBox(unit) {
      // Create a centered blue box and nest content inside it
      xnew.nest('<div style="position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F; cursor: pointer;">');
      
      // Add text inside the box
      const text = xnew('<span style="color: white; font-size: 24px; display: flex; justify-content: center; align-items: center; height: 100%;">');

      // Handle click events - toggle the rotation
      let running = false;
      unit.on('click', ({ event }) => {
        running = !running;
        text.element.textContent = running ? 'start' : 'stop';
      });

      // Update animation frame
      let rotate = 0;
      unit.on('update', () => {
        if (running === false) return;
        rotate++;
        unit.element.style.transform = `rotate(${rotate}deg)`;
      });
    }
  </script>
</body>
</html>
```

**ポイント:**
- `unit.on()` でイベントリスナーを登録します
- `click` などの DOM イベントはユーザー操作に応じて発火します
- `update` イベントは毎フレーム発火します

## 次のステップ

これで xnew を使い始める準備は整いました。次は以下のページに進んでください。

1. **[xnew — xnew](./xnew/xnew)** — イベント・ライフサイクル・カスタムメソッドなどの API リファレンス
2. **[xnew — xnew.timeout / interval / transition](./xnew/xnew.timeout)** — 自動クリーンアップ付きのタイマーと連鎖可能なトランジション
3. **[Addons — xpixi / xthree](./addons/xpixi)** — PixiJS / Three.js 連携
