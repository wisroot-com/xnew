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

import { xnew as base } from './core/xnew';
import { Unit, UnitTimer, ComponentFn, Status as CoreStatus } from './core/unit';
import { Environment as CoreEnvironment } from './core/env';

// boot 入力 / ルームステータスの型を公開する（socket は socket.io の io / socket をそのまま渡す）。
export type { BootServerOptions, BootClientOptions, ClientStatus, RoomStatus } from './sync/xsync';

import { xsync } from './sync/xsync';
import { xbasics } from './basics/xbasics';

// --- xnew: core only (type namespace merges onto the callable) ---
namespace xnew {
    export type Unit = InstanceType<typeof Unit>;
    export type UnitTimer = InstanceType<typeof UnitTimer>;
    export type Component<P extends object = any, A extends object = {}> = ComponentFn<P, A>;
    export type Environment = CoreEnvironment;
    export type Status = CoreStatus;
}
const xnew = base;

export { xnew, xsync, xbasics };
