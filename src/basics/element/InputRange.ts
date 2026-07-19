//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">, horizontal or vertical (`vertical: true`)
// unit.element is the container (frame ring + interaction input); left un-composed, the default
// InputRangeMeter + InputRangeStatus are drawn, each following the bubbling input event on the shared
// container. A trailing compose function replaces them with caller content (xnew.composed === false gate).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, vertical = false, className = '', style = '', ...others }:
    { value?: number, min?: number, max?: number, step?: number, vertical?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        // the container carries the faint frame ring as an inset box-shadow (not a border) so it costs no
        // box-model width — the padding box then equals the border box, and the absolute meter shares the
        // container's coordinate system (clean inset: 0 / width: f, no -1px / +2px). The size prelude lives
        // on the orientation variant so the long axis carries the margin-box cap
        container: `
            display: inline-block;
            position: relative; margin: 0.125em;
            box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 40%, transparent);
            border-radius: 0.25em;
        `,
        // horizontal: 10em wide bar; max-width: stretch caps the margin box so a caller margin never overflows
        horizontal: `
            width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
        `,
        // vertical: 10em tall bar; max-height: stretch caps the margin box the same way on the long axis
        vertical: `
            width: 1.8em; height: 10em; max-height: -webkit-fill-available; max-height: -moz-available; max-height: stretch;
        `,
        // invisible native control stretched over the whole surface; the thumb is shrunk to zero
        // extent along the track so the pointer→value mapping spans the full length and the bar tip
        // tracks the cursor (natively the thumb center only travels between the half-thumb insets)
        input: `
            position: absolute; inset: 0; width: 100%; height: 100%;
            opacity: 0; cursor: pointer; user-select: none; margin: 0;
            &::-webkit-slider-thumb { appearance: none; width: 0; height: 0; }
            &::-moz-range-thumb { width: 0; height: 0; border: none; }
            appearance: none;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${vertical ? css.vertical : css.horizontal} ${className}`, style });

    const initial = value ?? min;
    
    // hidden native input for interaction (min / max / step before value, so value never clamps against defaults)
    const direction = vertical ? 'writing-mode: vertical-lr; direction: rtl;' : '';
    xnew({ tag: 'input', type: 'range', min, max, step, value: initial, className: css.input, style: direction, ...others });

    if (xnew.composed === false) {
        xnew(InputRangeMeter, { value: initial, min, max, vertical });
        xnew(InputRangeStatus, { value: initial, vertical });
    }
}

//----------------------------------------------------------------------------------------------------
// InputRangeMeter — the value-driven meter layer of an InputRange that grows with the value
// Mounted on the InputRange container, it follows the bubbling `input` event (event.target is the range
// input, so the numeric value arrives even though the listener is on the container).
//----------------------------------------------------------------------------------------------------

function InputRangeMeter(unit: xnew.Unit,
    { value = 0, min = 0, max = 100, vertical = false }:
    { value?: number, min?: number, max?: number, vertical?: boolean } = {}
) {
    const css = xnew.css('base', {
        // value-driven meter; the growth axis (width / height) is set per orientation. The container frame is
        // an inset box-shadow (no border), so the padding box equals the border box — the meter pins flush at
        // 0 and its border coincides with the frame ring, and a full value fills exactly 100%
        meter: `
            position: absolute;
            box-sizing: border-box;
            border: 1px solid currentColor; border-radius: 0.25em;
            background: color-mix(in srgb, currentColor 20%, transparent);
        `,
        horizontal: `
            top: 0; left: 0; bottom: 0;
            transition: width 0.05s;
        `,
        vertical: `
            left: 0; right: 0; bottom: 0;
            transition: height 0.05s;
        `,
    });

    const meter = xnew({ tag: 'div', className: `${css.meter} ${vertical ? css.vertical : css.horizontal}` });

    function update(v: number) {
        const percent = `${(v - min) / (max - min) * 100}%`;
        if (vertical) {
            meter.element.style.height = percent;
        } else {
            meter.element.style.width = percent;
        }
    }
    update(value);

    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}

//----------------------------------------------------------------------------------------------------
// InputRangeStatus — the value readout painted above an InputRange meter
// Mounted on the InputRange container, it follows the bubbling `input` event and shows the raw value
// (pointer-events: none keeps the drag on the hidden input).
//----------------------------------------------------------------------------------------------------

function InputRangeStatus(unit: xnew.Unit,
    { value = 0, vertical = false }:
    { value?: number, vertical?: boolean } = {}
) {
    const css = xnew.css('base', {
        status: `
            position: absolute; inset: 0;
            box-sizing: border-box;
            display: flex;
            pointer-events: none;
        `,
        horizontal: `
            padding: 0 0.5em;
            justify-content: flex-end; align-items: center;
        `,
        vertical: `
            padding: 0.5em 0;
            justify-content: center; align-items: flex-end;
        `,
    });

    const status = xnew({ tag: 'div', className: `${css.status} ${vertical ? css.vertical : css.horizontal}` });

    function update(v: number) {
        status.element.textContent = String(v);
    }
    update(value);

    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
