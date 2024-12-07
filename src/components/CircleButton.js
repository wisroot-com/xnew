import { xnew, xnest } from '../core/xnew';
import { PointerEvent } from './PointerEvent';

export function CircleButton(xnode, { size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    xnest({ style: `position: relative; width: ${size}px; height: ${size}px; user-select: none;`, });
    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke-linejoin: round; stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)};`;

    const target = xnew({ tagName: 'svg', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

    const pointer = xnew(target, PointerEvent);

    pointer.on('down', (event, ex) => {
        target.element.style.filter = 'brightness(90%)';
        xnode.emit('down', event, ex);
    });
    pointer.on('up', (event, ex) => {
        target.element.style.filter = '';
        xnode.emit('up', event, ex);
    });
}

