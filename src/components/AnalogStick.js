import { xnew, xnest } from '../core/xnew';
import { PointerEvent } from './PointerEvent';

export function AnalogStick(xnode, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    xnest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

    xnew({ tagName: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <polygon points="50  7 40 18 60 18"></polygon>
        <polygon points="50 93 40 83 60 83"></polygon>
        <polygon points=" 7 50 18 40 18 60"></polygon>
        <polygon points="93 50 83 40 83 60"></polygon>
    `);
    const target = xnew({ tagName: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="23"></circle>
    `);

    const pointer = xnew(PointerEvent);

    pointer.on('down dragmove', (event, { type, position }) => {
        target.element.style.filter = 'brightness(90%)';

        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        xnode.emit(type, event, { type, vector });
        target.element.style.left = vector.x * size / 4 + 'px';
        target.element.style.top = vector.y * size / 4 + 'px';
    });

    pointer.on('dragup', (event, { type }) => {
        target.element.style.filter = '';

        const vector = { x: 0, y: 0 };
        xnode.emit(type, event, { type, vector });
        target.element.style.left = vector.x * size / 4 + 'px';
        target.element.style.top = vector.y * size / 4 + 'px';
    });
}
