//----------------------------------------------------------------------------------------------------
// ToggleBar — a pressable label row that opens / closes a Gate; the marker at its left moves as the gate moves
// `gate` is the Gate unit to drive — the caller owns it, so the same one also feeds the Accordion (or Overlay)
// holding what the bar reveals — and it is re-exposed as `gate`. `label` fills the row's text; further
// content composed into the bar lands after it, still inside the pressable row.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

// 'chevron' swings a quarter turn (closed points right, open points down); 'plusminus' lays its upright
// down onto the crossbar, so a closed bar reads '+' and an open one '-'. Both are one stroke turning 90deg.
export type ToggleBarMarker = 'chevron' | 'plusminus';

export function ToggleBar(unit: xnew.Unit,
    { gate, label = '', marker = 'chevron', className = '', style = '', ...others }:
    { gate: xnew.Unit, label?: string, marker?: ToggleBarMarker, className?: string, style?: string, [key: string]: any }
) {
    const css = xnew.css('base', {
        container: `
            display: flex; align-items: center;
            min-height: 2em;
            cursor: pointer; user-select: none;
        `,
        // the 24 viewBox and 1.5 stroke are the xicons geometry, so a bar's marker carries the same
        // weight as the heroicons drawn beside it (a Panel row's chevron, say) at any font size
        marker: `
            flex: none; width: 0.9em; height: 0.9em; margin-right: 0.25em;
            fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;
        `,
        // an svg child turns about its own bbox, not the viewBox, without these
        turn: `
            transform-box: fill-box; transform-origin: center;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    // a local svg rather than xicons, so a bar never drags the whole icon table into a bundle (as ListboxChevron does)
    let turn!: xnew.Unit;
    xnew({ tag: 'svg', viewBox: '0 0 24 24', className: css.marker }, () => {
        if (marker === 'plusminus') {
            // both strokes are the same length about the same centre, so the turned upright lands flat on the crossbar
            xnew({ tag: 'path', d: 'M4.5 12h15' });
            turn = xnew({ tag: 'path', d: 'M12 4.5v15', className: css.turn });
        } else {
            turn = xnew({ tag: 'path', d: 'm8.25 4.5 7.5 7.5-7.5 7.5', className: css.turn });
        }
    });

    // whichever marker it is, the moving stroke follows the gate through the same quarter turn
    apply(gate.value);
    gate.on('-transition', ({ value }: { value: number }) => apply(value));
    function apply(value: number) {
        turn.current.style.transform = `rotate(${value * 90}deg)`;
    }

    if (label !== '') {
        xnew('<div>', label);
    }

    unit.on('click', () => gate.toggle());

    return {
        get gate() {
            return gate;
        },
    };
}
