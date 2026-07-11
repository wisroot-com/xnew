//----------------------------------------------------------------------------------------------------
// InputSwitch — sliding on / off switch backed by a hidden native <input type="checkbox">
//
// The invisible native control captures interaction (click / keyboard) while the visible surface
// is a rounded track with a knob sliding between the edges, so callers get the familiar switch
// look with native checkbox semantics.
//
// - InputSwitch : component({ value, name, className, style }) — className / style decorate the
//                 container; emits 'input' with { value } (boolean); returns { get container }
//
// Usage: const sw = xnew('<div style="width: 3em; height: 1.5em;">', xbasics.InputSwitch, { value: true });
//        sw.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputSwitch(unit: xnew.Unit,
    { value = false, name = '', className = '', style = '' }:
    { value?: boolean, name?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css({
        // sizing shell only; the default size is pending (fills the host for now)
        container: { layer: 'xbasics', body: 'box-sizing: border-box; width: 100%; height: 100%;' },
        fill: { layer: 'xbasics', body: 'box-sizing: border-box; width: 100%; height: 100%;' },
        frame: { layer: 'xbasics', body: 'border: 1px solid currentColor; border-radius: 0.25em;' },
        tint: { layer: 'xbasics', body: 'background: color-mix(in srgb, currentColor 20%, transparent);' },
    });

    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });

    xnew.nest(`<div class="${cls.fill} ${cls.frame}" style="position: relative; border-radius: 1em;">`);
    const track = unit.element as HTMLElement;

    // aspect-ratio keeps the knob square at any track size, so the slide needs no size math
    const knob = xnew('<div style="position: absolute; top: 0.15em; bottom: 0.15em; aspect-ratio: 1 / 1; border-radius: 50%; background: currentColor; transition: left 0.15s, transform 0.15s;">');

    const update = (checked: boolean) => {
        track.classList.toggle(cls.tint, checked);
        knob.element.style.left = checked ? 'calc(100% - 0.15em)' : '0.15em';
        knob.element.style.transform = checked ? 'translateX(-100%)' : 'translateX(0)';
    };
    update(value);

    xnew.nest(`<input type="checkbox"${name ? ` name="${name}"` : ''}${value ? ' checked' : ''} style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;">`);
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });

    return { get container() { return container; } };
}
