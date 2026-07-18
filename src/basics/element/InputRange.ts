//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">, horizontal or vertical (`vertical: true`)
// InputRange owns the container frame ring and the interaction input; the nested InputRangeMeter owns the
// value-driven meter and status readout, following the bubbling input event on the shared container.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { ElementAttributes } from './attributes';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, vertical = false, className = '', style = '', attributes = {}, ...others }:
    { value?: number, min?: number, max?: number, step?: number, vertical?: boolean, className?: string, style?: string, attributes?: { meter?: ElementAttributes, status?: ElementAttributes }, [key: string]: any } = {}
) {
    const initial = value ?? min;

    const css = xnew.css({
        // the box itself carries the frame ring; the size prelude lives on the orientation variant so the
        // long axis carries the margin-box cap. box-sizing: border-box keeps the ring border inside the size
        container: {
            layer: 'base',
            body: `
                display: inline-block;
                box-sizing: border-box;
                position: relative; margin: 0.125em;
                border: 1px solid color-mix(in srgb, currentColor 40%, transparent); border-radius: 0.25em;
            `,
        },
        // horizontal: 10em wide bar; max-width: stretch caps the margin box so a caller margin never overflows
        horizontal: {
            layer: 'base',
            body: `
                width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
            `,
        },
        // vertical: 10em tall bar; max-height: stretch caps the margin box the same way on the long axis
        vertical: {
            layer: 'base',
            body: `
                width: 1.8em; height: 10em; max-height: -webkit-fill-available; max-height: -moz-available; max-height: stretch;
            `,
        },
        // invisible native control stretched over the whole surface; the thumb is shrunk to zero
        // extent along the track so the pointer→value mapping spans the full length and the bar tip
        // tracks the cursor (natively the thumb center only travels between the half-thumb insets)
        input: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; user-select: none; margin: 0;
                appearance: none;
            `,
        },
        inputHorizontal: {
            layer: 'base',
            body: `
                &::-webkit-slider-thumb { appearance: none; width: 0; }
                &::-moz-range-thumb { width: 0; border: none; }
            `,
        },
        // writing-mode makes the native range run along the block axis; direction: rtl puts min at the
        // bottom so dragging up increases (the deprecated appearance: slider-vertical is avoided)
        inputVertical: {
            layer: 'base',
            body: `
                writing-mode: vertical-lr; direction: rtl;
                &::-webkit-slider-thumb { appearance: none; height: 0; }
                &::-moz-range-thumb { height: 0; border: none; }
            `,
        },
    });

    const sizeClass = vertical ? css.vertical : css.horizontal;
    xnew.nest({ tag: 'div', className: `${css.container} ${sizeClass} ${className}`, style });

    xnew(InputRangeMeter, { value: initial, min, max, vertical, attributes });

    // hidden native input for interaction (min / max / step before value, so value never clamps against defaults)
    const inputClass = vertical ? css.inputVertical : css.inputHorizontal;
    xnew.nest({ tag: 'input', type: 'range', min, max, step, value: initial, className: `${css.input} ${inputClass}`, ...others });
}

//----------------------------------------------------------------------------------------------------
// InputRangeMeter — the value-driven display of an InputRange: a meter layer that grows with the value
// plus a status readout. Mounted on the InputRange container, it follows the bubbling `input` event
// (event.target is the range input, so the numeric value arrives even though the listener is on the container).
//----------------------------------------------------------------------------------------------------

function InputRangeMeter(unit: xnew.Unit,
    { value = 0, min = 0, max = 100, vertical = false, attributes = {} }:
    { value?: number, min?: number, max?: number, vertical?: boolean, attributes?: { meter?: ElementAttributes, status?: ElementAttributes } } = {}
) {
    const css = xnew.css({
        // value-driven meter; the growth axis (width / height) is set per orientation, driven from the container edge
        meter: {
            layer: 'base',
            body: `
                position: absolute;
                box-sizing: border-box;
                border: 1px solid currentColor; border-radius: 0.25em;
                background: color-mix(in srgb, currentColor 20%, transparent);
            `,
        },
        meterHorizontal: {
            layer: 'base',
            body: `
                top: 0; left: 0; bottom: 0;
                transition: width 0.05s;
            `,
        },
        meterVertical: {
            layer: 'base',
            body: `
                left: 0; right: 0; bottom: 0;
                transition: height 0.05s;
            `,
        },
        // value readout painted above the meter (pointer-events: none keeps the drag on the input)
        status: {
            layer: 'base',
            body: `
                position: absolute; inset: 0;
                box-sizing: border-box;
                display: flex;
                pointer-events: none;
            `,
        },
        statusHorizontal: {
            layer: 'base',
            body: `
                padding: 0 0.5em;
                justify-content: flex-end; align-items: center;
            `,
        },
        statusVertical: {
            layer: 'base',
            body: `
                padding: 0.5em 0;
                justify-content: center; align-items: flex-end;
            `,
        },
    });

    const meterClass = vertical ? css.meterVertical : css.meterHorizontal;
    const meter = xnew({ tag: 'div', className: `${css.meter} ${meterClass} ${attributes.meter?.className ?? ''}`, style: attributes.meter?.style });

    const statusClass = vertical ? css.statusVertical : css.statusHorizontal;
    const status = xnew({ tag: 'div', className: `${css.status} ${statusClass} ${attributes.status?.className ?? ''}`, style: attributes.status?.style });

    function update(v: number) {
        const percent = `${(v - min) / (max - min) * 100}%`;
        if (vertical) {
            meter.element.style.height = percent;
        } else {
            meter.element.style.width = percent;
        }
        status.element.textContent = String(v);
    }
    update(value);

    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
