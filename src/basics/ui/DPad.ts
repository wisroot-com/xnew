//----------------------------------------------------------------------------------------------------
// DPad — virtual game-pad directional pad with a quantized 4 or 8 way vector
//
// Drag-based on-screen input that translates pointer movement into a quantized vector (x / y in
// {-1, 0, 1}) and emits it as '-down' / '-move' / '-up'; the active arrow segment is highlighted.
// `diagonal: false` restricts to 4 directions.
//
// - DPad : component({ diagonal, stroke, fill, ... }) emitting '-down' / '-move' / '-up' with { vector }
//
// Usage: xnew(xbasics.DPad, { diagonal: false }).on('-move', ({ vector }) => move(vector));
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from '../element/SVG';
import { Aspect } from '../view/Aspect';

export function DPad(unit: xnew.Unit,
    { diagonal = true, stroke = 'currentColor', strokeOpacity = 0.8, strokeWidth = 1, fill = '#FFF', fillOpacity = 0.8 }:
    { diagonal?: boolean, stroke?: string, strokeOpacity?: number, strokeWidth?: number, fill?: string, fillOpacity?: number } = {}
) {
    xnew.extend(Aspect, { aspect: 1.0, fit: 'contain' });
    xnew.nest(`<div style="width: 100%; height: 100%; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;">`);

    const polygons = [
        '<polygon points="32 32 23 23 23  4 24  3 40  3 41  4 41 23">',
        '<polygon points="32 32 23 41 23 60 24 61 40 61 41 60 41 41">',
        '<polygon points="32 32 23 23  4 23  3 24  3 40  4 41 23 41">',
        '<polygon points="32 32 41 23 60 23 61 24 61 40 60 41 41 41">'
    ];

    const targets = polygons.map((polygon) => {
        return xnew((unit: xnew.Unit) => {
            xnew.extend(SVG, { style: 'position: absolute; width: 100%; height: 100%;', fill, fillOpacity });
            xnew(polygon);
        });
    });

    xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { style: 'position: absolute; width: 100%; height: 100%;', stroke, strokeOpacity, strokeWidth });
        xnew('<polyline points="23 23 23  4 24  3 40  3 41  4 41 23">');
        xnew('<polyline points="23 41 23 60 24 61 40 61 41 60 41 41">');
        xnew('<polyline points="23 23  4 23  3 24  3 40  4 41 23 41">');
        xnew('<polyline points="41 23 60 23 61 24 61 40 60 41 41 41">');
        xnew('<polygon points="32  7 27 13 37 13">');
        xnew('<polygon points="32 57 27 51 37 51">');
        xnew('<polygon points=" 7 32 13 27 13 37">');
        xnew('<polygon points="57 32 51 27 51 37">');
    });

    unit.on('dragstart dragmove', ({ type, position }: { type: string, position: { x: number, y: number } }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        if (diagonal === true) {
            vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
            vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
        } else if (Math.abs(vector.x) > Math.abs(vector.y)) {
            vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
            vector.y = 0;
        } else {
            vector.x = 0;
            vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
        }

        targets[0].element.style.filter = (vector.y < 0) ? 'brightness(80%)' : '';
        targets[1].element.style.filter = (vector.y > 0) ? 'brightness(80%)' : '';
        targets[2].element.style.filter = (vector.x < 0) ? 'brightness(80%)' : '';
        targets[3].element.style.filter = (vector.x > 0) ? 'brightness(80%)' : '';
        const nexttype = { dragstart: '-down', dragmove: '-move' }[type] as string;
        xnew.emit(nexttype, { vector });
    });

    unit.on('dragend', () => {
        targets[0].element.style.filter = '';
        targets[1].element.style.filter = '';
        targets[2].element.style.filter = '';
        targets[3].element.style.filter = '';
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}
