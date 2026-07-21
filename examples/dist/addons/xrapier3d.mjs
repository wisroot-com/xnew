import { xnew } from '@mulsense/xnew';
import RAPIER from '@dimforge/rapier3d-compat';

const xrapier3d = {
    initialize({ gravity = { x: 0.0, y: -9.81, z: 0.0 } } = {}) {
        return xnew.promise(xnew(Root, { gravity }));
    },
    get world() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.world;
    },
};
function Root(unit, { gravity }) {
    let world = null;
    xnew.promise(RAPIER.init()).then(() => {
        world = new RAPIER.World(gravity);
    });
    unit.on('finalize', () => {
        world === null || world === void 0 ? void 0 : world.free();
        world = null;
    });
    return {
        get world() { return world; },
    };
}

export { xrapier3d };
