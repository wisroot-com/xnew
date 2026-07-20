//----------------------------------------------------------------------------------------------------
// DPad — virtual game-pad directional pad with a quantized 4 or 8 way vector
// Extends VectorPad ('8way' / '4way') for input; draws 4 quadrants that
// highlight per direction on -down / -move and clear on -up.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { VectorPad } from './VectorPad';

export function DPad(unit: xnew.Unit,
    { type = '8way', className = '', style = '' }:
    { type?: '4way' | '8way', className?: string, style?: string } = {}
) {
    xnew.extend(VectorPad, { type, className, style });

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
