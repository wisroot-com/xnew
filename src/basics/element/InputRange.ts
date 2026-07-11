//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">
// The invisible native control captures interaction while the visible surface is a value-driven
// meter layer growing over a full-extent frame layer, plus a status readout of the value.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, className = '', style = '', designs = {}, ...others }:
    { value?: number, min?: number, max?: number, step?: number, className?: string, style?: string, designs?: { frame?: Design, meter?: Design, status?: Design }, [key: string]: any } = {}
) {
    const initial = value ?? min;

    xnew.extend(Container, {
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        base: 'box-sizing: border-box; width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em; position: relative; margin: 0.125em 0;',
        className, style,
    });

    const css = xnew.css({
        frame: {
            layer: 'base',
            body: `
                position: absolute; inset: 0;
                border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
                border-radius: 0.25em;
            `,
        },
        meter: {
            layer: 'base',
            body: `
                position: absolute; top: 0; left: 0; bottom: 0;
                box-sizing: border-box;
                border: 1px solid currentColor; border-radius: 0.25em;
                background: color-mix(in srgb, currentColor 20%, transparent);
                transition: width 0.05s;
            `,
        },
        // value readout painted above the meter (pointer-events: none keeps the drag on the input)
        status: {
            layer: 'base',
            body: `
                position: absolute; inset: 0;
                box-sizing: border-box; padding: 0 0.5em;
                display: flex; justify-content: flex-end; align-items: center;
                pointer-events: none;
            `,
        },
        // invisible native control stretched over the whole surface; the thumb is shrunk to zero
        // width so the pointer→value mapping spans the full width and the bar tip tracks the cursor
        // (natively the thumb center only travels between the half-thumb insets)
        input: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; user-select: none; margin: 0;
                appearance: none;
                &::-webkit-slider-thumb { appearance: none; width: 0; }
                &::-moz-range-thumb { width: 0; border: none; }
            `,
        },
    });

    xnew({ tag: 'div', className: `${css.frame} ${designs.frame?.className ?? ''}`, style: designs.frame?.style });

    const meter = xnew({ tag: 'div', className: `${css.meter} ${designs.meter?.className ?? ''}`, style: designs.meter?.style });

    const status = xnew({ tag: 'div', className: `${css.status} ${designs.status?.className ?? ''}`, style: designs.status?.style });

    const update = (v: number) => {
        meter.element.style.width = `${(v - min) / (max - min) * 100}%`;
        status.element.textContent = String(v);
    };
    update(initial);

    // hidden native input for interaction (min / max / step before value, so value never clamps against defaults)
    xnew.nest({ tag: 'input', type: 'range', min, max, step, value: initial, className: css.input, ...others });
    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
