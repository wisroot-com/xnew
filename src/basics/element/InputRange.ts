//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">
//
// The invisible native control captures interaction (drag / touch / keyboard) while the visible
// surface is just a growing fill bar, so callers get a gauge look with native range semantics.
//
// - InputRange : component({ value, min, max, step, orientation, name, className, style })
//                — emits 'input' with { value }; orientation: 'horizontal' (default, fills left→right)
//                  or 'vertical' (fills bottom→top)
//
// Usage: const gauge = xnew('<div style="width: 8em; height: 2em;">', xbasics.InputRange, { value: 50 });
//        gauge.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { sharedCss } from '../styles';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, orientation = 'horizontal', name = '', className = '', style = '' }:
    { value?: number, min?: number, max?: number, step?: number, orientation?: 'horizontal' | 'vertical', name?: string, className?: string, style?: string } = {}
) {
    value = value ?? min;
    const cls = xnew.css(sharedCss);
    const horizontal = orientation !== 'vertical';

    xnew.nest(`<div class="${cls.fill} ${cls.clickable} ${className}" style="position: relative; ${style}">`);

    // fill bar
    const fillAnchor = horizontal
        ? 'top: 0; left: 0; bottom: 0; transition: width 0.05s;'
        : 'left: 0; right: 0; bottom: 0; transition: height 0.05s;';
    const fill = xnew(`<div class="${cls.frame} ${cls.tint}" style="position: absolute; ${fillAnchor}">`);

    const update = (v: number) => {
        const percent = `${(v - min) / (max - min) * 100}%`;
        if (horizontal) {
            fill.element.style.width = percent;
        } else {
            fill.element.style.height = percent;
        }
    };
    update(value);

    // hidden native input for interaction (vertical flips the native control's axis)
    const inputAxis = horizontal ? '' : ' writing-mode: vertical-lr; direction: rtl;';
    xnew.nest(`<input type="range"${name ? ` name="${name}"` : ''} min="${min}" max="${max}" step="${step}" value="${value}" style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;${inputAxis}">`);
    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
