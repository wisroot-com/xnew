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
        // the container carries the faint frame ring; the absolute meter overlaps it from the padding box
        // via a -1px offset on its pinned sides. The size prelude lives on the orientation variant so the
        // long axis carries the margin-box cap
        container: `
            display: inline-block;
            position: relative; margin: 0.125em;
            border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
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
            appearance: none;
        `,
        inputHorizontal: `
            &::-webkit-slider-thumb { appearance: none; width: 0; }
            &::-moz-range-thumb { width: 0; border: none; }
        `,
        // writing-mode makes the native range run along the block axis; direction: rtl puts min at the
        // bottom so dragging up increases (the deprecated appearance: slider-vertical is avoided)
        inputVertical: `
            writing-mode: vertical-lr; direction: rtl;
            &::-webkit-slider-thumb { appearance: none; height: 0; }
            &::-moz-range-thumb { height: 0; border: none; }
        `,
    });

    const sizeClass = vertical ? css.vertical : css.horizontal;
    xnew.nest({ tag: 'div', className: `${css.container} ${sizeClass} ${className}`, style });

    const initial = value ?? min;
    if (xnew.composed === false) {
        xnew(InputRangeMeter, { value: initial, min, max, vertical });
        xnew(InputRangeStatus, { value: initial, vertical });
    }

    // hidden native input for interaction (min / max / step before value, so value never clamps against defaults)
    const inputClass = vertical ? css.inputVertical : css.inputHorizontal;
    xnew({ tag: 'input', type: 'range', min, max, step, value: initial, className: `${css.input} ${inputClass}`, ...others });
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
        // value-driven meter; the growth axis (width / height) is set per orientation. The pinned sides sit
        // at -1px so the meter border rides on the container frame ring instead of insetting 1px within it
        // (the meter's containing block is the container padding box, inside the 1px frame border)
        meter: `
            position: absolute;
            box-sizing: border-box;
            border: 1px solid currentColor; border-radius: 0.25em;
            background: color-mix(in srgb, currentColor 20%, transparent);
        `,
        horizontal: `
            top: -1px; left: -1px; bottom: -1px;
            transition: width 0.05s;
        `,
        vertical: `
            left: -1px; right: -1px; bottom: -1px;
            transition: height 0.05s;
        `,
    });

    const meter = xnew({ tag: 'div', className: `${css.meter} ${vertical ? css.vertical : css.horizontal}` });

    function update(v: number) {
        // +2px at full (scaled by fraction) so the meter's leading border reaches -1px past the padding
        // box and overlaps the container frame ring, matching the always-pinned sides
        const fraction = (v - min) / (max - min);
        const length = `calc(${fraction * 100}% + ${fraction * 2}px)`;
        if (vertical) {
            meter.element.style.height = length;
        } else {
            meter.element.style.width = length;
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
