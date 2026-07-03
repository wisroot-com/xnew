//----------------------------------------------------------------------------------------------------
// env — 実行環境（server = Node.js / client = browser）の単一の判定元
//
// server / client の別は「プロセスがどの実行環境で動いているか」で決まり、実行中に変化しない
// （Node プロセスは常に server、browser タブは常に client）。そのため判定は起動時に一度だけ行い、
// xsync.server / xsync.client の分岐と sync の transport 選択がこの 1 箇所を共有する。
// 1 プロセスで両環境を模す必要があるテストや、apply（常に client 側の操作）のような
// 「環境が一意に決まる処理」のために、一時的な上書き（override）も用意する。
//
// - Environment : 'server' | 'client'
// - getEnvironment() : 現在の環境（override があればそれ、無ければ起動時の自動判定）
// - setEnvironment(env|null) : 環境を上書き（null で自動判定へ戻す）。主にテスト用
// - withEnvironment(env, fn) : fn 実行中だけ env に上書きし、終了時に元へ戻す（ネスト安全）
//----------------------------------------------------------------------------------------------------

export type Environment = 'server' | 'client';

// 起動時に一度だけ判定（実行中に環境は変わらないので再評価しない）。
// window（と document）が無ければ Node.js = server、有れば browser = client。
const detected: Environment =
    (typeof window === 'undefined' || typeof window.document === 'undefined') ? 'server' : 'client';

let override: Environment | null = null;

/** 現在の実行環境を返す（override 優先、無ければ起動時の自動判定）。 */
export function getEnvironment(): Environment {
    return override ?? detected;
}

/** 実行環境を上書きする（null で自動判定へ戻す）。主にテストが 1 プロセスで両環境を模すために使う。 */
export function setEnvironment(env: Environment | null): void {
    override = env;
}

/** fn 実行中だけ env へ上書きし、終了時に直前の状態へ戻す（ネスト可。例: apply は常に client 文脈で構築）。 */
export function withEnvironment<T>(env: Environment, fn: () => T): T {
    const previous = override;
    override = env;
    try {
        return fn();
    } finally {
        override = previous;
    }
}
