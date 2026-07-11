//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">
//
// The invisible native control captures interaction (drag / touch / keyboard) while the visible
// surface is a value-driven meter layer growing over a full-extent background layer (default look:
// a fill bar inside a faint outline), so callers get a gauge look with native range semantics.
//
// - InputRange : component({ value, min, max, step, name, className, style, designs })
//                — emits 'input' with { value }; fills left→right;
//                  designs: { background?, meter? } — a Design ({ className?, style? }) per part
//
// Usage: const gauge = xnew(xbasics.InputRange, { value: 50, designs: { meter: { style: 'background: gold;' } } });
//        gauge.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Design } from '../design';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, name, className = '', style = '', designs = {} }:
    { value?: number, min?: number, max?: number, step?: number, name?: string, className?: string, style?: string, designs?: { background?: Design, meter?: Design } } = {}
) {
    value = value ?? min;
    const cls = xnew.css({
        // wraps the whole gauge; the default size is an overridable @layer xbasics rule
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.8rem;
                position: relative;
                cursor: pointer; user-select: none;
            `,
        },
        // static full-extent layer (default: a faint outline of the max extent)
        background: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0;
                border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
                border-radius: 0.25em;
            `,
        },
        // value-driven layer (default: a bordered fill bar; border-box so it lands on the background at max)
        meter: {
            layer: 'xbasics',
            body: `
                position: absolute; top: 0; left: 0; bottom: 0;
                box-sizing: border-box;
                border: 1px solid currentColor; border-radius: 0.25em;
                background: color-mix(in srgb, currentColor 20%, transparent);
                transition: width 0.05s;
            `,
        },
        // invisible native control stretched over the whole surface; the thumb is shrunk to zero
        // width so the pointer→value mapping spans the full width and the bar tip tracks the cursor
        // (natively the thumb center only travels between the half-thumb insets)
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
                appearance: none;
                &::-webkit-slider-thumb { appearance: none; width: 0; }
                &::-moz-range-thumb { width: 0; border: none; }
            `,
        },
    });

    xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });

    xnew({ tag: 'div', className: `${cls.background} ${designs.background?.className ?? ''}`, style: designs.background?.style });

    const meter = xnew({ tag: 'div', className: `${cls.meter} ${designs.meter?.className ?? ''}`, style: designs.meter?.style });

    const update = (v: number) => {
        meter.element.style.width = `${(v - min) / (max - min) * 100}%`;
    };
    update(value);

    // hidden native input for interaction (min / max / step before value, so value never clamps against defaults)
    xnew.nest({ tag: 'input', type: 'range', name, min, max, step, value, className: cls.input });
    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
