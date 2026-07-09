//----------------------------------------------------------------------------------------------------
// InputNumber — framed native number field with custom spin buttons
//
// Number entry needs the real control visible, so this styles the native <input type="number">
// itself; the native spinner is hidden and replaced with left (-) / right (+) SVG spin buttons
// flanking the field, so the control matches the other Input* elements on any surface.
//
// - InputNumber : component({ value, min, max, step, name, placeholder, className, style })
//                 — emits 'input' with { value } (number; NaN while the field is empty);
//                   the spin buttons step via the native stepUp/stepDown (min / max / step apply)
//
// Usage: const num = xnew('<div style="width: 8em; height: 2em;">', xbasics.InputNumber, { value: 10, min: 0, max: 100 });
//        num.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { sharedCss } from '../styles';
import { SVG } from './SVG';

const numberCss = {
    // the native spinner is hidden because the custom buttons replace it
    noSpinner: '-moz-appearance: textfield; appearance: textfield; &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }',
    // visible native text control; transparent + inherit so it sits on any surface
    textInput: 'box-sizing: border-box; width: 100%; height: 100%; padding: 0 0.5em; margin: 0; background: transparent; color: inherit; font: inherit; outline: none; &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }',
    press: '&:active { filter: brightness(0.5); }',
};

export function InputNumber(unit: xnew.Unit,
    { value, min, max, step, name = '', placeholder = '', className = '', style = '' }:
    { value?: number, min?: number, max?: number, step?: number, name?: string, placeholder?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css(sharedCss);
    const num = xnew.css(numberCss);

    const container = xnew.nest(`<div class="${className}" style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: stretch; overflow: hidden; border: 1px solid currentColor; border-radius: 0.25em; ${style}">`);

    // custom spin buttons flanking the field (stepUp / stepDown keep the native min / max / step semantics);
    // element is captured after nest — a listener owned by the left button sees the pre-input nest state via unit.element
    let element: HTMLInputElement;
    const spinButton = (direction: number, path: string) => {
        const button = xnew(container, () => {
            xnew.nest(`<div class="${cls.clickable} ${cls.hover} ${num.press}" style="width: 2em; display: flex; align-items: center; justify-content: center;">`);
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

    const attrs = [
        name ? ` name="${name}"` : '',
        min !== undefined ? ` min="${min}"` : '',
        max !== undefined ? ` max="${max}"` : '',
        step !== undefined ? ` step="${step}"` : '',
    ].join('');
    xnew.nest(`<input type="number"${attrs} class="${num.textInput} ${num.noSpinner}" style="flex: 1 1 0; width: auto; min-width: 0; text-align: center;">`);

    element = unit.element as HTMLInputElement;
    if (value !== undefined) {
        element.value = String(value);
    }
    element.placeholder = placeholder;

    spinButton(+1, 'M4.5 3 7.5 6 4.5 9');
}
