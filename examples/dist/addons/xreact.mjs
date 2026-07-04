import { useRef, useEffect, createElement } from 'react';
import { xnew } from '@mulsense/xnew';

function Embed({ Component, props, className, style }) {
    const hostRef = useRef(null);
    const unitRef = useRef(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    useEffect(() => {
        const unit = xnew(hostRef.current, Component, propsRef.current);
        unitRef.current = unit;
        return () => {
            unit.finalize();
            unitRef.current = null;
        };
    }, [Component]);
    useEffect(() => {
        var _a, _b;
        (_b = (_a = unitRef.current) === null || _a === void 0 ? void 0 : _a.setProps) === null || _b === void 0 ? void 0 : _b.call(_a, props);
    });
    return createElement('div', { ref: hostRef, className, style });
}
const xreact = { Embed };

export { xreact };
