//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">
//
// The invisible native control captures interaction (drag / touch / keyboard) while the visible
// surface is a growing value bar inside a faint outline (the max extent), so callers get a gauge
// look with native range semantics.
//
// - InputRange : component({ value, min, max, step, name, className, style })
//                — emits 'input' with { value }; fills left→right
//
// Usage: const gauge = xnew(xbasics.InputRange, { value: 50 });
//        gauge.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, name, className = '', style = '' }:
    { value?: number, min?: number, max?: number, step?: number, name?: string, className?: string, style?: string } = {}
) {
    value = value ?? min;
    const cls = xnew.css({
        // wraps the whole gauge; the default size is an overridable @layer xbasics rule
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.5rem;
                position: relative;
                cursor: pointer; user-select: none;
            `,
        },
        // faint border marking the max extent
        outline: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0;
                border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
                border-radius: 0.25em;
            `,
        },
        // value bar; border-box so its border lands exactly on the outline at max
        bar: {
            layer: 'xbasics',
            body: `
                position: absolute; top: 0; left: 0; bottom: 0;
                box-sizing: border-box;
                border: 1px solid currentColor; border-radius: 0.25em;
                background: color-mix(in srgb, currentColor 20%, transparent);
                transition: width 0.05s;
            `,
        },
        // invisible native control stretched over the whole surface
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });

    xnew.nest(`<div class="${cls.container} ${className}" style="${style}">`);

    xnew(`<div class="${cls.outline}">`);

    const bar = xnew(`<div class="${cls.bar}">`);

    const update = (v: number) => {
        bar.element.style.width = `${(v - min) / (max - min) * 100}%`;
    };
    update(value);

    // hidden native input for interaction (min / max / step before value, so value never clamps against defaults)
    xnew.nest({ tag: 'input', type: 'range', name, min, max, step, value, className: cls.input });
    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
