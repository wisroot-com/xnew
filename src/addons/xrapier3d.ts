//----------------------------------------------------------------------------------------------------
// xrapier3d — Rapier 3D (compat build) integration
//
// Same shape as xrapier2d but with a 3D gravity vector. `initialize({ gravity })` mounts a Root
// Unit that awaits RAPIER.init() (WASM is lazy-loaded) and creates a RAPIER.World; child
// components read the world through xnew.context(Root).
//
// - xrapier3d : { initialize, world }
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
