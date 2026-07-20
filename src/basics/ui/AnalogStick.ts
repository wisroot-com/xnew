//----------------------------------------------------------------------------------------------------
// AnalogStick — virtual game-pad stick with a continuous radial vector
// Extends VectorPad ('analog') for input; draws the frame arrows plus a movable knob that follows
// -down / -move and recenters on -up.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { VectorPad } from './VectorPad';

export function AnalogStick(unit: xnew.Unit,
    { className = '', style = '' }:
    { className?: string, style?: string } = {}
) {
    xnew.extend(VectorPad, { type: 'analog', className, style });

    // static frame arrows
    xnew('<polygon points="32  7 27 13 37 13">');
    xnew('<polygon points="32 57 27 51 37 51">');
    xnew('<polygon points=" 7 32 13 27 13 37">');
    xnew('<polygon points="57 32 51 27 51 37">');

    // movable knob, shifted in viewBox units (its travel radius is a quarter of the 64-unit span = 16)
    const target = xnew('<circle cx="32" cy="32" r="14">');

    unit.on('-down -move', ({ vector }: { vector: { x: number, y: number } }) => {
        target.element.setAttribute('transform', `translate(${vector.x * 16} ${vector.y * 16})`);
        target.element.style.filter = 'brightness(80%)';
    });
    unit.on('-up', () => {
        target.element.removeAttribute('transform');
        target.element.style.filter = '';
    });
}
