//----------------------------------------------------------------------------------------------------
// InputRadio — segmented button group backed by hidden native <input type="radio"> controls
//
// One framed row of exclusive segments (one per item) keeps every choice visible, unlike a
// pulldown; the hidden radios give native exclusivity and form semantics.
//
// - InputRadio : component({ value, items, name, className, style }) — emits 'input' with { value } (string)
//
// Usage: const radio = xnew('<div style="height: 2em;">', xbasics.InputRadio, { items: ['low', 'mid', 'high'] });
//        radio.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

// radios are exclusive only within a shared name; unnamed groups get a generated one
let radioGroupId = 0;

export function InputRadio(unit: xnew.Unit,
    { value, items = [], name = '', className = '', style = '' }:
    { value?: string, items?: string[], name?: string, className?: string, style?: string } = {}
) {
    const initial = value ?? items[0] ?? '';
    const cls = xnew.css`@layer xnew {
        .$fill { box-sizing: border-box; width: 100%; height: 100%; }
        .$frame { border: 1px solid currentColor; border-radius: 0.25em; }
        .$clickable { cursor: pointer; user-select: none; }
        .$hoverTint:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
        .$tint { background: color-mix(in srgb, currentColor 20%, transparent); }
    }`;
    const group = name !== '' ? name : `xnew-radio-${++radioGroupId}`;

    xnew.nest(`<div class="${cls.fill} ${cls.frame} ${className}" style="display: flex; align-items: stretch; overflow: hidden; ${style}">`);

    const segments: [xnew.Unit, string][] = [];
    items.forEach((item, index) => {
        const segment = xnew(`<div class="${cls.clickable} ${cls.hoverTint}" style="flex: 1 1 0; position: relative; display: flex; align-items: center; justify-content: center; white-space: nowrap;${index > 0 ? ' border-left: 1px solid currentColor;' : ''}">`, () => {
            xnew('<div>', item);
            xnew(`<input type="radio" name="${group}" value="${item}"${item === initial ? ' checked' : ''} style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;">`);
        });
        segments.push([segment, item]);
    });

    const update = (selected: string) => {
        for (const [segment, item] of segments) {
            segment.element.classList.toggle(cls.tint, item === selected);
        }
    };
    update(initial);

    unit.on('input', ({ value }: { value: string }) => {
        update(value);
    });
}
