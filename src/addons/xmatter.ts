//----------------------------------------------------------------------------------------------------
// xmatter — matter-js (2D physics) integration
//
// `initialize()` mounts a Root Unit that creates a Matter.Engine; child Units retrieve the engine
// and its world through xnew.context(Root). Lifetime is tied to the Root Unit — engine is GC'd
// when that Unit finalizes.
//
// - xmatter : { initialize, engine, world }
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
