//----------------------------------------------------------------------------------------------------
// xrapier3d — Rapier 3D (compat build) integration; same shape as xrapier2d with 3D gravity
// `initialize` awaits RAPIER.init() (WASM is lazy-loaded) then creates a World; children read it
// via xnew.context(Root), and the getter returns null until init completes.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import RAPIER from '@dimforge/rapier3d-compat';

export const xrapier3d = {
    initialize ({ gravity = { x: 0.0, y: -9.81, z: 0.0 } }: any = {}) {
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
