//----------------------------------------------------------------------------------------------------
// sync — networking layer entry (assembles the xsync.* facade + ready-made components)
//
// The public barrel (src/index.ts) re-exports `xsync` from here; addons never touch these internals.
//
// - xsync : sync facade (server / client / state / register / emitTo* / room / clients / myself / boot)
//           plus the Lobby / Room components. Re-exports the public types callers annotate with.
//
// Caveat: xsync copies the facade via getOwnPropertyDescriptors, NOT Object.assign — room / clients /
// myself are getters that resolve the current unit lazily, and Object.assign would invoke them at
// module load (no current unit → throw). defineProperties drops the facade type from its return, so
// the result is cast back.
//----------------------------------------------------------------------------------------------------

import { sync } from './facade';
import { Lobby, Room } from './components';

// public types callers annotate with
export type { ClientStatus, RoomStatus, BootServerOptions, BootClientOptions, SyncNode } from './internal';
// test seam: replicas' per-unit sync data (drive capture/apply through boot's 'sync' emit, not directly)
export { syncOf } from './internal';

export const xsync = Object.defineProperties(
    { Lobby, Room },
    Object.getOwnPropertyDescriptors(sync),
) as typeof sync & { Lobby: typeof Lobby; Room: typeof Room };
