//----------------------------------------------------------------------------------------------------
// xreact — embed an xnew component inside React (React 18/19; react is external, react-dom not needed).
//
// The boundary is one host <div>: React renders it, xnew owns its contents.
//
// - xreact.Embed : <xreact.Embed Component={Main} props={{ ... }} />
//
// Lifetime: mount → xnew(host, Component, props); re-render → unit.setProps?.(props); unmount → finalize().
//----------------------------------------------------------------------------------------------------

import { createElement, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { xnew } from '@mulsense/xnew';

export interface EmbedProps<P> {
    /** xnew component function (unit, props) => defines */
    Component: (unit: any, props: P) => any;
    /** props passed to Component; live updates flow through setProps on re-render */
    props?: P;
    /** className for the host div */
    className?: string;
    /** style for the host div */
    style?: CSSProperties;
}

function Embed<P>({ Component, props, className, style }: EmbedProps<P>): ReactElement {
    const hostRef = useRef<HTMLDivElement>(null);
    const unitRef = useRef<any>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    // mount once / finalize on unmount (remount if Component changes)
    useEffect(() => {
        const unit = xnew(hostRef.current!, Component as any, propsRef.current as any);
        unitRef.current = unit;
        return () => {
            unit.finalize();
            unitRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [Component]);

    // React → xnew: push latest props each render (if the component exposes setProps)
    useEffect(() => {
        unitRef.current?.setProps?.(props);
    });

    return createElement('div', { ref: hostRef, className, style });
}

export const xreact = { Embed };
