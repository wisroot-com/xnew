import { useCallback, useState } from 'react';
import { xreact } from '@mulsense/xnew/addons/xreact';
import { Main } from './scene';

//----------------------------------------------------------------------------------------------------
// App — React 側のアプリ本体。操作パネル（React）と xnew シーンを <XReact> で組み合わせる。
//   - React → xnew : 色 / 停止を props で渡す（XReact が setProps に流す）。
//   - xnew → React : 反射回数を onBounce で受けてカウンタを更新する。
//   - 「シーンを破棄 / 生成」で mount/unmount を切り替え、finalize による後始末を確認できる。
//----------------------------------------------------------------------------------------------------

const COLORS: Record<string, string> = { 青: '#3b82f6', 赤: '#ef4444', 緑: '#22c55e', 紫: '#a855f7' };

export function App() {
    const [colorName, setColorName] = useState('青');
    const [running, setRunning] = useState(true);
    const [mounted, setMounted] = useState(true);
    const [bounces, setBounces] = useState(0);

    const onBounce = useCallback(() => setBounces((n) => n + 1), []);

    return (
        <div className="app">
            <h1>React + xnew</h1>
            <p className="lead">
                React がページを管理し、その中の枠だけを xnew のシーンが受け持ちます。
                操作は React → xnew（色 / 停止）、反射回数は xnew → React に流れます。
            </p>

            <div className="controls">
                <label htmlFor="color">色:</label>
                <select id="color" value={colorName} onChange={(e) => setColorName(e.target.value)}>
                    {Object.keys(COLORS).map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <button onClick={() => setRunning((v) => !v)}>{running ? '停止' : '再開'}</button>
                <button onClick={() => setMounted((v) => !v)}>{mounted ? 'シーンを破棄' : 'シーンを生成'}</button>
                <span>反射: <b>{bounces}</b> 回</span>
            </div>

            <div className="stage-box">
                {mounted ? (
                    <xreact.Embed Component={Main} props={{ color: COLORS[colorName], running, onBounce }} />
                ) : (
                    <div className="empty">（シーンは破棄されています）</div>
                )}
            </div>
        </div>
    );
}
