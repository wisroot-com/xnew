import { xnew } from '@mulsense/xnew';
import Matter from 'matter-js';

const xmatter = {
    initialize({} = {}) {
        return xnew.promise(xnew(Root, {}));
    },
    get engine() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.engine;
    },
    get world() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.engine.world;
    },
};
function Root(unit, {}) {
    const engine = Matter.Engine.create();
    unit.on('finalize', () => {
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
    });
    return {
        get engine() { return engine; },
    };
}

export { xmatter };
