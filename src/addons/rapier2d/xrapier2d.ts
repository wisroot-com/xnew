//----------------------------------------------------------------------------------------------------
// xrapier2d — Rapier 2D (compat build) integration
// `xrapier2d.init()` awaits RAPIER.init() (the compat build loads its WASM lazily) then creates a World;
// children read it via xnew.context(Root), and the getter returns null until init completes.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import RAPIER from '@dimforge/rapier2d-compat';

export const xrapier2d = {
    init ({ gravity = { x: 0.0, y: -9.81 } }: any = {}) {
        return xnew.promise(xnew(Root, { gravity }));
    },
    get world() {
        return xnew.context(Root)?.world;
    },
};

function Root(unit: xnew.Unit, { gravity }: any) {
    let world: RAPIER.World | null = null;
    
    xnew.promise(RAPIER.init()).then(() => {
        world = new RAPIER.World(gravity);
    });

    // free the WASM-backed world on tree teardown (the init callback is scope-skipped after destroy, so no world is created if the unit is destroyed first)
    unit.on('destroy', () => {
        world?.free();
        world = null;
    });

    return {
        get world() { return world; },
    };
}
