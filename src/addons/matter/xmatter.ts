//----------------------------------------------------------------------------------------------------
// xmatter — matter-js (2D physics) integration
// `init()` mounts a Root Unit owning a Matter.Engine; child Units read the engine / world
// through xnew.context(Root). The engine's lifetime is tied to the Root Unit.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import Matter from 'matter-js';

export const xmatter = {
    init ({}: any = {}) {
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

    // release the world bodies + engine state on tree teardown
    unit.on('destroy', () => {
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
    });

    return {
        get engine() { return engine; },
    }
}
