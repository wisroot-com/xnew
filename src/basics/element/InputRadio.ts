//----------------------------------------------------------------------------------------------------
// InputRadio — segmented button group backed by hidden native <input type="radio"> controls
//
// One framed row of exclusive segments (one per item) keeps every choice visible, unlike a
// pulldown; the hidden radios give native exclusivity and form semantics.
// The selected look lives in css rules keyed on a data-checked attribute, so designs stay intact.
//
// - InputRadio : component({ value, items, name, className, style, designs }) — className / style
//                decorate the container; designs: { frame?, item? } — a Design
//                ({ className?, style? }) per part; emits 'input' with { value } (string);
//                returns { get container }
//
// Usage: const radio = xnew(xbasics.InputRadio, { items: ['low', 'mid', 'high'] });
//        radio.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

// radios are exclusive only within a shared name; unnamed groups get a generated one
let radioGroupId = 0;

export function InputRadio(unit: xnew.Unit,
    { value, items = [], name = '', className = '', style = '', designs = {} }:
    { value?: string, items?: string[], name?: string, className?: string, style?: string, designs?: { frame?: Design, item?: Design } } = {}
) {
    const initial = value ?? items[0] ?? '';

    // the default size is pending (fills the host for now)
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: 100%; height: 100%;',
        className, style,
    });

    const cls = xnew.css({
        // framed row holding the item cells
        frame: {
            layer: 'base',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                display: flex; align-items: stretch; overflow: hidden;
                border: 1px solid currentColor; border-radius: 0.25em;
            `,
        },
        // one cell per choice (position: relative anchors the input overlay);
        // the selected state is expressed via data-checked
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
        // invisible native control stretched over the cell
        input: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });
    const group = name !== '' ? name : `xnew-radio-${++radioGroupId}`;

    xnew.nest({ tag: 'div', className: `${cls.frame} ${designs.frame?.className ?? ''}`, style: designs.frame?.style });

    const segments: [xnew.Unit, string][] = [];
    items.forEach((item) => {
        const segment = xnew({ tag: 'div', className: `${cls.item} ${designs.item?.className ?? ''}`, style: designs.item?.style }, () => {
            xnew('<div>', item);
            xnew({ tag: 'input', type: 'radio', name: group, value: item, checked: item === initial, className: cls.input });
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
