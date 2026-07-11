//----------------------------------------------------------------------------------------------------
// Public barrel — the first-tier exports of @mulsense/xnew: xnew, xsync, xbasics
// Each layer is assembled in its own module and only re-exported here; addons stay on subpath exports.
//----------------------------------------------------------------------------------------------------

// 各レイヤーは自モジュールで組み立て済み（xnew は値＋型名前空間をマージ済み。xsync の boot 入力や
// ルームステータス等の公開型はファサードのシグネチャ経由で露出し、呼び出し側は推論で受け取る）ので、ここでは再輸出のみ。
export { xnew } from './core/xnew';
export { xsync } from './sync/xsync';
export { xbasics } from './basics/xbasics';
