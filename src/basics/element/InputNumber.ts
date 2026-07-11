//----------------------------------------------------------------------------------------------------
// InputNumber — framed native number field with custom spin buttons
//
// Number entry needs the real control visible, so this styles the native <input type="number">
// itself; the native spinner is hidden and replaced with left (-) / right (+) SVG spin buttons
// flanking the field, so the control matches the other Input* elements on any surface.
//
// - InputNumber : component({ className, style, ...rest }) — rest members (value, min, max, step,
//                 name, placeholder, …) pass through to the <input>; emits 'input' with { value }
//                 (number; NaN while the field is empty); the spin buttons step via the native
//                 stepUp/stepDown (min / max / step apply)
//
// Usage: const num = xnew('<div style="width: 8em; height: 2em;">', xbasics.InputNumber, { value: 10, min: 0, max: 100 });
//        num.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from './SVG';

export function InputNumber(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const cls = xnew.css({
        // framed flex row hosting spin button / field / spin button
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                display: flex; align-items: stretch; overflow: hidden;
                border: 1px solid currentColor; border-radius: 0.25em;
            `,
        },
        // spin button cell (hover tint + press feedback)
        spin: {
            layer: 'xbasics',
            body: `
                width: 2em;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:active { filter: brightness(0.5); }
            `,
        },
        // transparent native field; the native spinner is hidden because the custom buttons replace it
        input: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; height: 100%;
                flex: 1 1 0; width: auto; min-width: 0;
                text-align: center; padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                outline: none;
                -moz-appearance: textfield; appearance: textfield;
                &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });

    // custom spin buttons flanking the field (stepUp / stepDown keep the native min / max / step semantics);
    // element is captured after nest — a listener owned by the left button sees the pre-input nest state via unit.element
    let element: HTMLInputElement;
    const spinButton = (direction: number, path: string) => {
        const button = xnew(container, () => {
            xnew.nest(`<div class="${cls.spin}">`);
            xnew((unit: xnew.Unit) => {
                xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'width: 0.9em; height: 0.9em;' });
                xnew(`<path d="${path}"/>`);
            });
        });
        button.on('click', () => {
            if (direction > 0) {
                element.stepUp();
            } else {
                element.stepDown();
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    spinButton(-1, 'M7.5 3 4.5 6 7.5 9');

    // members unused here (value / min / max / step / name / placeholder / …) pass through to the field
    xnew.nest({ tag: 'input', type: 'number', className: cls.input, ...others });

    element = unit.element as HTMLInputElement;

    spinButton(+1, 'M4.5 3 7.5 6 4.5 9');
}
