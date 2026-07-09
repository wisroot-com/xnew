//----------------------------------------------------------------------------------------------------
// InputRange — text-free gauge backed by a hidden native <input type="range">
//
// The invisible native control captures interaction (drag / touch / keyboard) while the visible
// surface is just a growing fill bar, so callers get a gauge look with native range semantics.
//
// - InputRange : component({ value, min, max, step, orientation, label, name, className, style })
//                — emits 'input' with { value }; orientation: 'horizontal' (default, fills left→right)
//                  or 'vertical' (fills bottom→top); label overlays the label + live value on the gauge
//
// Usage: const gauge = xnew('<div style="width: 8em; height: 2em;">', xbasics.InputRange, { value: 50 });
//        gauge.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { sharedCss } from '../styles';

export function InputRange(unit: xnew.Unit,
    { value, min = 0, max = 100, step = 1, orientation = 'horizontal', label = '', name = '', className = '', style = '' }:
    { value?: number, min?: number, max?: number, step?: number, orientation?: 'horizontal' | 'vertical', label?: string, name?: string, className?: string, style?: string } = {}
) {
    value = value ?? min;
    const cls = xnew.css(sharedCss);
    const horizontal = orientation !== 'vertical';

    xnew.nest(`<div class="${cls.clickable} ${className}" style="position: relative; width: 100%; height: 100%; ${style}">`);

    // fill bar
    const fillAnchor = horizontal
        ? 'top: 0; left: 0; bottom: 0; transition: width 0.05s;'
        : 'left: 0; right: 0; bottom: 0; transition: height 0.05s;';
    const fill = xnew(`<div class="${cls.frame} ${cls.pale}" style="position: absolute; ${fillAnchor}">`);

    // overlay labels (after the fill bar so the text paints above it; the hidden input stays on top for interaction)
    let status: xnew.Unit | null = null;
    if (label !== '') {
        const overlay = xnew(`<div class="${cls.overlay}" style="padding: 0 0.5em; display: flex; justify-content: space-between; align-items: center; pointer-events: none;">`);
        xnew(overlay, '<div>', label);
        status = xnew(overlay, '<div>', String(value));
    }

    const update = (v: number) => {
        const percent = `${(v - min) / (max - min) * 100}%`;
        if (horizontal) {
            fill.element.style.width = percent;
        } else {
            fill.element.style.height = percent;
        }
        if (status !== null) {
            status.element.textContent = String(v);
        }
    };
    update(value);

    // hidden native input for interaction (vertical flips the native control's axis)
    const inputStyle = horizontal ? '' : ' style="writing-mode: vertical-lr; direction: rtl;"';
    xnew.nest(`<input type="range"${name ? ` name="${name}"` : ''} min="${min}" max="${max}" step="${step}" value="${value}" class="${cls.hiddenInput}"${inputStyle}>`);
    unit.on('input', ({ value }: { value: number }) => {
        update(value);
    });
}
