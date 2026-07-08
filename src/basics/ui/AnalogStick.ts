//----------------------------------------------------------------------------------------------------
// AnalogStick — virtual game-pad stick with a continuous radial vector
//
// Drag-based on-screen input that translates pointer movement into a normalized vector (x / y in
// [-1, 1]) and emits it as '-down' / '-move' / '-up' so parent components can react without
// touching DOM events directly. The visual stick follows the pointer within a radius.
//
// - AnalogStick : component({ stroke, fill, ... }) emitting '-down' / '-move' / '-up' with { vector }
//
// Usage: xnew(xbasics.AnalogStick).on('-move', ({ vector }) => move(vector));
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from '../element/SVG';
import { sharedCss } from '../styles';
import { Aspect } from '../view/Aspect';

export function AnalogStick(unit: xnew.Unit,
    { stroke = 'currentColor', strokeOpacity = 0.8, strokeWidth = 1, fill = '#FFF', fillOpacity = 0.8 }:
    { stroke?: string, strokeOpacity?: number, strokeWidth?: number, fill?: string, fillOpacity?: number } = {}
) {
    const cls = xnew.css(sharedCss);
    xnew.extend(Aspect, { aspect: 1.0, fit: 'contain' });
    xnew.nest(`<div class="${cls.touchArea}">`);

    xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { className: cls.overlay, stroke, strokeOpacity, strokeWidth, fill, fillOpacity });
        xnew('<polygon points="32  7 27 13 37 13">');
        xnew('<polygon points="32 57 27 51 37 51">');
        xnew('<polygon points=" 7 32 13 27 13 37">');
        xnew('<polygon points="57 32 51 27 51 37">');
    });

    const target = xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { className: cls.overlay, stroke, strokeOpacity, strokeWidth, fill, fillOpacity });
        xnew('<circle cx="32" cy="32" r="14">');
    });

    unit.on('dragstart dragmove', ({ type, position }: { type: string, position: { x: number, y: number } }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };

        Object.assign(target.element.style, { filter: 'brightness(80%)', left: `${vector.x * size / 4}px`, top: `${vector.y * size / 4}px` });
        const nexttype = { dragstart: '-down', dragmove: '-move' }[type] as string;
        xnew.emit(nexttype, { vector });
    });

    unit.on('dragend', () => {
        Object.assign(target.element.style, { filter: '', left: '0px', top: '0px' });
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}
