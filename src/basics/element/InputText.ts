//----------------------------------------------------------------------------------------------------
// InputText — framed native text field that inherits the surrounding look
//
// Text entry needs the real control visible, so unlike the gauge-style inputs this styles the
// native <input type="text"> itself with the shared frame to match the other Input* elements.
//
// - InputText : component({ value, name, placeholder, className, style }) — emits 'input' with { value } (string)
//
// Usage: const text = xnew('<div style="width: 12em; height: 2em;">', xbasics.InputText, { placeholder: 'name' });
//        text.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { sharedCss } from '../styles';

export function InputText(unit: xnew.Unit,
    { value = '', name = '', placeholder = '', className = '', style = '' }:
    { value?: string, name?: string, placeholder?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css(sharedCss);

    xnew.nest(`<input type="text"${name ? ` name="${name}"` : ''} class="${cls.frame} ${cls.textInput} ${className}" style="${style}">`);

    // value / placeholder are set as properties so arbitrary text cannot break the tag string
    const element = unit.element as HTMLInputElement;
    element.value = value;
    element.placeholder = placeholder;
}
