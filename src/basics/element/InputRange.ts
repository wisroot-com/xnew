//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">, horizontal or vertical (`vertical: true`)
// unit.element is the container (frame ring + interaction input); used standalone, the default
// InputRangeMeter + InputRangeStatus are drawn; a trailing compose fn replaces them (xnew.standalone gate).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step, vertical = false, className = '', style = '', ...others }:
    { value?: number, min?: number, max?: number, step?: number, vertical?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            position: relative; margin: 0.125em;
            box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 40%, transparent);
            border-radius: 0.25em;
        `,
        horizontal: `
            width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
        `,
        vertical: `
            width: 1.8em; height: 10em; max-height: -webkit-fill-available; max-height: -moz-available; max-height: stretch;
        `,
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
    xnew({ tag: 'input', type: 'range', min, max, step: step ?? autoStep(min, max), value: initial, className: css.input, style: direction, ...others });

    if (xnew.standalone === true) {
        xnew(InputRangeMeter, { value: initial, min, max, vertical });
        xnew(InputRangeStatus, { value: initial, vertical });
    }
}

//----------------------------------------------------------------------------------------------------
// autoStep — default step when unspecified: ~100 steps over d = max - min, snapped to …, 0.1, 0.5, 1, 5, 10, …
//----------------------------------------------------------------------------------------------------

function autoStep(min: number, max: number): number {
    const d = max - min;
    if (d > 0) {
        const target = d / 100;
        const base = Math.pow(10, Math.floor(Math.log10(target)));
        const ratio = target / base;
        // snap to the 1 / 5 sequence at the geometric midpoints (√5, √50)
        if (ratio < Math.sqrt(5)) {
            return base;
        } else if (ratio < Math.sqrt(50)) {
            return base * 5;
        } else {
            return base * 10;
        }
    } else {
        return 1;
    }
}

//----------------------------------------------------------------------------------------------------
// InputRangeMeter — the meter layer that grows with the value, mounted on the InputRange container (follows the bubbling `input` event)
//----------------------------------------------------------------------------------------------------

function InputRangeMeter(unit: xnew.Unit,
    { value = 0, min = 0, max = 100, vertical = false }:
    { value?: number, min?: number, max?: number, vertical?: boolean } = {}
) {
    const css = xnew.css('base', {
        meter: `
            position: absolute;
            box-sizing: border-box;
            border: 1px solid currentColor; border-radius: 0.25em;
            background: color-mix(in srgb, currentColor 20%, transparent);
            pointer-events: none;
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

    function apply(v: number) {
        const percent = `${(v - min) / (max - min) * 100}%`;
        if (vertical) {
            meter.element.style.height = percent;
        } else {
            meter.element.style.width = percent;
        }
    }
    apply(value);

    unit.on('input', ({ value }: { value: number }) => {
        apply(value);
    });
}

//----------------------------------------------------------------------------------------------------
// InputRangeStatus — the value readout painted above the meter (pointer-events: none keeps the drag on the hidden input)
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

    function apply(v: number) {
        status.element.textContent = String(v);
    }
    apply(value);

    unit.on('input', ({ value }: { value: number }) => {
        apply(value);
    });
}
