//----------------------------------------------------------------------------------------------------
// Public barrel — the three first-tier exports of @mulsense/xnew
//
// Split by responsibility so callers pull only the layer they mean; addons stay on subpath exports.
// Each layer is assembled in its own module and merely re-exported here.
//
// - xnew    : core (unit tree / lifecycle / DOM / events / timers / context) — the callable + type namespace
// - xsync   : networking (server↔client sync facade + Lobby / Room) — src/sync/xsync.ts
// - xbasics : networking-free convenience components — src/basics/xbasics.ts
//----------------------------------------------------------------------------------------------------

// 各レイヤーは自モジュールで組み立て済み（xnew / xsync は値＋型名前空間をマージ済み。boot 入力や
// ルームステータス等の公開型は xsync.BootServerOptions のように名前空間から参照する）ので、ここでは再輸出のみ。
export { xnew } from './core/xnew';
export { xsync } from './sync/xsync';
export { xbasics } from './basics/xbasics';
