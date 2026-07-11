//----------------------------------------------------------------------------------------------------
// AnalogStick — virtual game-pad stick with a continuous radial vector
// Translates pointer drags into a normalized vector (x / y in [-1, 1]) emitted as events,
// so parent components react without touching DOM events directly.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from '../element/Container';
import { Design } from '../design';

export function AnalogStick(unit: xnew.Unit,
    { className = '', style = '', designs = {} }:
    { className?: string, style?: string, designs?: { svg?: Design } } = {}
) {
    xnew.extend(Container, {
        base: 'position: relative; width: 100%; height: 100%; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;',
        className, style,
    });

    const css = xnew.css({
        svg: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; box-sizing: border-box; display: block; width: 100%; height: 100%;
                stroke: currentColor; stroke-opacity: 0.8; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: #FFF; fill-opacity: 0.8;
            `,
        },
    });
    const svg = { tag: 'svg', viewBox: '0 0 64 64', className: `${css.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style };

    xnew((unit: xnew.Unit) => {
        xnew.nest(svg);
        xnew('<polygon points="32  7 27 13 37 13">');
        xnew('<polygon points="32 57 27 51 37 51">');
        xnew('<polygon points=" 7 32 13 27 13 37">');
        xnew('<polygon points="57 32 51 27 51 37">');
    });

    const target = xnew((unit: xnew.Unit) => {
        xnew.nest(svg);
        xnew('<circle cx="32" cy="32" r="14">');
    });

    unit.on('dragstart dragmove', ({ type, position }: { type: string, position: { x: number, y: number } }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };

        // the <svg> itself is position: absolute, so the knob moves via its left / top
        Object.assign(target.element.style, { filter: 'brightness(80%)', left: `${vector.x * size / 4}px`, top: `${vector.y * size / 4}px` });
        xnew.emit({ dragstart: '-down', dragmove: '-move' }[type] as string, { vector });
    });

    unit.on('dragend', () => {
        Object.assign(target.element.style, { filter: '', left: '0px', top: '0px' });
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}
