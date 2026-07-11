//----------------------------------------------------------------------------------------------------
// InputSwitch — sliding on / off switch backed by a hidden native <input type="checkbox">
//
// The invisible native control captures interaction (click / keyboard) while the visible surface
// is a rounded frame with a knob sliding between the edges, so callers get the familiar
// switch look with native checkbox semantics.
// The on state lives in css rules keyed on a data-checked attribute, so designs stay intact.
//
// - InputSwitch : component({ value, className, style, designs, ...rest }) — className / style
//                 decorate the container; designs: { frame?, knob? } — a Design
//                 ({ className?, style? }) per part; rest members (name, …) pass through to the
//                 <input>; emits 'input' with { value } (boolean); returns { get container }
//
// Usage: const sw = xnew(xbasics.InputSwitch, { value: true });
//        sw.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Design } from '../design';

export function InputSwitch(unit: xnew.Unit,
    { value = false, className = '', style = '', designs = {}, ...others }:
    { value?: boolean, className?: string, style?: string, designs?: { frame?: Design, knob?: Design }, [key: string]: any } = {}
) {
    const cls = xnew.css({
        // sizing shell only; the default size is an overridable @layer xbasics rule
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 3rem; height: 1.5rem;
            `,
        },
        // rounded track carrying the knob (position: relative anchors the knob and input overlay);
        // the on state is expressed via data-checked
        frame: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                position: relative;
                border: 1px solid currentColor; border-radius: 1em;
                cursor: pointer; user-select: none;
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        // aspect-ratio keeps the knob square at any frame size, so the slide needs no size math
        knob: {
            layer: 'xbasics',
            body: `
                position: absolute; top: 0.15em; bottom: 0.15em; left: 0.15em;
                aspect-ratio: 1 / 1; border-radius: 50%;
                background: currentColor;
                transition: left 0.15s, transform 0.15s;
                [data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }
            `,
        },
        // invisible native control stretched over the frame
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });

    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });

    const frame = xnew.nest({ tag: 'div', className: `${cls.frame} ${designs.frame?.className ?? ''}`, style: designs.frame?.style });

    xnew({ tag: 'div', className: `${cls.knob} ${designs.knob?.className ?? ''}`, style: designs.knob?.style });

    const update = (checked: boolean) => {
        frame.toggleAttribute('data-checked', checked);
    };
    update(value);

    // hidden native input for interaction
    xnew.nest({ tag: 'input', type: 'checkbox', checked: value, className: cls.input, ...others });
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });

    return { get container() { return container; } };
}
