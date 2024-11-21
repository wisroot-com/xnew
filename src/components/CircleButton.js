import { xnew } from '../core/xnew';

export function CircleButton(xnode, { size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    xnode.nest({ style: `position: relative; width: ${size}px; height: ${size}px; user-select: none;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke-linejoin: round; stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)};`;

    const target = xnew({ tag: 'svg', name: 'target', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

    target.on('pointerdown', down);

    // prevent touch default event
    target.on('touchstart', (event) => {
        event.preventDefault();
    });

    function down(event) {
        target.element.style.filter = 'brightness(90%)';
        const type = 'down';
        xnode.emit(type, event, { type });

        window.addEventListener('pointerup', up);
    }
    function up(event) {
        target.element.style.filter = '';
        const type = 'up';
        xnode.emit(type, event, { type });

        window.removeEventListener('pointerup', up);
    }

    return {
        finalize() {
            window.removeEventListener('pointerup', up);
        },
    }
}

