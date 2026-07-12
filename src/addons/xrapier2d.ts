//----------------------------------------------------------------------------------------------------
// xrapier2d — Rapier 2D (compat build) integration
// `initialize` awaits RAPIER.init() (the compat build loads its WASM lazily) then creates a World;
// children read it via xnew.context(Root), and the getter returns null until init completes.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import RAPIER from '@dimforge/rapier2d-compat';

export const xrapier2d = {
    initialize ({ gravity = { x: 0.0, y: -9.81 } }: any = {}) {
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
    return {
        get world() { return world; },
    };
}
