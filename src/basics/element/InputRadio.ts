//----------------------------------------------------------------------------------------------------
// InputRadio — segmented button group backed by hidden native <input type="radio"> controls
// One framed row of exclusive segments keeps every choice visible, unlike a pulldown; the
// selected look lives in css rules keyed on a data-checked attribute, so designs stay intact.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Design } from '../design';

// radios are exclusive only within a shared name; unnamed groups get a generated one
let radioGroupId = 0;

export function InputRadio(unit: xnew.Unit,
    { value, items = [], name = '', className = '', style = '', designs = {} }:
    { value?: string, items?: string[], name?: string, className?: string, style?: string, designs?: { item?: Design } } = {}
) {
    const initial = value ?? items[0] ?? '';

    const css = xnew.css({
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        container: {
            layer: 'base',
            body: `
                box-sizing: border-box;
                display: inline-flex; align-items: stretch;
                width: 100%; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 100%;
                overflow: hidden;
                border: 1px solid currentColor; border-radius: 0.25em;
            `,
        },
        item: {
            layer: 'base',
            body: `
                flex: 1 1 0;
                position: relative;
                display: flex; align-items: center; justify-content: center;
                white-space: nowrap;
                user-select: none;
                & + & { border-left: 1px solid currentColor; }
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        input: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });
    const group = name !== '' ? name : `xnew-radio-${++radioGroupId}`;

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    const segments: [xnew.Unit, string][] = [];
    items.forEach((item) => {
        const segment = xnew({ tag: 'div', className: `${css.item} ${designs.item?.className ?? ''}`, style: designs.item?.style }, () => {
            xnew('<div>', item);
            xnew({ tag: 'input', type: 'radio', name: group, value: item, checked: item === initial, className: css.input });
        });
        segments.push([segment, item]);
    });

    const update = (selected: string) => {
        for (const [segment, item] of segments) {
            segment.element.toggleAttribute('data-checked', item === selected);
        }
    };
    update(initial);

    unit.on('input', ({ value }: { value: string }) => {
        update(value);
    });
}
