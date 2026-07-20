//----------------------------------------------------------------------------------------------------
// VirtualPad — on-screen virtual game-pad input
// Converts a pointer drag into a direction vector and emits it as -down / -move / -up ({ vector });
// `type` sets both the quantization and the default UI: 'analog' (continuous stick + knob),
// '8way' / '4way' (quantized directional pad). The default UI is drawn only when standalone
// (xnew.standalone), so a caller can compose its own visuals instead. The container is the <svg>.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function VirtualPad(unit: xnew.Unit,
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

    // default UI, switched by type — drawn only when standalone so a caller can compose its own instead
    if (xnew.standalone === true) {
        if (type === 'analog') {
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
        } else {
            const polygons = [
                '<polygon points="32 32 23 23 23  4 24  3 40  3 41  4 41 23">',
                '<polygon points="32 32 23 41 23 60 24 61 40 61 41 60 41 41">',
                '<polygon points="32 32 23 23  4 23  3 24  3 40  4 41 23 41">',
                '<polygon points="32 32 41 23 60 23 61 24 61 40 60 41 41 41">'
            ];

            // fill quadrants (stroke disabled); each highlights independently
            let targets: xnew.Unit[] = [];
            xnew(() => {
                xnew.nest('<g style="stroke: none;">');
                targets = polygons.map((polygon) => xnew(polygon));
            });

            // stroke outline plus center arrows (fill disabled)
            xnew(() => {
                xnew.nest('<g style="fill: none;">');
                xnew('<polyline points="23 23 23  4 24  3 40  3 41  4 41 23">');
                xnew('<polyline points="23 41 23 60 24 61 40 61 41 60 41 41">');
                xnew('<polyline points="23 23  4 23  3 24  3 40  4 41 23 41">');
                xnew('<polyline points="41 23 60 23 61 24 61 40 60 41 41 41">');
                xnew('<polygon points="32  7 27 13 37 13">');
                xnew('<polygon points="32 57 27 51 37 51">');
                xnew('<polygon points=" 7 32 13 27 13 37">');
                xnew('<polygon points="57 32 51 27 51 37">');
            });

            unit.on('-down -move', ({ vector }: { vector: { x: number, y: number } }) => {
                targets[0].element.style.filter = (vector.y < 0) ? 'brightness(80%)' : '';
                targets[1].element.style.filter = (vector.y > 0) ? 'brightness(80%)' : '';
                targets[2].element.style.filter = (vector.x < 0) ? 'brightness(80%)' : '';
                targets[3].element.style.filter = (vector.x > 0) ? 'brightness(80%)' : '';
            });
            unit.on('-up', () => {
                targets[0].element.style.filter = '';
                targets[1].element.style.filter = '';
                targets[2].element.style.filter = '';
                targets[3].element.style.filter = '';
            });
        }
    }
}
