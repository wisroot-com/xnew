//----------------------------------------------------------------------------------------------------
// VectorPad — drag-driven directional input driver shared by AnalogStick / DPad
// Converts a pointer drag into a direction vector and emits it as -down / -move / -up ({ vector });
// `type` quantizes the vector: 'analog' (continuous), '8way' (8 directions), '4way' (4 directions).
// The container is the <svg> itself; presentation components extend this and draw into it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function VectorPad(unit: xnew.Unit,
    { type = 'analog', className = '', style = '' }:
    { type?: 'analog' | '4way' | '8way', className?: string, style?: string } = {}
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

    unit.on('dragstart dragmove', ({ type: event, position }: { type: string, position: { x: number, y: number } }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        if (type === '8way') {
            vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
            vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
        } else if (type === '4way') {
            if (Math.abs(vector.x) > Math.abs(vector.y)) {
                vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
                vector.y = 0;
            } else {
                vector.x = 0;
                vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
            }
        }
        xnew.emit({ dragstart: '-down', dragmove: '-move' }[event] as string, { vector });
    });

    unit.on('dragend', () => {
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}
