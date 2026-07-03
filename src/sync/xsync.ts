//----------------------------------------------------------------------------------------------------
// sync — networking layer entry (assembles the xsync.* facade + ready-made components)
//
// The public barrel (src/index.ts) re-exports `xsync` from here; addons never touch these internals.
//
// - xsync : sync facade (server / client / state / register / emitTo* / room / clients / myself / boot)
//           plus the Lobby / Room components. A type namespace merges the public types onto the value,
//           so callers annotate with xsync.{Environment,ClientStatus,RoomStatus,BootServerOptions,BootClientOptions}.
//
// Caveat: xsync copies the facade via getOwnPropertyDescriptors, NOT Object.assign — room / clients /
// myself are getters that resolve the current unit lazily, and Object.assign would invoke them at
// module load (no current unit → throw). defineProperties drops the facade type from its return, so
// the result is cast back.
//----------------------------------------------------------------------------------------------------

import { sync } from './engine';
import { Lobby, Room } from './venue';

// test seam: replicas' per-unit sync data (drive capture/apply through boot's 'sync' emit, not directly)
export { syncOf } from './engine';
export type { SyncNode } from './engine';

export const xsync = Object.defineProperties(
    { Lobby, Room },
    Object.getOwnPropertyDescriptors(sync),
) as typeof sync & { Lobby: typeof Lobby; Room: typeof Room };

// 公開型を xsync 名前空間としてマージする（callers annotate with xsync.RoomStatus など）。
// server/client を分ける Environment もこのネットワーク層の型としてここに属する。
export namespace xsync {
    export type Environment = import('./engine').RuntimeEnvironment;
    export type ClientStatus = import('./engine').SyncClientStatus;
    export type RoomStatus = import('./engine').SyncRoomStatus;
    export type BootServerOptions = import('./engine').SyncBootServerOptions;
    export type BootClientOptions = import('./engine').SyncBootClientOptions;
}
