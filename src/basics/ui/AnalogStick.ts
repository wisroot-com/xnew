//----------------------------------------------------------------------------------------------------
// AnalogStick — virtual game-pad stick with a continuous radial vector
//
// Drag-based on-screen input that translates pointer movement into a normalized vector (x / y in
// [-1, 1]) and emits it as '-down' / '-move' / '-up' so parent components can react without
// touching DOM events directly. The visual stick follows the pointer within a radius.
//
// - AnalogStick : component({ className, style, designs }) emitting '-down' / '-move' / '-up'
//                 with { vector }; className / style decorate the pointer-operated container;
//                 designs: { svg? } — a Design ({ className?, style? }) applied to the SVG layers;
//                 returns { get container }
//
// Usage: xnew(xbasics.AnalogStick).on('-move', ({ vector }) => move(vector));
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from '../element/Container';
import { SVG } from '../element/SVG';
import { Aspect } from '../view/Aspect';
import { Design } from '../design';

// full-size stacked SVG layers
const overlay = 'position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box;';

export function AnalogStick(unit: xnew.Unit,
    { className = '', style = '', designs = {} }:
    { className?: string, style?: string, designs?: { svg?: Design } } = {}
) {
    xnew.extend(Aspect, { aspect: 1.0, fit: 'contain' });

    // pointer-operated surface
    xnew.extend(Container, {
        base: 'width: 100%; height: 100%; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;',
        className, style,
    });

    // default look inline on the svg parts; the caller's designs.svg declarations come later, so they win
    const svg: Design = { className: designs.svg?.className, style: `stroke: currentColor; stroke-opacity: 0.8; fill: #FFF; fill-opacity: 0.8; ${designs.svg?.style ?? ''}` };

    xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { style: overlay, designs: { svg } });
        xnew('<polygon points="32  7 27 13 37 13">');
        xnew('<polygon points="32 57 27 51 37 51">');
        xnew('<polygon points=" 7 32 13 27 13 37">');
        xnew('<polygon points="57 32 51 27 51 37">');
    });

    const target = xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { style: overlay, designs: { svg } });
        xnew('<circle cx="32" cy="32" r="14">');
    });

    unit.on('dragstart dragmove', ({ type, position }: { type: string, position: { x: number, y: number } }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };

        // the overlay (position: absolute) sits on the SVG's container, so the move targets it
        Object.assign(target.container.style, { filter: 'brightness(80%)', left: `${vector.x * size / 4}px`, top: `${vector.y * size / 4}px` });
        xnew.emit({ dragstart: '-down', dragmove: '-move' }[type] as string, { vector });
    });

    unit.on('dragend', () => {
        Object.assign(target.container.style, { filter: '', left: '0px', top: '0px' });
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}
