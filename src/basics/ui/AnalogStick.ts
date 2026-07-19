//----------------------------------------------------------------------------------------------------
// AnalogStick — virtual game-pad stick with a continuous radial vector
// Translates pointer drags into a normalized vector (x / y in [-1, 1]) emitted as events,
// so parent components react without touching DOM events directly. The container is the <svg> itself.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function AnalogStick(unit: xnew.Unit,
    { className = '', style = '' }:
    { className?: string, style?: string } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: block; box-sizing: border-box;
            cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;
            stroke: currentColor; stroke-opacity: 0.8; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
            fill: #FFF; fill-opacity: 0.8;
        `,
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 64 64', className: `${css.container} ${className}`, style });

    // static frame arrows
    xnew('<polygon points="32  7 27 13 37 13">');
    xnew('<polygon points="32 57 27 51 37 51">');
    xnew('<polygon points=" 7 32 13 27 13 37">');
    xnew('<polygon points="57 32 51 27 51 37">');

    // movable knob, shifted in viewBox units (its travel radius is a quarter of the 64-unit span = 16)
    const target = xnew('<circle cx="32" cy="32" r="14">');

    unit.on('dragstart dragmove', ({ type, position }: { type: string, position: { x: number, y: number } }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };

        target.element.setAttribute('transform', `translate(${vector.x * 16} ${vector.y * 16})`);
        target.element.style.filter = 'brightness(80%)';
        xnew.emit({ dragstart: '-down', dragmove: '-move' }[type] as string, { vector });
    });

    unit.on('dragend', () => {
        target.element.removeAttribute('transform');
        target.element.style.filter = '';
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}
