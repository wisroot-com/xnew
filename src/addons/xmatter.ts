//----------------------------------------------------------------------------------------------------
// xmatter — matter-js (2D physics) integration
// `initialize()` mounts a Root Unit owning a Matter.Engine; child Units read the engine / world
// through xnew.context(Root). The engine's lifetime is tied to the Root Unit.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import Matter from 'matter-js';

export const xmatter = {
    initialize ({}: any = {}) {
       return xnew.promise(xnew(Root, {}));
    },
    get engine() {
        return xnew.context(Root)?.engine;
    },
    get world() {
        return xnew.context(Root)?.engine.world;
    },
};

function Root(unit: xnew.Unit, {}: any) {
    const engine = Matter.Engine.create();

    return {
        get engine() { return engine; },
    }
}
